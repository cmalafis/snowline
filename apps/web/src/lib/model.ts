import {
  buildDayContext,
  haversineM,
  scoreAt,
  scoreRunDay,
  zoneScore,
  type AppResortData,
  type AppRun,
  type AppZone,
  type DayContext,
  type DayWeather,
  type Difficulty,
  type LonLat,
  type RunScore,
} from "@snowline/core";
import type { Prefs } from "./storage";

export const DIFF_ORDER: Difficulty[] = ["novice", "easy", "intermediate", "advanced", "expert", "freeride", "extreme"];

export interface Adjustments {
  groomed: Record<string, boolean>;
  aspect: Record<string, number>;
}

export interface ScoredDay {
  ctx: DayContext;
  /** Run id -> scores from opening to closing, every 15 minutes. */
  byRun: Map<string, RunScore[]>;
}

export function scoreDay(data: AppResortData, weather: DayWeather, adj: Adjustments): ScoredDay {
  const { resort } = data;
  const ctx = buildDayContext(
    { lat: resort.base.lat, lon: resort.base.lon, tz: resort.tz, openHour: resort.openHour, closeHour: resort.closeHour, treelineFt: resort.treelineFt },
    weather,
  );
  const zones = new Map(data.zones.map((z) => [z.id, z]));
  const byRun = new Map<string, RunScore[]>();
  for (const run of data.runs) {
    byRun.set(run.id, scoreRunDay(run, zones.get(run.zone ?? ""), ctx, { groomedToday: adj.groomed[run.id], aspectDeg: adj.aspect[run.id] }));
  }
  return { ctx, byRun };
}

export function eligible(run: AppRun, prefs: Prefs): boolean {
  const max = DIFF_ORDER.indexOf(prefs.maxDifficulty);
  const d = run.difficulty === "unknown" ? DIFF_ORDER.indexOf("intermediate") : DIFF_ORDER.indexOf(run.difficulty);
  return d <= max && prefs.types.includes(run.type);
}

export interface Ranked {
  run: AppRun;
  s: RunScore;
}

export function rankAt(data: AppResortData, day: ScoredDay, hour: number, prefs: Prefs): Ranked[] {
  return data.runs
    .filter((r) => eligible(r, prefs))
    .map((run) => ({ run, s: scoreAt(day.byRun.get(run.id)!, hour) }))
    .sort((a, b) => b.s.score - a.s.score || a.run.name.localeCompare(b.run.name));
}

export function zoneScoreAt(data: AppResortData, day: ScoredDay, zoneId: string, hour: number, prefs: Prefs): number | null {
  return zoneScore(data.runs.filter((r) => r.zone === zoneId && eligible(r, prefs)).map((r) => scoreAt(day.byRun.get(r.id)!, hour).score));
}

export function tier(score: number): "prime" | "good" | "fair" | "skip" {
  return score >= 80 ? "prime" : score >= 65 ? "good" : score >= 50 ? "fair" : "skip";
}

export const TIER_COLOR = { prime: "var(--good)", good: "var(--blue)", fair: "var(--warn)", skip: "var(--bad)" } as const;

export const TYPE_LABEL = { groomer: "Groomers", bump: "Bumps", tree: "Trees", bowl: "Bowls & chutes" } as const;

/** Short label for the dial: the zone name up to its first separator. */
export function zoneShort(z: AppZone): string {
  const s = z.name.split(/ & | and |,/)[0]!.replace(/^Mt\. /, "Mt ").trim();
  return s.length > 12 ? s.slice(0, 11) + "…" : s;
}

/** Distance from a point to the nearest sampled point of a run. */
export function distanceToRun(run: AppRun, p: LonLat): number {
  let d = Infinity;
  for (const q of run.points) d = Math.min(d, haversineM(p, q));
  return d;
}

/** The run the user is most likely on (within 250 m) and runs within `radiusM`. */
export function nearby(data: AppResortData, p: LonLat, radiusM = 1200): { here: AppRun | null; zoneId: string | null; near: Set<string> } {
  let here: AppRun | null = null;
  let best = Infinity;
  const near = new Set<string>();
  for (const r of data.runs) {
    const d = distanceToRun(r, p);
    if (d < best) [here, best] = [r, d];
    if (d <= radiusM) near.add(r.id);
  }
  if (best > 250) here = null;
  return { here, zoneId: here?.zone ?? null, near };
}
