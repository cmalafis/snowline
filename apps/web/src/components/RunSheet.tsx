"use client";
import { useEffect, useState } from "react";
import { compassPoint, fmtTime, scoreAt, type AppRun, type AppZone, type RunScore } from "@snowline/core";
import { TIER_COLOR, tier } from "@/lib/model";
import { sendFeedback, store } from "@/lib/storage";
import { DiffSymbol } from "./DiffSymbol";

const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

function ProfileChart({ profile }: { profile: [number, number][] }) {
  if (profile.length < 2) return <p className="muted text-sm">No elevation profile for area runs (glades and bowls).</p>;
  const W = 320;
  const H = 110;
  const xs = profile.map((p) => p[0]);
  const ys = profile.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => 4 + ((x - x0) / (x1 - x0 || 1)) * (W - 8);
  const sy = (y: number) => 10 + (1 - (y - y0) / (y1 - y0 || 1)) * (H - 26);
  const line = profile.map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Elevation profile from ${Math.round(y1)} to ${Math.round(y0)} feet`}>
      <path d={`${line} L${sx(x1)} ${H - 16} L${sx(x0)} ${H - 16}Z`} fill="var(--shade)" opacity=".18" />
      <path d={line} fill="none" stroke="var(--shade)" strokeWidth="2.5" />
      <text x="4" y="9" fontSize="10" fill="var(--muted)" className="mono">
        {Math.round(y1).toLocaleString()} ft
      </text>
      <text x={W - 4} y={H - 3} fontSize="10" fill="var(--muted)" textAnchor="end" className="mono">
        {Math.round(y0).toLocaleString()} ft · {(x1 / 1609).toFixed(2)} mi
      </text>
    </svg>
  );
}

function ScoreChart({ day, hour }: { day: RunScore[]; hour: number }) {
  const W = 320;
  const H = 120;
  const h0 = day[0]!.hour;
  const h1 = day[day.length - 1]!.hour;
  const sx = (h: number) => 6 + ((h - h0) / (h1 - h0)) * (W - 12);
  const sy = (s: number) => 8 + (1 - s / 100) * (H - 28);
  const line = day.map((s, i) => `${i ? "L" : "M"}${sx(s.hour).toFixed(1)} ${sy(s.score).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Score through the day">
      {[80, 65, 50].map((v) => (
        <line key={v} x1="6" x2={W - 6} y1={sy(v)} y2={sy(v)} stroke="var(--line)" strokeDasharray="3 4" />
      ))}
      {day.map((s) => (
        <rect key={s.hour} x={sx(s.hour) - 4} y={sy(s.score)} width="8" height={H - 20 - sy(s.score)} fill={TIER_COLOR[tier(s.score)]} opacity=".25" />
      ))}
      <path d={line} fill="none" stroke="var(--ink)" strokeWidth="2.5" />
      <line x1={sx(hour)} x2={sx(hour)} y1="4" y2={H - 20} stroke="var(--accent)" strokeWidth="2" />
      {[9, 11, 13, 15].map((h) => (
        <text key={h} x={sx(h)} y={H - 4} fontSize="10" textAnchor="middle" fill="var(--muted)" className="mono">
          {fmtTime(h).replace(":00", "")}
        </text>
      ))}
    </svg>
  );
}

export function RunSheet({
  resortId,
  date,
  run,
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
}: {
  resortId: string;
  date: string;
  run: AppRun;
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
}) {
  const s = scoreAt(day, hour);
  const best = day.reduce((m, x) => (x.score > m.score ? x : m));
  const [rated, setRated] = useState<number | null>(() => store.ratings().find((r) => r.runId === run.id && r.date === date)?.rating ?? null);
  const [editAspect, setEditAspect] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rate = (n: number) => {
    setRated(n);
    store.addRating({ resort: resortId, runId: run.id, runName: run.name, date, hour, predicted: s.score, rating: n, at: new Date().toISOString() });
    void sendFeedback({ kind: "rating", resort: resortId, runId: run.id, runName: run.name, date, hour, predicted: s.score, rating: n });
  };

  const shownAspect = aspectFix ?? run.aspectDeg;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden />
      <section className="sheet" role="dialog" aria-modal="true" aria-label={run.name}>
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-[var(--line)]" aria-hidden />
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[24px] font-black leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              <DiffSymbol d={run.difficulty} size={22} />
              {run.name}
            </h2>
            <p className="mono muted text-[13px]">
              {zone?.name ?? "—"} · {run.topFt.toLocaleString()}→{run.bottomFt.toLocaleString()} ft · {run.pitchDeg.toFixed(0)}° pitch
            </p>
          </div>
          <button type="button" className="btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`tag t-${tier(s.score)}`} style={{ fontSize: 13 }}>
            {s.label} {s.score}
          </span>
          <span className="muted text-sm">
            at {fmtTime(hour)} · best around {fmtTime(best.hour)} ({best.score})
          </span>
        </div>
        <ul className="mt-2 grid gap-1">
          {s.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
          {s.warnings.map((w) => (
            <li key={w} className="font-bold" style={{ color: "var(--bad)" }}>
              ⚠ {w}
            </li>
          ))}
        </ul>

        <h3 className="label mt-4">Score through the day</h3>
        <ScoreChart day={day} hour={hour} />

        <h3 className="label mt-3">Elevation profile</h3>
        <ProfileChart profile={run.profile} />

        <h3 className="label mt-3">Slope</h3>
        <p className="text-[15px]">
          Faces <b>{compassPoint(shownAspect)}</b> ({shownAspect}°){aspectFix !== undefined ? " — your correction" : ""}
          {run.mixedAspect && run.parts ? ` · mixed: ${run.parts.map((p) => `${compassPoint(p.aspectDeg)} ${Math.round(p.weight * 100)}%`).join(", ")}` : ""}
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" className="btn" onClick={onFavorite} aria-pressed={favorite}>
            {favorite ? "★ Favourite" : "☆ Add to favourites"}
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={groomedOverride}
            onClick={() => {
              const next = !groomedToday;
              onGroomed(next);
              void sendFeedback({ kind: "correction", resort: resortId, runId: run.id, runName: run.name, date, groomed: next });
            }}
          >
            {groomedToday ? "Groomed today ✓ (tap if not)" : "Not groomed today (tap if it was)"}
          </button>
          <button type="button" className="btn" onClick={() => setEditAspect((v) => !v)} aria-expanded={editAspect}>
            Faces a different way?
          </button>
          {groomedOverride && (
            <button type="button" className="linkbtn" onClick={() => onGroomed(null)}>
              Reset grooming to default
            </button>
          )}
        </div>
        {editAspect && (
          <div className="mt-2 grid grid-cols-4 gap-2" role="group" aria-label="Which way does it face?">
            {POINTS.map((p, i) => (
              <button
                key={p}
                type="button"
                className="chip"
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
              <button type="button" className="linkbtn col-span-4 justify-self-start" onClick={() => onAspect(null)}>
                Use the computed aspect ({compassPoint(run.aspectDeg)})
              </button>
            )}
          </div>
        )}

        <h3 className="label mt-5">How did it ski?</h3>
        <div className="mt-1 grid grid-cols-5 gap-2" role="group" aria-label="Rate this run from 1 to 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className="chip" aria-pressed={rated === n} onClick={() => rate(n)}>
              {n}
            </button>
          ))}
        </div>
        <p className="muted mt-1 text-[13px]">{rated ? "Thanks! Your rating helps calibrate the model." : "1 = awful, 5 = perfect. Sent with the predicted score."}</p>
      </section>
    </>
  );
}
