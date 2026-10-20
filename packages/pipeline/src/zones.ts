import { circularMean, haversineM, pointSegmentDist, type Lift, type LonLat, type ResortConfig, type Zone } from "@snowline/core";
import type { Projection } from "./sources/dem.ts";

/** Lift kinds that serve terrain. Magic carpets, rope tows and stations don't define zones. */
const ZONE_LIFT_KINDS = new Set(["chair_lift", "gondola", "cable_car", "mixed_lift", "t-bar", "j-bar", "platter", "drag_lift"]);

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function zoneIdForLift(lift: Lift, cfg: ResortConfig): string {
  const name = lift.name ?? `lift-${lift.osmId}`;
  return cfg.zoneOverrides?.[name] ?? slug(name);
}

/** Lifts that can define a zone. */
export function zoneLifts(lifts: Lift[], cfg: ResortConfig): Lift[] {
  const ignore = new Set(cfg.ignoreLifts ?? []);
  return lifts.filter((l) => ZONE_LIFT_KINDS.has(l.kind) && !(l.name && ignore.has(l.name)));
}

function distToLift(p: LonLat, lift: Lift, proj: Projection): number {
  const xy = proj.toXY(p);
  const line = lift.coordinates.map(proj.toXY);
  let d = Infinity;
  for (let i = 1; i < line.length; i++) d = Math.min(d, pointSegmentDist(xy, line[i - 1]!, line[i]!));
  return d;
}

/**
 * The lift serving a run: the one you ride to its top and back from its bottom. Candidates are lifts whose
 * top station is within `radiusM` of the run's top and not below it (with some slack); the winner minimises
 * distance from the run's bottom to the lift line plus half the distance between the tops. Weighting the
 * bottom separates lifts that share a summit and catches runs that drop in from a neighbouring peak.
 * With no candidate, the lift whose line passes closest to the run's top.
 */
export function assignLift(
  run: { top: LonLat; topFt: number; bottom: LonLat },
  lifts: Lift[],
  radiusM: number,
  proj: Projection,
): Lift | null {
  const SLACK_FT = 100;
  let best: Lift | null = null;
  let bestD = Infinity;
  for (const l of lifts) {
    if (l.topFt + SLACK_FT < run.topFt) continue;
    const dTop = haversineM(run.top, l.top);
    if (dTop > radiusM) continue;
    const d = dTop / 2 + distToLift(run.bottom, l, proj);
    if (d < bestD) [best, bestD] = [l, d];
  }
  if (best) return best;
  for (const l of lifts) {
    const d = distToLift(run.top, l, proj);
    if (d < bestD) [best, bestD] = [l, d];
  }
  return best;
}

export interface ZoneMember {
  zone: string | null;
  topFt: number;
  bottomFt: number;
  aspectDeg: number;
  lengthM: number;
}

export function buildZones(runs: ZoneMember[], lifts: Lift[], cfg: ResortConfig): Zone[] {
  const ids = new Set(runs.map((r) => r.zone).filter((z): z is string => !!z));
  const zones: Zone[] = [];
  for (const id of ids) {
    const members = runs.filter((r) => r.zone === id);
    const zoneLiftNames = lifts.filter((l) => zoneIdForLift(l, cfg) === id).map((l) => l.name ?? String(l.osmId));
    const topFt = Math.max(...members.map((r) => r.topFt));
    zones.push({
      id,
      name: cfg.zoneNames?.[id] ?? (zoneLiftNames.join(" & ") || id),
      lifts: zoneLiftNames,
      aspectDeg: circularMean(members.map((r) => r.aspectDeg), members.map((r) => r.lengthM)),
      topFt,
      bottomFt: Math.min(...members.map((r) => r.bottomFt)),
      windExposed: topFt >= cfg.treelineFt || cfg.summit.elevationFt - topFt <= cfg.ridgeProximityFt,
      runCount: members.length,
      ...(cfg.zoneTuning?.[id]?.springHeadStartHours ? { springHeadStartHours: cfg.zoneTuning[id].springHeadStartHours } : {}),
    });
  }
  return zones.sort((a, b) => a.name.localeCompare(b.name));
}
