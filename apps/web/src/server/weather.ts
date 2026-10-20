import "server-only";
import { addDays, todayIn, type AppResort, type DayWeather, type HourlyPoint, type StationWeather } from "@snowline/core";

const HOURLY = [
  "temperature_2m",
  "cloud_cover",
  "wind_speed_10m",
  "wind_gusts_10m",
  "snowfall",
  "precipitation",
  "direct_normal_irradiance",
  "diffuse_radiation",
] as const;
const TTL_MS = 30 * 60 * 1000;
const M_PER_FT = 0.3048;

interface OpenMeteoLocation {
  elevation: number;
  hourly: Record<"time" | (typeof HOURLY)[number], (string | number | null)[]>;
}

const cache = new Map<string, { at: number; value: Promise<OpenMeteoLocation[]> }>();

/** Hourly forecast for base and summit (three days back through tomorrow), downscaled by Open-Meteo to each elevation. */
async function fetchForecast(resort: AppResort): Promise<OpenMeteoLocation[]> {
  const key = resort.id;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const params = new URLSearchParams({
    latitude: `${resort.base.lat},${resort.summit.lat}`,
    longitude: `${resort.base.lon},${resort.summit.lon}`,
    elevation: `${Math.round(resort.base.elevationFt * M_PER_FT)},${Math.round(resort.summit.elevationFt * M_PER_FT)}`,
    hourly: HOURLY.join(","),
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: resort.tz,
    past_days: "3",
    forecast_days: "3",
  });
  const value = fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) }).then(async (res) => {
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as OpenMeteoLocation[];
  });
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const num = (v: string | number | null | undefined, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

function station(loc: OpenMeteoLocation, date: string, elevationFt: number): StationWeather {
  const times = loc.hourly.time as string[];
  const rows = times.map((t, i) => ({ t, i }));
  const at = (prefix: string) => rows.filter((r) => r.t.startsWith(prefix));
  const value = (field: (typeof HOURLY)[number], i: number) => num(loc.hourly[field][i]);

  const hourly: HourlyPoint[] = at(date).map(({ t, i }) => ({
    hour: Number(t.slice(11, 13)),
    temperatureF: value("temperature_2m", i),
    cloudCover: value("cloud_cover", i),
    windMph: value("wind_speed_10m", i),
    gustMph: value("wind_gusts_10m", i),
    snowfallIn: value("snowfall", i),
    precipIn: value("precipitation", i),
    directNormal: value("direct_normal_irradiance", i),
    diffuse: value("diffuse_radiation", i),
  }));
  const yesterday = addDays(date, -1);
  const yHigh = Math.max(...at(yesterday).map(({ i }) => value("temperature_2m", i)));
  // Overnight: 6pm yesterday to 8am today.
  const night = rows.filter((r) => (r.t >= `${yesterday}T18:00` && r.t <= `${date}T08:00`)).map(({ i }) => value("temperature_2m", i));
  return { elevationFt, hourly, yesterdayHighF: yHigh, overnightLowF: Math.min(...night) };
}

/** Snow in the `days` × 24 hours up to 8am on `date`. */
function snowTotal(loc: OpenMeteoLocation, date: string, days: number): number {
  const times = loc.hourly.time as string[];
  const from = `${addDays(date, -days)}T08:00`;
  const to = `${date}T08:00`;
  return times.reduce((s, t, i) => (t > from && t <= to ? s + num(loc.hourly.snowfall[i]) : s), 0);
}

/** Strongest gust from 4pm the day before to 8am on `date`. */
function overnightMaxGust(loc: OpenMeteoLocation, date: string): number {
  const times = loc.hourly.time as string[];
  const from = `${addDays(date, -1)}T16:00`;
  const to = `${date}T08:00`;
  return times.reduce((m, t, i) => (t >= from && t <= to ? Math.max(m, num(loc.hourly.wind_gusts_10m[i])) : m), 0);
}

/** Weather for `date` (default: today at the resort), or null if it's outside the forecast window. */
export async function dayWeather(resort: AppResort, date?: string): Promise<DayWeather | null> {
  const today = todayIn(resort.tz);
  const d = date ?? today;
  if (d < today || d > addDays(today, 1)) return null;
  const [base, summit] = await fetchForecast(resort);
  if (!base || !summit) throw new Error("Open-Meteo returned too few locations");
  return {
    date: d,
    base: station(base, d, resort.base.elevationFt),
    summit: station(summit, d, resort.summit.elevationFt),
    newSnowIn: round1(snowTotal(summit, d, 1)),
    newSnowBaseIn: round1(snowTotal(base, d, 1)),
    stormTotalIn: round1(snowTotal(summit, d, 3)),
    overnightMaxGustMph: Math.round(overnightMaxGust(summit, d)),
    source: "open-meteo",
  };
}
