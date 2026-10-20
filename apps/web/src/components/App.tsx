"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SCENARIOS,
  addDays,
  compassPoint,
  fmtTime,
  hourIn,
  overnightLowAt,
  sampleHourly,
  todayIn,
  yesterdayHighAt,
  type AppResortData,
  type DayWeather,
  type ResortSummary,
  type LonLat,
} from "@snowline/core";
import { distanceToRun, nearby, rankAt, scoreDay, zoneScoreAt, type Ranked } from "@/lib/model";
import { DEFAULT_PREFS, flushFeedback, store, type Prefs } from "@/lib/storage";
import { Dial } from "./Dial";
import { DiffSymbol } from "./DiffSymbol";
import { HourlyPlan } from "./HourlyPlan";
import { RunRow } from "./RunList";
import { ResortPicker } from "./ResortPicker";
import { RunSheet } from "./RunSheet";
import { SettingsSheet } from "./SettingsSheet";
import { WeatherStrip } from "./WeatherStrip";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="panel muted">Loading map…</div> });

type Load<T> = { state: "loading" } | { state: "ok"; value: T; offline: boolean } | { state: "error"; message: string };

async function getJson<T>(url: string): Promise<{ value: T; offline: boolean }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
  return { value: (await res.json()) as T, offline: res.headers.get("X-Snowline-Offline") === "1" };
}

