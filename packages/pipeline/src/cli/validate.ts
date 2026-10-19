import { readFile } from "node:fs/promises";
import path from "node:path";
import { angleDiff, bearingDeg, circularMean, compassPoint, pointSegmentDist, type Lift, type LonLat, type Run, type Zone } from "@snowline/core";
import { compare, parseLocalKnowledge } from "../localKnowledge.ts";
import { textTable } from "./print-table.ts";
import { ROOT, dataPath, loadResort, readJson } from "../resort.ts";

const fmtAspect = (d: number | null) => (d === null ? "—" : `${d}° ${compassPoint(d)}`);

/**
 * Independent check on the DEM: chairlifts mostly climb the fall line, so the bearing from a lift's top to its
 * bottom approximates the aspect of the slope under it. Compare it with the DEM aspect of run segments near the line.
 */
function liftFallLineCheck(lifts: Lift[], runs: Run[], nearM = 120, minPitchDeg = 5) {
  const lat0 = lifts[0]?.top[1] ?? 0;
  const xy = ([lon, lat]: LonLat): [number, number] => [lon * 111_320 * Math.cos((lat0 * Math.PI) / 180), lat * 110_574];
  return lifts
    .filter((l) => l.kind !== "station" && l.kind !== "magic_carpet")
    .map((l) => {
      const line = l.coordinates.map(xy);
      const near = runs.flatMap((r) => r.segments).filter((s) => {
        if (s.pitchDeg < minPitchDeg) return false;
        const p = xy(s.at);
        return line.some((_, i) => i > 0 && pointSegmentDist(p, line[i - 1]!, line[i]!) < nearM);
      });
      const fall = Math.round(bearingDeg(l.top, l.bottom));
      const dem = near.length ? Math.round(circularMean(near.map((s) => s.aspectDeg), near.map((s) => s.lengthM))) : null;
      return { name: l.name ?? String(l.osmId), fall, dem, n: near.length, diff: dem === null ? null : Math.round(angleDiff(fall, dem)) };
    });
}

export async function validate(resortId: string) {
  const cfg = await loadResort(resortId);
  const runs = await readJson<Run[]>(dataPath(cfg.id, "runs.json"));
  const lifts = await readJson<Lift[]>(dataPath(cfg.id, "lifts.json"));
  const zones = await readJson<Zone[]>(dataPath(cfg.id, "zones.json"));
  const md = await readFile(path.join(ROOT, "reference/local-knowledge.md"), "utf8");
  const rows = parseLocalKnowledge(md, cfg.name);
  const results = rows.map((row) => compare(row, runs, zones, cfg));

  console.log(`\n${cfg.name} — computed terrain vs reference/local-knowledge.md (${rows.length} rows${rows.some((r) => r.example) ? ", including the template example" : ""})\n`);
  if (results.length) {
    console.log(
      textTable(
        ["Run", "OSM match", "Owner aspect", "Computed", "Δ", "Pitch°", "Owner zone/lift", "Computed zone", "Owner: skis best", "Verdict"],
        results.map((c) => [
          c.row.run + (c.row.example ? " (example)" : ""),
          c.matched.map((r) => r.name).join(" + ") || "—",
          c.row.aspect || "—",
          fmtAspect(c.computedAspect),
          c.aspectDiff === null ? "" : `${c.aspectDiff}°`,
          c.matched.length ? (c.matched.reduce((t, r) => t + r.pitchDeg * r.lengthM, 0) / c.matched.reduce((t, r) => t + r.lengthM, 0)).toFixed(1) : "—",
          c.row.zoneOrLift || "—",
          c.computedZone?.name ?? "—",
          c.row.skisBest || "",
          c.disagreements.length ? "DISAGREE" : "ok",
        ]),
      ),
    );
  } else console.log("No runs listed yet. Fill in the table to validate against it.");

  const refs = cfg.validation?.referenceZoneAspects;
  const zoneDisagreements: string[] = [];
  if (refs) {
    console.log(`\nZone mean aspect vs reference zone aspects (${cfg.validation?.referenceZoneSource ?? "config"})\n`);
    console.log(
      textTable(
        ["Zone", "Reference", "Computed", "Δ", "Verdict"],
        Object.entries(refs).map(([id, ref]) => {
          const z = zones.find((z) => z.id === id);
          const d = z ? Math.round(angleDiff(ref, z.aspectDeg)) : null;
          const bad = d === null || d > 45;
          if (bad) zoneDisagreements.push(`${z?.name ?? id}: reference ${fmtAspect(ref)}, computed ${z ? fmtAspect(Math.round(z.aspectDeg)) : "missing"}${d !== null ? ` (Δ ${d}°)` : ""}`);
          return [z?.name ?? id, fmtAspect(ref), z ? fmtAspect(Math.round(z.aspectDeg)) : "missing", d === null ? "" : `${d}°`, bad ? "DISAGREE" : "ok"];
        }),
      ),
    );
  }

  const liftRows = liftFallLineCheck(lifts, runs);
  console.log("\nDEM sanity check: lift fall line (top → bottom bearing) vs DEM aspect of run segments within 120 m of the lift\n");
  console.log(
    textTable(
      ["Lift", "Lift fall line", "DEM aspect nearby", "Segments", "Δ"],
      liftRows.map((r) => [r.name, fmtAspect(r.fall), fmtAspect(r.dem), String(r.n), r.diff === null ? "" : `${r.diff}°`]),
    ),
  );
  const checked = liftRows.filter((r) => r.diff !== null);
  console.log(`  ${checked.filter((r) => r.diff! <= 30).length}/${checked.length} lifts within 30°`);

  const all = [
    ...results.filter((c) => c.disagreements.length).map((c) => `${c.row.run}: ${c.disagreements.join("; ")}`),
    ...zoneDisagreements.map((d) => `zone ${d}`),
  ];
  console.log(`\nDisagreements (${all.length}):`);
  for (const d of all) console.log(`  - ${d}`);
  if (!all.length) console.log("  none");
}

if (import.meta.url === `file://${process.argv[1]}`) await validate(process.argv[2]!);
