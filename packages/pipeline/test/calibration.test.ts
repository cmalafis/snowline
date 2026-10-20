import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AppResortData, ResortConfig } from "@snowline/core";
import { springOrderCheck } from "../src/calibration.ts";
import { ROOT } from "../src/resort.ts";

// Crested Butte publishes its spring softening order (config validation.springOrder, sourced from skicb.com).
// This guards the scoring defaults and the zone tuning against regressions on real terrain.
const cfg = JSON.parse(readFileSync(path.join(ROOT, "config/resorts/crested-butte.json"), "utf8")) as ResortConfig;
const data = JSON.parse(readFileSync(path.join(ROOT, "data/crested-butte/app.json"), "utf8")) as AppResortData;
const { groups } = springOrderCheck(data, cfg.validation!.springOrder!);
const onset = (id: string) => groups.flatMap((g) => g.zones).find((z) => z.id === id)!.onset!;

describe("Crested Butte spring calibration", () => {
  it("softens Red Lady, Painter Boy and East River first, in the morning", () => {
    const morning = groups[0]!;
    expect(morning.zones.every((z) => z.ok)).toBe(true);
    const latestMorning = Math.max(...morning.zones.map((z) => z.onset!));
    const later = groups.slice(1).flatMap((g) => g.zones.map((z) => z.onset!));
    expect(latestMorning).toBeLessThanOrEqual(Math.min(...later));
  });

  it("puts High Lift and North Face at about 11 and Paradise at midday", () => {
    for (const id of ["high-lift", "north-face", "paradise"]) {
      expect(groups.flatMap((g) => g.zones).find((z) => z.id === id)!.ok).toBe(true);
    }
  });

  it("softens the west-facing Banana/Peel side last", () => {
    const others = groups.slice(0, -1).flatMap((g) => g.zones.map((z) => z.onset!));
    expect(onset("banana-peel")).toBeGreaterThan(Math.max(...others));
  });

  // Known gaps (reported by `npm run validate -- crested-butte`): Silver Queen goes prime ~12:15 vs the published
  // ~11am, and Banana/Peel ~12:45 vs ~2pm. Horizon shading (build phase 2) is the likely fix for Banana.
});
