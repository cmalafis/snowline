import "server-only";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { AppResortData, ResortSummary } from "@snowline/core";

/** Where pipeline output lives: SNOWLINE_DATA_DIR in the container, the repo's data/ folder in dev. Read at runtime, so kept out of build tracing. */
export const DATA_DIR = process.env.SNOWLINE_DATA_DIR ?? path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data");

const cache = new Map<string, AppResortData>();

export async function listResorts(): Promise<ResortSummary[]> {
  const dirs = await readdir(/* turbopackIgnore: true */ DATA_DIR, { withFileTypes: true });
  const out: ResortSummary[] = [];
  for (const d of dirs) {
    if (!d.isDirectory() || !existsSync(path.join(DATA_DIR, d.name, "app.json"))) continue;
    const data = await loadResort(d.name);
    if (!data) continue;
    const r = data.resort;
    out.push({ id: r.id, name: r.name, region: r.region ?? null, pass: r.pass ?? null, base: r.base, summit: r.summit, runCount: data.runs.length });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadResort(id: string): Promise<AppResortData | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  const hit = cache.get(id);
  if (hit) return hit;
  const file = path.join(/* turbopackIgnore: true */ DATA_DIR, id, "app.json");
  if (!existsSync(file)) return null;
  const data = JSON.parse(await readFile(file, "utf8")) as AppResortData;
  cache.set(id, data);
  return data;
}
