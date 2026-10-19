"use client";
import { useState } from "react";
import type { Difficulty, RunType } from "@snowline/core";
import { TYPE_LABEL } from "@/lib/model";
import { sendFeedback, store, type Prefs } from "@/lib/storage";
import { DiffSymbol } from "./DiffSymbol";

const MAX: { d: Difficulty; label: string }[] = [
  { d: "easy", label: "Greens" },
  { d: "intermediate", label: "Blues" },
  { d: "advanced", label: "Blacks" },
  { d: "expert", label: "Double blacks" },
];

export function SettingsSheet({ prefs, resortId, onPrefs, onClose }: { prefs: Prefs; resortId: string; onPrefs: (p: Prefs) => void; onClose: () => void }) {
  const [theme, setTheme] = useState(store.theme());
  const [text, setText] = useState("");
  const [sent, setSent] = useState<null | "sent" | "queued">(null);

  const toggleType = (t: RunType) => {
    const has = prefs.types.includes(t);
    if (has && prefs.types.length === 1) return;
    onPrefs({ ...prefs, types: has ? prefs.types.filter((x) => x !== t) : [...prefs.types, t] });
  };

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden />
      <section className="sheet" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-[var(--line)]" aria-hidden />
        <header className="flex items-center justify-between">
          <h2 className="h2">Your skiing</h2>
          <button type="button" className="btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <h3 className="label mt-3">Terrain you like</h3>
        <div className="mt-1 flex flex-wrap gap-2">
          {(Object.keys(TYPE_LABEL) as RunType[]).map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={prefs.types.includes(t)} onClick={() => toggleType(t)}>
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <h3 className="label mt-4">Hardest you&apos;ll ski</h3>
        <div className="mt-1 flex flex-wrap gap-2">
          {MAX.map(({ d, label }) => (
            <button key={d} type="button" className="chip flex items-center gap-2" aria-pressed={prefs.maxDifficulty === d} onClick={() => onPrefs({ ...prefs, maxDifficulty: d })}>
              <DiffSymbol d={d} size={16} />
              {label}
            </button>
          ))}
        </div>

        <h3 className="label mt-4">Display</h3>
        <div className="seg mt-1" role="group" aria-label="Theme">
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
              {t[0]!.toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <h3 className="label mt-5">Tell us what you think</h3>
        <p className="muted text-[14px]">Wrong aspect? A run missing? A score way off? This goes straight to the developer.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={2000}
          className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3"
          placeholder="e.g. Shadows was bulletproof at 11 even though you said Prime"
        />
        <button
          type="button"
          className="btn btn-primary mt-2"
          disabled={!text.trim()}
          onClick={async () => {
            const ok = await sendFeedback({ kind: "comment", resort: resortId, text });
            setSent(ok ? "sent" : "queued");
            setText("");
          }}
        >
          Send feedback
        </button>
        {sent && <p className="muted mt-1 text-[13px]">{sent === "sent" ? "Thanks — got it." : "Saved. It'll send when you have signal."}</p>}

        <h3 className="label mt-5">About these scores</h3>
        <p className="muted text-[14px] leading-relaxed">
          Scores come from the sun on each slope (its aspect and pitch from 10 m terrain data), temperature at the run&apos;s elevation, last night&apos;s refreeze, new
          snow, grooming, traffic, wind and light, using the Open-Meteo forecast. They&apos;re estimates. Always check the resort&apos;s grooming report, open terrain and
          avalanche conditions. Run data © OpenStreetMap contributors.
        </p>
      </section>
    </>
  );
}
