import { circularMean, compassPoint, type AppResortData, type AppRun, type AppTreeArea, type Lift, type LonLat, type Run, type Segment, type Zone } from "@snowline/core";
import { existsSync } from "node:fs";
import { dataPath, loadResort, readJson, writeJson } from "../resort.ts";
import type { TreeArea } from "../treeAreas.ts";

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const roundLL = ([lon, lat]: LonLat): LonLat => [round(lon, 5), round(lat, 5)];

/** Douglas-Peucker on lon/lat, with a tolerance in degrees (~1e-4 ≈ 10 m). */
export function simplify(line: LonLat[], tol: number): LonLat[] {
  if (line.length < 3) return line;
  const [a, b] = [line[0]!, line[line.length - 1]!];
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < line.length - 1; i++) {
    const p = line[i]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1e-18;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
    const d = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
    if (d > maxD) [maxD, idx] = [d, i];
  }
  if (maxD <= tol) return [a, b];
  return [...simplify(line.slice(0, idx + 1), tol).slice(0, -1), ...simplify(line.slice(idx), tol)];
}

/** Mixed-aspect runs: group segments by compass sector, keep sectors with at least 10% of the length (max 4). */
export function aspectParts(segments: Segment[]): { aspectDeg: number; pitchDeg: number; weight: number }[] {
  const total = segments.reduce((t, s) => t + s.lengthM, 0);
  const bySector = new Map<string, Segment[]>();
  for (const s of segments) bySector.set(compassPoint(s.aspectDeg), [...(bySector.get(compassPoint(s.aspectDeg)) ?? []), s]);
  return [...bySector.values()]
    .map((segs) => {
      const len = segs.reduce((t, s) => t + s.lengthM, 0);
      return {
        aspectDeg: Math.round(circularMean(segs.map((s) => s.aspectDeg), segs.map((s) => s.lengthM))),
        pitchDeg: round(segs.reduce((t, s) => t + s.pitchDeg * s.lengthM, 0) / len, 1),
        weight: round(len / total, 3),
      };
    })
    .filter((p) => p.weight >= 0.1)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);
}

function profile(run: Run): [number, number][] {
  if (run.geometry === "area") return [];
  const pts: [number, number][] = [];
  let d = 0;
  for (const s of run.segments) {
    pts.push([Math.round(d + s.lengthM / 2), s.elevationFt]);
    d += s.lengthM;
  }
  // Downhill left to right, whichever way OSM drew the line.
  if (pts.length > 1 && pts[0]![1] < pts[pts.length - 1]![1]) {
    const total = d;
    return pts.reverse().map(([x, y]) => [Math.round(total - x), y]);
  }
  return pts;
}

export async function exportApp(resortId: string) {
  const cfg = await loadResort(resortId);
  const runs = await readJson<Run[]>(dataPath(cfg.id, "runs.json"));
  const zones = await readJson<Zone[]>(dataPath(cfg.id, "zones.json"));
  const lifts = await readJson<Lift[]>(dataPath(cfg.id, "lifts.json"));

  const appRuns: AppRun[] = runs
    .filter((r): r is Run & { name: string } => !!r.name)
    .map((r) => ({
      id: r.id,
      name: r.name,
      difficulty: r.difficulty,
      type: r.type,
      groomed: r.groomed,
      aspectDeg: r.aspectDeg,
      pitchDeg: r.pitchDeg,
      topFt: r.topFt,
      bottomFt: r.bottomFt,
      zone: r.zone,
      lengthM: r.lengthM,
      mixedAspect: r.mixedAspect,
      ...(r.canopyPct !== undefined ? { canopyPct: r.canopyPct, shelterPct: r.shelterPct } : {}),
      ...(r.mixedAspect ? { parts: aspectParts(r.segments) } : {}),
      geometry: r.geometry,
      lines: r.coordinates.map((c) => simplify(c, 0.00006).map(roundLL)),
      profile: profile(r),
      points: (r.segments.length > 60 ? r.segments.filter((_, i) => i % Math.ceil(r.segments.length / 60) === 0) : r.segments).map((s) => roundLL(s.at)),
    }));

  // Unmarked tree areas, scored like glades. Difficulty from pitch: they're never easy, being unmarked.
  const treeAreas: AppTreeArea[] = existsSync(dataPath(cfg.id, "treeAreas.json"))
    ? (await readJson<TreeArea[]>(dataPath(cfg.id, "treeAreas.json"))).map((a) => ({
        id: a.id,
        name: a.name,
        difficulty: a.pitchDeg >= 25 ? "expert" : "advanced",
        type: "tree",
        groomed: false,
        aspectDeg: a.aspectDeg,
        pitchDeg: a.pitchDeg,
        topFt: a.topFt,
        bottomFt: a.bottomFt,
        zone: a.zone,
        lengthM: 0,
        mixedAspect: false,
        canopyPct: a.canopyPct,
        shelterPct: a.shelterPct,
        geometry: "area",
        lines: [],
        profile: [],
        points: a.points,
        unmarked: true,
        areaHa: a.areaHa,
        polygons: a.polygons,
        hazards: a.hazards,
        nearRuns: a.nearRuns,
      }))
    : [];

  const all = appRuns.flatMap((r) => r.lines.flat());
  const lons = all.map((p) => p[0]);
  const lats = all.map((p) => p[1]);
  const data: AppResortData = {
    version: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    resort: {
      id: cfg.id,
      name: cfg.name,
      region: cfg.region ?? null,
      pass: cfg.pass ?? null,
      avalanche: cfg.avalanche ?? null,
      opensnowSlug: cfg.opensnow?.slug ?? null,
      tz: cfg.tz,
      openHour: cfg.hours?.open ?? 8.5,
      closeHour: cfg.hours?.close ?? 16,
      treelineFt: cfg.treelineFt,
      base: cfg.base,
      summit: cfg.summit,
      bounds: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)].map((n) => round(n, 4)) as [number, number, number, number],
    },
    zones: zones.map((z) => ({
      id: z.id,
      name: z.name,
      aspectDeg: Math.round(z.aspectDeg),
      topFt: z.topFt,
      bottomFt: z.bottomFt,
      windExposed: z.windExposed,
      lifts: z.lifts,
      ...(z.springHeadStartHours ? { springHeadStartHours: z.springHeadStartHours } : {}),
    })),
    lifts: lifts.filter((l) => l.kind !== "station").map((l) => ({ name: l.name, kind: l.kind, line: l.coordinates.map(roundLL) })),
    runs: appRuns,
    treeAreas,
  };
  await writeJson(dataPath(cfg.id, "app.json"), data);
  console.log(`  app.json: ${appRuns.length} runs, ${treeAreas.length} tree areas, ${data.zones.length} zones, ${(JSON.stringify(data).length / 1024).toFixed(0)} KB`);
}

if (import.meta.url === `file://${process.argv[1]}`) await exportApp(process.argv[2]!);
