import { describe, expect, it } from "vitest";
import { buildDayContext, scoreAt, scoreRunDay, labelFor, zoneScore, type RunScore, type ScoringRun } from "../src/scoring/score.ts";
import { incidence, clearSkyDni } from "../src/scoring/incidence.ts";
import { temperatureAt, type DayWeather } from "../src/scoring/weather.ts";
import { SCENARIOS } from "../src/scoring/scenarios.ts";

const RESORT = { lat: 40.4572, lon: -106.8045, tz: "America/Denver", openHour: 8.5, closeHour: 16, treelineFt: 11000 };
const scenario = (id: string) => SCENARIOS.find((s) => s.id === id)!.weather;

const run = (id: string, type: ScoringRun["type"], aspectDeg: number, extra: Partial<ScoringRun> = {}): ScoringRun => ({
  id,
  name: id,
  difficulty: type === "groomer" ? "intermediate" : "advanced",
  type,
  groomed: type === "groomer",
  aspectDeg,
  pitchDeg: 18,
  topFt: 9800,
  bottomFt: 8800,
  zone: "z",
  ...extra,
});

/** Midpoint of the hours a run spends in the "prime" state. */
function primeCentre(day: RunScore[]): number {
  const prime = day.filter((s) => s.state === "prime");
  expect(prime.length).toBeGreaterThan(0);
  return (prime[0]!.hour + prime[prime.length - 1]!.hour) / 2;
}

describe("incidence", () => {
  it("is 1 for a slope square to the sun and 0 when the sun is behind it or down", () => {
    expect(incidence({ elevationDeg: 60, azimuthDeg: 180 }, 180, 30)).toBeCloseTo(1, 6);
    expect(incidence({ elevationDeg: 10, azimuthDeg: 90 }, 270, 40)).toBe(0);
    expect(incidence({ elevationDeg: -1, azimuthDeg: 180 }, 180, 30)).toBe(0);
    expect(incidence({ elevationDeg: 45, azimuthDeg: 123 }, 0, 0)).toBeCloseTo(Math.SQRT1_2, 6);
  });
  it("clear-sky DNI rises with sun height and altitude", () => {
    expect(clearSkyDni(60, 3000)).toBeGreaterThan(clearSkyDni(15, 3000));
    expect(clearSkyDni(30, 3000)).toBeGreaterThan(clearSkyDni(30, 0));
    expect(clearSkyDni(-2, 3000)).toBe(0);
  });
});

describe("temperature by elevation", () => {
  const w = scenario("spring");
  it("interpolates between base and summit", () => {
    const base = temperatureAt(w, 12, 6900, 3.5);
    const summit = temperatureAt(w, 12, 10568, 3.5);
    expect(temperatureAt(w, 12, (6900 + 10568) / 2, 3.5)).toBeCloseTo((base + summit) / 2, 6);
  });
  it("falls back to the lapse rate without a summit station", () => {
    const noSummit: DayWeather = { ...w, summit: undefined };
    expect(temperatureAt(noSummit, 12, 7900, 3.5)).toBeCloseTo(temperatureAt(noSummit, 12, 6900, 3.5) - 3.5, 6);
  });
});

describe("scenario: bluebird spring day after a refreeze", () => {
  const ctx = buildDayContext(RESORT, scenario("spring"));
  const east = scoreRunDay(run("E", "groomer", 90), undefined, ctx);
  const south = scoreRunDay(run("S", "groomer", 180), undefined, ctx);
  const west = scoreRunDay(run("W", "groomer", 270), undefined, ctx);

  it("softens east, then south, then west", () => {
    const [e, s, w] = [primeCentre(east), primeCentre(south), primeCentre(west)];
    expect(e).toBeGreaterThanOrEqual(9.5);
    expect(e).toBeLessThanOrEqual(11.5);
    expect(s).toBeGreaterThan(e);
    expect(s).toBeLessThanOrEqual(13);
    expect(w).toBeGreaterThan(s);
    expect(w).toBeGreaterThanOrEqual(12.5);
  });

  it("starts firm, explains why, and goes slushy late", () => {
    expect(scoreAt(east, 8.5).state).toBe("frozen");
    expect(scoreAt(east, 15.5).state).toBe("slush");
    expect(scoreAt(east, 10.5).reasons[0]).toMatch(/East-facing, in the sun since 7:\d\dam/);
  });

  it("bumps are terrible refrozen and great once softened", () => {
    const bumps = scoreRunDay(run("E bumps", "bump", 90), undefined, ctx);
    expect(scoreAt(bumps, 8.5).score).toBeLessThan(35);
    expect(scoreAt(bumps, 8.5).reasons).toContain("Refrozen, bulletproof bumps");
    expect(Math.max(...bumps.map((s) => s.score))).toBeGreaterThanOrEqual(80);
  });

  it("an ungroomed groomer scores below the same run groomed", () => {
    const packed = scoreRunDay(run("E", "groomer", 90), undefined, ctx, { groomedToday: false });
    expect(scoreAt(packed, 9).score).toBeLessThan(scoreAt(east, 9).score - 15);
  });

  it("a user aspect correction changes the timing", () => {
    const corrected = scoreRunDay(run("E", "groomer", 90), undefined, ctx, { aspectDeg: 270 });
    expect(primeCentre(corrected)).toBeCloseTo(primeCentre(west), 6);
  });
});

