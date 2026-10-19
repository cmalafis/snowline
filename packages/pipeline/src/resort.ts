import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { AnalysisConfig, ResortConfig } from "@snowline/core";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const DEFAULT_ANALYSIS: AnalysisConfig = {
  segmentLengthM: 50,
  smoothingRadiusM: 15,
  mixedAspectSpreadDeg: 90,
  aspectSpreadTrim: 0.1,
  liftTopMatchRadiusM: 1000,
  minPitchForAspectDeg: 3,
};

export async function loadResort(id: string | undefined): Promise<ResortConfig> {
  if (!id) throw new Error("Usage: <command> <resort-id>   (see config/resorts/*.json)");
  const file = path.join(ROOT, "config/resorts", `${id}.json`);
  if (!existsSync(file)) throw new Error(`No resort config at ${path.relative(ROOT, file)}`);
  return JSON.parse(await readFile(file, "utf8")) as ResortConfig;
}

export const analysisConfig = (cfg: ResortConfig): AnalysisConfig => ({ ...DEFAULT_ANALYSIS, ...cfg.analysis });

export function dataPath(resortId: string, ...parts: string[]): string {
  return path.join(ROOT, "data", resortId, ...parts);
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 1) + "\n");
}

export async function readJson<T>(file: string): Promise<T> {
  if (!existsSync(file)) throw new Error(`Missing ${path.relative(ROOT, file)}. Run the earlier pipeline step first.`);
  return JSON.parse(await readFile(file, "utf8")) as T;
}
