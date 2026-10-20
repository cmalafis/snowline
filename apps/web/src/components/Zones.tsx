"use client";
import { compassPoint, type AppZone, type SunPosition } from "@snowline/core";
import { TIER_COLOR, tier } from "@/lib/model";
import { Icon } from "./ui";

const C = 150;
const MARKER = 13;
const rad = Math.PI / 180;
const at = (deg: number, r: number) => [C + r * Math.sin(deg * rad), C - r * Math.cos(deg * rad)] as const;

/**
 * Each zone is a numbered dot at its true slope direction. Zones facing the same way step inward to rings
 * further in rather than being pushed round the compass, so a dot never points the wrong way.
 */
function placeMarkers(zones: { id: string; aspectDeg: number }[]): Map<string, readonly [number, number]> {
  const placed = new Map<string, readonly [number, number]>();
  for (const z of zones) {
    let spot: readonly [number, number] | null = null;
    for (const r of [108, 82, 56, 120, 34]) {
      const p = at(z.aspectDeg, r);
      if ([...placed.values()].every(([x, y]) => Math.hypot(x - p[0], y - p[1]) >= MARKER * 2 + 1)) {
        spot = p;
        break;
      }
    }
    // Still crowded: nudge sideways a little at the outer ring.
    for (let d = 8; !spot && d <= 40; d += 8)
      for (const s of [d, -d]) {
        const p = at(z.aspectDeg + s, 108);
        if ([...placed.values()].every(([x, y]) => Math.hypot(x - p[0], y - p[1]) >= MARKER * 2 + 1)) {
          spot = p;
          break;
        }
      }
    placed.set(z.id, spot ?? at(z.aspectDeg, 108));
  }
  return placed;
}

export interface RankedZone {
  zone: AppZone;
  score: number | null;
  n: number;
}

/** Zones ranked best first and numbered; zones with no runs matching the user's settings go last. */
export function rankZones(zones: AppZone[], scores: Map<string, number | null>): RankedZone[] {
  return [...zones]
    .map((zone) => ({ zone, score: scores.get(zone.id) ?? null }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.zone.name.localeCompare(b.zone.name))
    .map((z, i) => ({ ...z, n: i + 1 }));
}

export function ZonesCard({
  ranked,
  sun,
  hereZone,
  onPick,
}: {
  ranked: RankedZone[];
  sun: SunPosition;
  hereZone: string | null;
  onPick: (zoneId: string) => void;
}) {
  const spots = placeMarkers(ranked.map((r) => r.zone));
  const up = sun.elevationDeg > 0;
  const [ax, ay] = at(sun.azimuthDeg - 90, 135);
  const [bx, by] = at(sun.azimuthDeg + 90, 135);
  const [sx, sy] = at(sun.azimuthDeg, 135);
  return (
    <section className="card" aria-label="Zones by slope direction" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h2 className="card-title">Zones by slope direction</h2>
        <div className="card-sub">Each dot sits at the way its zone faces. The yellow arc is the half of the compass in the sun. Tap a zone to see its runs.</div>
      </div>
      <svg
        viewBox="0 0 300 300"
        width="300"
        height="300"
        role="img"
        aria-label={`Compass of zones by slope direction${up ? `; the sun is in the ${compassPoint(sun.azimuthDeg)}` : "; the sun is down"}`}
        style={{ alignSelf: "center", maxWidth: "100%", height: "auto" }}
      >
        {up && <path d={`M${ax} ${ay} A135 135 0 0 1 ${bx} ${by}`} fill="none" stroke="var(--pf-sun)" strokeWidth="10" strokeLinecap="round" opacity="0.35" />}
        <circle cx={C} cy={C} r="125" fill="none" stroke="var(--pf-border)" />
        <circle cx={C} cy={C} r="80" fill="none" stroke="var(--pf-border)" strokeDasharray="3 5" />
        {(["N", "E", "S", "W"] as const).map((l, i) => {
          const [x, y] = at(i * 90, 143);
          return (
            <text key={l} x={x} y={y + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--pf-subtle)" fontFamily="var(--font-display)">
              {l}
            </text>
          );
        })}
        {up && (
          <g aria-hidden="true">
            <circle cx={sx} cy={sy} r="13" fill="var(--pf-sun)" opacity="0.3" />
            <circle cx={sx} cy={sy} r={6 + sun.elevationDeg / 15} fill="var(--pf-sun)" />
          </g>
        )}
        {ranked.map(({ zone, score, n }) => {
          const [x, y] = spots.get(zone.id)!;
          return (
            <g key={zone.id} aria-hidden="true">
              {hereZone === zone.id && <circle cx={x} cy={y} r={MARKER + 5} fill="none" stroke="var(--pf-primary)" strokeWidth="3" />}
              <circle cx={x} cy={y} r={MARKER} fill={score === null ? "var(--pf-track)" : TIER_COLOR[tier(score)]} />
              <text x={x} y={y + 4.5} textAnchor="middle" fontSize="12" fontWeight="700" fill={score === null ? "var(--pf-text)" : "var(--pf-on-marker)"} fontFamily="var(--font-body)">
                {n}
              </text>
            </g>
          );
        })}
      </svg>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {ranked.map(({ zone, score, n }) => (
          <li key={zone.id} style={{ borderTop: "1px solid var(--pf-border)" }}>
            <button
              type="button"
              onClick={() => onPick(zone.id)}
              style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr) 96px", gap: 10, alignItems: "center", width: "100%", minHeight: 56, padding: "6px 0", border: 0, background: "transparent", textAlign: "left", cursor: "pointer" }}
            >
              <span
                style={{ width: 26, height: 26, borderRadius: 999, background: score === null ? "var(--pf-track)" : TIER_COLOR[tier(score)], color: score === null ? "var(--pf-text)" : "var(--pf-on-marker)", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}
                aria-hidden="true"
              >
                {n}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, lineHeight: 1.25 }}>
                  {zone.name}
                  {hereZone === zone.id && <span className="label label-sm label-good">You&apos;re here</span>}
                </span>
                <span className="subtle" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                  faces {compassPoint(zone.aspectDeg)}
                  {zone.windExposed && (
                    <>
                      {" · "}
                      <Icon name="wind" size={14} /> wind-exposed
                    </>
                  )}
                </span>
              </span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <span className="mono" style={{ fontWeight: 500 }}>
                  {score ?? "–"}
                  <span className="sr-only"> out of 100</span>
                </span>
                <span className="bar" style={{ width: 96 }}>
                  <i style={{ width: `${score ?? 0}%`, background: score === null ? "transparent" : TIER_COLOR[tier(score)] }} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
