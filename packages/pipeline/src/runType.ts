import type { RunType } from "@snowline/core";
import type { RawRun } from "./terrain.ts";

/**
 * Best guess from OSM tags and the run name. OSM rarely tags grooming, so most runs fall through to
 * "groomer"; resort config `runOverrides` and the grooming report (step 3) correct the rest.
 */
export function classifyRun(run: RawRun, topFt: number, treelineFt: number): RunType {
  const name = (run.name ?? "").toLowerCase();
  const grooming = run.grooming ?? "";
  if (grooming.includes("mogul")) return "bump";
  if (run.tags.gladed === "yes" || run.tags.glade === "yes" || /\b(glades?|trees|woods)\b/.test(name)) return "tree";
  if (/\bbowl\b/.test(name) || (run.geometry === "area" && topFt > treelineFt)) return "bowl";
  if (/\bbumps?\b|\bmoguls?\b/.test(name)) return "bump";
  if (grooming === "backcountry") return run.geometry === "area" ? "tree" : "bump";
  if (run.geometry === "area") return "tree";
  return "groomer";
}
