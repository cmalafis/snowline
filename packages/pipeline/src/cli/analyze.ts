import { mToFt, type LonLat, type Lift, type ResortConfig, type Run } from "@snowline/core";
import type { OsmDump } from "../sources/overpass.ts";
import { loadDem, utmEpsg, utmProjection, type Projection, type Raster } from "../sources/dem.ts";
import { analyzeRun, buildRawRuns, normName } from "../terrain.ts";
import { classifyRun } from "../runType.ts";
import { assignLift, buildZones, zoneIdForLift, zoneLifts } from "../zones.ts";
import { analysisConfig, dataPath, loadResort, readJson, writeJson } from "../resort.ts";
import { loadCanopy, type CanopyGrid } from "../sources/canopy.ts";

/** Trees within this distance shelter a run from wind and give it definition in flat light. */
const SHELTER_RADIUS_M = 75;

/** Length-weighted canopy on and around a run, or nothing when canopy data is unavailable. */
function canopyMeans(segments: { at: LonLat; lengthM: number }[], canopy: CanopyGrid | null): { canopyPct?: number; shelterPct?: number } {
  if (!canopy) return {};
  let on = 0;
  let around = 0;
  let len = 0;
  for (const s of segments) {
    const a = canopy.at(s.at);
    const b = canopy.around(s.at, SHELTER_RADIUS_M);
    if (a === null || b === null) continue;
    on += a * s.lengthM;
    around += b * s.lengthM;
    len += s.lengthM;
  }
  return len ? { canopyPct: Math.round(on / len), shelterPct: Math.round(around / len) } : {};
}

/** Projected bbox covering the ski-area boundary (or the config bbox) plus a buffer. */
function demBbox(cfg: ResortConfig, osm: OsmDump, proj: Projection): [number, number, number, number] {
  const [s, w, n, e] = cfg.osm.bbox;
  const pts: LonLat[] = [[w, s], [e, s], [e, n], [w, n]];
  for (const ring of osm.boundary) pts.push(...ring);
  for (const way of [...osm.pistes, ...osm.lifts]) for (const g of way.geometry) pts.push([g.lon, g.lat]);
  const xy = pts.map(proj.toXY);
  const pad = 300;
  return [
    Math.floor(Math.min(...xy.map((p) => p[0])) - pad),
    Math.floor(Math.min(...xy.map((p) => p[1])) - pad),
    Math.ceil(Math.max(...xy.map((p) => p[0])) + pad),
    Math.ceil(Math.max(...xy.map((p) => p[1])) + pad),
  ];
}

function buildLifts(osm: OsmDump, dem: Raster, proj: Projection): Lift[] {
  return osm.lifts
    .filter((w) => w.geometry.length >= 2)
    .map((w) => {
      const c: LonLat[] = w.geometry.map((g) => [g.lon, g.lat]);
      const elev = (p: LonLat) => mToFt(dem.elevation(...proj.toXY(p)));
      // OSM lifts should point uphill, but don't trust it.
      const [bottom, top] = elev(c[0]!) <= elev(c[c.length - 1]!) ? [c[0]!, c[c.length - 1]!] : [c[c.length - 1]!, c[0]!];
      return {
        id: `osm-way-${w.id}`,
        osmId: w.id,
        name: w.tags.name ?? null,
        kind: w.tags.aerialway!,
        coordinates: c,
        bottom,
        top,
        bottomFt: elev(bottom),
        topFt: elev(top),
      };
    });
}

