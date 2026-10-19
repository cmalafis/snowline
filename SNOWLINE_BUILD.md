# Snowline — build brief

Build **Snowline**: a mobile-first app that tells skiers where the best snow is, hour by hour, at a given resort. Launch resorts: **Steamboat** and **Breckenridge**. Adding a resort must be configuration plus running the data pipeline, never new code.

## The core idea

Snow quality on a run depends on:
- the sun energy the slope has absorbed today (sun position vs. the slope's aspect and pitch)
- air temperature at the run's elevation
- whether the surface refroze overnight
- new snow
- grooming
- traffic
- wind
- light (flat light vs. sun)

Outputs:
1. A ranked **"Ski this now"** list for the selected time.
2. An **hourly plan** (9am–3pm): the best zone each hour, with the best run in it and why.
3. A **compass dial** showing zones by slope direction, colored by score, with the sun's current direction.
4. A **map view** coloring runs by current score.

## Reference material in this repo

- `reference/prototype.html` — a working single-file prototype. Port its solar position (`sunPos`), slope incidence (`incidence`) and scoring logic (`scoreRun`) into the TypeScript scoring module, then improve them per this spec. Use its layout (dial, hourly plan, ranked list) as UI direction. **Ignore its hard-coded run list and aspects**: those are placeholders to be replaced by the data pipeline.
- `reference/trailmaps/` — official resort trail maps (PDF/images). Use them to check run names, difficulty, lifts and zone groupings. Don't trace geometry from them.
- `reference/local-knowledge.md` — the owner's ground truth on how specific runs face and when they ski best. Treat it as the validation set for the aspect pipeline and the scoring model.
- `reference/grooming/` — saved examples of each resort's grooming and lift-status data (HTML, JSON or HAR captured from the browser). Use them to write the parsers.

## Product requirements

- **Installable PWA first, iOS home-screen ready**: web app manifest, icons, splash screens, full-screen display.
- **Offline**: a service worker caches today's forecast, computed scores and trail data when the app opens, so it works with no signal on the lift.
- **Geolocation**: highlight the zone the user is standing in and show "best nearby".
- **Optional web push**: a powder alert (e.g. 6am when 6"+ fell overnight) and a "your favorite run is in its prime window" alert.
- **No accounts in v1.** Store user favorites and corrections anonymously per device, with an optional sync later.
- **Glove-friendly, sun-readable design**: big tap targets, high contrast, light and dark modes. Standard trail difficulty symbols.
- Keep the scoring and data layers framework-agnostic so the app can later be wrapped with **Capacitor** for the App Store without a rewrite.

## Stack

- Next.js (App Router) + TypeScript, Tailwind.
- Postgres with PostGIS for resorts, runs, segments, forecasts and user corrections. Drizzle or Prisma for the schema and migrations.
- MapLibre GL with OpenSkiMap / OpenStreetMap-based tiles for the map.
- **AWS**, infrastructure in CDK (TypeScript):
  - Amplify Hosting for the app
  - EventBridge schedule + Lambda for data refresh jobs
  - RDS Postgres (or Neon if simpler; make it a config choice)
  - Secrets Manager for any keys
- Vitest for unit tests, Playwright for one end-to-end smoke test.

## Data pipeline (scheduled jobs, never per request)

### 1. Trail geometry (on demand per resort, plus a weekly refresh)
- Source: OpenSkiMap runs data (`https://tiles.openskimap.org/geojson/runs.geojson`, filtered to the resort's ski area) or the Overpass API (`way["piste:type"="downhill"]` within the resort boundary).
- Keep: OSM id, name, `piste:difficulty`, `piste:grooming`, LineString geometry, and the ski area relation.
- Also pull lifts (`aerialway=*`) for zone grouping and wind exposure.

### 2. Terrain analysis
- Sample each run's line against a DEM (USGS 3DEP 10 m preferred; Open-Meteo Elevation API as a fallback).
- Split runs into ~50 m segments. For each segment, compute elevation, pitch, and **aspect from the DEM gradient** (the direction the slope faces downhill), not from the line's direction.
- Per run, store top/bottom elevation, length-weighted mean pitch, and length-weighted mean aspect (circular mean). Flag runs whose segments span more than ~90° of aspect as "mixed aspect", and score those per segment.
- Group runs into zones by the lift that serves them, with a name override in resort config.
- Flag wind-exposed zones: above treeline, or the top of the zone is near the summit ridge.
- Phase 2: horizon shading from the DEM, for slopes in the shadow of a ridge in the morning or afternoon.

### 3. Weather (hourly)
- Open-Meteo hourly forecast at both base and summit coordinates: temperature, cloud cover, shortwave radiation, wind speed and gusts, snowfall.
- Also store yesterday's observed max temperature and overnight low.
- Interpolate temperature by elevation between the base and summit points; fall back to a lapse rate of ~3.5°F per 1,000 ft.

### 4. Grooming and lift status (each morning, ~5:30am Mountain)
- Parse each resort's published grooming and lift reports, using the saved samples in `reference/grooming/`.
- Fall back to the OSM `piste:grooming` tags, plus user toggles.
- Respect each resort's terms of use and robots.txt. If scraping isn't allowed, ship without it and lean on user toggles.

## Scoring model

A pure TypeScript module with no I/O, fully unit-tested, with every threshold in a config object.

- **Sun position**: the NOAA solar position algorithm in the resort's time zone (America/Denver).
- **Incidence on the slope**: `cos i = cos(s)·sin(e) + sin(s)·cos(e)·cos(az_sun − aspect)`, clamped at zero. Scale by the forecast shortwave radiation and cloud cover.
- **Softening energy**: integrate absorbed energy since sunrise in 15-minute steps, weighted by temperature at the run's elevation. The sun barely softens snow below ~20°F; air above 32°F softens snow even in the shade.
- **Refreeze**: true when yesterday's high at the run's elevation was above ~34°F and the overnight low was below ~28°F, unless there's 3"+ of new snow.
- **Surface states**: frozen/firm → softening → prime (corn / soft) → heavy → slush, driven by the softening energy and the current temperature.
- **Run types**:
  - *Groomed*: fresh corduroy decays with traffic and hours since opening. Firm when refrozen, best once softened, worse when slushy.
  - *Groomed run that wasn't groomed today*: treat as chopped and packed.
  - *Bumps*: terrible when refrozen, great once softened.
  - *Trees*: hold snow longest, best in flat light.
  - *Bowls*: wind-exposed, worst in flat light.
- **Powder (4"+ new)**: a big bonus that decays with tracking, more slowly in trees and on low-traffic runs. Penalize sun-baked snow on south and west aspects when it's warm. Give a bonus to shaded north-facing slopes.
- **Flat light**: penalize bowls and bumps above treeline, favor trees.
- **Wind**: penalize exposed zones and warn of lift holds when gusts exceed ~35 mph.
- **Cold days**: a small bonus for sunny slopes when it's below ~10°F.
- **Output per run and time**: a 0–100 score, a label (Prime / Good / Fair / Skip), and the top two human-readable reasons, e.g. "East-facing, in the sun since 8:40, groomer softening nicely".
- **User preferences**: terrain types (groomers, bumps, trees, bowls) and the hardest difficulty they'll ski.

## UI

- Resort switcher; a time scrubber from opening to closing.
- Compass dial: zones placed by aspect, colored by score, with the sun's direction and the half of the dial currently facing the sun highlighted. Tap a zone to filter.
- Hourly plan with a small heat strip per zone across the day.
- Ranked run list: difficulty symbol, zone, aspect, groomed status, temperature at elevation, score bar, and the reasons.
- Run detail: elevation profile, aspect, a score-over-the-day chart, and the reasons. Users can mark it groomed or not today, correct its aspect, and favorite it.
- **Community corrections**: store each user correction. Apply an aspect correction for everyone once 3 independent reports agree. Apply grooming toggles for that day only.
- **"How did it ski?" feedback**: after a run, the user rates it 1–5. Store the rating with the predicted score so the model can be calibrated later.

## Build order and checkpoints

Stop at each checkpoint and show me the output before continuing.

1. **Data pipeline for Steamboat.** Pull runs and lifts, run the DEM analysis, and print a table of every run: name, difficulty, zone, top/bottom elevation, pitch, aspect (degrees and compass point), and the mixed-aspect flag.
   **Checkpoint:** compare it against `reference/local-knowledge.md` and list every disagreement.
2. **Scoring module + tests.** Port it from the prototype, then extend it per this spec. Test sun position against NOAA's solar calculator for at least 3 dates and times at Steamboat. Add scenario tests: a bluebird spring day after a refreeze (east faces prime mid-morning, south faces around midday, west faces in the afternoon); a cold powder day; overcast flat light; and strong wind.
   **Checkpoint:** print a 9am–3pm score table for 10 runs under each scenario.
3. **Weather and grooming jobs**, plus the database schema and migrations.
4. **App UI as a PWA**, with offline caching and geolocation.
5. **Breckenridge**, through config plus the pipeline only. If it needs code changes, refactor until it doesn't.
6. **AWS deployment with CDK**: Amplify, EventBridge + Lambda, Postgres, Secrets Manager.
   **Checkpoint:** a deploy runbook in the README and a cost estimate.
7. **Push notifications** and the "how did it ski?" feedback loop.

## Scaffold but don't build yet

- Crowd and lift-line estimates (holidays, pass blackout dates, powder days, weather).
- On-mountain food and après ratings.
- Capacitor wrap for the iOS App Store: native geolocation, a home-screen widget.

## Deliverables

- A repo with a README covering local setup, the data pipeline, adding a resort, and deploying.
- Seed and pipeline scripts for both resorts.
- Unit tests for the solar, incidence and scoring modules, and the scenario tests above.
- A validation script that prints computed aspect and pitch for runs listed in `reference/local-knowledge.md`, side by side with the owner's notes.
