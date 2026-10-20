import type { Difficulty, RunType } from "../types.ts";
import { DEG, M_PER_FT, compassPoint } from "../geo.ts";
import { DEFAULT_SCORING, type ScoringConfig } from "./config.ts";
import { slopeRadiation, irradiance } from "./incidence.ts";
import { sunPosition, type SunPosition } from "./solar.ts";
import { localToUTC, fmtTime } from "./time.ts";
import {
  cloudAt,
  newSnowAt,
  overnightLowAt,
  precipRateAt,
  sampleHourly,
  snowSince,
  stationFor,
  temperatureAt,
  windAt,
  yesterdayHighAt,
  type DayWeather,
} from "./weather.ts";

export interface ScoringRun {
  id: string;
  name: string | null;
  difficulty: Difficulty;
  type: RunType;
  /** Whether the run is normally groomed (the default for "groomed today"). */
  groomed: boolean;
  aspectDeg: number;
  pitchDeg: number;
  topFt: number;
  bottomFt: number;
  zone: string | null;
  /** Mixed-aspect runs: parts scored separately, then length-weighted. */
  parts?: { aspectDeg: number; pitchDeg: number; weight: number }[];
  /** Tree canopy on the run and within ~75 m of it, percent. Without them, the run type stands in. */
  canopyPct?: number;
  shelterPct?: number;
}

export interface ScoringZone {
  id: string;
  windExposed: boolean;
  /**
   * Hours earlier this zone softens than sun and forecast temperature alone predict: microclimate the forecast
   * can't see (e.g. a warm base area), set from local knowledge in resort config.
   */
  springHeadStartHours?: number;
}

export interface ResortClock {
  lat: number;
  lon: number;
  tz: string;
  openHour: number;
  closeHour: number;
  treelineFt: number;
}

export interface DayContext {
  resort: ResortClock;
  weather: DayWeather;
  cfg: ScoringConfig;
  steps: { hour: number; sun: SunPosition }[];
}

/** Per-device or community adjustments for one run on one day. */
export interface RunAdjustments {
  groomedToday?: boolean;
  aspectDeg?: number;
}

export type SurfaceState = "frozen" | "softening" | "prime" | "heavy" | "slush" | "winter" | "powder";
export type Label = "Prime" | "Good" | "Fair" | "Skip";

export interface RunScore {
  hour: number;
  score: number;
  label: Label;
  state: SurfaceState;
  reasons: string[];
  warnings: string[];
  inSun: boolean;
  /** Hour the slope came into the sun today, if it has. */
  sunSince: number | null;
  tempF: number;
  energy: number;
}

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const DIRECTION: Record<string, string> = { N: "North", NE: "Northeast", E: "East", SE: "Southeast", S: "South", SW: "Southwest", W: "West", NW: "Northwest" };

/** Canopy on and around a run; without measurements, the run type stands in. */
function cover(run: ScoringRun): { canopy: number; shelter: number } {
  const canopy = run.canopyPct ?? (run.type === "tree" ? 45 : 10);
  return { canopy, shelter: run.shelterPct ?? canopy };
}

/** 0 = deep in the trees, 1 = wide open (and always 1 above treeline). */
export function exposureOf(run: ScoringRun, treelineFt: number, cfg: ScoringConfig = DEFAULT_SCORING): number {
  if (run.topFt > treelineFt) return 1;
  const { canopy, shelter } = cover(run);
  const t = cfg.trees;
  return 1 - clamp((Math.max(canopy, shelter) - t.openBelowPct) / (t.shelteredAbovePct - t.openBelowPct));
}

export function buildDayContext(resort: ResortClock, weather: DayWeather, cfg: ScoringConfig = DEFAULT_SCORING): DayContext {
  const steps = [];
  for (let h = cfg.dayStartHour; h <= cfg.dayEndHour + 1e-9; h += cfg.stepHours) {
    steps.push({ hour: h, sun: sunPosition(localToUTC(weather.date, h, resort.tz), resort.lat, resort.lon) });
  }
  return { resort, weather, cfg, steps };
}