describe("scenario: cold powder day", () => {
  const ctx = buildDayContext(RESORT, scenario("powder"));
  const trees = scoreRunDay(run("N trees", "tree", 0), undefined, ctx);
  const bumps = scoreRunDay(run("S bumps", "bump", 180), undefined, ctx);
  const groomer = scoreRunDay(run("N groomer", "groomer", 0), undefined, ctx);

  it("rates fresh snow highly and says so", () => {
    expect(scoreAt(trees, 9).label).toBe("Prime");
    expect(scoreAt(trees, 9).reasons[0]).toBe('10" of new snow, still fresh');
    expect(scoreAt(trees, 9).state).toBe("powder");
  });

  it("trees hold powder longer than open terrain and beat groomers by afternoon", () => {
    // Both times are after the clouds clear, so the cold-day sun bonus doesn't skew the comparison.
    const treeDrop = scoreAt(trees, 10.5).score - scoreAt(trees, 15.5).score;
    const bumpDrop = scoreAt(bumps, 10.5).score - scoreAt(bumps, 15.5).score;
    expect(treeDrop).toBeLessThan(bumpDrop);
    expect(scoreAt(trees, 15).score).toBeGreaterThan(scoreAt(groomer, 15).score);
  });

  it("shaded north slopes keep the powder cold", () => {
    expect(scoreAt(trees, 11).reasons).toContain("Shady north slope keeps the powder cold");
  });
});

describe("scenario: overcast flat light", () => {
  const ctx = buildDayContext(RESORT, scenario("flatlight"));
  const at = (r: ScoringRun) => scoreAt(scoreRunDay(r, undefined, ctx), 11);

  it("favours trees and penalises open bowls and bumps", () => {
    const trees = at(run("trees", "tree", 300));
    const bowl = at(run("bowl", "bowl", 300));
    const bumps = at(run("bumps", "bump", 300));
    expect(trees.score).toBeGreaterThan(bowl.score + 10);
    expect(trees.score).toBeGreaterThan(bumps.score);
    expect(trees.reasons).toContain("Trees give definition in flat light");
    expect(bowl.reasons).toContain("Flat light in the open");
  });

  it("penalises bowls above treeline harder", () => {
    const low = at(run("bowl", "bowl", 300));
    const high = at(run("alpine bowl", "bowl", 300, { topFt: 12000, bottomFt: 11200 }));
    expect(high.reasons).toContain("Flat light in the open");
    const w = scenario("flatlight");
    const clear = (st: typeof w.base) => ({ ...st, hourly: st.hourly.map((p) => ({ ...p, cloudCover: 0, snowfallIn: 0 })) });
    const ctxClear = buildDayContext(RESORT, { ...w, base: clear(w.base), summit: clear(w.summit!) });
    expect(scoreAt(scoreRunDay(run("bowl", "bowl", 300), undefined, ctxClear), 11).score).toBeGreaterThan(low.score);
  });
});

describe("scenario: strong wind", () => {
  const ctx = buildDayContext(RESORT, scenario("wind"));
  const bowl = run("summit bowl", "bowl", 270, { topFt: 10500, bottomFt: 9800 });

  it("penalises exposed zones and warns of lift holds", () => {
    const exposed = scoreAt(scoreRunDay(bowl, { id: "z", windExposed: true }, ctx), 11);
    const sheltered = scoreAt(scoreRunDay(bowl, { id: "z", windExposed: false }, ctx), 11);
    expect(exposed.score).toBeLessThan(sheltered.score - 15);
    expect(exposed.warnings[0]).toMatch(/Gusts to \d+ mph: lift holds likely/);
    expect(exposed.reasons).toContain("Exposed to strong wind");
  });
});

