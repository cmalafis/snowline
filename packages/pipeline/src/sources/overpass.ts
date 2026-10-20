import type { ResortConfig } from "@snowline/core";

const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const USER_AGENT = "snowline-pipeline/0.1 (+https://github.com/snowline)";

export interface OsmWay {
  type: "way";
  id: number;
  tags: Record<string, string>;
  geometry: { lat: number; lon: number }[];
}

export interface OsmRelation {
  type: "relation";
  id: number;
  tags: Record<string, string>;
  members: { type: string; ref: number; role: string; geometry?: { lat: number; lon: number }[] }[];
}

export interface OsmDump {
  fetchedAt: string;
  boundary: [number, number][][]; // rings of [lon, lat]
  pistes: OsmWay[];
  pisteRelations: OsmRelation[];
  lifts: OsmWay[];
  /** Streams and rivers: a hazard in unmarked tree areas. Absent in dumps fetched before this was added. */
  waterways?: OsmWay[];
}

async function overpass(query: string): Promise<{ elements: any[] }> {
  let lastErr: unknown;
  for (const url of ENDPOINTS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ data: query }),
        });
        if (res.status === 429 || res.status >= 500) throw new Error(`Overpass ${res.status}`);
        if (!res.ok) throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return (await res.json()) as { elements: any[] };
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

/** Downhill pistes, piste route relations and aerialways inside the resort's bbox, plus its boundary rings. */
export async function fetchResortOsm(cfg: ResortConfig): Promise<OsmDump> {
  const [s, w, n, e] = cfg.osm.bbox;
  const bbox = `${s},${w},${n},${e}`;
  const area = cfg.osm.skiArea;
  const boundaryQ = area ? `${area.type}(${area.id});out geom;` : "";
  const q = `[out:json][timeout:120];
${boundaryQ}
way["piste:type"="downhill"](${bbox});out tags geom;
relation["route"="piste"]["piste:type"="downhill"](${bbox});out tags geom;
way["aerialway"](${bbox});out tags geom;
way["waterway"~"^(stream|river|brook|canal|ditch)$"](${bbox});out tags geom;`;
  const { elements } = await overpass(q);

  const boundary: [number, number][][] = [];
  const pistes: OsmWay[] = [];
  const pisteRelations: OsmRelation[] = [];
  const lifts: OsmWay[] = [];
  const waterways: OsmWay[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    if (area && el.type === area.type && el.id === area.id) {
      if (el.type === "way") boundary.push(el.geometry.map((p: any) => [p.lon, p.lat]));
      else for (const m of el.members ?? []) if (m.role === "outer" && m.geometry) boundary.push(m.geometry.map((p: any) => [p.lon, p.lat]));
    } else if (el.type === "way" && tags["piste:type"] === "downhill") pistes.push(el);
    else if (el.type === "relation" && tags.route === "piste") pisteRelations.push(el);
    else if (el.type === "way" && tags.aerialway) lifts.push(el);
    else if (el.type === "way" && tags.waterway) waterways.push(el);
  }
  return { fetchedAt: new Date().toISOString(), boundary, pistes, pisteRelations, lifts, waterways };
}
