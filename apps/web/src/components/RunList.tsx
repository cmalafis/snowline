"use client";
import { compassPoint, exposureOf, type AppZone } from "@snowline/core";
import { TIER_COLOR, tier, type Ranked } from "@/lib/model";
import { DiffSymbol } from "./DiffSymbol";
import { Icon, ScoreLabel } from "./ui";

const TONE = { up: "var(--pf-prime)", down: "var(--pf-skip)", flat: "var(--pf-border-strong)" } as const;

export function groomLabel(r: Pick<Ranked, "run">, groomedToday: boolean): string {
  if (r.run.type === "groomer") return groomedToday ? "groomed" : "not groomed";
  return { bump: "bumps", tree: "glades", bowl: "bowl/chute" }[r.run.type];
}

/** Tree cover as a label: in the trees / tree-lined / open / above treeline. */
export function CoverLabel({ run, treelineFt }: { run: Ranked["run"]; treelineFt: number }) {
  const e = exposureOf(run, treelineFt);
  const [text, cls] =
    run.topFt > treelineFt ? ["Above treeline", "label-neutral"] : e < 0.35 ? ["In the trees", "label-prime"] : e < 0.7 ? ["Tree-lined", "label-good"] : ["Open slope", "label-neutral"];
  return (
    <span className={`label label-sm ${cls}`}>
      <Icon name="tree" size={14} />
      {text}
    </span>
  );
}

/** Short tag for a warning ("Gusts to 52 mph: lift holds likely" becomes "Lift holds likely"). */
export function warningTag(w: string): string {
  if (/lift holds/i.test(w)) return "Lift holds likely";
  if (/rain/i.test(w)) return "Rain here";
  return w;
}

export function RunRow({
  r,
  zone,
  groomedToday,
  favorite,
  edited,
  distanceM,
  treelineFt,
  showZone,
  unmarked,
  onOpen,
}: {
  r: Ranked;
  zone: AppZone | undefined;
  groomedToday: boolean;
  favorite: boolean;
  edited: boolean;
  distanceM?: number;
  treelineFt: number;
  showZone: boolean;
  /** Set for unmarked tree areas: their size and how many hazards the data found. */
  unmarked?: { areaHa: number; hazards: number };
  onOpen: () => void;
}) {
  const meta = [
    showZone ? zone?.name : null,
    `faces ${compassPoint(r.run.aspectDeg)}${r.run.mixedAspect ? " (mixed)" : ""}`,
    unmarked ? `${Math.round(unmarked.areaHa * 2.47)} acres of trees` : groomLabel(r, groomedToday),
    `${r.s.tempF}°F`,
    edited ? "edited" : null,
    distanceM !== undefined ? (distanceM < 1000 ? `${Math.round(distanceM / 10) * 10} m away` : `${(distanceM / 1609).toFixed(1)} mi away`) : null,
  ].filter(Boolean);
  return (
    <article className="card" data-testid="run-row" style={{ padding: 0 }}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${r.run.name}, ${r.s.label} ${r.s.score}. Details`}
        style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", padding: "14px 16px", border: 0, background: "transparent", textAlign: "left", cursor: "pointer", borderRadius: 16 }}
      >
        <span style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr) auto", gap: 10, alignItems: "start", width: "100%" }}>
          <span style={{ marginTop: 4 }}>
            <DiffSymbol d={r.run.difficulty} size={18} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span data-testid="run-name" className="display" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 19, lineHeight: 1.2 }}>
              {r.run.name}
              {favorite && <Icon name="starFilled" size={16} style={{ color: "var(--pf-sun)" }} />}
            </span>
            <span className="subtle" style={{ display: "block", fontSize: 13 }}>
              {meta.join(" · ")}
            </span>
          </span>
          <ScoreLabel score={r.s.score} label={r.s.label} />
        </span>
        <span className="bar" style={{ width: "100%" }}>
          <i style={{ width: `${r.s.score}%`, background: TIER_COLOR[tier(r.s.score)] }} />
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
          {r.s.reasons.map((why, i) => (
            <span key={why} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span aria-hidden="true" style={{ flex: "none", width: 8, height: 8, marginTop: 7, borderRadius: 999, background: TONE[r.s.tones[i] ?? "flat"] }} />
              {why}
            </span>
          ))}
        </span>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {unmarked && (
            <>
              <span className="label label-sm label-skip">
                <Icon name="danger" size={14} />
                Unmarked, off-piste
              </span>
              {unmarked.hazards > 0 && (
                <span className="label label-sm label-fair">
                  <Icon name="warning" size={14} />
                  {unmarked.hazards} {unmarked.hazards === 1 ? "hazard" : "hazards"} found
                </span>
              )}
            </>
          )}
          {[...new Set(r.s.warnings.map(warningTag))].map((w) => (
            <span key={w} className="label label-sm label-fair">
              <Icon name="warning" size={14} />
              {w}
            </span>
          ))}
          <CoverLabel run={r.run} treelineFt={treelineFt} />
        </span>
      </button>
    </article>
  );
}
