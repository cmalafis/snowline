import { describe, expect, it } from "vitest";
import proj4 from "proj4";
import type { LonLat, Run } from "@snowline/core";
import { Raster, utmProjection } from "../src/sources/dem.ts";
import { ALBERS, CanopyGrid } from "../src/sources/canopy.ts";
import { findTreeAreas } from "../src/treeAreas.ts";

// A 1.2 km square of 20° east-facing slope on the UTM 13N central meridian.
const proj = utmProjection(32613);
const CM: LonLat = [-105, 40.45];
const [cx, cy] = proj.toXY(CM);
const SIZE = 121;
const CELL = 10;
const originX = cx - (SIZE / 2) * CELL;
const originY = cy + (SIZE / 2) * CELL;
const slope = Math.tan((20 * Math.PI) / 180);
const demData = new Float32Array(SIZE * SIZE);
for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) demData[r * SIZE + c] = 3000 - slope * (originX + (c + 0.5) * CELL - cx);
const dem = new Raster(SIZE, SIZE, originX, originY, CELL, demData, "3dep");

/** Metres east/north of the centre -> lon/lat. */
const at = (dx: number, dy: number): LonLat => proj.toLonLat([cx + dx, cy + dy]);

/**
 * Canopy in a 30 m Albers grid: 40% in a skiable block west of centre, 90% (too tight) in a block east of
 * centre, 10% (open slope) elsewhere.
 */
function canopyGrid(): CanopyGrid {
  const toAlbers = proj4("EPSG:4326", ALBERS);
  const corners = [at(-700, -700), at(700, 700), at(-700, 700), at(700, -700)].map((p) => toAlbers.forward(p) as [number, number]);
  const ax = Math.floor(Math.min(...corners.map((p) => p[0])) / 30) * 30;
  const ay = Math.ceil(Math.max(...corners.map((p) => p[1])) / 30) * 30;
  const w = 60;
  const h = 60;
  const data = new Uint8Array(w * h);
  const toUtm = proj4(ALBERS, "+proj=utm +zone=13 +datum=WGS84 +units=m +no_defs");
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const [x, y] = toUtm.forward([ax + (c + 0.5) * 30, ay - (r + 0.5) * 30]) as [number, number];
      const dx = x - cx;
      const dy = y - cy;
      const inWest = dx > -450 && dx < -50 && Math.abs(dy) < 200;
      const inEast = dx > 100 && dx < 450 && Math.abs(dy) < 200;
      data[r * w + c] = inWest ? 40 : inEast ? 90 : 10;
    }
  return new CanopyGrid(w, h, ax, ay, 30, data);
}

const boundary: [number, number][][] = [[at(-550, -550), at(550, -550), at(550, 550), at(-550, 550), at(-550, -550)]];
const run = (name: string, line: LonLat[]): Run =>
  ({ id: name, name, coordinates: [line], geometry: "line", zone: "z", segments: [] }) as unknown as Run;

describe("findTreeAreas", () => {
  const canopy = canopyGrid();
  const base = { resortId: "t", boundary, zones: [{ id: "z", name: "Test Zone" }] as never, liftLines: [], dem, rawDem: dem, canopy, proj };

  it("finds skiable trees and skips open slopes, tight forest and run corridors", () => {
    // A run straight down the middle of the skiable block.
    const areas = findTreeAreas({ ...base, runs: [run("Middle Run", [at(-250, -300), at(-250, 300)])] });
    expect(areas.length).toBeGreaterThanOrEqual(1);
    for (const a of areas) {
      expect(a.canopyPct).toBeGreaterThanOrEqual(25);
      expect(a.canopyPct).toBeLessThanOrEqual(70);
      expect(a.pitchDeg).toBeCloseTo(20, 0);
      expect(a.aspectDeg).toBeCloseTo(90, -1);
      expect(a.zone).toBe("z");
      expect(a.nearRuns).toContain("Middle Run");
      expect(a.name).toMatch(/Middle Run/);
      // Nothing from the 90% block east of centre.
      for (const ring of a.polygons) for (const p of ring) expect(proj.toXY(p)[0] - cx).toBeLessThan(0);
    }
    // The run splits the block: no area cell sits within the clearance of the run.
    const all = areas.flatMap((a) => a.points.map((p) => proj.toXY(p)[0] - cx));
    expect(all.every((dx) => Math.abs(dx - -250) > 40)).toBe(true);
  });

  it("flags creeks running through an area", () => {
    const creek = [at(-400, -150), at(-100, -150)];
    const areas = findTreeAreas({ ...base, runs: [run("Edge Run", [at(-500, -500), at(-500, 500)])], waterways: [creek] });
    expect(areas.some((a) => a.hazards.some((h) => /creek runs through it/.test(h)))).toBe(true);
  });

  it("flags areas against the ski-area boundary", () => {
    const tight: [number, number][][] = [[at(-470, -260), at(-30, -260), at(-30, 260), at(-470, 260), at(-470, -260)]];
    const areas = findTreeAreas({ ...base, boundary: tight, runs: [run("Edge Run", [at(-600, -600), at(-600, 600)])] });
    expect(areas.length).toBeGreaterThan(0);
    expect(areas.every((a) => a.hazards.some((h) => /ski-area boundary/.test(h)))).toBe(true);
  });

  it("finds nothing without a boundary", () => {
    expect(findTreeAreas({ ...base, boundary: [], runs: [] })).toEqual([]);
  });
});
