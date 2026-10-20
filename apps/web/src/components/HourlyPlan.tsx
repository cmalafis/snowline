"use client";
import { fmtTime, type AppResortData } from "@snowline/core";
import { TIER_COLOR, rankAt, tier, zoneScoreAt, type ScoredDay } from "@/lib/model";
import type { Prefs } from "@/lib/storage";

const HOURS = [9, 10, 11, 12, 13, 14, 15];
const HEAT = [8.5, 9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5];

/** Best zone each hour, its best run and why, with a heat strip for that zone across the day. */
export function HourlyPlan({
  data,
  day,
  prefs,
  hour,
  onPick,
}: {
  data: AppResortData;
  day: ScoredDay;
  prefs: Prefs;
  hour: number;
  onPick: (hour: number, zoneId: string) => void;
}) {
  const rows = HOURS.map((h) => {
    let best: { id: string; s: number } | null = null;
    for (const z of data.zones) {
      const s = zoneScoreAt(data, day, z.id, h, prefs);
      if (s !== null && (!best || s > best.s)) best = { id: z.id, s };
    }
    if (!best) return null;
    const zone = data.zones.find((z) => z.id === best.id)!;
    const top = rankAt(data, day, h, prefs).find((r) => r.run.zone === zone.id);
    return { h, zone, s: best.s, top };
  }).filter((r) => r !== null);

  return (
    <section className="card" aria-label="Hour by hour">
      <h2 className="card-title">Your day, hour by hour</h2>
      <div className="card-sub" style={{ marginBottom: 8 }}>
        Best zone each hour, and how it holds up across the day
      </div>
      {!rows.length ? (
        <p className="subtle" style={{ margin: 0 }}>
          No runs match your terrain and difficulty settings.
        </p>
      ) : (
        <ol style={{ margin: "0 -16px", padding: 0, listStyle: "none" }}>
          {rows.map(({ h, zone, s, top }) => {
            const current = hour >= h && hour < h + 1;
            return (
              <li key={h} style={{ borderTop: "1px solid var(--pf-border)" }}>
                <button
                  type="button"
                  onClick={() => onPick(h, zone.id)}
                  aria-current={current ? "time" : undefined}
                  aria-label={`${fmtTime(h)}: ${zone.name}, score ${s}${top ? `, ${top.run.name}` : ""}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "56px minmax(0,1fr) 84px",
                    gap: 10,
                    alignItems: "center",
                    width: "100%",
                    padding: "10px 16px",
                    border: 0,
                    background: current ? "var(--pf-now)" : "transparent",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span className="mono" style={{ fontWeight: 500 }}>
                    {fmtTime(h).replace(":00", "")}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, lineHeight: 1.25 }}>{zone.name}</span>
                      <span className={`label label-sm label-${tier(s)}`} style={{ fontWeight: 700 }}>
                        {s}
                      </span>
                    </span>
                    {top && (
                      <span className="subtle" style={{ display: "block", fontSize: 13, lineHeight: 1.35 }}>
                        {top.run.name}: {top.s.reasons[0] ?? ""}
                      </span>
                    )}
                  </span>
                  <span style={{ display: "grid", gridTemplateColumns: `repeat(${HEAT.length}, minmax(0,1fr))`, gap: 2 }} aria-hidden="true">
                    {HEAT.map((hh) => {
                      const v = zoneScoreAt(data, day, zone.id, hh, prefs) ?? 0;
                      return <i key={hh} style={{ height: 22, borderRadius: 3, background: TIER_COLOR[tier(v)], opacity: 0.3 + 0.7 * Math.max(0, Math.min(1, (v - 35) / 55)) }} />;
                    })}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