function skyWords(cloud: number): string {
  return cloud < 20 ? "Bluebird" : cloud < 50 ? "Mostly sunny" : cloud < 80 ? "Partly cloudy" : "Overcast";
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
  const [view, setView] = useState<"list" | "map">("list");
  const [settings, setSettings] = useState(false);
  const [showAll, setShowAll] = useState(false);
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
    getJson<AppResortData>(`/api/resorts/${resortId}`)
      .then(({ value, offline }) => {
        setData({ state: "ok", value, offline });
        setFavorites(store.favorites(resortId));
        setAspect(store.aspectFixes(resortId));
        const r = value.resort;
        const now = hourIn(r.tz);
        setHour(Math.min(r.closeHour, Math.max(r.openHour, Math.round(now * 4) / 4)));
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
  const zoneScores = useMemo(() => {
    const m = new Map<string, number | null>();
    if (resort && day) for (const z of resort.zones) m.set(z.id, zoneScoreAt(resort, day, z.id, hour, prefs));
    return m;
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
      }}
      onClose={() => setPicker(null)}
    />
  );
  if (!resort)
    return (
      <>
        <Centered title={picker ? "Snowline" : "Loading…"} detail={picker ? "Where the best snow is, hour by hour." : undefined} />
        {pickerEl}
      </>
    );

  const { resort: r, zones } = resort;
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const sun = day ? day.ctx.steps.reduce((m, s) => (Math.abs(s.hour - hour) < Math.abs(m.hour - hour) ? s : m)).sun : { elevationDeg: 0, azimuthDeg: 180 };
  const sunrise = day?.ctx.steps.find((s) => s.sun.elevationDeg > 0)?.hour;

  let list = ranked;
  if (zoneFilter) list = list.filter((x) => x.run.zone === zoneFilter);
  if (favOnly) list = list.filter((x) => favorites.includes(x.run.id));
  if (nearMe && atResort) list = list.filter((x) => where!.near.has(x.run.id));
  const hidden = resort.runs.length - ranked.length;
  const shown = showAll ? list : list.slice(0, 25);
  const best = ranked[0];
  const visibleIds = new Set(list.map((x) => x.run.id));
  const open = openRun ? resort.runs.find((x) => x.id === openRun) : null;

  // Conditions summary for the selected hour.
  const midFt = (r.base.elevationFt + r.summit.elevationFt) / 2;
  const cond = wx && {
    baseT: Math.round(sampleHourly(wx.base.hourly, hour, (p) => p.temperatureF) ?? 0),
    summitT: wx.summit ? Math.round(sampleHourly(wx.summit.hourly, hour, (p) => p.temperatureF) ?? 0) : null,
    cloud: sampleHourly((wx.summit ?? wx.base).hourly, hour, (p) => p.cloudCover) ?? 0,
    gust: Math.round(sampleHourly((wx.summit ?? wx.base).hourly, hour, (p) => p.gustMph) ?? 0),
    refreeze: yesterdayHighAt(wx, midFt, 3.5) > 34 && overnightLowAt(wx, midFt, 3.5) < 28 && wx.newSnowIn < 3,
  };

  return (
    <main className="mx-auto grid max-w-[1180px] gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="label">Snowline</span>
          <button
            type="button"
            onClick={() => setPicker("switch")}
            disabled={resorts.length < 2}
            className="flex items-center gap-2 text-left"
            aria-label={`${r.name}. Change resort`}
            data-testid="resort-button"
          >
            <h1 className="text-[clamp(30px,7vw,42px)] font-black leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {r.name}
            </h1>
            {resorts.length > 1 && (
              <span className="rounded-full border border-[var(--line)] px-3 py-1 text-[14px] font-bold" aria-hidden>
                Change ▾
              </span>
            )}
          </button>
          <p className="muted mt-1 text-[14px]">{r.region ? `${r.region} · ` : ""}Where the best snow is, hour by hour.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg" role="group" aria-label="Day">
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
          <button type="button" className="btn" onClick={() => setSettings(true)} aria-label="Settings and feedback">
            ⚙︎
          </button>
        </div>
      </header>

      {scenario && (
        <section className="panel grid gap-2" style={{ borderColor: "var(--accent)" }} aria-label="Demo day">
          <p className="text-[14px] font-bold">Demo day — made-up weather on the real {resort.resort.name} runs, not today&apos;s forecast.</p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Demo weather">
            {SCENARIOS.map((x) => (
              <button key={x.id} type="button" className="chip shrink-0" aria-pressed={demo === x.id} onClick={() => setDemo(x.id)}>
                {x.title}
              </button>
            ))}
          </div>
        </section>
      )}
      {!scenario && offSeason(date) && (
        <p className="panel text-[14px]">
          It&apos;s the off-season, so today&apos;s scores aren&apos;t meaningful.{" "}
          <button type="button" className="linkbtn" onClick={() => setDemo(SCENARIOS[0]!.id)}>
            Try a demo day →
          </button>
        </p>
      )}
      {((data.state === "ok" && data.offline) || (weather.state === "ok" && weather.offline)) && (
        <p className="panel text-[14px] font-bold" style={{ borderColor: "var(--warn)" }}>
          Offline — showing the forecast and scores saved when you last had signal.
        </p>
      )}
      {weather.state === "error" && (
        <p className="panel text-[14px] font-bold" style={{ borderColor: "var(--bad)" }}>
          Weather unavailable ({weather.message}). Open the app once with signal to save today&apos;s forecast.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          {/* Time scrubber */}
          <section className="panel grid gap-2" aria-label="Time of day">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="label">{r.name}</span>
                <div className="mono text-[34px] font-semibold leading-none">{fmtTime(hour)}</div>
              </div>
              <div className="mono muted text-right text-[13px] leading-snug">
                {sun.elevationDeg > 0 ? `Sun ${Math.round(sun.elevationDeg)}° up, from the ${compassPoint(sun.azimuthDeg)}` : "Sun is down"}
                {sunrise !== undefined && <div>Sunrise {fmtTime(sunrise)}</div>}
              </div>
            </div>
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
            />
            <div className="mono muted flex justify-between text-[12px]">
              <span>{fmtTime(r.openHour)}</span>
              <span>Noon</span>
              <span>{fmtTime(r.closeHour)}</span>
            </div>
            {cond && (
              <p className="mono text-[13.5px]">
                {skyWords(cond.cloud)} · {cond.baseT}°F base{cond.summitT !== null ? ` / ${cond.summitT}°F top` : ""} · {wx!.newSnowIn}&quot; new
                {wx!.newSnowBaseIn !== undefined && wx!.newSnowBaseIn < wx!.newSnowIn - 0.5 ? ` (${wx!.newSnowBaseIn}" at base)` : ""}
                {wx!.stormTotalIn && wx!.stormTotalIn > wx!.newSnowIn + 0.5 ? ` · ${wx!.stormTotalIn}" in 3 days` : ""} · gusts {cond.gust} mph
                {cond.refreeze ? " · overnight refreeze" : ""}
              </p>
            )}
            {wx && <WeatherStrip resort={r} weather={wx} hour={hour} onHour={setHour} />}
          </section>

          {/* Dial + best pick */}
          <section className="panel grid justify-items-center gap-2" aria-label="Zones by slope direction">
            {day ? (
              <Dial zones={zones} scores={zoneScores} sun={sun} selected={zoneFilter} hereZone={where?.zoneId ?? null} onSelect={setZoneFilter} />
            ) : (
              <p className="muted py-16">{weather.state === "loading" ? "Getting the forecast…" : "No forecast"}</p>
            )}
            <p className="muted text-center text-[13px]">Tap a zone to filter. The yellow arc is the half of the compass facing the sun.</p>
            {best && (
              <button type="button" className="mt-1 grid w-full gap-1 border-t border-[var(--line)] pt-3 text-left" onClick={() => setOpenRun(best.run.id)}>
                <span className="label">Best right now</span>
                <span className="flex flex-wrap items-center gap-2 text-[24px] font-black leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                  <DiffSymbol d={best.run.difficulty} size={22} />
                  {best.run.name}
                  <span className={`tag t-${best.s.label.toLowerCase()}`}>
                    {best.s.label} {best.s.score}
                  </span>
                </span>
                <span className="muted">
                  {zoneById.get(best.run.zone ?? "")?.name}, faces {compassPoint(best.run.aspectDeg)}. {best.s.reasons.join(". ")}.
                </span>
              </button>
            )}
          </section>

          {/* Hourly plan */}
          {day && (
            <section className="panel" aria-label="Hour by hour">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="h2">Your day, hour by hour</h2>
                <span className="muted text-[13px]">best zone each hour</span>
              </div>
              <HourlyPlan
                data={resort}
                day={day}
                prefs={prefs}
                hour={hour}
                onPick={(h, z) => {
                  setHour(h);
                  setZoneFilter(z);
                }}
              />
            </section>
          )}
        </div>

        {/* Runs: list or map */}
        <section className="panel min-w-0" aria-label="Runs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="h2">{zoneFilter ? zoneById.get(zoneFilter)?.name : nearMe && atResort ? "Best near you" : "Ski this now"}</h2>
            <div className="seg" role="group" aria-label="View">
              <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
                List
              </button>
              <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>
                Map
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="chip" aria-pressed={nearMe} onClick={() => setNearMe((v) => !v)}>
              📍 Near me
            </button>
            <button type="button" className="chip" aria-pressed={favOnly} onClick={() => setFavOnly((v) => !v)} disabled={!favorites.length && !favOnly}>
              ★ Favourites
            </button>
            {zoneFilter && (
              <button type="button" className="chip" onClick={() => setZoneFilter(null)}>
                ✕ All zones
              </button>
            )}
          </div>
          {nearMe && (
            <p className="mt-2 text-[14px]">
              {locError ??
                (!loc
                  ? "Finding you…"
                  : where?.here
                    ? `You're on ${where.here.name} (${zoneById.get(where.here.zone ?? "")?.name ?? "—"}).`
                    : atResort
                      ? "You're near the runs below."
                      : `You're not at ${r.name} — showing every run.`)}
            </p>
          )}
          {hidden > 0 && <p className="muted mt-1 text-[13px]">{hidden} runs hidden by your terrain and difficulty settings.</p>}

          {!day ? (
            <p className="muted py-8">{weather.state === "loading" ? "Scoring runs…" : "Scores need a forecast."}</p>
          ) : view === "map" ? (
            <div className="mt-3">
              <MapView data={resort} day={day} hour={hour} visible={visibleIds} onOpen={setOpenRun} />
            </div>
          ) : (
            <div className="mt-2" data-testid="run-list">
              {shown.map((x) => (
                <RunRow
                  key={x.run.id}
                  r={x}
                  zone={zoneById.get(x.run.zone ?? "")}
                  groomedToday={groomed[x.run.id] ?? x.run.groomed}
                  favorite={favorites.includes(x.run.id)}
                  edited={x.run.id in aspect || x.run.id in groomed}
                  distanceM={nearMe && loc && atResort ? distanceToRun(x.run, loc.p) : undefined}
                  onOpen={() => setOpenRun(x.run.id)}
                />
              ))}
              {!shown.length && <p className="muted py-6">No runs match. Try another zone or loosen your settings.</p>}
              {list.length > shown.length && (
                <button type="button" className="btn mt-2 w-full" onClick={() => setShowAll(true)}>
                  Show all {list.length} runs
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      <footer className="muted max-w-[72ch] text-[13px]">
        Estimates from slope aspect, sun, temperature, grooming and the Open-Meteo forecast. Check {r.name}&apos;s grooming report and open terrain before you go. Run data ©
        OpenStreetMap contributors.
      </footer>

      {open && day && (
        <RunSheet
          resortId={r.id}
          date={date}
          run={open}
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
        />
      )}
      {pickerEl}
      {settings && <SettingsSheet prefs={prefs} resortId={r.id} onPrefs={setPrefs} onClose={() => setSettings(false)} />}
    </main>
  );
}

/** May through October: North American resorts are closed, so the live forecast isn't about snow. */
function offSeason(date: string): boolean {
  const m = Number(date.slice(5, 7));
  return m >= 5 && m <= 10;
}

function Centered({ title, detail }: { title: string; detail?: string }) {
  return (
    <main className="grid min-h-[60dvh] place-items-center text-center">
      <div>
        <h1 className="text-[28px] font-black" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </h1>
        {detail && <p className="muted mt-2">{detail}</p>}
      </div>
    </main>
  );
}
