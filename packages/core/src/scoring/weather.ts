// Weather inputs for one resort-day, and lookups by hour and elevation.

export interface HourlyPoint {
  /** Local hour this value is valid at (0-23). */
  hour: number;
  temperatureF: number;
  /** Total cloud cover, 0-100. */
  cloudCover: number;
  windMph: number;
  gustMph: number;
  /** Snowfall during the preceding hour, inches. */
  snowfallIn: number;
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
  /** Snow in the 24 hours to opening, inches (summit if available). */
  newSnowIn: number;
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
