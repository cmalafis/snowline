import { circularMean, mToFt, pointInPolygon, pointSegmentDist, type LonLat, type Run, type Zone } from "@snowline/core";
import { slopeAt, type Projection, type Raster } from "./sources/dem.ts";
import type { CanopyGrid } from "./sources/canopy.ts";

/**
 * Unmarked tree areas: forest inside the ski-area boundary that is open enough and steep enough to ski but
 * isn't a mapped run. Found on a 30 m grid from tree canopy (NLCD) and the DEM, grouped into connected areas.
 * This is a best guess from 30 m data: it can't see cliffs, creeks, rocks, closures or ropes, so every area
 * carries cautions and the app keeps the layer off until the user accepts them.
 */

export interface TreeAreaConfig {
  cellM: number;
  /** Canopy band that's skiable: below it is open slope, above it is too tight. */
  minCanopyPct: number;
  maxCanopyPct: number;
  minPitchDeg: number;
  maxPitchDeg: number;
  /** Clearance from mapped runs (and inside area pistes) and from lift lines. */
  runClearanceM: number;
  liftClearanceM: number;
  minCells: number;
  minVerticalFt: number;
  /** Hazard thresholds. */
  cliffPitchDeg: number;
  exitDistanceM: number;
  boundaryWarnM: number;
  tightCanopyPct: number;
}

export const DEFAULT_TREE_AREAS: TreeAreaConfig = {
  cellM: 30,
  minCanopyPct: 25,
  maxCanopyPct: 70,
  minPitchDeg: 15,
  maxPitchDeg: 40,
  runClearanceM: 40,
  liftClearanceM: 30,
  minCells: 12,
  minVerticalFt: 150,
  cliffPitchDeg: 45,
  exitDistanceM: 90,
  boundaryWarnM: 90,
  tightCanopyPct: 55,
};

export interface TreeArea {
  id: string;
  name: string;
  zone: string | null;
  nearRuns: string[];
  areaHa: number;
  topFt: number;
  bottomFt: number;
  pitchDeg: number;
  aspectDeg: number;
  canopyPct: number;
  shelterPct: number;
  /** Area-specific hazards found in the data. */
  hazards: string[];
  /** Rectangles covering the area's cells (one polygon ring each). */
  polygons: LonLat[][];
  /** A sample of cell centres, for "near me". */
  points: LonLat[];
}

type XY = [number, number];

/** Buckets segments into a coarse grid so "distance to nearest run" stays fast. */
class SegmentIndex {
  private buckets = new Map<string, { a: XY; b: XY; tag: number }[]>();
  constructor(private size: number) {}
  private key(cx: number, cy: number) {
    return `${cx},${cy}`;
  }
  add(a: XY, b: XY, tag: number) {
    const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
    const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
    for (let cx = Math.floor(x0 / this.size); cx <= Math.floor(x1 / this.size); cx++)
      for (let cy = Math.floor(y0 / this.size); cy <= Math.floor(y1 / this.size); cy++) {
        const k = this.key(cx, cy);
        const list = this.buckets.get(k) ?? [];
        list.push({ a, b, tag });
        this.buckets.set(k, list);
      }
  }
  /** Nearest segment within `maxM`, or null. */
  nearest(p: XY, maxM: number): { d: number; tag: number } | null {
    let best: { d: number; tag: number } | null = null;
    const r = Math.ceil(maxM / this.size);
    const cx = Math.floor(p[0] / this.size);
    const cy = Math.floor(p[1] / this.size);
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++)
        for (const s of this.buckets.get(this.key(cx + dx, cy + dy)) ?? []) {
          const d = pointSegmentDist(p, s.a, s.b);
          if (d <= maxM && (!best || d < best.d)) best = { d, tag: s.tag };
        }
    return best;
  }
}

