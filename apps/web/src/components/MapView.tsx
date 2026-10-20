"use client";
import { useEffect, useRef } from "react";
import type { Map as MLMap, GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { scoreAt, type AppResortData, type AppTreeArea } from "@snowline/core";
import { tier, type ScoredDay } from "@/lib/model";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const COLORS = { prime: "#3d7317", good: "#0066cc", fair: "#dca614", skip: "#b1380b" } as const;

function runFeatures(data: AppResortData, day: ScoredDay, hour: number, visible: Set<string>) {
  return {
    type: "FeatureCollection" as const,
    features: data.runs
      .filter((r) => visible.has(r.id))
      .map((r) => {
        const s = scoreAt(day.byRun.get(r.id)!, hour).score;
        const props = { id: r.id, name: r.name, score: s, color: COLORS[tier(s)] };
        return r.geometry === "area"
          ? { type: "Feature" as const, properties: props, geometry: { type: "Polygon" as const, coordinates: r.lines } }
          : { type: "Feature" as const, properties: props, geometry: { type: "MultiLineString" as const, coordinates: r.lines } };
      }),
  };
}

/** Unmarked tree areas: one multipolygon per area, coloured by score. Empty when the layer is off. */
function treeFeatures(areas: AppTreeArea[] | null, day: ScoredDay, hour: number) {
  return {
    type: "FeatureCollection" as const,
    features: (areas ?? []).map((a) => {
      const s = scoreAt(day.byRun.get(a.id)!, hour).score;
      return {
        type: "Feature" as const,
        properties: { id: a.id, name: a.name, score: s, color: COLORS[tier(s)] },
        geometry: { type: "MultiPolygon" as const, coordinates: a.polygons.map((ring) => [ring]) },
      };
    }),
  };
}

export default function MapView({
  data,
  day,
  hour,
  visible,
  treeAreas,
  onOpen,
}: {
  data: AppResortData;
  day: ScoredDay;
  hour: number;
  visible: Set<string>;
  /** Unmarked tree areas to draw, or null when the layer is off. */
  treeAreas: AppTreeArea[] | null;
  onOpen: (runId: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const latest = useRef({ data, day, hour, visible, treeAreas, onOpen });
  latest.current = { data, day, hour, visible, treeAreas, onOpen };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      maplibre.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      if (cancelled || !el.current) return;
      const [w, s, e, n] = data.resort.bounds;
      const m = new maplibre.Map({
        container: el.current,
        style: STYLE,
        bounds: [
          [w, s],
          [e, n],
        ],
        fitBoundsOptions: { padding: 24 },
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.current = m;
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      m.addControl(new maplibre.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), "top-right");
      m.on("load", () => {
        const cur = latest.current;
        m.addSource("lifts", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: cur.data.lifts.map((l) => ({ type: "Feature", properties: { name: l.name ?? "" }, geometry: { type: "LineString", coordinates: l.line } })),
          },
        });
        m.addSource("trees", { type: "geojson", data: treeFeatures(cur.treeAreas, cur.day, cur.hour) });
        // Under the runs: shaded patches, clearly not runs. No antialiasing, or seams between an area's
        // rectangles show as stripes.
        m.addLayer({ id: "tree-areas", type: "fill", source: "trees", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.28, "fill-antialias": false } });
        m.addSource("runs", { type: "geojson", data: runFeatures(cur.data, cur.day, cur.hour, cur.visible) });
        m.addLayer({ id: "run-areas", type: "fill", source: "runs", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": ["get", "color"], "fill-opacity": 0.3 } });
        m.addLayer({
          id: "run-lines",
          type: "line",
          source: "runs",
          filter: ["!=", ["geometry-type"], "Polygon"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ["get", "color"], "line-width": ["interpolate", ["linear"], ["zoom"], 12, 2.5, 15, 6] },
        });
        m.addLayer({ id: "lifts", type: "line", source: "lifts", paint: { "line-color": "#0f1e28", "line-width": 1.6, "line-dasharray": [2, 1.5] } });
        m.addLayer({
          id: "run-labels",
          type: "symbol",
          source: "runs",
          minzoom: 14,
          layout: { "symbol-placement": "line", "text-field": ["concat", ["get", "name"], " ", ["to-string", ["get", "score"]]], "text-size": 12 },
          paint: { "text-color": "#0f1e28", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
        });
        for (const layer of ["run-lines", "run-areas", "tree-areas"]) {
          m.on("click", layer, (ev: MapLayerMouseEvent) => {
            const id = ev.features?.[0]?.properties?.id;
            if (typeof id === "string") latest.current.onOpen(id);
          });
          m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
          m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
        }
      });
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // The map is created once per resort; scores update through setData below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.resort.id]);

  useEffect(() => {
    const src = map.current?.getSource("runs") as GeoJSONSource | undefined;
    src?.setData(runFeatures(data, day, hour, visible));
    (map.current?.getSource("trees") as GeoJSONSource | undefined)?.setData(treeFeatures(treeAreas, day, hour));
  }, [data, day, hour, visible, treeAreas]);

  return (
    <div className="relative overflow-hidden" style={{ height: "62dvh", minHeight: 360, borderRadius: 16, border: "1px solid var(--pf-border)" }}>
      {/* Inline style: maplibre-gl.css sets position: relative on the container, which would beat a utility class. */}
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      <div className="pointer-events-none absolute bottom-2 left-2 flex gap-2 px-2 py-1 text-[12px] font-bold shadow" style={{ background: "var(--pf-surface)", borderRadius: 999 }}>
        {(["prime", "good", "fair", "skip"] as const).map((t) => (
          <span key={t} className="flex items-center gap-1">
            <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[t] }} />
            {t[0]!.toUpperCase() + t.slice(1)}
          </span>
        ))}
        {treeAreas && (
          <span className="flex items-center gap-1">
            <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.good, opacity: 0.35 }} />
            Unmarked trees
          </span>
        )}
      </div>
    </div>
  );
}
