"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SCORING,
  SCENARIOS,
  addDays,
  cloudAt,
  compassPoint,
  fmtTime,
  hourIn,
  overnightLowAt,
  temperatureAt,
  todayIn,
  windAt,
  yesterdayHighAt,
  type AppResortData,
  type DayWeather,
  type LonLat,
  type ResortSummary,
} from "@snowline/core";
import { distanceToRun, nearby, rankAt, scoreDay, zoneScoreAt, type Ranked } from "@/lib/model";
import { DEFAULT_PREFS, flushFeedback, store, type Prefs } from "@/lib/storage";
import { DiffSymbol } from "./DiffSymbol";
import { HourlyPlan } from "./HourlyPlan";
import { CoverLabel, RunRow, groomLabel } from "./RunList";
import { ResortPicker } from "./ResortPicker";
import { RunSheet } from "./RunSheet";
import { DifficultyPicker, MAX_LABEL, SettingsSheet, TerrainPicker } from "./SettingsSheet";
import { Alert, BrandMark, Icon, ScoreLabel } from "./ui";
import { WeatherStrip } from "./WeatherStrip";
import { ZonesCard, rankZones } from "./Zones";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="card subtle">Loading map…</div> });

type Load<T> = { state: "loading" } | { state: "ok"; value: T; offline: boolean } | { state: "error"; message: string };
type Tab = "overview" | "runs" | "map";

async function getJson<T>(url: string): Promise<{ value: T; offline: boolean }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
  return { value: (await res.json()) as T, offline: res.headers.get("X-Snowline-Offline") === "1" };
}

function skyWords(cloud: number): string {
  return cloud < 20 ? "Sunny" : cloud < 50 ? "Mostly sunny" : cloud < 80 ? "Partly cloudy" : "Overcast";
}

function listNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function App() {
  const [resorts, setResorts] = useState<ResortSummary[]>([]);
  const [resortId, setResortId] = useState<string | null>(null);
  /** "first": no resort chosen yet, so the picker can't be dismissed. */
  const [picker, setPicker] = useState<null | "first" | "switch">(null);
  const [dayOffset, setDayOffset] = useState(0);
  /** A demo scenario id instead of the live forecast (useful off-season and for testers). */
  const [demo, setDemo] = useState<string | null>(null);
  const [data, setData] = useState<Load<AppResortData>>({ state: "loading" });
  const [weather, setWeather] = useState<Load<DayWeather>>({ state: "loading" });
  const [hour, setHour] = useState(9);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [groomed, setGroomed] = useState<Record<string, boolean>>({});
  const [aspect, setAspect] = useState<Record<string, number>>({});
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [settings, setSettings] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<null | "terrain" | "difficulty">(null);
  const [loc, setLoc] = useState<{ p: LonLat; at: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [nearMe, setNearMe] = useState(false);
  const [favOnly, setFavOnly] = useState(false);

  // Boot: prefs, resort list, service worker, queued feedback.
  useEffect(() => {
    setPrefsState(store.prefs());
    getJson<ResortSummary[]>("/api/resorts?conditions=1")
      .then(({ value }) => {
        setResorts(value);
        // A shared link (?resort=…) wins, then the last resort used on this device.
        const wanted = new URLSearchParams(window.location.search).get("resort") ?? store.resort();
        const match = value.find((r) => r.id === wanted);
        if (match) setResortId(match.id);
        else if (value.length === 1) setResortId(value[0]!.id);
        else if (value.length > 1) setPicker("first");
        else setData({ state: "error", message: "No resorts available" });
      })
      .catch((e: Error) => setData({ state: "error", message: e.message }));
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    void flushFeedback();
    const online = () => void flushFeedback();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);

  const tz = data.state === "ok" ? data.value.resort.tz : "America/Denver";
  const scenario = demo ? SCENARIOS.find((x) => x.id === demo) : undefined;
  const date = useMemo(() => scenario?.weather.date ?? addDays(todayIn(tz), dayOffset), [scenario, tz, dayOffset]);

  // Resort data.
  useEffect(() => {
    if (!resortId) return;
    store.setResort(resortId);
    const url = new URL(window.location.href);
    url.searchParams.set("resort", resortId);
    window.history.replaceState(null, "", url);
    setData({ state: "loading" });
    setZoneFilter(null);
    setOpenRun(null);
    setQuery("");
    getJson<AppResortData>(`/api/resorts/${resortId}`)
      .then(({ value, offline }) => {
        setData({ state: "ok", value, offline });
        setFavorites(store.favorites(resortId));
        setAspect(store.aspectFixes(resortId));
        const r = value.resort;
        setHour(Math.min(r.closeHour, Math.max(r.openHour, Math.round(hourIn(r.tz) * 4) / 4)));
      })
      .catch((e: Error) => setData({ state: "error", message: e.message }));
  }, [resortId]);

  // Weather for the chosen day: a demo scenario placed at this resort's base and summit, or the live forecast.
  useEffect(() => {
    if (!resortId) return;
    setGroomed(store.groomed(resortId, date));
    if (scenario) {
      if (data.state !== "ok") return;
      const { base, summit } = data.value.resort;
      const w = scenario.weather;
      setWeather({
        state: "ok",
        offline: false,
        value: { ...w, base: { ...w.base, elevationFt: base.elevationFt }, summit: w.summit && { ...w.summit, elevationFt: summit.elevationFt } },
      });
      return;
    }
    setWeather({ state: "loading" });
    getJson<DayWeather>(`/api/resorts/${resortId}/weather?date=${date}`)
      .then(({ value, offline }) => setWeather({ state: "ok", value, offline }))
      .catch((e: Error) => setWeather({ state: "error", message: e.message }));
  }, [resortId, date, scenario, data]);

  // Geolocation, only once the user asks for it.
  useEffect(() => {
    if (!nearMe) return;
    if (!("geolocation" in navigator)) return setLocError("Location isn't available on this device.");
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setLocError(null);
        setLoc({ p: [pos.coords.longitude, pos.coords.latitude], at: Date.now() });
      },
      (err) => setLocError(err.code === err.PERMISSION_DENIED ? "Location permission was denied." : "Couldn't get your location."),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [nearMe]);

  const setPrefs = useCallback((p: Prefs) => {
    setPrefsState(p);
    store.setPrefs(p);
  }, []);

  const resort = data.state === "ok" ? data.value : null;
  const wx = weather.state === "ok" ? weather.value : null;
  const day = useMemo(() => (resort && wx ? scoreDay(resort, wx, { groomed, aspect }) : null), [resort, wx, groomed, aspect]);
  const where = useMemo(() => (resort && loc ? nearby(resort, loc.p) : null), [resort, loc]);
  const atResort = !!where && where.near.size > 0;
  const ranked: Ranked[] = useMemo(() => (resort && day ? rankAt(resort, day, hour, prefs) : []), [resort, day, hour, prefs]);
  const zoneRanks = useMemo(() => {
    if (!resort || !day) return [];
    const scores = new Map(resort.zones.map((z) => [z.id, zoneScoreAt(resort, day, z.id, hour, prefs)] as const));
    return rankZones(resort.zones, scores);
  }, [resort, day, hour, prefs]);

  if (data.state === "error") return <Centered title="Couldn't load Snowline" detail={data.message} />;
  const pickerEl = picker && (
    <ResortPicker
      resorts={resorts}
      current={resortId}
      firstVisit={picker === "first"}
      onPick={(id) => {
        setPicker(null);
        setResortId(id);
        setTab("overview");
      }}
      onClose={() => setPicker(null)}
    />
  );
  if (!resort)
    return (
      <>
        <header className="masthead">
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BrandMark />
            <span className="display" style={{ fontSize: 20 }}>
              Snowline
            </span>
          </span>
        </header>
        <Centered title={picker ? "Where the best snow is, hour by hour." : "Loading…"} />
        {pickerEl}
      </>
    );

  const { resort: r, zones } = resort;
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const sun = day ? day.ctx.steps.reduce((m, s) => (Math.abs(s.hour - hour) < Math.abs(m.hour - hour) ? s : m)).sun : { elevationDeg: 0, azimuthDeg: 180 };
  const sunrise = day?.ctx.steps.find((s) => s.sun.elevationDeg > 0)?.hour;
  const best = ranked[0];
  const open = openRun ? resort.runs.find((x) => x.id === openRun) : null;

  // Runs tab filters.
  const q = query.trim().toLowerCase();
  let list = ranked;
  if (zoneFilter) list = list.filter((x) => x.run.zone === zoneFilter);
  if (favOnly) list = list.filter((x) => favorites.includes(x.run.id));
  if (nearMe && atResort) list = list.filter((x) => where!.near.has(x.run.id));
  if (q) list = list.filter((x) => x.run.name.toLowerCase().includes(q));
  const hiddenByPrefs = resort.runs.length - ranked.length;
  const shown = showAll ? list : list.slice(0, 25);
  const visibleIds = new Set(list.map((x) => x.run.id));
  const allTypes = prefs.types.length === 4;
  const anyFilter = !!zoneFilter || favOnly || nearMe || !!q || !allTypes || prefs.maxDifficulty !== "expert";

  // What matters this hour, summarised for the alerts and condition labels.
  const midFt = (r.base.elevationFt + r.summit.elevationFt) / 2;
  const holdWarning = ranked.flatMap((x) => x.s.warnings).find((w) => /lift holds/i.test(w));
  const rainWarning = ranked.some((x) => x.s.warnings.some((w) => /rain/i.test(w)));
  const scoured = (wx?.overnightMaxGustMph ?? 0) >= DEFAULT_SCORING.wind.scourGustMph;
  const exposedZones = zones.filter((z) => z.windExposed).map((z) => z.name);
  const cond = wx && {
    mid: Math.round(temperatureAt(wx, hour, midFt, 3.5)),
    top: Math.round(temperatureAt(wx, hour, r.summit.elevationFt, 3.5)),
    cloud: cloudAt(wx, hour, midFt),
    gust: Math.round(windAt(wx, hour, r.summit.elevationFt).gustMph),
    refreeze: yesterdayHighAt(wx, midFt, 3.5) > 34 && overnightLowAt(wx, midFt, 3.5) < 28 && wx.newSnowIn < 3,
  };
  const pct = ((hour - r.openHour) / (r.closeHour - r.openHour)) * 100;

  const goRuns = (zoneId: string | null) => {
    setZoneFilter(zoneId);
    setShowAll(false);
    setTab("runs");
  };

  const slider = (
    <>
      <input
        className="scrub"
        type="range"
        min={r.openHour}
        max={r.closeHour}
        step={0.25}
        value={hour}
        onChange={(e) => setHour(Number(e.target.value))}
        aria-label="Time of day"
        aria-valuetext={fmtTime(hour)}
        style={{ ["--pct" as string]: `${pct}%` }}
      />
      <div className="mono subtle" style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: -6 }}>
        <span>{fmtTime(r.openHour)}</span>
        <span>Noon</span>
        <span>{fmtTime(r.closeHour)}</span>
      </div>
    </>
  );

  const compactTime = (
    <section className="card" aria-label="Time of day" style={{ padding: "12px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span>
          <span className="subtle" style={{ fontSize: 14 }}>
            Scores at{" "}
          </span>
          <span className="display" style={{ fontSize: 22 }}>
            {fmtTime(hour)}
          </span>
        </span>
        {cond && (
          <span className="subtle" style={{ fontSize: 14 }}>
            {skyWords(cond.cloud)} · {cond.mid}°F · gusts {cond.gust}
          </span>
        )}
      </div>
      {slider}
    </section>
  );

  return (
    <>
      <header className="masthead">
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BrandMark />
          <span className="display" style={{ fontSize: 20 }}>
            Snowline
          </span>
        </span>
        <span style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            className="btn-icon"
            aria-label="Near me"
            aria-pressed={nearMe}
            onClick={() => {
              setNearMe((v) => !v);
              if (!nearMe) setTab("runs");
            }}
          >
            <Icon name="pin" size={22} />
          </button>
          <button type="button" className="btn-icon" aria-label="Settings and feedback" onClick={() => setSettings(true)}>
            <Icon name="gear" size={22} />
          </button>
        </span>
      </header>

      <div className="page-header">
        <div>
          <button
            type="button"
            className="btn"
            onClick={() => setPicker("switch")}
            disabled={resorts.length < 2}
            aria-label={`${r.name}. Change resort`}
            data-testid="resort-button"
            style={{ justifyContent: "space-between", minHeight: 56, padding: "0 16px", border: "1px solid var(--pf-border-strong)", color: "var(--pf-text)", background: "var(--pf-surface)", opacity: 1 }}
          >
            <span style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
              <span className="display" style={{ fontSize: 24 }}>
                {r.name}
              </span>
              {r.region && (
                <span className="subtle" style={{ fontSize: 14, fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.region.replace(", Colorado", ", CO")}
                </span>
              )}
            </span>
            {resorts.length > 1 && <Icon name="chevronDown" />}
          </button>
          <div className="toggle-group" role="group" aria-label="Day">
            {["Today", "Tomorrow"].map((label, i) => (
              <button
                key={label}
                type="button"
                aria-pressed={!demo && dayOffset === i}
                onClick={() => {
                  setDemo(null);
                  setDayOffset(i);
                }}
              >
                {label}
              </button>
            ))}
            <button type="button" aria-pressed={!!demo} onClick={() => setDemo(demo ?? SCENARIOS[0]!.id)}>
              Demo
            </button>
          </div>
          <div className="tabs" role="tablist" aria-label="Views">
            {(
              [
                ["overview", "Overview"],
                ["runs", "Runs"],
                ["map", "Map"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" className="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} id={`tab-${id}`} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="page" id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {scenario && tab === "overview" && (
          <div className="alert alert-info" role="status" style={{ flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <Icon name="info" style={{ color: "var(--a-info-icon)", marginTop: 2 }} />
              <div>
                <div className="alert-title">Demo day: {scenario.title.charAt(0).toLowerCase() + scenario.title.slice(1)}</div>
                <div className="alert-body">Made-up weather on the real {r.name} runs. Switch to Today for the live forecast.</div>
              </div>
            </div>
            <div role="group" aria-label="Demo weather" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -16px", padding: "0 16px 2px" }}>
              {SCENARIOS.map((x) => (
                <button key={x.id} type="button" className="filter-btn" style={{ flex: "none" }} aria-pressed={demo === x.id} onClick={() => setDemo(x.id)}>
                  {x.title}
                </button>
              ))}
            </div>
          </div>
        )}
        {!scenario && tab === "overview" && offSeason(date) && (
          <Alert variant="info" title="It's the off-season">
            Live scores aren&apos;t meaningful until the snow arrives.{" "}
            <button type="button" className="btn btn-link" style={{ minHeight: 0, padding: 0 }} onClick={() => setDemo(SCENARIOS[0]!.id)}>
              Try a demo day
            </button>
          </Alert>
        )}
        {((data.state === "ok" && data.offline) || (weather.state === "ok" && weather.offline)) && (
          <Alert variant="warning" title="You're offline">
            Showing the forecast and scores saved when you last had signal.
          </Alert>
        )}
        {weather.state === "error" && (
          <Alert variant="danger" title="Weather unavailable">
            {weather.message}. Open the app once with signal to save today&apos;s forecast.
          </Alert>
        )}
        {tab === "overview" && holdWarning && (
          <Alert variant="warning" title={holdWarning.replace(": lift holds likely", " up top")}>
            Lift holds likely on {listNames(exposedZones)}.{scoured ? " Open slopes were scoured overnight;" : ""} Sheltered tree runs ski best.
          </Alert>
        )}
        {tab === "overview" && !holdWarning && scoured && wx && (
          <Alert variant="warning" title={`Windy night: gusts to ${Math.round(wx.overnightMaxGustMph ?? 0)} mph`}>
            Open, ungroomed slopes are likely firm or icy. Groomers and tree runs held up best.
          </Alert>
        )}
        {tab === "overview" && rainWarning && (
          <Alert variant="warning" title="Rain below the snow line">
            Lower runs are getting rain; higher terrain is getting snow.
          </Alert>
        )}

        {tab === "overview" && (
          <>
            <section className="card" aria-label="Time of day" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
                <div>
                  <div className="subtle" style={{ fontSize: 14, fontWeight: 500 }}>
                    Showing scores at
                  </div>
                  <div className="display" style={{ fontSize: 40, lineHeight: 1 }}>
                    {fmtTime(hour)}
                  </div>
                </div>
                <div className="subtle" style={{ textAlign: "right", fontSize: 14 }}>
                  {sun.elevationDeg > 0 ? `Sun ${Math.round(sun.elevationDeg)}° up, from the ${compassPoint(sun.azimuthDeg)}` : "Sun is down"}
                  {sunrise !== undefined && (
                    <>
                      <br />
                      Sunrise {fmtTime(sunrise)}
                    </>
                  )}
                </div>
              </div>
              <div>{slider}</div>
              {cond && wx && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <span className="label label-outline">{skyWords(cond.cloud)}</span>
                  <span className="label label-outline">{cond.mid}°F mid-mountain</span>
                  <span className="label label-outline">{cond.top}°F up top</span>
                  <span className={`label ${wx.newSnowIn >= 4 ? "label-good" : "label-outline"}`}>
                    {wx.newSnowIn}&quot; new{wx.newSnowBaseIn !== undefined && wx.newSnowBaseIn < wx.newSnowIn - 0.5 ? ` (${wx.newSnowBaseIn}" at base)` : ""}
                  </span>
                  {wx.stormTotalIn !== undefined && wx.stormTotalIn > wx.newSnowIn + 0.5 && <span className="label label-outline">{wx.stormTotalIn}&quot; in 3 days</span>}
                  <span className={`label ${cond.gust >= DEFAULT_SCORING.wind.holdGustMph ? "label-fair" : "label-outline"}`}>Gusts {cond.gust} mph</span>
                  {cond.refreeze && <span className="label label-outline">Overnight refreeze</span>}
                  {scoured && <span className="label label-fair">Scoured overnight</span>}
                </div>
              )}
              {wx && <WeatherStrip resort={r} weather={wx} hour={hour} onHour={setHour} />}
            </section>

            {!day ? (
              <div className="card subtle">{weather.state === "loading" ? "Getting the forecast…" : "Scores need a forecast."}</div>
            ) : (
              <>
                {best && (
                  <section className="card" aria-label="Best right now" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div className="subtle" style={{ fontSize: 14, fontWeight: 500 }}>
                      Best right now
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <DiffSymbol d={best.run.difficulty} size={20} />
                      <span className="display" style={{ fontSize: 26, lineHeight: 1.1 }}>
                        {best.run.name}
                      </span>
                      <ScoreLabel score={best.s.score} label={best.s.label} />
                    </div>
                    <div className="subtle" style={{ fontSize: 14 }}>
                      {zoneById.get(best.run.zone ?? "")?.name} · faces {compassPoint(best.run.aspectDeg)} · {groomLabel(best, groomed[best.run.id] ?? best.run.groomed)} · {best.s.tempF}°F
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                      {best.s.reasons.map((why, i) => (
                        <li key={why} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <Icon
                            name={best.s.tones[i] === "up" ? "check" : best.s.tones[i] === "down" ? "warning" : "info"}
                            style={{ color: best.s.tones[i] === "up" ? "var(--pf-prime)" : best.s.tones[i] === "down" ? "var(--pf-skip)" : "var(--pf-subtle)", marginTop: 2 }}
                          />
                          {why}
                        </li>
                      ))}
                    </ul>
                    <div>
                      <CoverLabel run={best.run} treelineFt={r.treelineFt} />
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                      <button type="button" className="btn btn-primary" onClick={() => setOpenRun(best.run.id)}>
                        View run
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setTab("map")}>
                        Show on map
                      </button>
                    </div>
                  </section>
                )}
                <ZonesCard ranked={zoneRanks} sun={sun} hereZone={where?.zoneId ?? null} onPick={goRuns} />
                <HourlyPlan
                  data={resort}
                  day={day}
                  prefs={prefs}
                  hour={hour}
                  onPick={(h, z) => {
                    setHour(h);
                    goRuns(z);
                  }}
                />
              </>
            )}
          </>
        )}

        {tab === "runs" && (
          <>
            {compactTime}
            <section className="card" aria-label="Filters" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label className="search">
                <Icon name="search" size={18} style={{ color: "var(--pf-subtle)" }} />
                <span className="sr-only">Find a run</span>
                <input type="search" placeholder="Find a run" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="filter-btn" aria-pressed={nearMe} onClick={() => setNearMe((v) => !v)}>
                  <Icon name="pin" size={16} />
                  Near me
                </button>
                <button type="button" className="filter-btn" aria-pressed={favOnly} onClick={() => setFavOnly((v) => !v)} disabled={!favorites.length && !favOnly}>
                  <Icon name={favOnly ? "starFilled" : "star"} size={16} />
                  Favorites
                </button>
                <button type="button" className="filter-btn" aria-expanded={menu === "terrain"} onClick={() => setMenu(menu === "terrain" ? null : "terrain")}>
                  Terrain
                  <Icon name="chevronDown" size={16} />
                </button>
                <button type="button" className="filter-btn" aria-expanded={menu === "difficulty"} onClick={() => setMenu(menu === "difficulty" ? null : "difficulty")}>
                  Difficulty
                  <Icon name="chevronDown" size={16} />
                </button>
              </div>
              {menu === "terrain" && <TerrainPicker prefs={prefs} onPrefs={setPrefs} />}
              {menu === "difficulty" && <DifficultyPicker prefs={prefs} onPrefs={setPrefs} />}
              {anyFilter && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {zoneFilter && <Chip label={`Zone: ${zoneById.get(zoneFilter)?.name}`} onRemove={() => setZoneFilter(null)} />}
                  {nearMe && <Chip label="Near me" onRemove={() => setNearMe(false)} />}
                  {favOnly && <Chip label="Favorites" onRemove={() => setFavOnly(false)} />}
                  {q && <Chip label={`"${query.trim()}"`} onRemove={() => setQuery("")} />}
                  {!allTypes && <Chip label={`Terrain: ${prefs.types.length} of 4`} onRemove={() => setPrefs({ ...prefs, types: DEFAULT_PREFS.types })} />}
                  {prefs.maxDifficulty !== "expert" && <Chip label={`Up to ${MAX_LABEL[prefs.maxDifficulty]}`} onRemove={() => setPrefs({ ...prefs, maxDifficulty: "expert" })} />}
                  <button
                    type="button"
                    className="btn btn-link"
                    style={{ minHeight: 32, fontSize: 14 }}
                    onClick={() => {
                      setZoneFilter(null);
                      setNearMe(false);
                      setFavOnly(false);
                      setQuery("");
                      setPrefs(DEFAULT_PREFS);
                    }}
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </section>
            {nearMe && (
              <Alert variant="info" title={locError ? "Location unavailable" : !loc ? "Finding you…" : where?.here ? `You're on ${where.here.name}` : atResort ? "You're near these runs" : `You're not at ${r.name}`}>
                {locError ??
                  (where?.here ? `${zoneById.get(where.here.zone ?? "")?.name ?? ""}. Showing runs within about a mile.` : loc && !atResort ? "Showing every run instead." : undefined)}
              </Alert>
            )}
            <div className="subtle" style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
              <span>
                {list.length} of {resort.runs.length} runs · best first
              </span>
              {hiddenByPrefs > 0 && <span>{hiddenByPrefs} hidden by your settings</span>}
            </div>
            {!day ? (
              <div className="card subtle">{weather.state === "loading" ? "Scoring runs…" : "Scores need a forecast."}</div>
            ) : (
              <div data-testid="run-list" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {shown.map((x) => (
                  <RunRow
                    key={x.run.id}
                    r={x}
                    zone={zoneById.get(x.run.zone ?? "")}
                    groomedToday={groomed[x.run.id] ?? x.run.groomed}
                    favorite={favorites.includes(x.run.id)}
                    edited={x.run.id in aspect || x.run.id in groomed}
                    distanceM={nearMe && loc && atResort ? distanceToRun(x.run, loc.p) : undefined}
                    treelineFt={r.treelineFt}
                    showZone={!zoneFilter}
                    onOpen={() => setOpenRun(x.run.id)}
                  />
                ))}
                {!shown.length && (
                  <div className="card" style={{ textAlign: "center" }}>
                    <div className="card-title">No runs match</div>
                    <div className="card-sub">Try another zone, or clear some filters.</div>
                  </div>
                )}
                {list.length > shown.length && (
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAll(true)}>
                    Show all {list.length} runs
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {tab === "map" && (
          <>
            {compactTime}
            {day ? <MapView data={resort} day={day} hour={hour} visible={visibleIds} onOpen={setOpenRun} /> : <div className="card subtle">Scores need a forecast.</div>}
            {(zoneFilter || favOnly || q) && (
              <div className="subtle" style={{ fontSize: 14 }}>
                Showing {list.length} runs that match your filters on the Runs tab.
              </div>
            )}
          </>
        )}

        <p className="subtle" style={{ margin: 0, fontSize: 13 }}>
          Estimates from slope aspect, sun, temperature, tree cover and the Open-Meteo forecast. Check {r.name}&apos;s grooming report and open terrain before you go. Run
          data © OpenStreetMap contributors.
        </p>
      </main>

      {open && day && (
        <RunSheet
          resortId={r.id}
          date={date}
          run={open}
          treelineFt={r.treelineFt}
          zone={zoneById.get(open.zone ?? "")}
          day={day.byRun.get(open.id)!}
          hour={hour}
          groomedToday={groomed[open.id] ?? open.groomed}
          groomedOverride={open.id in groomed}
          aspectFix={aspect[open.id]}
          favorite={favorites.includes(open.id)}
          onClose={() => setOpenRun(null)}
          onFavorite={() => setFavorites(store.toggleFavorite(r.id, open.id))}
          onGroomed={(v) => setGroomed(store.setGroomed(r.id, date, open.id, v))}
          onAspect={(deg) => setAspect(store.setAspectFix(r.id, open.id, deg))}
          onShowMap={() => {
            setOpenRun(null);
            setTab("map");
          }}
        />
      )}
      {pickerEl}
      {settings && <SettingsSheet prefs={prefs} resortId={r.id} onPrefs={setPrefs} onClose={() => setSettings(false)} />}
    </>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="chip">
      {label}
      <button type="button" aria-label={`Remove ${label}`} onClick={onRemove}>
        <Icon name="close" size={14} />
      </button>
    </span>
  );
}

/** May through October: North American resorts are closed, so the live forecast isn't about snow. */
function offSeason(date: string): boolean {
  const m = Number(date.slice(5, 7));
  return m >= 5 && m <= 10;
}

function Centered({ title, detail }: { title: string; detail?: string }) {
  return (
    <main className="page" style={{ minHeight: "50dvh", justifyContent: "center", textAlign: "center" }}>
      <h1 className="display" style={{ margin: 0, fontSize: 24 }}>
        {title}
      </h1>
      {detail && <p className="subtle">{detail}</p>}
    </main>
  );
}
