"use client";
import { useEffect, useState } from "react";
import { haversineM, type LonLat, type ResortSummary } from "@snowline/core";

type Sort = "name" | "snow" | "near";

function sky(cloud: number): string {
  return cloud < 20 ? "Bluebird" : cloud < 50 ? "Mostly sunny" : cloud < 80 ? "Partly cloudy" : "Overcast";
}

function inches(x: number): string {
  return x < 3 ? x.toFixed(1).replace(/\.0$/, "") : String(Math.round(x));
}

/** Choose a resort: cards with live conditions, sortable by name, new snow, or distance from you. */
export function ResortPicker({
  resorts,
  current,
  firstVisit,
  onPick,
  onClose,
}: {
  resorts: ResortSummary[];
  current: string | null;
  firstVisit: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [sort, setSort] = useState<Sort>("name");
  const [here, setHere] = useState<LonLat | null>(null);
  const [locError, setLocError] = useState<string | null>(null);

  useEffect(() => {
    if (firstVisit) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [firstVisit, onClose]);

  const pickNear = () => {
    setSort("near");
    if (here) return;
    if (!("geolocation" in navigator)) return setLocError("Location isn't available on this device.");
    navigator.geolocation.getCurrentPosition(
      (p) => setHere([p.coords.longitude, p.coords.latitude]),
      () => setLocError("Couldn't get your location."),
      { maximumAge: 600_000, timeout: 15_000 },
    );
  };

  const dist = (r: ResortSummary) => (here ? haversineM(here, [r.base.lon, r.base.lat]) : Infinity);
  const sorted = [...resorts].sort((a, b) =>
    sort === "snow"
      ? (b.conditions?.newSnowIn ?? -1) - (a.conditions?.newSnowIn ?? -1) || (b.conditions?.stormTotalIn ?? 0) - (a.conditions?.stormTotalIn ?? 0)
      : sort === "near" && here
        ? dist(a) - dist(b)
        : a.name.localeCompare(b.name),
  );

  return (
    <>
      <div className="sheet-backdrop" onClick={firstVisit ? undefined : onClose} aria-hidden />
      <section className="sheet" role="dialog" aria-modal="true" aria-label="Choose a resort" data-testid="resort-picker">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-[var(--line)]" aria-hidden />
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[24px] font-black leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              {firstVisit ? "Where are you skiing?" : "Choose a resort"}
            </h2>
            <p className="muted text-[14px]">Snow and sun change by the hour; pick a mountain to see where it&apos;s best.</p>
          </div>
          {!firstVisit && (
            <button type="button" className="btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </header>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Sort resorts">
          <button type="button" className="chip" aria-pressed={sort === "name"} onClick={() => setSort("name")}>
            A–Z
          </button>
          <button type="button" className="chip" aria-pressed={sort === "snow"} onClick={() => setSort("snow")}>
            ❄︎ Most new snow
          </button>
          <button type="button" className="chip" aria-pressed={sort === "near"} onClick={pickNear}>
            📍 Nearest
          </button>
        </div>
        {sort === "near" && locError && <p className="muted mt-1 text-[13px]">{locError}</p>}

        <ul className="mt-3 grid gap-3">
          {sorted.map((r) => {
            const c = r.conditions;
            const d = dist(r);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onPick(r.id)}
                  aria-current={r.id === current}
                  data-testid="resort-card"
                  className="grid w-full gap-1 rounded-2xl border bg-[var(--bg)] p-4 text-left"
                  style={{ borderColor: r.id === current ? "var(--ink)" : "var(--line)", borderWidth: r.id === current ? 2 : 1, minHeight: 88 }}
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[22px] font-black leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                      {r.name}
                    </span>
                    {r.pass && <span className="tag t-good">{r.pass}</span>}
                  </span>
                  <span className="muted text-[14px]">
                    {[r.region, `${(r.summit.elevationFt - r.base.elevationFt).toLocaleString()} ft vertical`, `${r.runCount} runs`, Number.isFinite(d) ? `${Math.round(d / 1609)} mi away` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {c ? (
                    <span className="mono text-[14px]">
                      <b style={{ color: c.newSnowIn >= 4 ? "var(--blue)" : undefined }}>{inches(c.newSnowIn)}&quot; new</b>
                      {c.stormTotalIn && c.stormTotalIn > c.newSnowIn ? ` · ${inches(c.stormTotalIn)}" in 3 days` : ""} · {c.summitTempF}°F up top · {sky(c.cloudCover)}
                      {c.gustMph >= 35 ? ` · gusts ${c.gustMph} mph` : ""}
                    </span>
                  ) : (
                    <span className="muted text-[13px]">Conditions load when you open it.</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
