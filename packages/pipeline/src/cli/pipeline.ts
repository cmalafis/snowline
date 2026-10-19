import { existsSync } from "node:fs";
import { fetchTrails } from "./fetch-trails.ts";
import { analyze } from "./analyze.ts";
import { printTable } from "./print-table.ts";
import { exportApp } from "./export.ts";
import { dataPath } from "../resort.ts";

// Usage: npm run pipeline -- <resort-id> [--refresh]
const [resortId, ...flags] = process.argv.slice(2);
if (!resortId) throw new Error("Usage: npm run pipeline -- <resort-id> [--refresh]");
if (flags.includes("--refresh") || !existsSync(dataPath(resortId, "osm.json"))) await fetchTrails(resortId);
await analyze(resortId);
await printTable(resortId);
await exportApp(resortId);
