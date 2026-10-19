import {
  aspectSpread,
  bearingDeg,
  circularMean,
  haversineM,
  mToFt,
  pointInPolygon,
  type AnalysisConfig,
  type Difficulty,
  type LonLat,
  type Segment,
} from "@snowline/core";
import type { OsmWay } from "./sources/overpass.ts";
import { slopeAt, type Projection, type Raster } from "./sources/dem.ts";

export interface RawRun {
  osmIds: number[];
  name: string | null;
  difficulty: Difficulty;
  grooming: string | null;
  geometry: "line" | "area";
  chains: LonLat[][];
  tags: Record<string, string>;
}

const DIFFICULTIES: Difficulty[] = ["novice", "easy", "intermediate", "advanced", "expert", "freeride", "extreme"];
const toDifficulty = (v: string | undefined): Difficulty => (DIFFICULTIES.includes(v as Difficulty) ? (v as Difficulty) : "unknown");

const coords = (w: OsmWay): LonLat[] => w.geometry.map((p) => [p.lon, p.lat]);
const isClosed = (c: LonLat[]) => c.length > 3 && haversineM(c[0]!, c[c.length - 1]!) < 1;

/** Join chains whose endpoints touch (within `tolM`), reversing as needed. */
export function joinChains(chains: LonLat[][], tolM = 20): LonLat[][] {
  const out = chains.map((c) => [...c]);
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < out.length; i++)
      for (let j = 0; j < out.length; j++) {
        if (i === j) continue;
        const a = out[i]!;
        const b = out[j]!;
        const join = (x: LonLat[], y: LonLat[]) => {
          out[i] = [...x, ...y.slice(1)];
          out.splice(j, 1);
          merged = true;
        };
        if (haversineM(a[a.length - 1]!, b[0]!) < tolM) join(a, b);
        else if (haversineM(a[a.length - 1]!, b[b.length - 1]!) < tolM) join(a, [...b].reverse());
        else if (haversineM(a[0]!, b[b.length - 1]!) < tolM) join(b, a);
        else if (haversineM(a[0]!, b[0]!) < tolM) join([...a].reverse(), b);
        else continue;
        break outer;
      }
  }
  return out;
}

/** Normalise a run name for grouping and matching: case, punctuation, apostrophes, "Lift Line" spacing. */
export function normName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/lift\s*line/g, "liftline")
    .replace(/cut\s*off/g, "cutoff")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Group OSM piste ways into runs. Line ways with the same name and difficulty become one run
 * (OSM often splits a run at junctions). Closed ways tagged as areas stay separate.
 */
