"use client";
import { compassPoint, type AppZone, type SunPosition } from "@snowline/core";
import { TIER_COLOR, tier, zoneShort } from "@/lib/model";

const CX = 170;
const CY = 170;
const WEDGE = 36; // degrees each zone wedge spans
const rad = Math.PI / 180;
const pt = (a: number, r: number) => [CX + r * Math.sin(a * rad), CY - r * Math.cos(a * rad)] as const;

/**
 * Spread zones around the dial so wedges don't overlap: each sits as close to its true aspect as it can,
 * at least one wedge apart. The true aspect is marked with a tick on the rim.
 */
function layout(zones: AppZone[]): Map<string, number> {
  const items = zones.map((z) => ({ id: z.id, want: z.aspectDeg, at: z.aspectDeg })).sort((a, b) => a.want - b.want);
  const gap = Math.min(WEDGE + 4, 360 / Math.max(1, items.length));
  for (let iter = 0; iter < 200; iter++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      const a = items[i]!;
      const b = items[(i + 1) % items.length]!;
      let d = (((b.at - a.at) % 360) + 360) % 360;
      if (items.length === 1) break;
      if (d < gap) {
        const push = (gap - d) / 2 + 0.01;
        a.at -= push;
        b.at += push;
        moved = true;
      }
    }
    // Pull gently back toward true aspects.
    for (const it of items) {
      const diff = ((it.want - it.at + 540) % 360) - 180;
      it.at += diff * 0.05;
    }
    if (!moved && iter > 20) break;
  }
  return new Map(items.map((i) => [i.id, ((i.at % 360) + 360) % 360]));
}

export function Dial({
  zones,
  scores,
  sun,
  selected,
  hereZone,
  onSelect,
}: {
  zones: AppZone[];
  scores: Map<string, number | null>;
  sun: SunPosition;
  selected: string | null;
  hereZone: string | null;
  onSelect: (id: string | null) => void;
}) {
  const at = layout(zones);
  const up = sun.elevationDeg > 0;
  const arc = (r: number, a0: number, a1: number) => {
    const [x0, y0] = pt(a0, r);
    const [x1, y1] = pt(a1, r);
    return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`;
  };
  return (
    <svg viewBox="0 0 340 340" className="w-full max-w-[360px] h-auto" role="group" aria-label="Zones by the direction their slopes face, coloured by snow score, with the sun's direction">
      {/* The half of the compass facing the sun: slopes pointing this way are in the sun. */}
      {up && <path d={`${arc(128, sun.azimuthDeg - 90, sun.azimuthDeg + 90)}`} fill="none" stroke="var(--sun)" strokeWidth="10" strokeLinecap="round" opacity=".35" />}
      <circle cx={CX} cy={CY} r="128" fill="none" stroke="var(--line)" />
      <circle cx={CX} cy={CY} r="58" fill="none" stroke="var(--line)" />
      {["N", "E", "S", "W"].map((l, i) => {
        const [x, y] = pt(i * 90, 152);
        return (
          <text key={l} x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--muted)" style={{ fontFamily: "var(--font-display)" }}>
            {l}
          </text>
        );
      })}
      {zones.map((z) => {
        const a = at.get(z.id)!;
        const s = scores.get(z.id) ?? null;
        const a0 = a - WEDGE / 2;
        const a1 = a + WEDGE / 2;
        const [ox0, oy0] = pt(a0, 122);
        const [ox1, oy1] = pt(a1, 122);
        const [ix1, iy1] = pt(a1, 64);
        const [ix0, iy0] = pt(a0, 64);
        const d = `M${ix0} ${iy0} L${ox0} ${oy0} A122 122 0 0 1 ${ox1} ${oy1} L${ix1} ${iy1} A64 64 0 0 0 ${ix0} ${iy0}Z`;
        const color = s === null ? "var(--line)" : TIER_COLOR[tier(s)];
        const opacity = s === null ? 0.4 : 0.35 + 0.65 * Math.max(0, Math.min(1, (s - 35) / 55));
        const [lx, ly] = pt(a, 93);
        const [tx0, ty0] = pt(z.aspectDeg, 124);
        const [tx1, ty1] = pt(z.aspectDeg, 132);
        const isSel = selected === z.id;
        const toggle = () => onSelect(isSel ? null : z.id);
        return (
          <g
            key={z.id}
            role="button"
            tabIndex={0}
            aria-pressed={isSel}
            aria-label={`${z.name}, slopes face ${compassPoint(z.aspectDeg)}, score ${s ?? "no matching runs"}`}
            onClick={toggle}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle())}
            style={{ cursor: "pointer" }}
          >
            <path d={d} fill="var(--surface)" />
            <path d={d} fill={color} opacity={opacity} stroke={isSel ? "var(--ink)" : "var(--surface)"} strokeWidth={isSel ? 3 : 1.5} />
            <line x1={tx0} y1={ty0} x2={tx1} y2={ty1} stroke="var(--ink)" strokeWidth="2" opacity=".6" />
            {hereZone === z.id && <circle cx={lx} cy={ly - 20} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />}
            <text x={lx} y={ly - 3} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="var(--ink)" style={{ fontFamily: "var(--font-display)" }}>
              {zoneShort(z)}
            </text>
            <text x={lx} y={ly + 12} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)" style={{ fontFamily: "var(--font-mono)" }}>
              {s ?? "–"}
            </text>
          </g>
        );
      })}
      {up &&
        (() => {
          const [sx, sy] = pt(sun.azimuthDeg, 140);
          const r = 7 + sun.elevationDeg / 9;
          return (
            <g aria-hidden>
              <circle cx={sx} cy={sy} r={r + 6} fill="var(--sun)" opacity=".25" />
              <circle cx={sx} cy={sy} r={r} fill="var(--sun)" />
            </g>
          );
        })()}
      <text x={CX} y={CY - 4} textAnchor="middle" fontSize="10" fontWeight="800" letterSpacing="1" fill="var(--muted)">
        SLOPES
      </text>
      <text x={CX} y={CY + 10} textAnchor="middle" fontSize="10" fontWeight="800" letterSpacing="1" fill="var(--muted)">
        FACING
      </text>
    </svg>
  );
}
