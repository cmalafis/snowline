import { SCENARIOS, buildDayContext, compassPoint, scoreAt, scoreRunDay, type AppResortData, type AppRun } from "@snowline/core";
import { dataPath, loadResort, readJson } from "../resort.ts";
import { DIFFICULTY_SYMBOL, textTable } from "./print-table.ts";

/** Ten runs that cover the compass and the run types: the longest single-aspect run per direction, then trees/bumps/bowls. */
function pickRuns(runs: AppRun[], n = 10): AppRun[] {
  const picked: AppRun[] = [];
  const byLength = [...runs].filter((r) => !r.mixedAspect && r.topFt - r.bottomFt > 250).sort((a, b) => b.lengthM - a.lengthM);
  for (const dir of ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]) {
    const r = byLength.find((r) => compassPoint(r.aspectDeg) === dir && r.type === "groomer" && !picked.includes(r));
    if (r) picked.push(r);
  }
  for (const type of ["tree", "bump", "bowl"] as const) {
    const r = byLength.find((r) => r.type === type && !picked.includes(r));
    if (r) picked.push(r);
  }
  return picked.slice(0, n);
}

export async function scores(resortId: string) {
  const cfg = await loadResort(resortId);
  const data = await readJson<AppResortData>(dataPath(cfg.id, "app.json"));
  const { resort } = data;
  const clock = { lat: resort.base.lat, lon: resort.base.lon, tz: resort.tz, openHour: resort.openHour, closeHour: resort.closeHour, treelineFt: resort.treelineFt };
  const zones = new Map(data.zones.map((z) => [z.id, z]));
  const runs = pickRuns(data.runs);
  const hours = [9, 10, 11, 12, 13, 14, 15];

  for (const sc of SCENARIOS) {
    // Scenario stations sit at this resort's base and summit.
    const weather = {
      ...sc.weather,
      base: { ...sc.weather.base, elevationFt: resort.base.elevationFt },
      summit: sc.weather.summit && { ...sc.weather.summit, elevationFt: resort.summit.elevationFt },
    };
    const ctx = buildDayContext(clock, weather);
    const rows = runs.map((r) => {
      const day = scoreRunDay(r, zones.get(r.zone ?? ""), ctx);
      const best = day.reduce((m, s) => (s.score > m.score ? s : m));
      return [
        `${DIFFICULTY_SYMBOL[r.difficulty]} ${r.name}`,
        `${r.aspectDeg}° ${compassPoint(r.aspectDeg)}`,
        r.type,
        zones.get(r.zone ?? "")?.name ?? "—",
        ...hours.map((h) => {
          const s = scoreAt(day, h);
          return `${String(s.score).padStart(3)} ${s.state.slice(0, 4)}`;
        }),
        scoreAt(day, best.hour).reasons[0] ?? "",
      ];
    });
    console.log(`\n${resort.name}: ${sc.title} (${sc.weather.date})\n`);
    console.log(textTable(["Run", "Aspect", "Type", "Zone", ...hours.map((h) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`), "Best moment"], rows));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await scores(process.argv[2]!);
