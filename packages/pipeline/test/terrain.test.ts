import { describe, expect, it } from "vitest";
import { Raster, slopeAt, utmEpsg, utmProjection } from "../src/sources/dem.ts";
import { analyzeRun, buildRawRuns, joinChains, normName, resample, type RawRun } from "../src/terrain.ts";
import { DEFAULT_ANALYSIS } from "../src/resort.ts";
import type { OsmWay } from "../src/sources/overpass.ts";

// A UTM 13N projection and a point on its central meridian (-105°), where grid north is true north.
const proj = utmProjection(32613);
const CM: [number, number] = [-105, 40.45];

/** A tilted plane: `pitch` degrees, falling toward `aspect` (degrees from grid north). */
function plane(aspect: number, pitch: number, size = 101, cell = 10): Raster {
  const [cx, cy] = proj.toXY(CM);
  const originX = cx - (size / 2) * cell;
  const originY = cy + (size / 2) * cell;
  const slope = Math.tan((pitch * Math.PI) / 180);
  const ux = Math.sin((aspect * Math.PI) / 180);
  const uy = Math.cos((aspect * Math.PI) / 180);
  const data = new Float32Array(size * size);
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      const x = originX + (c + 0.5) * cell - cx;
      const y = originY - (r + 0.5) * cell - cy;
      data[r * size + c] = 3000 - slope * (x * ux + y * uy);
    }
  return new Raster(size, size, originX, originY, cell, data, "3dep");
}

describe("Horn gradient on synthetic planes", () => {
  for (const [aspect, label] of [[0, "N"], [90, "E"], [180, "S"], [270, "W"], [135, "SE"]] as const) {
    it(`a plane falling ${label} has aspect ${aspect}°`, () => {
      const s = slopeAt(plane(aspect, 20), proj, CM);
      expect(Math.abs(((s.aspectDeg - aspect + 540) % 360) - 180)).toBeLessThan(0.5);
      expect(s.pitchDeg).toBeCloseTo(20, 1);
      expect(s.elevationM).toBeCloseTo(3000, 0);
    });
  }

  it("smoothing keeps a plane's aspect and pitch", () => {
    const s = slopeAt(plane(225, 30).smoothed(30), proj, CM);
    expect(s.aspectDeg).toBeCloseTo(225, 0);
    expect(s.pitchDeg).toBeCloseTo(30, 0);
  });

  it("reports aspect from the terrain, not the line's direction", () => {
    // A traverse running due north across an east-facing slope.
    const dem = plane(90, 25);
    const [cx, cy] = proj.toXY(CM);
    const line = [proj.toLonLat([cx, cy - 200]), proj.toLonLat([cx, cy + 200])];
    const run: RawRun = { osmIds: [1], name: "Traverse", difficulty: "easy", grooming: null, geometry: "line", chains: [line], tags: {} };
    const t = analyzeRun(run, dem, proj, DEFAULT_ANALYSIS)!;
    expect(t.aspectDeg).toBeCloseTo(90, 0);
    expect(t.segments.every((s) => Math.abs(s.lineBearingDeg - 0) < 1 || Math.abs(s.lineBearingDeg - 360) < 1)).toBe(true);
    expect(t.mixedAspect).toBe(false);
    expect(t.segments).toHaveLength(8);
  });
});

describe("UTM helpers", () => {
  it("picks the zone from longitude", () => {
    expect(utmEpsg(-106.8, 40.45)).toBe(32613);
    expect(utmEpsg(-106.07, 39.48)).toBe(32613);
    expect(utmEpsg(10, -45)).toBe(32732);
  });
});

describe("resample", () => {
  it("cuts a line into ~50 m pieces and folds a short tail", () => {
    expect(resample([[0, 0], [0, 110]], 50).map((s) => Math.round(s.length))).toEqual([50, 60]);
    expect(resample([[0, 0], [0, 120]], 50).map((s) => Math.round(s.length))).toEqual([50, 50, 20]);
    const segs2 = resample([[0, 0], [0, 80], [60, 80]], 50);
    expect(segs2.reduce((t, s) => t + s.length, 0)).toBeGreaterThan(120);
    expect(segs2).toHaveLength(3);
  });
});

describe("building runs from OSM ways", () => {
  const way = (id: number, name: string | undefined, coords: [number, number][], tags: Record<string, string> = {}): OsmWay => ({
    type: "way",
    id,
    tags: { "piste:type": "downhill", ...(name ? { name } : {}), ...tags },
    geometry: coords.map(([lon, lat]) => ({ lon, lat })),
  });

  it("joins split ways of the same run, reversing as needed", () => {
    const chains = joinChains([
      [[0, 0], [0, 0.001]],
      [[0, 0.002], [0, 0.001]],
    ]);
    expect(chains).toHaveLength(1);
    expect(chains[0]).toHaveLength(3);
  });

  it("merges same-named ways, folds untagged stubs in, keeps areas separate", () => {
    const runs = buildRawRuns([
      way(1, "Buddy's Run", [[0, 0], [0, 0.001]], { "piste:difficulty": "intermediate" }),
      way(2, "Buddys Run", [[0, 0.001], [0, 0.002]], { "piste:difficulty": "intermediate" }),
      way(3, "Buddy's Run", [[0, 0.002], [0, 0.0025]]),
      way(4, "Shadows", [[1, 1], [1.001, 1], [1.001, 1.001], [1, 1]], { area: "yes", "piste:difficulty": "expert" }),
      way(5, undefined, [[2, 2], [2, 2.001]]),
    ]);
    const buddy = runs.find((r) => r.name === "Buddy's Run")!;
    expect(buddy.osmIds.sort()).toEqual([1, 2, 3]);
    expect(buddy.difficulty).toBe("intermediate");
    expect(buddy.chains).toHaveLength(1);
    expect(runs.find((r) => r.name === "Shadows")!.geometry).toBe("area");
    expect(runs.filter((r) => r.name === null)).toHaveLength(1);
  });

  it("normalises names", () => {
    expect(normName("Jess' Cut Off")).toBe(normName("Jess' Cutoff"));
    expect(normName("Sunshine Lift Line Upper")).toBe("sunshine liftline upper");
    expect(normName("Yoo-Hoo")).toBe(normName("Yoo Hoo"));
  });
});
