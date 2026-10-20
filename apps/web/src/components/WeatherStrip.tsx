"use client";
import { cloudAt, fmtTime, precipRateAt, temperatureAt, windAt, type AppResort, type DayWeather } from "@snowline/core";

const HOURS = [9, 10, 11, 12, 13, 14, 15];

function skyIcon(cloud: number, snow: number, rain: number): { icon: string; label: string } {
  if (rain >= 0.01) return { icon: "🌧", label: "Rain" };
  if (snow >= 0.2) return { icon: "🌨", label: "Snow" };
  if (cloud < 20) return { icon: "☀︎", label: "Sunny" };
  if (cloud < 50) return { icon: "🌤", label: "Mostly sunny" };
  if (cloud < 80) return { icon: "⛅︎", label: "Partly cloudy" };
  return { icon: "☁︎", label: "Overcast" };
}

/** The weather the scores are built from, hour by hour: sky, mid-mountain temperature, snow or rain, summit gusts. */
export function WeatherStrip({ resort, weather, hour, onHour }: { resort: AppResort; weather: DayWeather; hour: number; onHour: (h: number) => void }) {
  const midFt = (resort.base.elevationFt + resort.summit.elevationFt) / 2;
  return (
    <div className="mt-1 grid grid-cols-7 gap-1" role="group" aria-label="Weather by hour (mid-mountain)">
      {HOURS.map((h) => {
        const t = Math.round(temperatureAt(weather, h, midFt, 3.5));
        const cloud = cloudAt(weather, h, midFt);
        const p = precipRateAt(weather, h, midFt, 3.5);
        const gust = Math.round(windAt(weather, h, resort.summit.elevationFt).gustMph);
        const sky = skyIcon(cloud, p.snowIn, p.rainIn);
        const current = hour >= h && hour < h + 1;
        return (
          <button
            key={h}
            type="button"
            onClick={() => onHour(h)}
            className="grid justify-items-center rounded-lg py-1 text-center"
            style={{ background: current ? "color-mix(in srgb, var(--accent) 14%, transparent)" : undefined, minHeight: 72 }}
            aria-label={`${fmtTime(h)}: ${sky.label}, ${t}°F mid-mountain${p.snowIn >= 0.1 ? `, ${p.snowIn.toFixed(1)} inches of snow an hour` : ""}, gusts ${gust} mph up top`}
          >
            <span className="mono muted text-[11px]">{fmtTime(h).replace(":00", "")}</span>
            <span className="text-[18px] leading-tight" aria-hidden>
              {sky.icon}
            </span>
            <span className="mono text-[13px] font-semibold">{t}°</span>
            <span className="mono muted text-[11px]">{p.snowIn >= 0.1 ? `${p.snowIn.toFixed(1)}"` : gust >= 25 ? `${gust}mph` : " "}</span>
          </button>
        );
      })}
    </div>
  );
}
