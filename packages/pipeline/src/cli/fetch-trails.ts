import { fetchResortOsm } from "../sources/overpass.ts";
import { dataPath, loadResort, writeJson } from "../resort.ts";

export async function fetchTrails(resortId: string) {
  const cfg = await loadResort(resortId);
  console.log(`Fetching OSM runs and lifts for ${cfg.name}...`);
  const dump = await fetchResortOsm(cfg);
  await writeJson(dataPath(cfg.id, "osm.json"), dump);
  console.log(`  ${dump.pistes.length} piste ways, ${dump.pisteRelations.length} piste relations, ${dump.lifts.length} lifts, boundary rings: ${dump.boundary.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await fetchTrails(process.argv[2]!);
