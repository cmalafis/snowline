"use client";
import { useEffect, useState } from "react";
import { compassPoint, exposureOf, fmtTime, scoreAt, type AppRun, type AppTreeArea, type AppZone, type RunScore } from "@snowline/core";
import { tier } from "@/lib/model";
import { sendFeedback, store } from "@/lib/storage";
import { DiffSymbol } from "./DiffSymbol";
import { CoverLabel } from "./RunList";
import { Alert, Icon, ScoreLabel } from "./ui";
import { UnmarkedCautions } from "./Unmarked";

const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const DIRECTION: Record<string, string> = { N: "North", NE: "Northeast", E: "East", SE: "Southeast", S: "South", SW: "Southwest", W: "West", NW: "Northwest" };
const TONE_ICON = { up: { name: "check", color: "var(--pf-prime)" }, down: { name: "warning", color: "var(--pf-skip)" }, flat: { name: "info", color: "var(--pf-subtle)" } } as const;

function ScoreChart({ day, hour }: { day: RunScore[]; hour: number }) {
  const W = 326;
  const H = 150;
  const h0 = day[0]!.hour;
  const h1 = day[day.length - 1]!.hour;
  const lo = Math.max(0, Math.min(50, Math.floor((Math.min(...day.map((s) => s.score)) - 5) / 10) * 10));
  const sx = (h: number) => 16 + ((h - h0) / (h1 - h0)) * (W - 32);
  const sy = (s: number) => 120 - ((s - lo) / (100 - lo)) * 110;
  const line = day.map((s, i) => `${i ? "L" : "M"}${sx(s.hour).toFixed(1)} ${sy(s.score).toFixed(1)}`).join(" ");
  const now = scoreAt(day, hour);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={`Score through the day, from ${day[0]!.score} at opening to ${day[day.length - 1]!.score} at closing; ${now.score} at ${fmtTime(hour)}`}>
      {[
        [80, "Prime 80", "var(--l-prime-bd)", "var(--l-prime-fg)"],
        [65, "Good 65", "var(--l-good-bd)", "var(--l-good-fg)"],
      ]
        .filter(([v]) => (v as number) > lo)
        .map(([v, text, stroke, fill]) => (
          <g key={v as number}>
            <line x1="16" x2={W - 16} y1={sy(v as number)} y2={sy(v as number)} stroke={stroke as string} strokeDasharray="4 4" />
            <text x={W - 16} y={sy(v as number) - 5} textAnchor="end" fontSize="11" fill={fill as string} fontFamily="var(--font-body)">
              {text}
            </text>
          </g>
        ))}
      <path d={`${line} L${sx(h1)} 120 L${sx(h0)} 120 Z`} fill={`var(--pf-${tier(now.score)})`} opacity="0.12" />
      <path d={line} fill="none" stroke={`var(--pf-${tier(now.score)})`} strokeWidth="2.5" strokeLinejoin="round" />
      <line x1={sx(hour)} x2={sx(hour)} y1="8" y2="120" stroke="var(--pf-primary)" strokeWidth="2" />
      <circle cx={sx(hour)} cy={sy(now.score)} r="5" fill="var(--pf-primary)" stroke="var(--pf-surface)" strokeWidth="2" />
      <line x1="16" x2={W - 16} y1="120" y2="120" stroke="var(--pf-border-strong)" />
      {[9, 11, 13, 15].map((h) => (
        <text key={h} x={sx(h)} y="140" textAnchor="middle" fontSize="11" fill="var(--pf-subtle)" fontFamily="var(--font-mono)">
          {fmtTime(h).replace(":00", "")}
        </text>
      ))}
    </svg>
  );
}

function ProfileChart({ profile }: { profile: [number, number][] }) {
  if (profile.length < 2) return <p className="subtle" style={{ margin: 0, fontSize: 14 }}>No elevation profile for area runs (glades and bowls).</p>;
  const W = 326;
  const H = 130;
  const xs = profile.map((p) => p[0]);
  const ys = profile.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => 16 + ((x - x0) / (x1 - x0 || 1)) * (W - 32);
  const sy = (y: number) => 18 + (1 - (y - y0) / (y1 - y0 || 1)) * 86;
  const line = profile.map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={`Drops from ${Math.round(y1).toLocaleString()} to ${Math.round(y0).toLocaleString()} feet over ${(x1 / 1609).toFixed(2)} miles`}>
      <path d={`${line} L${sx(x1)} 110 L${sx(x0)} 110 Z`} fill="var(--pf-good)" opacity="0.12" />
      <path d={line} fill="none" stroke="var(--pf-good)" strokeWidth="2.5" strokeLinejoin="round" />
      <text x="20" y="12" fontSize="11" fill="var(--pf-subtle)" fontFamily="var(--font-mono)">
        {Math.round(y1).toLocaleString()} ft
      </text>
      <text x={W - 16} y={H - 4} textAnchor="end" fontSize="11" fill="var(--pf-subtle)" fontFamily="var(--font-mono)">
        {Math.round(y0).toLocaleString()} ft · {(x1 / 1609).toFixed(2)} mi
      </text>
    </svg>
  );
}