export function buildRawRuns(pistes: OsmWay[]): RawRun[] {
  const groups = new Map<string, OsmWay[]>();
  const runs: RawRun[] = [];
  for (const w of pistes) {
    const c = coords(w);
    const area = w.tags.area === "yes" || (isClosed(c) && w.tags.area !== "no");
    if (area || !w.tags.name) {
      runs.push({
        osmIds: [w.id],
        name: w.tags.name ?? null,
        difficulty: toDifficulty(w.tags["piste:difficulty"]),
        grooming: w.tags["piste:grooming"] ?? null,
        geometry: area ? "area" : "line",
        chains: [c],
        tags: w.tags,
      });
      continue;
    }
    const key = `${normName(w.tags.name)}|${w.tags["piste:difficulty"] ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), w]);
  }
  // Ways missing a difficulty tag (often short connectors) join a same-named run that has one.
  for (const [key, ways] of [...groups]) {
    if (!key.endsWith("|")) continue;
    const name = key.slice(0, -1);
    const target = [...groups.keys()].find((k) => k !== key && k.startsWith(`${name}|`));
    if (target) {
      groups.get(target)!.push(...ways);
      groups.delete(key);
    }
  }
  for (const ways of groups.values()) {
    const first = ways[0]!;
    runs.push({
      osmIds: ways.map((w) => w.id),
      name: first.tags.name!,
      difficulty: toDifficulty(ways.map((w) => w.tags["piste:difficulty"]).find(Boolean)),
      grooming: ways.map((w) => w.tags["piste:grooming"]).find(Boolean) ?? null,
      geometry: "line",
      chains: joinChains(ways.map(coords)),
      tags: Object.assign({}, ...ways.map((w) => w.tags)),
    });
  }
  return runs;
}

/** Cut a polyline into pieces of ~`step` metres; a short tail is folded into the last piece. */
export function resample(chain: [number, number][], step: number): { mid: [number, number]; a: [number, number]; b: [number, number]; length: number }[] {
  const pts: [number, number][] = [chain[0]!];
  let carry = 0;
  for (let i = 1; i < chain.length; i++) {
    const [x0, y0] = chain[i - 1]!;
    const [x1, y1] = chain[i]!;
    const d = Math.hypot(x1 - x0, y1 - y0);
    let t = step - carry;
    while (t <= d) {
      pts.push([x0 + ((x1 - x0) * t) / d, y0 + ((y1 - y0) * t) / d]);
      t += step;
    }
    carry = d - (t - step);
  }
  const last = chain[chain.length - 1]!;
  if (carry > step * 0.3 || pts.length === 1) pts.push(last);
  else pts[pts.length - 1] = last;
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    out.push({ a, b, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number], length: Math.hypot(b[0] - a[0], b[1] - a[1]) });
  }
  return out;
}

/** Grid points inside an area piste, standing in for segments. Each sample carries an equal share of the area's extent. */
function areaSamples(ring: [number, number][], spacing: number): [number, number][] {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const pts: [number, number][] = [];
  for (let x = Math.min(...xs) + spacing / 2; x < Math.max(...xs); x += spacing)
    for (let y = Math.min(...ys) + spacing / 2; y < Math.max(...ys); y += spacing) if (pointInPolygon([x, y], ring)) pts.push([x, y]);
  return pts;
}

export interface RunTerrain {
  segments: Segment[];
  lengthM: number;
  topFt: number;
  bottomFt: number;
  top: LonLat;
  bottom: LonLat;
  pitchDeg: number;
  aspectDeg: number;
  aspectSpreadDeg: number;
  mixedAspect: boolean;
}

export function analyzeRun(run: RawRun, dem: Raster, proj: Projection, cfg: AnalysisConfig): RunTerrain | null {
  const segments: Segment[] = [];
  const sample = (xy: [number, number], lengthM: number, lineBearingDeg: number) => {
    if (!dem.contains(xy[0], xy[1])) return;
    const at = proj.toLonLat(xy);
    const s = slopeAt(dem, proj, at);
    segments.push({ at, lengthM, elevationFt: mToFt(s.elevationM), pitchDeg: s.pitchDeg, aspectDeg: s.aspectDeg, lineBearingDeg });
  };

  if (run.geometry === "area") {
    const ring = run.chains[0]!.map(proj.toXY);
    const spacing = cfg.segmentLengthM / 2;
    const pts = areaSamples(ring, spacing);
    for (const p of pts) sample(p, spacing, NaN);
  } else {
    for (const chain of run.chains) {
      if (chain.length < 2) continue;
      for (const seg of resample(chain.map(proj.toXY), cfg.segmentLengthM))
        sample(seg.mid, seg.length, bearingDeg(proj.toLonLat(seg.a), proj.toLonLat(seg.b)));
    }
  }
  if (segments.length === 0) return null;

  const lengthM = segments.reduce((t, s) => t + s.lengthM, 0);
  const topSeg = segments.reduce((m, s) => (s.elevationFt > m.elevationFt ? s : m));
  const bottomSeg = segments.reduce((m, s) => (s.elevationFt < m.elevationFt ? s : m));
  const pitchDeg = segments.reduce((t, s) => t + s.pitchDeg * s.lengthM, 0) / lengthM;

  // Aspect of near-flat ground is noise, so it doesn't vote; if the whole run is flat, everything votes.
  let voters = segments.filter((s) => s.pitchDeg >= cfg.minPitchForAspectDeg);
  if (voters.length === 0) voters = segments;
  const aspectDeg = circularMean(voters.map((s) => s.aspectDeg), voters.map((s) => s.lengthM));
  const aspectSpreadDeg = aspectSpread(voters.map((s) => s.aspectDeg), voters.map((s) => s.lengthM), cfg.aspectSpreadTrim);

  return {
    segments,
    lengthM,
    topFt: topSeg.elevationFt,
    bottomFt: bottomSeg.elevationFt,
    top: topSeg.at,
    bottom: bottomSeg.at,
    pitchDeg,
    aspectDeg: Number.isNaN(aspectDeg) ? 0 : aspectDeg,
    aspectSpreadDeg,
    mixedAspect: aspectSpreadDeg > cfg.mixedAspectSpreadDeg,
  };
}
