// Weather inputs for one resort-day, and lookups by hour and elevation.

export interface HourlyPoint {
  /** Local hour this value is valid at (0-23). */
  hour: number;
  temperatureF: number;
  /** Total cloud cover, 0-100. */
  cloudCover: number;
  windMph: number;
  gustMph: number;
  /** Snowfall during the preceding hour at this station, inches. */
  snowfallIn: number;
  /**
   * Total precipitation (water equivalent) during the preceding hour, inches. When present, each run decides
   * for itself whether it fell as snow or rain from the temperature at its own elevation: a real snow line.
   */
  precipIn?: number;
  /**
   * Radiation, W/m², averaged over the preceding hour (Open-Meteo's convention). Optional: without it,
   * clear-sky radiation is scaled by cloud cover.
   */
  directNormal?: number;
  diffuse?: number;
}

export interface StationWeather {
  elevationFt: number;
  hourly: HourlyPoint[];
  /** Yesterday's high and last night's low at this station. */
  yesterdayHighF: number;
  overnightLowF: number;
}

export interface DayWeather {
  date: string;
  base: StationWeather;
  summit?: StationWeather;
  /** Snow in the 24 hours to 8am, inches, at the summit (or the only station). */
  newSnowIn: number;
  /** The same at the base, so low runs that got rain or less snow aren't credited with the summit's total. */
  newSnowBaseIn?: number;
  /** Snow in the 72 hours to 8am at the summit: older storm snow still soft off-piste. */
  stormTotalIn?: number;
  source: string;
}

/** Linear interpolation of an hourly field at a fractional hour, holding the ends flat. */
export function sampleHourly(points: HourlyPoint[], hour: number, pick: (p: HourlyPoint) => number | undefined, shift = 0): number | undefined {
  const pts = points.filter((p) => pick(p) !== undefined);
  if (!pts.length) return undefined;
  const h = hour + shift;
  if (h <= pts[0]!.hour) return pick(pts[0]!);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (h <= b.hour) {
      const t = (h - a.hour) / (b.hour - a.hour || 1);
      return pick(a)! + (pick(b)! - pick(a)!) * t;
    }
  }
  return pick(pts[pts.length - 1]!);
}

/** Value at an elevation, interpolated (or extrapolated) between base and summit, or by lapse rate without a summit. */
function byElevation(w: DayWeather, elevationFt: number, base: number, summit: number | undefined, lapseFPer1000: number): number {
  if (summit === undefined || !w.summit || w.summit.elevationFt === w.base.elevationFt) {
    return base - (lapseFPer1000 * (elevationFt - w.base.elevationFt)) / 1000;
  }
  const t = (elevationFt - w.base.elevationFt) / (w.summit.elevationFt - w.base.elevationFt);
  return base + (summit - base) * t;
}

export function temperatureAt(w: DayWeather, hour: number, elevationFt: number, lapse: number): number {
  const b = sampleHourly(w.base.hourly, hour, (p) => p.temperatureF)!;
  const s = w.summit ? sampleHourly(w.summit.hourly, hour, (p) => p.temperatureF) : undefined;
  return byElevation(w, elevationFt, b, s, lapse);
}

export function yesterdayHighAt(w: DayWeather, elevationFt: number, lapse: number): number {
  return byElevation(w, elevationFt, w.base.yesterdayHighF, w.summit?.yesterdayHighF, lapse);
}

export function overnightLowAt(w: DayWeather, elevationFt: number, lapse: number): number {
  return byElevation(w, elevationFt, w.base.overnightLowF, w.summit?.overnightLowF, lapse);
}

/** The station closest in elevation to `elevationFt`. */
export function stationFor(w: DayWeather, elevationFt: number): StationWeather {
  if (!w.summit) return w.base;
  return Math.abs(elevationFt - w.summit.elevationFt) < Math.abs(elevationFt - w.base.elevationFt) ? w.summit : w.base;
}

export function windAt(w: DayWeather, hour: number, elevationFt: number): { windMph: number; gustMph: number } {
  const st = stationFor(w, elevationFt);
  return {
    windMph: sampleHourly(st.hourly, hour, (p) => p.windMph) ?? 0,
    gustMph: sampleHourly(st.hourly, hour, (p) => p.gustMph) ?? 0,
  };
}

export function cloudAt(w: DayWeather, hour: number, elevationFt: number): number {
  return sampleHourly(stationFor(w, elevationFt).hourly, hour, (p) => p.cloudCover) ?? 0;
}

/** Overnight new snow at an elevation, interpolated between base and summit totals when both are known. */
export function newSnowAt(w: DayWeather, elevationFt: number): number {
  if (w.newSnowBaseIn === undefined || !w.summit) return w.newSnowIn;
  const t = Math.max(0, Math.min(1, (elevationFt - w.base.elevationFt) / (w.summit.elevationFt - w.base.elevationFt || 1)));
  return w.newSnowBaseIn + (w.newSnowIn - w.newSnowBaseIn) * t;
}

/** Snow-to-liquid ratio: ~10:1 near freezing, fluffier when cold. */
function snowRatio(tempF: number): number {
  return Math.min(20, 10 + Math.max(0, 28 - tempF) * 0.5);
}

/**
 * Snow and rain falling on a run during the hour ending at `p.hour`, inches. With precipitation in the forecast,
 * the split comes from the temperature at the run's elevation (all snow at or below 32°F, all rain from 35°F).
 */
export function precipAt(w: DayWeather, p: HourlyPoint, elevationFt: number, lapse: number): { snowIn: number; rainIn: number } {
  if (p.precipIn === undefined) return { snowIn: p.snowfallIn, rainIn: 0 };
  const t = temperatureAt(w, p.hour, elevationFt, lapse);
  const rainShare = Math.max(0, Math.min(1, (t - 32) / 3));
  return { snowIn: p.precipIn * (1 - rainShare) * snowRatio(t), rainIn: p.precipIn * rainShare };
}

/** Snow that has fallen on a run since `fromHour` (the overnight cutoff) up to `hour`. */
export function snowSince(w: DayWeather, fromHour: number, hour: number, elevationFt: number, lapse: number): number {
  return stationFor(w, elevationFt)
    .hourly.filter((p) => p.hour > fromHour && p.hour <= hour)
    .reduce((t, p) => t + precipAt(w, p, elevationFt, lapse).snowIn, 0);
}

/** Precipitation rate on a run around `hour`, inches per hour. */
export function precipRateAt(w: DayWeather, hour: number, elevationFt: number, lapse: number): { snowIn: number; rainIn: number } {
  const st = stationFor(w, elevationFt);
  // Each value covers the hour before it, so the hour containing `hour` ends at ceil(hour).
  const p = st.hourly.find((x) => x.hour === Math.min(23, Math.ceil(hour + 1e-9)));
  return p ? precipAt(w, p, elevationFt, lapse) : { snowIn: 0, rainIn: 0 };
}
