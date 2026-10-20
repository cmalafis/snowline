"use client";
import { useEffect, useState } from "react";
import type { Difficulty, RunType } from "@snowline/core";
import { TYPE_LABEL } from "@/lib/model";
import { sendFeedback, store, type Prefs } from "@/lib/storage";
import { DiffSymbol } from "./DiffSymbol";
import { Icon } from "./ui";

const MAX: { d: Difficulty; label: string }[] = [
  { d: "easy", label: "Greens" },
  { d: "intermediate", label: "Blues" },
  { d: "advanced", label: "Blacks" },
  { d: "expert", label: "Double blacks" },
];

export const MAX_LABEL = Object.fromEntries(MAX.map((m) => [m.d, m.label])) as Record<string, string>;

/** Terrain types as toggle buttons; at least one stays on. */
export function TerrainPicker({ prefs, onPrefs }: { prefs: Prefs; onPrefs: (p: Prefs) => void }) {
  const toggle = (t: RunType) => {
    const has = prefs.types.includes(t);
    if (has && prefs.types.length === 1) return;
    onPrefs({ ...prefs, types: has ? prefs.types.filter((x) => x !== t) : [...prefs.types, t] });
  };
  return (
    <div role="group" aria-label="Terrain you like" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {(Object.keys(TYPE_LABEL) as RunType[]).map((t) => (
        <button key={t} type="button" className="filter-btn" aria-pressed={prefs.types.includes(t)} onClick={() => toggle(t)}>
          {TYPE_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

/** The hardest difficulty to show. */
export function DifficultyPicker({ prefs, onPrefs }: { prefs: Prefs; onPrefs: (p: Prefs) => void }) {
  return (
    <div role="group" aria-label="Hardest you'll ski" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {MAX.map(({ d, label }) => (
        <button key={d} type="button" className="filter-btn" aria-pressed={prefs.maxDifficulty === d} onClick={() => onPrefs({ ...prefs, maxDifficulty: d })}>
          <DiffSymbol d={d} size={16} />
          {label}
        </button>
      ))}
    </div>
  );
}

export function SettingsSheet({
  prefs,
  resortId,
  onPrefs,
  onClose,
  unmarkedOn,
  onUnmarked,
}: {
  prefs: Prefs;
  resortId: string;
  onPrefs: (p: Prefs) => void;
  onClose: () => void;
  unmarkedOn: boolean;
  /** Turning on goes through the cautions screen; turning off is immediate. */
  onUnmarked: (on: boolean) => void;
}) {
  const [theme, setTheme] = useState(store.theme());
  const [text, setText] = useState("");
  const [sent, setSent] = useState<null | "sent" | "queued">(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden />
      <section className="sheet" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="sheet-head">
          <div className="grabber" aria-hidden />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="display" style={{ margin: 0, fontSize: 26 }}>
              Settings
            </h2>
            <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="sheet-body">
          <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 className="card-title">Your skiing</h3>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Terrain you like</div>
              <TerrainPicker prefs={prefs} onPrefs={onPrefs} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Hardest you&apos;ll ski</div>
              <DifficultyPicker prefs={prefs} onPrefs={onPrefs} />
            </div>
          </section>

          <section className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h3 className="card-title">Unmarked tree areas</h3>
            <div className="card-sub">
              Forest between the runs that looks skiable in tree-cover and terrain data. Off-piste, not patrolled like runs, and it may be closed. You&apos;ll see the
              cautions before it turns on.
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44, cursor: "pointer", fontWeight: 500 }}>
              <input
                type="checkbox"
                role="switch"
                checked={unmarkedOn}
                onChange={(e) => onUnmarked(e.target.checked)}
                style={{ width: 44, height: 24, accentColor: "var(--pf-primary)", margin: 0 }}
              />
              Show unmarked tree areas
            </label>
          </section>

          <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 className="card-title">Display</h3>
            <div className="toggle-group" role="group" aria-label="Theme">
              {(["system", "light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={theme === t}
                  onClick={() => {
                    store.setTheme(t);
                    setTheme(t);
                  }}
                >
                  {t === "system" ? "Match phone" : t[0]!.toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </section>

          <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 className="card-title">Tell us what you think</h3>
            <div className="card-sub">Wrong aspect? A run missing? A score way off? This goes straight to the developer.</div>
            <label className="sr-only" htmlFor="feedback-text">
              Your feedback
            </label>
            <textarea
              id="feedback-text"
              className="textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="e.g. Shadows was bulletproof at 11 even though you said Prime"
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={!text.trim()}
              onClick={async () => {
                const ok = await sendFeedback({ kind: "comment", resort: resortId, text });
                setSent(ok ? "sent" : "queued");
                setText("");
              }}
            >
              Send feedback
            </button>
            {sent && <div className="card-sub">{sent === "sent" ? "Thanks, got it." : "Saved. It'll send when you have signal."}</div>}
          </section>

          <section className="card">
            <h3 className="card-title" style={{ marginBottom: 6 }}>
              About these scores
            </h3>
            <p className="subtle" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              Every run is scored every 15 minutes from the Open-Meteo hourly forecast: how much sun its slope is getting (aspect and pitch from 10 m terrain data,
              cloud cover and forecast sunlight), the temperature at its elevation, last night&apos;s refreeze, new snow overnight and during the day (split into
              snow or rain by the temperature on that run), the last three days of storm snow off-piste, tree cover (wind shelter, flat-light definition, shade),
              grooming, traffic, wind and flat light. They&apos;re estimates. Always check the resort&apos;s grooming report, open terrain and avalanche conditions.
              Run data © OpenStreetMap contributors; tree canopy from NLCD (USFS/MRLC).
            </p>
          </section>
        </div>
      </section>
    </>
  );
}