export function labelFor(score: number, cfg: ScoringConfig = DEFAULT_SCORING): Label {
  return score >= cfg.labels.prime ? "Prime" : score >= cfg.labels.good ? "Good" : score >= cfg.labels.fair ? "Fair" : "Skip";
}

export function trafficFor(run: Pick<ScoringRun, "difficulty" | "type">, cfg: ScoringConfig = DEFAULT_SCORING): number {
  return cfg.traffic.byDifficulty[run.difficulty] * cfg.traffic.byType[run.type];
}

interface Timeline {
  absorbed: number[];
  /** Softening energy accumulated before each step. */
  energy: number[];
  /** Energy over the whole day window. */
  dailyEnergy: number;
  sunSince: (number | null)[];
}

/** Absorbed radiation and cumulative softening energy across the day for one slope orientation. */
function timeline(ctx: DayContext, midFt: number, aspectDeg: number, pitchDeg: number, canopyPct: number): Timeline {
  const { cfg, weather } = ctx;
  const station = stationFor(weather, midFt);
  const altitudeM = midFt * M_PER_FT;
  const absorbed: number[] = [];
  const energy: number[] = [];
  const sunSince: (number | null)[] = [];
  let e = 0;
  let since: number | null = null;
  for (const { hour, sun } of ctx.steps) {
    const t = temperatureAt(weather, hour, midFt, cfg.lapseFPer1000Ft);
    // Radiation values are averages over the preceding hour, so sample half an hour ahead.
    const forecast = {
      directNormal: sampleHourly(station.hourly, hour, (p) => p.directNormal, 0.5),
      diffuse: sampleHourly(station.hourly, hour, (p) => p.diffuse, 0.5),
    };
    // Trees on the run shade it.
    const shade = 1 - cfg.trees.sunShade * (canopyPct / 100);
    const a = shade * slopeRadiation(sun, aspectDeg, pitchDeg, irradiance(sun, altitudeM, cloudAt(weather, hour, midFt), forecast));
    absorbed.push(a);
    energy.push(e);
    if (since === null && a >= cfg.inSunThreshold && sun.elevationDeg > 0) since = hour;
    sunSince.push(since);
    const sunFactor = clamp((t - cfg.sunMinF) / (cfg.sunFullF - cfg.sunMinF));
    const air = (t - cfg.meltF) * cfg.airRatePerF;
    e = Math.max(0, e + (a * sunFactor + air) * cfg.stepHours);
  }
  return { absorbed, energy, sunSince, dailyEnergy: e };
}

interface Why {
  w: number;
  txt: string;
}

interface PartResult {
  score: number;
  state: SurfaceState;
  why: Why[];
  warnings: string[];
  inSun: boolean;
  sunSince: number | null;
  energy: number;
}

