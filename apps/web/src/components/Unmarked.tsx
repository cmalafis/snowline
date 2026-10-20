"use client";
import { useEffect, useState } from "react";
import { Icon } from "./ui";

type Avalanche = { name: string; url: string } | null;

/** The general cautions every unmarked tree area carries, before any area-specific hazards. */
export function UnmarkedCautions({ avalanche, compact }: { avalanche: Avalanche; compact?: boolean }) {
  const items = [
    {
      icon: "info" as const,
      title: "Not on the trail map",
      text: "Snowline finds these areas from tree-cover and terrain data, not from the resort. They aren't signed, groomed or patrolled like runs.",
    },
    {
      icon: "danger" as const,
      title: "Obey every closure, rope and sign",
      text: "An area showing here can still be closed. Skiing closed terrain is dangerous and can cost you your pass.",
    },
    {
      icon: "tree" as const,
      title: "Tree wells and deep snow can kill",
      text: "Ski with a partner, stay in sight of each other, and keep your phone on you.",
    },
    {
      icon: "warning" as const,
      title: "The data can't see everything",
      text: "Cliffs, rock bands, creeks, stumps and deadfall don't show up in 30 m tree and terrain data. Look before you drop in.",
    },
    {
      icon: "warning" as const,
      title: "Steep trees can slide",
      text: avalanche ? `Avalanches happen in trees too, even inside a ski area. Check the ${avalanche.name} on big snow days.` : "Avalanches happen in trees too, even inside a ski area. Check the local avalanche forecast on big snow days.",
    },
    {
      icon: "map" as const,
      title: "Know the way out",
      text: "Some areas funnel into drainages with no run at the bottom. Ski within your ability and keep the lifts in sight.",
    },
  ];
  const shown = compact ? items.slice(0, 3) : items;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
      {shown.map((c) => (
        <li key={c.title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Icon name={c.icon} style={{ marginTop: 2, color: c.icon === "danger" ? "var(--a-danger-icon)" : c.icon === "warning" ? "var(--a-warn-icon)" : "var(--pf-subtle)" }} />
          <span>
            <span style={{ display: "block", fontWeight: 700 }}>{c.title}</span>
            <span className="subtle" style={{ fontSize: 14 }}>
              {c.text}
            </span>
          </span>
        </li>
      ))}
      {avalanche && !compact && (
        <li>
          <a className="btn btn-secondary" href={avalanche.url} target="_blank" rel="noopener noreferrer" style={{ width: "100%" }}>
            Open the {avalanche.name}
          </a>
        </li>
      )}
    </ul>
  );
}

/** Opt-in: the cautions, an acknowledgement, then the layer turns on. */
export function UnmarkedSheet({ avalanche, onAccept, onClose }: { avalanche: Avalanche; onAccept: () => void; onClose: () => void }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden />
      <section className="sheet" role="dialog" aria-modal="true" aria-label="Unmarked tree areas" data-testid="unmarked-sheet">
        <div className="sheet-head">
          <div className="grabber" aria-hidden />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <h2 className="display" style={{ margin: 0, fontSize: 26, lineHeight: 1.15 }}>
                Unmarked tree areas
              </h2>
              <p className="subtle" style={{ margin: "6px 0 0", fontSize: 15 }}>
                Forest between the runs that looks skiable in the data. Read this before you turn it on.
              </p>
            </div>
            <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="sheet-body">
          <div className="alert alert-danger" role="alert">
            <Icon name="danger" />
            <div>
              <div className="alert-title">Off-piste: you&apos;re responsible for your own safety</div>
              <div className="alert-body">These are guesses from satellite and elevation data, not runs. Snowline can&apos;t tell you whether an area is open or safe.</div>
            </div>
          </div>
          <section className="card">
            <UnmarkedCautions avalanche={avalanche} />
          </section>
          <label className="card" style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} style={{ width: 22, height: 22, margin: "2px 0 0", accentColor: "var(--pf-primary)", flex: "none" }} />
            <span>
              I understand these areas aren&apos;t marked or patrolled runs, I&apos;ll obey every closure, and I&apos;ll ski them with a partner at my own risk.
            </span>
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              Not now
            </button>
            <button type="button" className="btn btn-primary" style={{ flex: 1.4 }} disabled={!ok} onClick={onAccept}>
              Show unmarked areas
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
