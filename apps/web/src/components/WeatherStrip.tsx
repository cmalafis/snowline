"use client";
import { cloudAt, fmtTime, precipRateAt, temperatureAt, windAt, type AppResort, type DayWeather } from "@snowline/core";
import { Icon } from "./ui";

const HOURS = [9, 10, 11, 12, 13, 14, 15];

function sky(cloud: number, snow: number, rain: number): { icon: "rain" | "snow" | "sun" | "partly" | "cloud"; label: string; color: string } {
  if (rain >= 0.01) return { icon: "rain", label: "Rain", color: "var(--pf-good)" };
  if (snow >= 0.2) return { icon: "snow", label: "Snow", color: "var(--pf-good)" };
  if (cloud < 20) return { icon: "sun", label: "Sunny", color: "var(--pf-sun)" };
  if (cloud < 50) return { icon: "partly", label: "Mostly sunny", color: "var(--pf-sun)" };
  if (cloud < 80) return { icon: "partly", label: "Partly cloudy", color: "var(--pf-subtle)" };
  return { icon: "cloud", label: "Overcast", color: "var(--pf-subtle)" };
}

/** The weather the scores are built from, hour by hour: sky, mid-mountain temperature, snow or rain, summit gusts. */
export function WeatherStrip({ resort, weather, hour, onHour }: { resort: AppResort; weather: DayWeather; hour: number; onHour: (h: number) => void }) {
  const midFt = (resort.base.elevationFt + resort.summit.elevationFt) / 2;
  return (
    <div role="group" aria-label="Weather by hour, mid-mountain" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 4, borderTop: "1px solid var(--pf-border)", paddingTop: 12 }}>
      {HOURS.map((h) => {
        const t = Math.round(temperatureAt(weather, h, midFt, 3.5));
        const p = precipRateAt(weather, h, midFt, 3.5);
        const gust = Math.round(windAt(weather, h, resort.summit.elevationFt).gustMph);
        const s = sky(cloudAt(weather, h, midFt), p.snowIn, p.rainIn);
        const current = hour >= h && hour < h + 1;
        return (
          <button
            key={h}
            type="button"
            onClick={() => onHour(h)}
            aria-label={`${fmtTime(h)}: ${s.label}, ${t}°F mid-mountain${p.snowIn >= 0.1 ? `, ${p.snowIn.toFixed(1)} inches of snow an hour` : ""}, gusts ${gust} mph up top`}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minHeight: 80, padding: "6px 0", border: 0, borderRadius: 12, background: current ? "var(--pf-now)" : "transparent", cursor: "pointer" }}
          >
            <span className="mono subtle" style={{ fontSize: 11 }}>
              {fmtTime(h).replace(":00", "")}
            </span>
            <Icon name={s.icon} style={{ color: s.color }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>{t}°</span>
            <span className="mono subtle" style={{ fontSize: 11 }}>
              {p.snowIn >= 0.1 ? `${p.snowIn.toFixed(1)}"` : gust >= 25 ? `${gust}mph` : " "}
            </span>
          </button>
        );
      })}
    </div>
  );
}
