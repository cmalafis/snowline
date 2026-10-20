# Snowline

Where the best snow is, hour by hour, at a given resort. Resorts so far: Steamboat, Breckenridge and Crested Butte. See `SNOWLINE_BUILD.md` for the full brief.

## Layout

```
config/resorts/<id>.json   per-resort config: OSM ski area, base/summit, zones, run overrides, aliases
packages/core              framework-agnostic types, geo math and the scoring model (no I/O)
packages/pipeline          data pipeline: OSM trails, DEM terrain analysis, validation, app export
apps/web                   Next.js PWA: API routes (data, weather, feedback) and the mobile UI
data/<id>/                 pipeline output (runs.json, lifts.json, zones.json, runs.md, app.json)
deploy/openshift           BuildConfig, Deployment, Service, Route, feedback PVC
reference/                 prototype, local knowledge, research notes, trail maps
```

## Local setup

Node 20+.

```sh
npm install
npm test            # unit + scenario tests (geo, terrain, solar vs NREL SPA, scoring)
npm run dev         # the app on http://localhost:3000
npm run build && npm run e2e   # Playwright smoke test against the production build
```

## Data pipeline

```sh
npm run pipeline -- steamboat            # fetch trails (cached), analyze terrain, print the run table
npm run pipeline -- steamboat --refresh  # re-fetch OSM runs and lifts
npm run validate -- steamboat            # compare against reference/local-knowledge.md
npm run scores -- steamboat              # 9am-3pm score table for 10 runs under each test scenario
```

Steps:

