import type { Difficulty, LonLat, RunType } from "./types.ts";
import type { ScoringRun } from "./scoring/score.ts";

/** What the app ships per resort: everything the client needs to score and draw runs, nothing it doesn't. */
export interface AppResort {
  id: string;
  name: string;
  region: string | null;
  pass: string | null;
  avalanche: { name: string; url: string } | null;
  tz: string;
  openHour: number;
  closeHour: number;
  treelineFt: number;
  base: { lat: number; lon: number; elevationFt: number };
  summit: { lat: number; lon: number; elevationFt: number };
  /** [west, south, east, north] */
  bounds: [number, number, number, number];
}

export interface AppZone {
  id: string;
  name: string;
  aspectDeg: number;
  topFt: number;
  bottomFt: number;
  windExposed: boolean;
  lifts: string[];
  springHeadStartHours?: number;
}

export interface AppLift {
  name: string | null;
  kind: string;
  line: LonLat[];
}

export interface AppRun extends ScoringRun {
  name: string;
  difficulty: Difficulty;
  type: RunType;
  lengthM: number;
  mixedAspect: boolean;
  geometry: "line" | "area";
  /** Simplified line(s), or the outline ring for area pistes. */
  lines: LonLat[][];
  /** [distance m, elevation ft] along the run, for line runs. */
  profile: [number, number][];
  /** Segment midpoints, for "which run am I on" lookups. */
  points: LonLat[];
}

/**
 * An unmarked tree area: forest between mapped runs that looks skiable in the canopy and terrain data. Scored
 * like a glade; shown only when the user has opted in and accepted the cautions.
 */
export interface AppTreeArea extends AppRun {
  unmarked: true;
  areaHa: number;
  /** Rectangles covering the area (each its own polygon ring). */
  polygons: LonLat[][];
  /** Hazards found in the data for this area. */
  hazards: string[];
  nearRuns: string[];
}

export interface AppResortData {
  version: string;
  generatedAt: string;
  resort: AppResort;
  zones: AppZone[];
  lifts: AppLift[];
  runs: AppRun[];
  treeAreas?: AppTreeArea[];
}

/** One entry in the resort picker. */
export interface ResortSummary {
  id: string;
  name: string;
  region: string | null;
  pass: string | null;
  base: { lat: number; lon: number; elevationFt: number };
  summit: { lat: number; lon: number; elevationFt: number };
  runCount: number;
  /** Live snapshot, when requested and available. */
  conditions?: { newSnowIn: number; stormTotalIn: number | null; summitTempF: number; cloudCover: number; gustMph: number } | null;
}
