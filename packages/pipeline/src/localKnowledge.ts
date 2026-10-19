import { angleDiff, circularMean, compassToDeg, type ResortConfig, type Run, type Zone } from "@snowline/core";
import { normName } from "./terrain.ts";

export interface KnowledgeRow {
  run: string;
  zoneOrLift: string;
  aspect: string;
  skisBest: string;
  notes: string;
  example: boolean;
}

/** Rows of the run table under `## <resortName>` in reference/local-knowledge.md, skipping blank rows. */
export function parseLocalKnowledge(md: string, resortName: string): KnowledgeRow[] {
  const rows: KnowledgeRow[] = [];
  let inResort = false;
  for (const line of md.split("\n")) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      inResort = heading[1]!.toLowerCase() === resortName.toLowerCase();
      continue;
    }
    if (!inResort || !line.trim().startsWith("|")) continue;
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (cells.every((c) => c === "" || /^-+$/.test(c)) || cells[0]?.toLowerCase() === "run") continue;
    const [run = "", zoneOrLift = "", aspect = "", skisBest = "", notes = ""] = cells;
    const example = /^example:\s*/i.test(run);
    rows.push({ run: run.replace(/^example:\s*/i, ""), zoneOrLift, aspect, skisBest, notes, example });
  }
  return rows;
}

/**
 * Runs matching a name from the owner's notes: exact (normalised) or via `nameAliases`, else every part of a run
 * that OSM splits into Upper/Lower/Middle pieces.
 */
export function matchRuns(name: string, runs: Run[], cfg: ResortConfig): Run[] {
  const aliases = new Map(Object.entries(cfg.nameAliases ?? {}).map(([k, v]) => [normName(k), normName(v)]));
  const target = aliases.get(normName(name)) ?? normName(name);
  const named = runs.filter((r) => r.name);
  const exact = named.filter((r) => normName(r.name!) === target);
  if (exact.length) return exact;
  const PART = /\b(upper|lower|middle|top|bottom)\b/g;
  return named.filter((r) => normName(r.name!).replace(PART, "").replace(/\s+/g, " ").trim() === target);
}

export interface Comparison {
  row: KnowledgeRow;
  matched: Run[];
  computedAspect: number | null;
  ownerAspect: number | null;
  aspectDiff: number | null;
  computedZone: Zone | null;
  zoneAgrees: boolean | null;
  disagreements: string[];
}

export function zoneMatches(text: string, zone: Zone): boolean {
  const t = normName(text);
  if (!t) return false;
  const names = [zone.id, zone.name, ...zone.lifts].map(normName);
  return names.some((n) => n === t || n.includes(t) || t.includes(n));
}

export function compare(row: KnowledgeRow, runs: Run[], zones: Zone[], cfg: ResortConfig, toleranceDeg = 45): Comparison {
  const matched = matchRuns(row.run, runs, cfg);
  const ownerAspect = compassToDeg(row.aspect) ?? (/^\d+(\.\d+)?$/.test(row.aspect) ? Number(row.aspect) : null);
  const computedAspect = matched.length
    ? Math.round(circularMean(matched.map((r) => r.aspectDeg), matched.map((r) => r.lengthM)))
    : null;
  const aspectDiff = ownerAspect !== null && computedAspect !== null ? Math.round(angleDiff(ownerAspect, computedAspect)) : null;
  const zoneIds = [...new Set(matched.map((r) => r.zone))];
  const computedZone = zones.find((z) => z.id === zoneIds[0]) ?? null;
  const zoneAgrees = row.zoneOrLift && computedZone ? zoneMatches(row.zoneOrLift, computedZone) : null;

  const disagreements: string[] = [];
  if (!matched.length) disagreements.push("not found in OSM runs");
  if (aspectDiff !== null && aspectDiff > toleranceDeg) disagreements.push(`aspect off by ${aspectDiff}°`);
  if (zoneAgrees === false) disagreements.push(`zone: computed "${computedZone!.name}", owner says "${row.zoneOrLift}"`);
  if (zoneIds.length > 1) disagreements.push(`parts fall in different zones: ${zoneIds.join(", ")}`);
  return { row, matched, computedAspect, ownerAspect, aspectDiff, computedZone, zoneAgrees, disagreements };
}