1. **Trails**: Overpass API, `piste:type=downhill` ways and `aerialway` ways in the resort bbox, plus the ski-area boundary. Raw response is cached in `data/<id>/osm.json`. Same-named ways are merged into one run.
2. **DEM**: a 10 m USGS 3DEP GeoTIFF for the ski area, in the resort's UTM zone (cached in `data/<id>/dem.tif`, gitignored). If 3DEP is unreachable it falls back to Open-Meteo's ~90 m elevation, and every run is marked `demSource: "open-meteo"`.
3. **Terrain**: each run is cut into ~50 m segments. Per segment: elevation, pitch and aspect from the DEM gradient (Horn's method on a lightly smoothed grid, corrected to true north). Never from the line direction. Area pistes (glades, bowls) are sampled on a grid inside the polygon. Per run: top/bottom elevation, length-weighted pitch, circular-mean aspect. "Mixed aspect" means the segment aspects span more than 90° after trimming the outer 10% of length.
4. **Zones**: each run goes to the lift you'd ride to reach its top and lap it from its bottom. `zoneOverrides` merges lifts into named zones. A zone is wind-exposed when its top is above `treelineFt` or within `ridgeProximityFt` of the summit.

5. **Export**: `data/<id>/app.json`, the slim file the app ships (simplified lines, profiles, mixed-aspect parts).

The validation script also runs an independent DEM sanity check. Lifts climb roughly the fall line, so it compares each lift's top-to-bottom bearing with the DEM aspect of runs near the lift.

## Adding a resort

1. Find the ski area's OSM element (`landuse=winter_sports`) and create `config/resorts/<id>.json` (copy `steamboat.json`).
2. Run `npm run pipeline -- <id>`. Read the zone table, then set `zoneOverrides`, `zoneNames` and `ignoreLifts` (transport gondolas) until the zones match how people talk about the mountain.
3. Research the resort (official map and site, guides) and set `runOverrides` for zones, run types (`groomer|bump|tree|bowl`), `groomed` defaults, difficulty fixes and terrain-park exclusions. When two runs share a name, target one with `"osm:<way id>"` as the key. Write the sources up in `reference/research/<id>.md`.
4. Add notes to `reference/local-knowledge.md` and run `npm run validate -- <id>`. If the resort publishes a spring softening order, add it as `validation.springOrder`; validate replays the spring scenario against it. When local knowledge says a zone softens earlier than sun and temperature explain (e.g. a warm base area), set `zoneTuning.<zone>.springHeadStartHours` with its source.
5. Set `region` and `pass` for the resort picker, then redeploy. The app lists every resort in `data/` that has an `app.json`.

No code changes should be needed. If one is, it's a bug in the pipeline.

## Unmarked tree areas

`packages/pipeline/src/treeAreas.ts` scans each ski-area boundary on a 30 m grid for forest that looks skiable but isn't a mapped run:
- canopy of 25–70% (open enough to ski)
- slope of 15–40°
- at least 40 m from mapped runs and 30 m from lifts

Matching cells are grouped into areas of at least 1 ha with 150 ft of vertical, named after the runs they sit between, and checked for hazards:
- pockets over 45° (possible cliffs)
- a year-round creek running through
- no mapped run at the bottom
- close to the ski-area boundary
- tight trees

Output goes to `data/<id>/treeAreas.json` and into `app.json`. Thresholds live in `DEFAULT_TREE_AREAS`.

In the app the layer is **off by default**. Turning it on shows the cautions, and the user must accept them first. The cautions cover:
- closures
- patrol
- tree wells
- what 30 m data can't see
- avalanches, linking the resort's `avalanche` center from config
- finding the way out

Areas then appear in their own section on the Runs tab and on the map. Each area's details open with a caution banner and the hazards found for that area.

## Scoring model

`packages/core/src/scoring/`, pure TypeScript with every threshold in `config.ts`:

- **Sun**: NOAA solar position (`solar.ts`), tested against NREL SPA reference values at Steamboat.
- **Energy**: radiation absorbed by each slope (`cos i` from aspect and pitch, times direct-normal plus diffuse irradiance from the forecast, or clear sky scaled by cloud), integrated every 15 minutes since dawn and gated by temperature at the run's elevation.
- **Surface**: frozen → softening → prime → heavy → slush after a refreeze. A slope only counts as refrozen if it gets enough sun in a day to have melted.
- **Run types**: groomers (corduroy wears with traffic), ungroomed groomers, bumps, trees and bowls. Powder decays with tracking. Flat light, wind holds and cold-day sun are also modelled.
- **Output**: 0–100, a label (Prime/Good/Fair/Skip) and the top two reasons.

The app runs the model in the browser, so scrubbing time is instant and it works offline. **Demo** days replay the four test scenarios on real runs, which is useful off-season.

## Deploy to OpenShift

The app runs as one container: the Next.js standalone server plus each resort's `app.json`. The image builds in the cluster, so your laptop's architecture doesn't matter.

```sh
oc login ...                                # or use an existing session
scripts/deploy-openshift.sh cmalafis-dev    # apply manifests, upload source, build, roll out, print the URL
```

- Testers' feedback ("how did it ski?" ratings, comments, aspect/grooming corrections) is appended to `/feedback/feedback.jsonl` on a 1 Gi PVC, and also logged to stdout. Read it with `oc exec deploy/snowline -- cat /feedback/feedback.jsonl`.
- Resort daily reports (open/closed, lifts and runs open, conditions, resort-measured new snow) come from OpenSnow's partner API, which needs a key from OpenSnow. Add it once and restart: `oc create secret generic snowline-opensnow --from-literal=api-key=<key>` then `oc rollout restart deploy/snowline`. Without it the app falls back to the forecast and the off-season guess.
- The resorts' own websites block automated access, so per-run grooming isn't fetched. Runs start from their usual grooming pattern (`groomed` in config, from research).
- Skiers' "groomed today" reports are shared with everyone for that day (`/api/resorts/<id>/reports`). Each device's latest report counts once; the majority wins and a tie goes to the most recent. A device's own report always wins on that device. Reports are kept for three days in `/feedback/reports.jsonl`.
- The Developer Sandbox scales idle deployments to zero. Bring it back with `oc scale deploy/snowline --replicas=1`, or rerun the script.
- The same image runs anywhere that runs containers (e.g. AWS App Runner/ECS). Build step 6 covers AWS with CDK.
