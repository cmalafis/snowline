// Synthetic weather days: used by the tests, the score-table checkpoint, and the app's demo days.
import type { DayWeather, HourlyPoint, StationWeather } from "./weather.ts";

interface StationSpec {
  elevationFt: number;
  lowF: number;
  highF: number;
  yesterdayHighF: number;
  overnightLowF: number;
  windMph: number;
  gustMph: number;
}

interface ScenarioSpec {
  id: string;
  title: string;
  date: string;
  cloudCover: number | ((hour: number) => number);
  snowfallInPerHour?: (hour: number) => number;
  newSnowIn: number;
  base: StationSpec;
  summit: StationSpec;
}

/** Diurnal curve: low at dawn, peak mid-afternoon (the prototype's shape). */
function diurnal(lo: number, hi: number, h: number): number {
  if (h <= 6.5) return lo;
  if (h <= 15) return lo + ((hi - lo) * (1 - Math.cos((Math.PI * (h - 6.5)) / 8.5))) / 2;
  return hi - (hi - lo) * Math.min(1, (h - 15) / 15.5);
}

function station(spec: StationSpec, s: ScenarioSpec): StationWeather {
  const hourly: HourlyPoint[] = [];
  for (let h = 0; h < 24; h++) {
    hourly.push({
      hour: h,
      temperatureF: Math.round(diurnal(spec.lowF, spec.highF, h) * 10) / 10,
      cloudCover: typeof s.cloudCover === "function" ? s.cloudCover(h) : s.cloudCover,
      windMph: spec.windMph,
      gustMph: spec.gustMph,
      snowfallIn: s.snowfallInPerHour?.(h) ?? 0,
    });
  }
  return { elevationFt: spec.elevationFt, hourly, yesterdayHighF: spec.yesterdayHighF, overnightLowF: spec.overnightLowF };
}

function build(s: ScenarioSpec): DayWeather {
  return { date: s.date, base: station(s.base, s), summit: station(s.summit, s), newSnowIn: s.newSnowIn, source: `scenario:${s.id}` };
}

const BASE_FT = 6900;
const SUMMIT_FT = 10568;

const SPECS: ScenarioSpec[] = [
  {
    id: "spring",
    title: "Bluebird spring day after a refreeze",
    date: "2026-03-28",
    cloudCover: 5,
    newSnowIn: 0,
    base: { elevationFt: BASE_FT, lowF: 24, highF: 52, yesterdayHighF: 54, overnightLowF: 24, windMph: 5, gustMph: 12 },
    summit: { elevationFt: SUMMIT_FT, lowF: 18, highF: 40, yesterdayHighF: 42, overnightLowF: 18, windMph: 10, gustMph: 18 },
  },
  {
    id: "powder",
    title: "Cold powder day (10\" overnight)",
    date: "2027-01-15",
    cloudCover: (h) => (h < 10 ? 60 : 25),
    snowfallInPerHour: (h) => (h < 6 ? 1.5 : 0),
    newSnowIn: 10,
    base: { elevationFt: BASE_FT, lowF: 2, highF: 16, yesterdayHighF: 20, overnightLowF: 4, windMph: 4, gustMph: 10 },
    summit: { elevationFt: SUMMIT_FT, lowF: -6, highF: 6, yesterdayHighF: 10, overnightLowF: -6, windMph: 8, gustMph: 16 },
  },
  {
    id: "flatlight",
    title: "Overcast flat light, light snow",
    date: "2027-02-10",
    cloudCover: 97,
    snowfallInPerHour: () => 0.3,
    newSnowIn: 2,
    base: { elevationFt: BASE_FT, lowF: 18, highF: 27, yesterdayHighF: 28, overnightLowF: 18, windMph: 6, gustMph: 14 },
    summit: { elevationFt: SUMMIT_FT, lowF: 10, highF: 17, yesterdayHighF: 18, overnightLowF: 10, windMph: 12, gustMph: 22 },
  },
  {
    id: "wind",
    title: "Strong wind, clear and cold",
    date: "2027-02-20",
    cloudCover: 15,
    newSnowIn: 0,
    base: { elevationFt: BASE_FT, lowF: 12, highF: 28, yesterdayHighF: 30, overnightLowF: 12, windMph: 12, gustMph: 26 },
    summit: { elevationFt: SUMMIT_FT, lowF: 4, highF: 16, yesterdayHighF: 18, overnightLowF: 4, windMph: 30, gustMph: 52 },
  },
];

export const SCENARIOS: { id: string; title: string; weather: DayWeather }[] = SPECS.map((s) => ({ id: s.id, title: s.title, weather: build(s) }));