export async function analyze(resortId: string) {
  const cfg = await loadResort(resortId);
  const acfg = analysisConfig(cfg);
  const osm = await readJson<OsmDump>(dataPath(cfg.id, "osm.json"));
  const epsg = utmEpsg(cfg.summit.lon, cfg.summit.lat);
  const proj = utmProjection(epsg);

  console.log(`Loading DEM for ${cfg.name} (EPSG:${epsg})...`);
  const raw = await loadDem({ bbox: demBbox(cfg, osm, proj), epsg, cellSize: 10, cacheFile: dataPath(cfg.id, "dem.tif") }, proj);
  console.log(`  ${raw.width}x${raw.height} cells at ${raw.cellSize} m from ${raw.source}`);
  const dem = raw.smoothed(acfg.smoothingRadiusM);
  const [minX, minY, maxX, maxY] = demBbox(cfg, osm, proj);
  const sw = proj.toLonLat([minX, minY]);
  const ne = proj.toLonLat([maxX, maxY]);
  const canopy = await loadCanopy([sw[0] - 0.002, sw[1] - 0.002, ne[0] + 0.002, ne[1] + 0.002], dataPath(cfg.id, "canopy.tif"));
  if (canopy) console.log(`  tree canopy: ${canopy.width}x${canopy.height} cells at 30 m (NLCD 2021)`);

  const lifts = buildLifts(osm, raw, proj);
  const candidates = zoneLifts(lifts, cfg);
  const overrides = new Map(Object.entries(cfg.runOverrides ?? {}).map(([k, v]) => [normName(k), v]));

  const runs: Run[] = [];
  for (const r of buildRawRuns(osm.pistes)) {
    // "osm:<way id>" targets one way when two runs share a name; otherwise match by run name.
    const ov = r.osmIds.map((id) => cfg.runOverrides?.[`osm:${id}`]).find(Boolean) ?? (r.name ? overrides.get(normName(r.name)) : undefined);
    if (ov?.exclude) continue;
    const t = analyzeRun(r, dem, proj, acfg);
    if (!t) {
      console.warn(`  skipped ${r.name ?? r.osmIds.join(",")}: outside DEM`);
      continue;
    }
    const lift = assignLift(t, candidates, acfg.liftTopMatchRadiusM, proj);
    const type = ov?.type ?? classifyRun(r, t.topFt, cfg.treelineFt);
    runs.push({
      id: `${cfg.id}-${r.name ? normName(r.name).replace(/ /g, "-") : "unnamed"}-${r.osmIds[0]}`,
      osmIds: r.osmIds,
      name: r.name,
      difficulty: ov?.difficulty ?? r.difficulty,
      grooming: r.grooming,
      type,
      // Without a grooming report, assume greens and blues get groomed; steeper groomers need an override.
      groomed:
        ov?.groomed ??
        (type === "groomer" && r.grooming !== "backcountry" && ["novice", "easy", "intermediate"].includes(ov?.difficulty ?? r.difficulty)),
      geometry: r.geometry,
      coordinates: r.chains,
      lengthM: Math.round(t.lengthM),
      topFt: Math.round(t.topFt),
      bottomFt: Math.round(t.bottomFt),
      pitchDeg: +t.pitchDeg.toFixed(1),
      ...canopyMeans(t.segments, canopy),
      aspectDeg: Math.round(ov?.aspect ?? t.aspectDeg),
      aspectSpreadDeg: Math.round(t.aspectSpreadDeg),
      mixedAspect: t.mixedAspect,
      zone: ov?.zone ?? (lift ? zoneIdForLift(lift, cfg) : null),
      segments: t.segments.map((s) => ({
        ...s,
        at: [+s.at[0].toFixed(6), +s.at[1].toFixed(6)] as LonLat,
        lengthM: Math.round(s.lengthM),
        elevationFt: Math.round(s.elevationFt),
        pitchDeg: +s.pitchDeg.toFixed(1),
        aspectDeg: Math.round(s.aspectDeg),
        lineBearingDeg: Math.round(s.lineBearingDeg),
        ...(canopy ? { canopyPct: Math.round(canopy.at(s.at) ?? 0), shelterPct: Math.round(canopy.around(s.at, SHELTER_RADIUS_M) ?? 0) } : {}),
      })),
      demSource: raw.source,
      tags: r.tags,
    });
  }

  const zones = buildZones(runs, lifts, cfg);
  await writeJson(dataPath(cfg.id, "runs.json"), runs);
  await writeJson(dataPath(cfg.id, "lifts.json"), lifts);
  await writeJson(dataPath(cfg.id, "zones.json"), zones);
  console.log(`  ${runs.length} runs (${runs.filter((r) => r.name).length} named), ${lifts.length} lifts, ${zones.length} zones`);
}

if (import.meta.url === `file://${process.argv[1]}`) await analyze(process.argv[2]!);