function scorePart(
  run: ScoringRun,
  zone: ScoringZone | undefined,
  ctx: DayContext,
  i: number,
  aspectDeg: number,
  tl: Timeline,
  groomedToday: boolean,
): PartResult {
  const { cfg, weather, resort } = ctx;
  const hour = ctx.steps[i]!.hour;
  const midFt = (run.topFt + run.bottomFt) / 2;
  const T = temperatureAt(weather, hour, midFt, cfg.lapseFPer1000Ft);
  // A zone that local knowledge says softens early runs ahead on the energy timeline (sun and temperature stay real).
  const ahead = Math.round((zone?.springHeadStartHours ?? 0) / cfg.stepHours);
  const E = tl.energy[Math.min(tl.energy.length - 1, i + ahead)]!;
  const absorbed = tl.absorbed[i]!;
  const inSun = absorbed >= cfg.inSunThreshold;
  const sunSince = tl.sunSince[i]!;
  const lapse = cfg.lapseFPer1000Ft;
  const kind = run.type === "groomer" ? (groomedToday ? "groom" : "packed") : run.type;
  // New snow on this run: the overnight total at its elevation plus whatever has fallen on it since the report.
  const overnight = newSnowAt(weather, midFt);
  const today = snowSince(weather, cfg.snowReportHour, hour, midFt, lapse);
  const fresh = overnight + today;
  // Off-piste, older storm snow stays soft for days.
  const older = kind === "groom" ? 0 : cfg.powder.settledShare * Math.max(0, (weather.stormTotalIn ?? 0) - weather.newSnowIn);
  const snow = fresh + older;
  const powder = snow >= cfg.powder.minIn;
  const refrozen =
    yesterdayHighAt(weather, midFt, lapse) > cfg.refreeze.yesterdayHighAboveF &&
    overnightLowAt(weather, midFt, lapse) < cfg.refreeze.overnightLowBelowF &&
    overnight < cfg.refreeze.cancelledBySnowIn &&
    tl.dailyEnergy >= cfg.refreeze.minDailyEnergy;
  const exposure = exposureOf(run, resort.treelineFt, cfg);
  const sheltered = 1 - exposure;
  const hrs = Math.max(0, hour - resort.openHour);
  // Snow falling during the day fills tracks back in.
  const hrsTracked = Math.max(0, hrs - today * cfg.powder.refillHoursPerIn);
  const traffic = trafficFor(run, cfg);
  const inches = (x: number) => (x < 3 ? x.toFixed(1).replace(/\.0$/, "") : String(Math.round(x)));
  const snowNote =
    today >= 1
      ? overnight >= 1
        ? `${inches(fresh)}" new, ${inches(today)}" of it since ${fmtTime(cfg.snowReportHour)}`
        : `${inches(today)}" fallen since ${fmtTime(cfg.snowReportHour)}`
      : fresh >= cfg.powder.minIn || older < 1
        ? `${inches(fresh)}" of new snow`
        : `${inches(weather.stormTotalIn ?? 0)}" storm total, still soft off-piste`;
  const dir = DIRECTION[compassPoint(aspectDeg)]!;
  const sunNote = sunSince !== null ? `${dir}-facing, in the sun since ${fmtTime(sunSince)}` : `${dir}-facing, still in the shade`;
  const s = cfg.surface;

  const state: SurfaceState = powder
    ? "powder"
    : refrozen
      ? E < s.softening
        ? "frozen"
        : E < s.prime
          ? "softening"
          : E <= s.heavy
            ? "prime"
            : E <= s.slush
              ? "heavy"
              : "slush"
      : T > cfg.winterHeavyF && E > s.heavy
        ? "heavy"
        : "winter";

  const why: Why[] = [];
  const warnings: string[] = [];
  const add = (w: number, txt: string) => why.push({ w, txt });
  let sc: number;

  if (kind === "groom") {
    sc = 86;
    const wear = Math.min(30, traffic * 3.5 * hrsTracked * (powder ? 0.6 : 1));
    sc -= wear;
    if (hrs < 1.25) add(6, "Fresh corduroy");
    else if (wear > 14) add(-wear, "Busy groomer, getting skied off");
    if (state === "frozen") (sc -= 18), add(-18, `${dir}-facing, still firm from last night's refreeze`);
    else if (state === "softening") (sc -= 6), add(-6, `${sunNote}, just starting to soften`);
    else if (state === "prime") (sc += 6), add(10, `${sunNote}, groomer softening nicely`);
    else if (state === "heavy") (sc -= 10), add(-10, "Getting soft and pushy");
    else if (state === "slush") (sc -= 28), add(-28, "Slushy now");
    else if (!powder) add(2, T < 22 ? "Cold, chalky winter groomer" : T > 40 ? "Warm, soft groomer" : "Packed winter groomer");
    if (powder) (sc += 4), add(5, today >= 1 ? `${snowNote}, fresh on the corduroy` : `${snowNote} groomed in`);
  } else if (kind === "packed") {
    sc = 62 - Math.min(20, traffic * 2 * hrsTracked);
    add(-8, "Not groomed today, likely chopped up");
    if (state === "frozen") (sc -= 26), add(-26, "Refrozen chunder, rough");
    else if (state === "prime") (sc += 8), add(8, `${sunNote}, chop softening`);
    else if (state === "heavy" || state === "slush") (sc -= 14), add(-14, "Heavy and slushy");
    if (powder) {
      const bonus = (Math.min(snow, cfg.powder.fullIn) / cfg.powder.fullIn) * cfg.powder.maxBonus * 0.8;
      const decay = Math.min(cfg.powder.maxDecay, traffic * cfg.powder.trackRateGroomer * hrsTracked);
      sc += bonus * (1 - decay);
      add(bonus * (1 - decay), decay < 0.4 ? `${snowNote} on an ungroomed run` : "New snow, getting tracked");
    }
  } else {
    sc = kind === "bump" ? 62 : kind === "tree" ? 60 : 64;
    if (powder) {
      const bonus = (Math.min(snow, cfg.powder.fullIn) / cfg.powder.fullIn) * cfg.powder.maxBonus;
      // Trees hold powder longer: blend the track rate by how sheltered the run is.
      const rate = cfg.powder.trackRateOpen + (cfg.powder.trackRateTree - cfg.powder.trackRateOpen) * Math.max(sheltered, kind === "tree" ? 0.8 : 0);
      const decay = Math.min(cfg.powder.maxDecay, traffic * rate * hrsTracked);
      const now = bonus * (1 - decay);
      sc += now;
      if (decay < 0.35) add(now, `${snowNote}, still fresh`);
      else if (decay < 0.65) add(now, "Some fresh left between tracks");
      else add(-6, "Mostly tracked out");
    } else if (state === "frozen") (sc -= 38), add(-38, kind === "bump" ? "Refrozen, bulletproof bumps" : "Refrozen and crusty");
    else if (state === "softening") (sc -= 15), add(-15, `${sunNote}, starting to soften`);
    else if (state === "prime") (sc += 18), add(18, kind === "bump" ? `${sunNote}, soft forgiving bumps` : `${sunNote}, softened up nicely`);
    else if (state === "heavy") (sc += 4), add(4, "Soft, getting heavy");
    else if (state === "slush") (sc -= 16), add(-16, "Slushy and sticky");
    else if (kind === "tree") (sc += 3), add(3, "Protected winter snow in the trees");
    else add(0, "Packed winter snow");
  }

  if (powder) {
    const southWest = Math.cos((aspectDeg - 225) * DEG) > 0.3;
    if (southWest && T > 28 && inSun && E > 1.2) (sc -= 14), add(-14, `${dir}-facing, sun is baking the new snow`);
    else if (Math.cos(aspectDeg * DEG) > 0.5 && !inSun) (sc += 5), add(5, "Shady north slope keeps the powder cold");
  }

  const aboveTreeline = run.topFt > resort.treelineFt;
  const falling = precipRateAt(weather, hour, midFt, lapse);
  const snowingNow = falling.snowIn > 0.2;
  const treeLined = sheltered >= 0.5;

  // Flat light: open terrain loses definition; trees (on or along a run) give it back.
  if (cloudAt(weather, hour, midFt) >= cfg.flatLightCloud || snowingNow) {
    if (kind === "bowl" || kind === "bump") {
      const p = (kind === "bowl" ? (aboveTreeline ? 14 : 10) : aboveTreeline ? 8 : 4) * exposure;
      if (p >= 1) (sc -= p), add(-p, kind === "bowl" ? "Flat light in the open" : "Hard to read bumps in flat light");
    }
    if (treeLined) {
      const b = 8 * sheltered;
      (sc += b), add(b, kind === "tree" ? "Trees give definition in flat light" : "Tree-lined, easier to see in flat light");
    }
  }

  if (falling.rainIn >= cfg.rain.minInPerHour) {
    (sc -= cfg.rain.penalty), add(-cfg.rain.penalty, "Raining at this elevation");
    warnings.push(`Rain below the snow line (${Math.round(T)}°F here)`);
  } else if (snowingNow && !powder) add(3, "Snowing now, fresh coat building");

  // Wind reaches a run in proportion to its exposure, more so in zones up on the ridge.
  const { gustMph } = windAt(weather, hour, run.topFt);
  const reach = exposure * (zone?.windExposed ? 1 : 0.6);
  if (gustMph >= cfg.wind.holdGustMph) {
    warnings.push(`Gusts to ${Math.round(gustMph)} mph: lift holds likely`);
    const p = 25 * reach;
    if (p >= 3) (sc -= p), add(-p, exposure >= 0.5 ? "Exposed to strong wind" : "Some wind getting through the trees");
    if (treeLined) (sc += 6 * sheltered), add(6 * sheltered, "Sheltered from the wind in the trees");
  } else if (gustMph >= cfg.wind.breezyGustMph) {
    const p = 8 * reach;
    if (p >= 2) (sc -= p), add(-p, "Breezy, exposed to the wind");
    if (treeLined) (sc += 3 * sheltered), add(3 * sheltered, "Out of the wind in the trees");
  }
  if (gustMph >= cfg.wind.blowingSnowGustMph && (snowingNow || fresh >= 2)) {
    const p = 8 * exposure;
    if (p >= 2) (sc -= p), add(-p, "Blowing snow, poor visibility in the open");
  }

  // A windy night strips and hardens open snow; tonight's grooming fixes groomers, nothing fixes the open.
  const nightGust = weather.overnightMaxGustMph ?? 0;
  if (nightGust >= cfg.wind.scourGustMph && kind !== "groom") {
    const p = 12 * exposure * (zone?.windExposed ? 1 : 0.7);
    if (p >= 2) (sc -= p), add(-p, `Wind-scoured overnight (gusts to ${Math.round(nightGust)} mph), likely firm or icy`);
    else if (sheltered >= 0.6 && snow >= 2) (sc += 4), add(4, "Trees kept last night's wind off the snow");
  }

  if (T < cfg.coldF) {
    if (inSun) (sc += 4), add(3, "In the sun, takes the edge off the cold");
    else (sc -= 4), add(-3, "Shaded and frigid");
  }

  return { score: clamp(sc, 0, 100), state, why, warnings, inSun, sunSince, energy: E };
}

