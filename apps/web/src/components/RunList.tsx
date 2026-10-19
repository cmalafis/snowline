"use client";
import { compassPoint, type AppZone } from "@snowline/core";
import { TIER_COLOR, tier, type Ranked } from "@/lib/model";
import { DiffSymbol } from "./DiffSymbol";

export function groomLabel(r: Ranked, groomedToday: boolean): string {
  if (r.run.type === "groomer") return groomedToday ? "groomed" : "not groomed";
  return { bump: "bumps", tree: "trees", bowl: "bowl/chute" }[r.run.type];
}

export function RunRow({
  r,
  zone,
  groomedToday,
  favorite,
  edited,
  distanceM,
  onOpen,
}: {
  r: Ranked;
  zone: AppZone | undefined;
  groomedToday: boolean;
  favorite: boolean;
  edited: boolean;
  distanceM?: number;
  onOpen: () => void;
}) {
  const t = tier(r.s.score);
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="run-row"
      className="grid w-full items-center gap-3 border-t border-[var(--line)] py-3 text-left"
      style={{ gridTemplateColumns: "22px minmax(0,1fr) 84px", minHeight: 64 }}
    >
      <DiffSymbol d={r.run.difficulty} />
      <span className="min-w-0">
        <span className="block font-extrabold leading-tight">
          {favorite && <span aria-label="Favourite">★ </span>}
          {r.run.name}
        </span>
        <span className="mono muted block text-[12.5px]">
          {zone?.name ?? "—"} · faces {compassPoint(r.run.aspectDeg)}
          {r.run.mixedAspect ? " (mixed)" : ""} · {groomLabel(r, groomedToday)} · {r.s.tempF}°F
          {edited ? " · edited" : ""}
          {distanceM !== undefined ? ` · ${distanceM < 1000 ? `${Math.round(distanceM / 10) * 10} m` : `${(distanceM / 1609).toFixed(1)} mi`}` : ""}
        </span>
        <span className="muted mt-0.5 block text-[13.5px] leading-snug">{r.s.reasons.join(". ")}</span>
        {r.s.warnings.map((w) => (
          <span key={w} className="mt-0.5 block text-[13px] font-bold" style={{ color: "var(--bad)" }}>
            ⚠ {w}
          </span>
        ))}
      </span>
      <span className="grid justify-items-end gap-1">
        <b className="mono text-[20px] leading-none">{r.s.score}</b>
        <span className="bar w-[84px]">
          <i style={{ width: `${r.s.score}%`, background: TIER_COLOR[t] }} />
        </span>
        <span className={`tag t-${t}`}>{r.s.label}</span>
      </span>
    </button>
  );
}