describe("mixed aspect and helpers", () => {
  const ctx = buildDayContext(RESORT, scenario("spring"));
  it("scores mixed-aspect runs per part, weighted by length", () => {
    const mixed = run("mixed", "groomer", 0, { parts: [{ aspectDeg: 90, pitchDeg: 18, weight: 3 }, { aspectDeg: 270, pitchDeg: 18, weight: 1 }] });
    const e = scoreAt(scoreRunDay(run("E", "groomer", 90), undefined, ctx), 10.5).score;
    const w = scoreAt(scoreRunDay(run("W", "groomer", 270), undefined, ctx), 10.5).score;
    expect(scoreAt(scoreRunDay(mixed, undefined, ctx), 10.5).score).toBe(Math.round((3 * e + w) / 4));
  });
  it("labels and zone scores", () => {
    expect([85, 70, 55, 20].map((s) => labelFor(s))).toEqual(["Prime", "Good", "Fair", "Skip"]);
    expect(zoneScore([50, 90, 70])).toBe(80);
    expect(zoneScore([])).toBeNull();
  });
  it("covers opening to closing in 15-minute steps", () => {
    const day = scoreRunDay(run("E", "groomer", 90), undefined, ctx);
    expect(day[0]!.hour).toBe(8.5);
    expect(day[day.length - 1]!.hour).toBe(16);
    expect(day).toHaveLength(31);
  });
});

describe("scenario: storm day, snowing all day", () => {
  const ctx = buildDayContext(RESORT, scenario("storm"));
  const trees = scoreRunDay(run("trees", "tree", 0), undefined, ctx);
  const bumps = scoreRunDay(run("bumps", "bump", 300), undefined, ctx);

  it("adds snow that falls during the day and says so", () => {
    const late = scoreAt(trees, 14);
    expect(late.state).toBe("powder");
    expect(late.reasons.join(" ")).toMatch(/of it since 8:00am/);
  });

  it("keeps refilling tracks, so open terrain holds up better than on a bluebird powder day", () => {
    const stormDrop = scoreAt(bumps, 9).score - scoreAt(bumps, 15).score;
    const powderCtx = buildDayContext(RESORT, scenario("powder"));
    const pow = scoreRunDay(run("bumps", "bump", 300), undefined, powderCtx);
    expect(stormDrop).toBeLessThan(scoreAt(pow, 9).score - scoreAt(pow, 15).score);
  });

  it("favours trees in the storm's flat light", () => {
    expect(scoreAt(trees, 11).score).toBeGreaterThan(scoreAt(scoreRunDay(run("bowl", "bowl", 0), undefined, ctx), 11).score);
  });
});

describe("scenario: warm storm with a snow line", () => {
  const ctx = buildDayContext(RESORT, scenario("rainline"));
  const low = scoreRunDay(run("low groomer", "groomer", 300, { topFt: 7800, bottomFt: 7000 }), undefined, ctx);
  const high = scoreRunDay(run("high groomer", "groomer", 300, { topFt: 10500, bottomFt: 10000 }), undefined, ctx);

  it("rains on low runs and snows on high ones", () => {
    const l = scoreAt(low, 13);
    const h = scoreAt(high, 13);
    expect(l.warnings.join(" ")).toMatch(/Rain below the snow line/);
    expect(l.reasons).toContain("Raining at this elevation");
    expect(h.warnings.join(" ")).not.toMatch(/Rain/);
    expect(h.score).toBeGreaterThan(l.score + 15);
  });
});

describe("snow by elevation", () => {
  it("splits precipitation into snow and rain by the run's temperature", async () => {
    const { precipAt, newSnowAt } = await import("../src/scoring/weather.ts");
    const w = scenario("rainline");
    const p = { ...w.base.hourly[12]!, precipIn: 0.1 };
    const lowSplit = precipAt(w, p, 6900, 3.5);
    const highSplit = precipAt(w, p, 10568, 3.5);
    expect(lowSplit.rainIn).toBeCloseTo(0.1, 6);
    expect(lowSplit.snowIn).toBe(0);
    expect(highSplit.rainIn).toBe(0);
    expect(highSplit.snowIn).toBeGreaterThanOrEqual(1); // 0.1" of water at ~28°F is ~1" of snow
    expect(newSnowAt(w, 6900)).toBe(0);
    expect(newSnowAt(w, 10568)).toBe(1);
    expect(newSnowAt(w, (6900 + 10568) / 2)).toBeCloseTo(0.5, 6);
  });
});