export function findTreeAreas(args: {
  resortId: string;
  boundary: [number, number][][];
  runs: Run[];
  zones: Zone[];
  liftLines: LonLat[][];
  /** Streams and rivers (OSM waterways). */
  waterways?: LonLat[][];
  dem: Raster;
  rawDem: Raster;
  canopy: CanopyGrid;
  proj: Projection;
  cfg?: Partial<TreeAreaConfig>;
}): TreeArea[] {
  const c = { ...DEFAULT_TREE_AREAS, ...args.cfg };
  const { proj, dem, rawDem, canopy } = args;
  const rings = args.boundary.filter((r) => r.length >= 4);
  if (!rings.length) return [];
  const inside = (p: LonLat) => rings.some((ring) => pointInPolygon(p, ring));

  // Mapped runs and lifts, in metres.
  const runIndex = new SegmentIndex(100);
  const named = args.runs.map((r, i) => ({ r, i }));
  for (const { r, i } of named)
    for (const chain of r.coordinates) {
      const xy = chain.map(proj.toXY);
      for (let k = 1; k < xy.length; k++) runIndex.add(xy[k - 1]!, xy[k]!, i);
    }
  const areaPistes = args.runs.filter((r) => r.geometry === "area").map((r) => r.coordinates[0]!);
  const liftIndex = new SegmentIndex(100);
  for (const line of args.liftLines) {
    const xy = line.map(proj.toXY);
    for (let k = 1; k < xy.length; k++) liftIndex.add(xy[k - 1]!, xy[k]!, 0);
  }
  const waterIndex = new SegmentIndex(100);
  for (const line of args.waterways ?? []) {
    const xy = line.map(proj.toXY);
    for (let k = 1; k < xy.length; k++) waterIndex.add(xy[k - 1]!, xy[k]!, 0);
  }
  const boundaryIndex = new SegmentIndex(100);
  for (const ring of rings) {
    const xy = ring.map(proj.toXY);
    for (let k = 1; k < xy.length; k++) boundaryIndex.add(xy[k - 1]!, xy[k]!, 0);
  }

  // Scan the boundary's bounding box.
  const all = rings.flat().map(proj.toXY);
  const minX = Math.min(...all.map((p) => p[0]));
  const maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1]));
  const maxY = Math.max(...all.map((p) => p[1]));
  const cols = Math.ceil((maxX - minX) / c.cellM);
  const rows = Math.ceil((maxY - minY) / c.cellM);
  interface Cell {
    col: number;
    row: number;
    xy: XY;
    at: LonLat;
    canopy: number;
    shelter: number;
    pitch: number;
    rawPitch: number;
    aspect: number;
    elevFt: number;
  }
  const cells = new Map<number, Cell>();
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const xy: XY = [minX + (col + 0.5) * c.cellM, maxY - (row + 0.5) * c.cellM];
      if (!dem.contains(xy[0], xy[1])) continue;
      const at = proj.toLonLat(xy);
      if (!inside(at)) continue;
      const cov = canopy.at(at);
      if (cov === null || cov < c.minCanopyPct || cov > c.maxCanopyPct) continue;
      const s = slopeAt(dem, proj, at);
      if (s.pitchDeg < c.minPitchDeg || s.pitchDeg > c.maxPitchDeg) continue;
      if (runIndex.nearest(xy, c.runClearanceM)) continue;
      if (areaPistes.some((ring) => pointInPolygon(at, ring))) continue;
      if (liftIndex.nearest(xy, c.liftClearanceM)) continue;
      cells.set(row * cols + col, {
        col,
        row,
        xy,
        at,
        canopy: cov,
        shelter: canopy.around(at, 75) ?? cov,
        pitch: s.pitchDeg,
        rawPitch: slopeAt(rawDem, proj, at).pitchDeg,
        aspect: s.aspectDeg,
        elevFt: mToFt(s.elevationM),
      });
    }

  // Connected components (4-neighbour).
  const seen = new Set<number>();
  const groups: Cell[][] = [];
  for (const [k, cell] of cells) {
    if (seen.has(k)) continue;
    const group: Cell[] = [];
    const stack = [k];
    seen.add(k);
    while (stack.length) {
      const cur = cells.get(stack.pop()!)!;
      group.push(cur);
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nc = cur.col + dc;
        const nr = cur.row + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        const nk = nr * cols + nc;
        if (cells.has(nk) && !seen.has(nk)) {
          seen.add(nk);
          stack.push(nk);
        }
      }
    }
    groups.push(group);
  }

  const zoneName = new Map(args.zones.map((z) => [z.id, z.name]));
  const areas: TreeArea[] = [];
  for (const g of groups) {
    if (g.length < c.minCells) continue;
    const topFt = Math.max(...g.map((x) => x.elevFt));
    const bottomFt = Math.min(...g.map((x) => x.elevFt));
    if (topFt - bottomFt < c.minVerticalFt) continue;

    // Neighbouring named runs, by how many cells they're nearest to.
    const votes = new Map<number, number>();
    for (const x of g) {
      const n = runIndex.nearest(x.xy, 400);
      if (n && args.runs[n.tag]!.name) votes.set(n.tag, (votes.get(n.tag) ?? 0) + 1);
    }
    const near = [...votes.entries()].sort((a, b) => b[1] - a[1]).map(([i]) => args.runs[i]!);
    const nearNames = [...new Set(near.map((r) => r.name!))].slice(0, 3);
    const zoneVotes = new Map<string, number>();
    for (const r of near) if (r.zone) zoneVotes.set(r.zone, (zoneVotes.get(r.zone) ?? 0) + (votes.get(args.runs.indexOf(r)) ?? 0));
    const zone = [...zoneVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Hazards the data can see.
    const hazards: string[] = [];
    const steepest = Math.max(...g.map((x) => x.rawPitch));
    if (steepest >= c.cliffPitchDeg) hazards.push(`Steep pockets over ${c.cliffPitchDeg}° (up to ${Math.round(steepest)}°): possible cliffs or rock bands`);
    const lowest = [...g].sort((a, b) => a.elevFt - b.elevFt).slice(0, Math.max(3, Math.round(g.length * 0.1)));
    if (!lowest.some((x) => runIndex.nearest(x.xy, c.exitDistanceM))) hazards.push("No mapped run at the bottom: make sure you know the way out");
    if (g.some((x) => waterIndex.nearest(x.xy, c.cellM))) hazards.push("A creek runs through it: watch for open water, holes and steep banks");
    if (g.some((x) => boundaryIndex.nearest(x.xy, c.boundaryWarnM))) hazards.push("Runs up against the ski-area boundary: don't leave it");
    const meanCanopy = g.reduce((t, x) => t + x.canopy, 0) / g.length;
    if (meanCanopy >= c.tightCanopyPct) hazards.push("Tight trees");

    // Cover the cells with rectangles: one per run of cells in a row, merged down identical runs in following rows.
    const spans = new Map<number, [number, number][]>();
    for (const x of g) spans.set(x.row, [...(spans.get(x.row) ?? []), [x.col, x.col]]);
    const rects: { c0: number; c1: number; r0: number; r1: number }[] = [];
    const open = new Map<string, { c0: number; c1: number; r0: number; r1: number }>();
    for (const row of [...spans.keys()].sort((a, b) => a - b)) {
      const colsInRow = spans.get(row)!.map(([a]) => a).sort((a, b) => a - b);
      const runs: [number, number][] = [];
      for (const col of colsInRow) {
        const last = runs[runs.length - 1];
        if (last && col === last[1] + 1) last[1] = col;
        else runs.push([col, col]);
      }
      const nextOpen = new Map<string, { c0: number; c1: number; r0: number; r1: number }>();
      for (const [c0, c1] of runs) {
        const key = `${c0}-${c1}`;
        const prev = open.get(key);
        if (prev && prev.r1 === row - 1) {
          prev.r1 = row;
          nextOpen.set(key, prev);
        } else {
          const rect = { c0, c1, r0: row, r1: row };
          rects.push(rect);
          nextOpen.set(key, rect);
        }
      }
      open.clear();
      for (const [k, v] of nextOpen) open.set(k, v);
    }
    const ll = (x: number, y: number): LonLat => {
      const p = proj.toLonLat([x, y]);
      return [+p[0].toFixed(5), +p[1].toFixed(5)];
    };
    const polygons = rects.map(({ c0, c1, r0, r1 }) => {
      const x0 = minX + c0 * c.cellM;
      const x1 = minX + (c1 + 1) * c.cellM;
      const y0 = maxY - (r1 + 1) * c.cellM;
      const y1 = maxY - r0 * c.cellM;
      return [ll(x0, y0), ll(x1, y0), ll(x1, y1), ll(x0, y1), ll(x0, y0)];
    });

    const name = nearNames.length >= 2 ? `Trees between ${nearNames[0]} and ${nearNames[1]}` : nearNames.length === 1 ? `Trees beside ${nearNames[0]}` : `Trees in ${zoneName.get(zone ?? "") ?? "the area"}`;
    const step = Math.max(1, Math.floor(g.length / 40));
    areas.push({
      id: "",
      name,
      zone,
      nearRuns: nearNames,
      areaHa: Math.round((g.length * c.cellM * c.cellM) / 1000) / 10,
      topFt: Math.round(topFt),
      bottomFt: Math.round(bottomFt),
      pitchDeg: Math.round((g.reduce((t, x) => t + x.pitch, 0) / g.length) * 10) / 10,
      aspectDeg: Math.round(circularMean(g.map((x) => x.aspect), g.map((x) => Math.max(1, x.pitch)))),
      canopyPct: Math.round(meanCanopy),
      shelterPct: Math.round(g.reduce((t, x) => t + x.shelter, 0) / g.length),
      hazards,
      polygons,
      points: g.filter((_, i) => i % step === 0).map((x) => [+x.at[0].toFixed(5), +x.at[1].toFixed(5)] as LonLat),
    });
  }

  // Unique names and stable ids, biggest first.
  areas.sort((a, b) => b.areaHa - a.areaHa);
  const used = new Map<string, number>();
  return areas.map((a, i) => {
    const n = (used.get(a.name) ?? 0) + 1;
    used.set(a.name, n);
    return { ...a, id: `${args.resortId}-trees-${i + 1}`, name: n > 1 ? `${a.name} (${n})` : a.name };
  });
}
