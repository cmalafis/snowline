"use client";
import { useEffect, useState } from "react";
import { haversineM, type LonLat, type ResortSummary } from "@snowline/core";
import { Icon } from "./ui";

type Sort = "name" | "snow" | "near";

function sky(cloud: number): string {
  return cloud < 20 ? "Sunny" : cloud < 50 ? "Mostly sunny" : cloud < 80 ? "Partly cloudy" : "Overcast";
}

function inches(x: number): string {
  return x < 3 ? x.toFixed(1).replace(/\.0$/, "") : String(Math.round(x));
}

/** Choose a resort: selectable cards with live conditions, sortable by name, new snow, or distance from you. */
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
  const [chosen, setChosen] = useState<string | null>(current);
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
  const chosenName = resorts.find((r) => r.id === chosen)?.name;

  return (
    <>
      <div className="sheet-backdrop" onClick={firstVisit ? undefined : onClose} aria-hidden />
      <section className="sheet" role="dialog" aria-modal="true" aria-label="Choose a resort" data-testid="resort-picker" style={{ display: "flex", flexDirection: "column" }}>
        <div className="sheet-head">
          <div className="grabber" aria-hidden />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <h2 className="display" style={{ margin: 0, fontSize: 26, lineHeight: 1.15 }}>
                {firstVisit ? "Where are you skiing?" : "Choose a resort"}
              </h2>
              <p className="subtle" style={{ margin: "6px 0 0", fontSize: 15 }}>
                Snow and sun change by the hour. Pick a mountain to see where it&apos;s best right now.
              </p>
            </div>
            {!firstVisit && (
              <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
                <Icon name="close" />
              </button>
            )}
          </div>
          <div className="toggle-group" role="group" aria-label="Sort resorts" style={{ marginTop: 12 }}>
            <button type="button" aria-pressed={sort === "name"} onClick={() => setSort("name")}>
              A–Z
            </button>
            <button type="button" aria-pressed={sort === "snow"} onClick={() => setSort("snow")} style={{ flex: 1.4 }}>
              Most new snow
            </button>
            <button type="button" aria-pressed={sort === "near"} onClick={pickNear} style={{ flex: 1.1 }}>
              Nearest
            </button>
          </div>
          {sort === "near" && locError && (
            <p className="subtle" style={{ margin: "6px 0 0", fontSize: 13 }}>
              {locError}
            </p>
          )}
        </div>

        <div className="sheet-body">
          <fieldset style={{ margin: 0, padding: 0, border: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <legend className="sr-only">Resort</legend>
            {sorted.map((r) => {
              const c = r.conditions;
              const d = dist(r);
              const selected = chosen === r.id;
              return (
                <label
                  key={r.id}
                  data-testid="resort-card"
                  className="card"
                  style={{ display: "flex", gap: 14, cursor: "pointer", border: selected ? "2px solid var(--pf-primary)" : "1px solid var(--pf-border)", padding: selected ? 15 : 16 }}
                >
                  <input
                    type="radio"
                    name="resort"
                    value={r.id}
                    checked={selected}
                    onChange={() => setChosen(r.id)}
                    style={{ width: 20, height: 20, margin: "4px 0 0", accentColor: "var(--pf-primary)", flex: "none" }}
                  />
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span className="display" style={{ fontSize: 22, lineHeight: 1.15 }}>
                        {r.name}
                      </span>
                      {r.pass && <span className="label label-sm label-good">{r.pass}</span>}
                    </span>
                    <span className="subtle" style={{ fontSize: 14 }}>
                      {[r.region, `${(r.summit.elevationFt - r.base.elevationFt).toLocaleString()} ft vertical`, `${r.runCount} runs`, Number.isFinite(d) ? `${Math.round(d / 1609)} mi away` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {c ? (
                      <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <span className={`label label-sm ${c.newSnowIn >= 4 ? "label-good" : "label-neutral"}`}>
                          <Icon name="snowflake" size={14} />
                          {inches(c.newSnowIn)}&quot; new{c.stormTotalIn && c.stormTotalIn > c.newSnowIn ? ` · ${inches(c.stormTotalIn)}" in 3 days` : ""}
                        </span>
                        <span className="label label-sm label-neutral">
                          <Icon name="thermometer" size={14} />
                          {c.summitTempF}°F up top
                        </span>
                        <span className="label label-sm label-neutral">{sky(c.cloudCover)}</span>
                        {c.gustMph >= 35 && (
                          <span className="label label-sm label-fair">
                            <Icon name="wind" size={14} />
                            Gusts {c.gustMph} mph
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="subtle" style={{ fontSize: 13 }}>
                        Conditions load when you open it.
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </fieldset>
          <p className="subtle" style={{ margin: 0, fontSize: 13 }}>
            Live conditions from the Open-Meteo forecast.
          </p>
          <button type="button" className="btn btn-primary" style={{ minHeight: 52, fontSize: 17, position: "sticky", bottom: 8 }} disabled={!chosen} onClick={() => chosen && onPick(chosen)}>
            {chosenName ? `Continue to ${chosenName}` : "Choose a resort"}
          </button>
        </div>
      </section>
    </>
  );
}