/** Scores for every step from opening to closing. */
export function scoreRunDay(run: ScoringRun, zone: ScoringZone | undefined, ctx: DayContext, adj: RunAdjustments = {}): RunScore[] {
  const midFt = (run.topFt + run.bottomFt) / 2;
  const parts =
    adj.aspectDeg !== undefined
      ? [{ aspectDeg: adj.aspectDeg, pitchDeg: run.pitchDeg, weight: 1 }]
      : run.parts?.length
        ? run.parts
        : [{ aspectDeg: run.aspectDeg, pitchDeg: run.pitchDeg, weight: 1 }];
  const total = parts.reduce((t, p) => t + p.weight, 0);
  const timelines = parts.map((p) => timeline(ctx, midFt, p.aspectDeg, p.pitchDeg, cover(run).canopy));
  const main = parts.indexOf(parts.reduce((m, p) => (p.weight > m.weight ? p : m)));
  const groomedToday = adj.groomedToday ?? run.groomed;
  const out: RunScore[] = [];
  ctx.steps.forEach(({ hour }, i) => {
    if (hour < ctx.resort.openHour - 1e-9 || hour > ctx.resort.closeHour + 1e-9) return;
    const results = parts.map((p, k) => scorePart(run, zone, ctx, i, p.aspectDeg, timelines[k]!, groomedToday));
    const lead = results[main]!;
    const score = Math.round(results.reduce((t, r, k) => t + r.score * parts[k]!.weight, 0) / total);
    const reasons = [...lead.why].sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).slice(0, 2).map((w) => w.txt);
    out.push({
      hour,
      score,
      label: labelFor(score, ctx.cfg),
      state: lead.state,
      reasons,
      warnings: lead.warnings,
      inSun: lead.inSun,
      sunSince: lead.sunSince,
      tempF: Math.round(temperatureAt(ctx.weather, hour, midFt, ctx.cfg.lapseFPer1000Ft)),
      energy: +lead.energy.toFixed(2),
    });
  });
  return out;
}

/** The score nearest `hour` from a day of scores. */
export function scoreAt(day: RunScore[], hour: number): RunScore {
  return day.reduce((best, s) => (Math.abs(s.hour - hour) < Math.abs(best.hour - hour) ? s : best));
}

/** A zone's score: the mean of its best two runs. */
export function zoneScore(scores: number[]): number | null {
  if (!scores.length) return null;
  const top = [...scores].sort((a, b) => b - a).slice(0, 2);
  return Math.round(top.reduce((a, b) => a + b, 0) / top.length);
}
