"use client";
import { useEffect, useRef } from "react";
import type { Map as MLMap, GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { scoreAt, type AppResortData } from "@snowline/core";
import { tier, type ScoredDay } from "@/lib/model";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const COLORS = { prime: "#1d8a52", good: "#1b63c0", fair: "#d29409", skip: "#b23a2e" } as const;

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

export default function MapView({
  data,
  day,
  hour,
  visible,
  onOpen,
}: {
  data: AppResortData;
  day: ScoredDay;
  hour: number;
  visible: Set<string>;
  onOpen: (runId: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const latest = useRef({ data, day, hour, visible, onOpen });
  latest.current = { data, day, hour, visible, onOpen };

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
        for (const layer of ["run-lines", "run-areas"]) {
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
  }, [data, day, hour, visible]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--line)]" style={{ height: "62dvh", minHeight: 360 }}>
      {/* Inline style: maplibre-gl.css sets position: relative on the container, which would beat a utility class. */}
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      <div className="pointer-events-none absolute bottom-2 left-2 flex gap-2 rounded-lg bg-[var(--surface)] px-2 py-1 text-[12px] font-bold shadow">
        {(["prime", "good", "fair", "skip"] as const).map((t) => (
          <span key={t} className="flex items-center gap-1">
            <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[t] }} />
            {t[0]!.toUpperCase() + t.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}