export function RunSheet({
  resortId,
  date,
  run,
  treelineFt,
  zone,
  day,
  hour,
  groomedToday,
  groomedOverride,
  aspectFix,
  favorite,
  onClose,
  onFavorite,
  onGroomed,
  onAspect,
  onShowMap,
  avalanche,
}: {
  resortId: string;
  date: string;
  run: AppRun | AppTreeArea;
  treelineFt: number;
  zone: AppZone | undefined;
  day: RunScore[];
  hour: number;
  groomedToday: boolean;
  groomedOverride: boolean;
  aspectFix: number | undefined;
  favorite: boolean;
  onClose: () => void;
  onFavorite: () => void;
  onGroomed: (v: boolean | null) => void;
  onAspect: (deg: number | null) => void;
  onShowMap: () => void;
  avalanche: { name: string; url: string } | null;
}) {
  const area = "unmarked" in run ? run : null;
  const s = scoreAt(day, hour);
  const best = day.reduce((m, x) => (x.score > m.score ? x : m));
  const previous = store.ratings().find((r) => r.runId === run.id && r.date === date)?.rating ?? null;
  const [rating, setRating] = useState<number | null>(previous);
  const [sent, setSent] = useState<null | "sent" | "queued">(previous ? "sent" : null);
  const [editAspect, setEditAspect] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = async () => {
    if (!rating) return;
    store.addRating({ resort: resortId, runId: run.id, runName: run.name, date, hour, predicted: s.score, rating, at: new Date().toISOString() });
    const ok = await sendFeedback({ kind: "rating", resort: resortId, runId: run.id, runName: run.name, date, hour, predicted: s.score, rating });
    setSent(ok ? "sent" : "queued");
  };

  const shownAspect = aspectFix ?? run.aspectDeg;
  const facts: [string, string][] = [
    ...(area
      ? ([
          ["Size", `${Math.round(area.areaHa * 2.47)} acres (${area.areaHa} ha)`],
          ["Between", area.nearRuns.length ? area.nearRuns.join(", ") : "No named runs nearby"],
        ] as [string, string][])
      : []),
    ["Tree cover", run.canopyPct !== undefined ? `${run.canopyPct}% canopy on the run, ${run.shelterPct}% around it` : "No canopy data; estimated from the run type"],
    [
      "Faces",
      `${DIRECTION[compassPoint(shownAspect)]} (${shownAspect}°)${aspectFix !== undefined ? ", your correction" : ""}${run.mixedAspect && run.parts ? `; mixed: ${run.parts.map((p) => `${compassPoint(p.aspectDeg)} ${Math.round(p.weight * 100)}%`).join(", ")}` : ""}`,
    ],
    ["Pitch", `${run.pitchDeg.toFixed(1)}°`],
    ["Elevation", `${run.topFt.toLocaleString()} → ${run.bottomFt.toLocaleString()} ft`],
    ["Temperature", `${s.tempF}°F at ${fmtTime(hour)}`],
  ];

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden />
      <section className="sheet" role="dialog" aria-modal="true" aria-label={run.name}>
        <div className="sheet-head">
          <div className="grabber" aria-hidden />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div className="subtle" style={{ fontSize: 14 }}>
                {zone?.name ?? "—"}
              </div>
              <h2 className="display" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10, fontSize: 28, lineHeight: 1.15 }}>
                <DiffSymbol d={run.difficulty} size={22} />
                {run.name}
              </h2>
            </div>
            <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
            <ScoreLabel score={s.score} label={s.label} />
            {area && (
              <span className="label label-skip">
                <Icon name="danger" size={16} />
                Unmarked, off-piste
              </span>
            )}
            <span className="label label-neutral">
              Best around {fmtTime(best.hour)} ({best.score})
            </span>
            <CoverLabel run={run} treelineFt={treelineFt} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onFavorite} aria-pressed={favorite}>
              <Icon name={favorite ? "starFilled" : "star"} size={18} />
              {favorite ? "Favorite" : "Add favorite"}
            </button>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onShowMap}>
              <Icon name="map" size={18} />
              On the map
            </button>
          </div>
        </div>

        <div className="sheet-body">
          {area && (
            <>
              <div className="alert alert-danger" role="alert" data-testid="unmarked-caution">
                <Icon name="danger" />
                <div>
                  <div className="alert-title">Unmarked tree area: use caution</div>
                  <div className="alert-body">
                    Found in tree-cover and terrain data, not on the trail map. Not patrolled like a run, and it may be closed. Obey all closures and ski with a
                    partner.
                  </div>
                </div>
              </div>
              <section className="card" aria-label="Hazards found for this area">
                <h3 className="card-title" style={{ marginBottom: 8 }}>
                  Hazards found for this area
                </h3>
                {area.hazards.length ? (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                    {area.hazards.map((h) => (
                      <li key={h} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <Icon name="warning" style={{ color: "var(--a-warn-icon)", marginTop: 2 }} />
                        {h}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="subtle" style={{ margin: 0, fontSize: 14 }}>
                    None found in the data. That doesn&apos;t mean there aren&apos;t any.
                  </p>
                )}
              </section>
              <section className="card" aria-label="Before you go in">
                <h3 className="card-title" style={{ marginBottom: 10 }}>
                  Before you go in
                </h3>
                <UnmarkedCautions avalanche={avalanche} />
              </section>
            </>
          )}
          {s.warnings.map((w) => (
            <Alert key={w} variant="warning" title={w}>
              {/lift holds/i.test(w) && exposureOf(run, treelineFt) < 0.5
                ? "This run is in the trees, so it skis well once you're on it. Getting up may take a wait."
                : undefined}
            </Alert>
          ))}

          <section className="card" aria-label={`Why it scores ${s.score}`}>
            <h3 className="card-title" style={{ marginBottom: 8 }}>
              Why it scores {s.score} at {fmtTime(hour)}
            </h3>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {s.reasons.map((r, i) => {
                const tone = TONE_ICON[s.tones[i] ?? "flat"];
                return (
                  <li key={r} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Icon name={tone.name} style={{ color: tone.color, marginTop: 2 }} />
                    {r}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card" aria-label="Score through the day">
            <h3 className="card-title">Score through the day</h3>
            <div className="card-sub" style={{ marginBottom: 8 }}>
              Best around {fmtTime(best.hour)}; the blue line is the time you&apos;re looking at
            </div>
            <ScoreChart day={day} hour={hour} />
          </section>

          <section className="card" aria-label="On this run">
            <h3 className="card-title" style={{ marginBottom: 4 }}>
              On this run
            </h3>
            <dl className="dl">
              {facts.map(([term, value]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              {!area && <div>
                <dt>Groomed today</dt>
                <dd>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 10, minHeight: 44, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={groomedToday}
                      onChange={(e) => {
                        onGroomed(e.target.checked);
                        void sendFeedback({ kind: "correction", resort: resortId, runId: run.id, runName: run.name, date, groomed: e.target.checked });
                      }}
                      style={{ width: 44, height: 24, accentColor: "var(--pf-primary)", margin: 0 }}
                    />
                    {groomedToday ? "Yes" : "No"}
                    {groomedOverride ? " (your report)" : ""}
                  </label>
                </dd>
              </div>}
            </dl>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-link" onClick={() => setEditAspect((v) => !v)} aria-expanded={editAspect}>
                Faces a different way? Correct it
              </button>
              {groomedOverride && (
                <button type="button" className="btn btn-link" onClick={() => onGroomed(null)}>
                  Reset grooming
                </button>
              )}
            </div>
            {editAspect && (
              <div role="group" aria-label="Which way does it face?" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8, marginTop: 4 }}>
                {POINTS.map((p, i) => (
                  <button
                    key={p}
                    type="button"
                    className="filter-btn"
                    style={{ justifyContent: "center" }}
                    aria-pressed={aspectFix !== undefined && compassPoint(aspectFix) === p}
                    onClick={() => {
                      onAspect(i * 45);
                      void sendFeedback({ kind: "correction", resort: resortId, runId: run.id, runName: run.name, aspect: i * 45 });
                    }}
                  >
                    {p}
                  </button>
                ))}
                {aspectFix !== undefined && (
                  <button type="button" className="btn btn-link" style={{ gridColumn: "1 / -1", justifySelf: "start" }} onClick={() => onAspect(null)}>
                    Use the computed aspect ({compassPoint(run.aspectDeg)})
                  </button>
                )}
              </div>
            )}
          </section>

          {!area && (
            <section className="card" aria-label="Elevation profile">
              <h3 className="card-title" style={{ marginBottom: 8 }}>
                Elevation profile
              </h3>
              <ProfileChart profile={run.profile} />
            </section>
          )}

          <section className="card" aria-label="How did it ski?" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 className="card-title">How did it ski?</h3>
            <div className="card-sub">Rate it after your run. It&apos;s sent with the predicted score to calibrate the model.</div>
            <div className="toggle-group" role="group" aria-label="Rating from 1 to 5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={rating === n}
                  onClick={() => {
                    setRating(n);
                    setSent(null);
                  }}
                  style={{ fontWeight: 700, minHeight: 48 }}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="subtle" style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: -4 }}>
              <span>Awful</span>
              <span>Perfect</span>
            </div>
            <button type="button" className="btn btn-primary" disabled={!rating || sent === "sent"} onClick={send}>
              {sent === "sent" ? "Thanks, rating sent" : "Send rating"}
            </button>
            {sent === "queued" && <div className="card-sub">Saved. It&apos;ll send when you have signal.</div>}
          </section>
        </div>
      </section>
    </>
  );
}
