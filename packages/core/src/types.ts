// Shared data shapes. No I/O here: the pipeline, scoring module and app all import these.

export type LonLat = [lon: number, lat: number];

export type Difficulty = "novice" | "easy" | "intermediate" | "advanced" | "expert" | "freeride" | "extreme" | "unknown";

export type RunType = "groomer" | "bump" | "tree" | "bowl";

export interface ResortConfig {
  id: string;
  name: string;
  /** Shown in the resort picker, e.g. "Routt County, Colorado". */
  region?: string;
  /** Season pass the resort is on, e.g. "Ikon" or "Epic". */
  pass?: string;
  tz: string;
  osm: {
    /** OSM element holding the ski area boundary (landuse=winter_sports). */
    skiArea?: { type: "way" | "relation"; id: number };
    /** [south, west, north, east], used when there is no boundary or to pad it. */
    bbox: [number, number, number, number];
  };
  /** Lift operating hours, local fractional hours (8.5 = 8:30). Defaults to 8:30-16:00. */
  hours?: { open: number; close: number };
  base: { lat: number; lon: number; elevationFt: number };
  summit: { lat: number; lon: number; elevationFt: number };
  treelineFt: number;
  /** A zone is wind-exposed when its top is within this many feet of the summit. */
  ridgeProximityFt: number;
  /** Lift name (as in OSM) -> zone id. Lifts sharing a zone id are merged. */
  zoneOverrides?: Record<string, string>;
  /** Zone id -> display name. */
  zoneNames?: Record<string, string>;
  /** Lift names to ignore when assigning zones (e.g. surface lifts, gondola access only). */
  ignoreLifts?: string[];
  /** Run name (or "osm:<way id>" when two runs share a name) -> fixes. */
  runOverrides?: Record<
    string,
    { zone?: string; type?: RunType; exclude?: boolean; aspect?: number; difficulty?: Difficulty; groomed?: boolean }
  >;
  /** Alternative name -> canonical OSM run name, used when matching user notes. */
  nameAliases?: Record<string, string>;
  /** Zone id -> calibration from local knowledge, each with its source. */
  zoneTuning?: Record<string, { springHeadStartHours?: number; source?: string }>;
  /** Reference values the validation script compares against, alongside reference/local-knowledge.md. */
  validation?: {
    /**
     * Published spring softening order: on the bluebird-spring scenario, each group's zones should go prime
     * (median run) within `toleranceHours` of `hour`, and groups in this order.
     */
    springOrder?: { label: string; zones: string[]; hour: number; source?: string }[];
    /** Zone id -> expected mean aspect in degrees. */
    referenceZoneAspects?: Record<string, number>;
    referenceZoneSource?: string;
  };
  /** Thresholds that rarely change per resort but may. */
  analysis?: Partial<AnalysisConfig>;
}

export interface AnalysisConfig {
  segmentLengthM: number;
  /** Half-width of the box filter applied to the DEM before computing gradients. */
  smoothingRadiusM: number;
  mixedAspectSpreadDeg: number;
  /** Share of segment length (0..0.5) trimmed from each edge of the aspect range before measuring spread. */
  aspectSpreadTrim: number;
  liftTopMatchRadiusM: number;
  /** Ignore DEM cells flatter than this when averaging aspect: aspect of near-flat ground is noise. */
  minPitchForAspectDeg: number;
}

export interface Segment {
  /** Midpoint of the segment. */
  at: LonLat;
  lengthM: number;
  elevationFt: number;
  pitchDeg: number;
  /** Downhill direction of the DEM gradient, degrees clockwise from true north. */
  aspectDeg: number;
  /** Direction of travel along the mapped line, for debugging only. */
  lineBearingDeg: number;
}

export interface Run {
  id: string;
  osmIds: number[];
  name: string | null;
  difficulty: Difficulty;
  grooming: string | null;
  type: RunType;
  /** Normally groomed: the default for "groomed today" until a grooming report or user says otherwise. */
  groomed: boolean;
  geometry: "line" | "area";
  coordinates: LonLat[][];
  lengthM: number;
  topFt: number;
  bottomFt: number;
  pitchDeg: number;
  aspectDeg: number;
  aspectSpreadDeg: number;
  mixedAspect: boolean;
  zone: string | null;
  segments: Segment[];
  demSource: "3dep" | "open-meteo";
  tags: Record<string, string>;
}

export interface Lift {
  id: string;
  osmId: number;
  name: string | null;
  kind: string;
  coordinates: LonLat[];
  bottom: LonLat;
  top: LonLat;
  bottomFt: number;
  topFt: number;
}

export interface Zone {
  id: string;
  name: string;
  lifts: string[];
  aspectDeg: number;
  topFt: number;
  bottomFt: number;
  windExposed: boolean;
  runCount: number;
  springHeadStartHours?: number;
}
