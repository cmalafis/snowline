"use client";
import { fmtTime, type AppResortData } from "@snowline/core";
import { TIER_COLOR, rankAt, tier, zoneScoreAt, type ScoredDay } from "@/lib/model";
import type { Prefs } from "@/lib/storage";

const HOURS = [9, 10, 11, 12, 13, 14, 15];
const HEAT = [8.5, 9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5];

/** Best zone each hour, its best run and why, with a small heat strip for that zone across the day. */
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

  if (!rows.length) return <p className="muted">No runs match your terrain and difficulty picks.</p>;

  return (
    <ol className="grid">
      {rows.map(({ h, zone, s, top }) => {
        const current = hour >= h && hour < h + 1;
        return (
          <li key={h}>
            <button
              type="button"
              onClick={() => onPick(h, zone.id)}
              className="grid w-full items-center gap-3 border-t border-[var(--line)] py-3 text-left first:border-t-0"
              style={{
                gridTemplateColumns: "58px minmax(0,1fr) 88px",
                background: current ? "linear-gradient(90deg, color-mix(in srgb, var(--accent) 14%, transparent), transparent)" : undefined,
              }}
              aria-label={`${fmtTime(h)}: ${zone.name}, ${top?.run.name ?? ""}`}
            >
              <span className="mono font-semibold">{fmtTime(h).replace(":00", "")}</span>
              <span className="min-w-0">
                <span className="block font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                  {zone.name} <span className={`tag t-${tier(s)}`}>{s}</span>
                </span>
                {top && (
                  <span className="muted block text-[13.5px] leading-snug">
                    {top.run.name}: {top.s.reasons[0] ?? ""}
                  </span>
                )}
              </span>
              <span className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${HEAT.length}, 1fr)` }} aria-hidden>
                {HEAT.map((hh) => {
                  const v = zoneScoreAt(data, day, zone.id, hh, prefs) ?? 0;
                  return <i key={hh} className="block h-5 rounded-[3px]" style={{ background: TIER_COLOR[tier(v)], opacity: 0.25 + 0.75 * Math.max(0, Math.min(1, (v - 35) / 55)) }} title={`${fmtTime(hh)}: ${v}`} />;
                })}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
