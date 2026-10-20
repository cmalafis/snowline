# Crested Butte: terrain research

Compiled 2026-10-19 so that Snowline doesn't have to ask the owner about Crested Butte terrain. Each claim lists its source.
skicb.com (Vail) pages were read where reachable; other facts come from Wikipedia, Crested Butte News, Vail Resorts press releases,
PeakRankings, OpenSnow, FirstTracks and Freeskier. No trail map image is saved in the repo.

OSM ski area: way **530521512** "Crested Butte Mountain Resort" (`landuse=winter_sports`, operator Vail Resorts). Its OSM tag
`opening_hours` reads "Nov We[4]-Apr Su[1]: 09:00-16:00".

## 0. Config basics

| Field | Value | Why |
|---|---|---|
| base | 38.8990, -106.9650, 9,375 ft | Mountaineer Square / bottom of Red Lady Express. Base 9,375 ft (https://en.wikipedia.org/wiki/Crested_Butte_Mountain_Resort). The DEM gives 9,373 ft at the Red Lady bottom station |
| summit | 38.8832, -106.9400, **11,880 ft** | **Top of the High Lift T-bar** (DEM 11,881 ft), the highest lift-served point. The 12,162 ft Peak is a ~15-minute, ~295 ft bootpack from there (https://www.freeskier.com/8-ways-maximize-closing-weekend-crested-butte-mountain-resort). The Peak run still tops at 12,087 ft in the table |
| treelineFt | 11,600 | **No CB-specific source found.** avalanche.org puts treeline "near 12,000 feet in the Southern Rockies" (https://avalanche.org/avalanche-encyclopedia/terrain/slope-characteristics/elevation/near-treeline/). OSM maps the Headwall, Peak and Teo bowl terrain as open areas starting at about 11,500–11,900 ft, so 11,600 sits between the two. Only the High Lift and west-side Extreme Limits zones reach it |
| ridgeProximityFt | 450 | So that Silver Queen (top 11,443 ft) and the North Face T-bar (top 11,417 ft) count as wind-exposed. Silver Queen has closed for "heavy snow and high winds" (https://crestedbuttenews.com/2019/03/cbmr-lift-update-thursday-march-7/), and the North Face suffers wind scouring (https://crestedbuttenews.com/2018/02/extremes-open-with-teo-and-headwall-as-high-lift-spins/) |
| hours | 9:00–16:00 | "9:00 AM to 4:00 PM" daily (https://www.skicb.com/explore-the-resort/about-the-resort/hours-of-operation.aspx); "9-4, weather and lift depending" (https://chairlift.opensnow.com/news/post/trip-report-crested-butte-mountain-resort-january-2019) |

## 1. Lifts

Source for the list: https://en.wikipedia.org/wiki/Crested_Butte_Mountain_Resort
- **High-speed quads:** Silver Queen Express (2,058 ft vertical), Red Lady Express (formerly Keystone Express, renamed 2004), Paradise Express, East River Express.
- **Fixed quads:** Prospect, Westwall. **Triples:** Teocalli (2019), Peachtree (2021), Painter Boy, Gold Link.
- **T-bars:** North Face (2004), High Lift (1991). There are also 3 magic carpets (OSM: Aspen Carpet, Pine Carpet, Spruce Conveyor). These are in `ignoreLifts`.
- **Twister** last ran in 2013-14 and was removed in 2019 (https://crestedbuttenews.com/2019/05/teocalli-lift-to-be-replaced-this-summer-twister-to-be-taken-down/). OSM has no Twister lift. The Twister runs remain.
- **Teocalli** was replaced in summer 2019, with its top moved closer to the top of Red Lady Express (same CB News link;
  https://news.vailresorts.com/2019-05-08-Crested-Buttes-Teocalli-Lift-Replacement-approved-by-U-S-Forest-Service). It is the egress lift
  from the Paradise/East River side back toward the base. Press releases call it a fixed-grip quad, while Wikipedia lists a triple. That conflict doesn't matter here.
- **Access chain** (https://www.peakrankings.com/content/crested-butte):
  - Silver Queen is the only way to the High Lift.
  - Painter Boy links Gold Link and Prospect to the rest of the mountain.
  - West Wall is needed to get back from the Banana area.

## 2. Zones (config `zoneOverrides` / `zoneNames`)

| id | Name | Lifts | Why |
|---|---|---|---|
| red-lady | Red Lady & Base Area | Red Lady Express, Peachtree, West Wall | Base-area beginner and lower-front terrain. "Red Lady is almost all green, Peachtree the bunny hill" (PeakRankings). West Wall serves groomed intermediate terrain above the base (https://www.skicb.com/blog/tips-for-spring-skiing-in-crested-butte.aspx) and is the Banana egress |
| teocalli | Teocalli (lower mountain) | Teocalli | Lower Forest Queen, Lower Ruby Chief, Bushwacker, Gus' Way and Meander feed the Teocalli bottom. It is the egress lift to the base (CB News 2019). Named "lower mountain" so it isn't confused with the Teocalli (Teo) bowls off the High Lift |
| silver-queen | Silver Queen | Silver Queen Express | Front-side upper mountain: Twister, International, Crystal, Jokerville, Monument, Hot Rocks. "Long mogul runs off Silver Queen" (PeakRankings) |
| banana-peel | Banana, Peel & Forest (Extreme Limits) | (via Silver Queen / High Lift; run overrides) | West-facing Extreme Limits: Banana, Peel, Funnel, Flatiron, Forest, Hidden Chutes, Tropicana, Total Recall and others. "Peel, Banana and Funnel drop west from the High Lift for over 2,000 vertical feet" (https://www.firsttracksonline.com/2003/01/02/crested-butte-the-anti-colorado-resort/). Forest, Peel and Flatiron are the "west side" (https://news.vailresorts.com/2019-01-30-Skiers-and-Riders-will-be-Spellbound-from-Crested-Buttes-Next-Terrain-Openings). It opens separately from the groomed front side: "rarely covered before February" (FirstTracks 2003). The pipeline had put these runs in Silver Queen |
| paradise | Paradise Bowl | Paradise Express | Paradise Bowl, Ruby Chief, Forest Queen, Canaan, Keystone, Horseshoe. Rambo is overridden here: it is reached "by cat track near Powder Rock Glade and Hawks Nest" (https://skicb.com/blog/top-5-steepest-trails-at-crested-butte-mountain-resort.aspx), not from Teocalli |
| east-river | East River | East River Express | Treasury, Gallowich, Black Eagle, Resurrection, Bakery Trees, Double Top Glades. East River has "grippy groomers", soft bumps and glades (https://chairlift.opensnow.com/news/post/insider-s-guide-to-skiing-crested-butte-colorado; PeakRankings) |
| north-face | North Face, Spellbound & Phoenix (Extreme Limits) | North Face T-bar | The North Face T-bar serves The North Face, Spellbound and Third Bowl (ski.com, search snippet only: https://www.ski.com/blog/how-to-ski-crested-buttes-extremes/), plus Hard Slab, Hawks Nest, Old Pro and The Glades (OpenSnow guide). High Life and Staircase are "off the North Face Lift" (Vail 2019). Phoenix and Staircase are reached from Spellbound via a traverse (skicb top-5). Phoenix Last Steep and the Sock-It-To-Me cat-track exit are overridden here from East River, whose base they drain to |
| high-lift | Headwall, Teo Bowls & Peak (High Lift) | The High Lift | The High Lift serves Headwall, Teocalli Bowl, Teo 2 and the Peak (ski.com snippet), plus Big Chute and Headwall Glades (OpenSnow). Headwall is entered through the Halfpipe gully (skicb top-5). Teo 2 is about 40 acres beyond Teo Bowl, with a 20–30 min walk or skin out to the bottom of Wolf's Lair (https://crestedbuttenews.com/?p=6387) |
| prospect-gold-link | Prospect & Gold Link | Prospect, Gold Link | North-facing intermediate pods on the north side of the resort. "All runs around Gold Link" are groomed (https://xpatmatt.com/crested-butte-micro-guide/). They share aspect (DEM ~0° N) and access via Painter Boy |
| painter-boy | Painter Boy | Painter Boy | Kept apart because its runs face SW (DEM ~212°), unlike its north-facing neighbours. Spring blog: Painter Boy warms first (skicb spring tips) |

Hike-to terrain: the Peak sits in `high-lift` (bootpack from its top). Third Bowl (hike in and out) and Spellbound (short hike) sit in `north-face` (PeakRankings).
Hall of Fame and Upper Banana Entrance top out above Silver Queen, but they are west-side Extreme Limits, so they are in `banana-peel`.

## 3. Run types and grooming (`runOverrides`)

- **OSM.** 99 of 280 OSM piste ways are tagged `piste:grooming=backcountry`, and none is tagged groomed. Most Extreme Limits terrain is mapped as `area` polygons with `gladed=yes`.
  The classifier makes those `tree` (or `bowl` when they are open areas above treeline), so they are captured, not dropped (106 tree, 24 bowl, 21 bump, 107 groomer).
  OSM rates almost all Extreme Limits terrain `expert` and a few lines `extreme`. Both print as ◆◆. No difficulty overrides were needed.
- **Default grooming.** All 28 west-side Extreme Limits runs are set `groomed: false`, and so are the 2 Phoenix exits (ungroomed by nature). Expert runs already default to ungroomed.

| Run | Set | Source |
|---|---|---|
| Upper/Lower International | groomed true | "groomed regularly with a winch snowcat" (skicb spring tips). FirstTracks 2003 called it a "typical mogul trail". The newer official source wins |
| Twister, Middle Twister | bump, groomed false | "typical mogul trails" (FirstTracks 2003) |
| Rambo | bump, groomed false, zone paradise | "massive moguls" (https://www.denvergazette.com/outtherecolorado/2026/01/18/a-skiers-guide-to-crested-butte-mountain-resort-terrain-dining-lodging-parking-and-more/). Access via Paradise (skicb top-5) |
| The North Face | bowl, groomed false | open, wind-scoured face. "The Glades are more wind-protected than the North Face" (CB News 2018) |

**Groomed defaults were left alone** for green and blue runs: Forest Queen, Treasury, Gallowich, Black Eagle, Gold Link, Prospect and Painter Boy runs.
They are consistent with "Upper and Lower Forest Queen are corduroy" (OpenSnow), "Treasury and Ruby Chief are cruisers" (https://www.freeskier.com/the-skiers-guide-to-crested-butte)
and "all runs around Gold Link" (xpatmatt).

Unresolved:
- **Ruby Chief.** Called "bumpier" (Denver Gazette 2026), but also groomed (xpatmatt) and a cruiser (Freeskier). Left as a default groomed blue.
- **Banana, Funnel, Chiquita, Sunset Ridge, Lower Peel, Flatiron, Big Chute, Figure 11 Chutes.** OSM maps these as backcountry lines, so they type as `bump`. They are really steep open chutes and faces. There was no source to call them bowls, so they were left alone.
- **Ungroomed expert lines.** Many still type as `groomer` with `groomed: false`, which means chopped/packed: Staircase, Sock-It-To-Me Ridge, Phoenix Chutes, Tower 11 Chutes, Pinball, Luge, Headwall Ridge Traverse, Teo 2 Traverse.

## 4. Terrain parks

The current parks are **Ten Peaks Progression Park** (off Painter Boy, Gold Link and Prospect) and **Lower Twister Terrain Park**
(below Uley's Cabin) (https://skicb.com/the-mountain/about-the-mountain/terrain-parks.aspx).
Neither is mapped as its own piste in OSM. Lower Twister is a green trail that hosts the park, so it is kept, like Bashor at Steamboat.
OSM "Halfpipe" is the natural Headwall entrance gully, not a pipe, so it is kept.

## 5. OSM vs official discrepancies

- OSM lift "Gold Link **LIft**" (typo). It is used verbatim in `zoneOverrides`. OSM "West Wall Lift" = Wikipedia "Westwall".
- `nameAliases`:
  - Hawks Nest → Hawk's Nest
  - Bushwhacker → Bushwacker (OSM; CB News also writes Bushwacker)
  - Forest Queen / Forrest Queen → Upper Forest Queen
  - Ruby Chief → Upper Ruby Chief
  - Treasury → Upper Treasury
  - International → Upper International
  - Canaan / Cannon → Upper Canaan (the resort blog spells it "Cannon")
  - Peak → The Peak
  - North Face → The North Face
  - Teo 2 → Teo 2 Traverse
- OSM has no "Teocalli Bowl" or "Hourglass" piste. The Teo bowl terrain is drawn as many named sub-areas (Main Street, Duey's, Coffey Grounds, Morning Glory and others).
- Lift-assignment fixes made with `runOverrides.zone`: 28 runs to `banana-peel`, 2 to `north-face`, and Rambo to `paradise`.

## 6. "Skis best when": lore and general patterns

- **Aspects.** The terrain is 45% north, 45% west and 10% east (Wikipedia). "The front side faces west… most expert terrain faces north and holds packed powder into April. Headwall/Big Chute have north exposure" (FirstTracks 2003).
  The DEM agrees: front/Silver Queen 324°, west-side Extreme Limits 279°, North Face 31°, Paradise 358°, East River 32°.
- **Spring timing** (official, https://www.skicb.com/blog/tips-for-spring-skiing-in-crested-butte.aspx):
  - **Morning:** Red Lady and Painter Boy warm first. Treasury and East River soften early. Third Bowl and parts of Phoenix get early sun.
  - **About 11 am:** Head to East River, Silver Queen, High Lift and North Face.
  - **Midday:** Paradise Bowl, Canaan and Forest Queen.
  - **Afternoon:** The west-facing front side is in sun by 2 pm, with corn on Peel, Flatiron, Funnel and Banana. West Wall is good for afternoon corn.
- **Banana and Funnel** face west and are "least reliable". Wait until about noon for them to soften (FirstTracks 2003). They are good on sunny afternoons (https://www.firsttracksonline.com/boards/threads/crested-butte-co-3-26-27-08.6678).
  Third Bowl's entry side "starts to face east" (same thread).
- **Wind.**
  - Silver Queen closed for "heavy snow and high winds", and High Lift skiers then hiked from the top of Paradise (CB News Mar 2019).
  - Wind damaged Silver Queen's communication line, closing it for about 4.5 days (https://crestedbuttenews.com/?p=25789).
  - Gusts have shut Red Lady for over 3 hours (https://crestedbuttenews.com/?p=274).
  - "Wind has not been our friend in the North Face" (CB News 2018). Upper Paradise is wind-affected (FirstTracks 2008 thread).
  - Prevailing SW–W winds load upper elevations (CBAC forecasts, regional: https://avalog.co/forecasts/16q3u8wvn7).
  - No per-lift mph threshold or "first to close" order was found.
- **Powder.** The North Face is the powder-day destination (OpenSnow guide). The Glades are more wind-protected than the North Face (CB News 2018).
  On powder days the T-bars can be delayed for avalanche mitigation (OpenSnow).
- **Extreme Limits opening.** The T-bars open in early-to-mid January in normal years:
  - 2018-19: High Lift Jan 7, North Face Jan 12 (https://news.vailresorts.com/2019-01-12-Crested-Butte-Mountain-Resort-Opens-the-North-Face-Lift-for-the-2018-19-Winter-Season).
  - 2022-23: both T-bars Jan 5, after 3+ ft (https://crestedbuttenews.com/2023/01/the-t-bars-are-spinning-at-cbmr/).
  - 2024-25: Jan 7, at 115" season-to-date (https://www.denvergazette.com/2025/01/08/2-snow-events-coming-plus-crested-buttes-extreme-terrain-opens-whiteout-snow-report/).
  - In thin years it is much later: 2017-18, the High Lift opened only Feb 21 and the North Face stayed shut because of weak layers and wind (CB News 2018).
  - The Peak and Third Bowl often open only for a few weeks around late Feb–March (PeakRankings).
- **Flat light:** no CB-specific source was found.

## 7. Confidence and unknowns

- **High confidence:** the lift list; the High Lift access to Headwall, Teo and the Peak; the North Face T-bar access to Spellbound, Third Bowl and The North Face; the west-facing Banana/Peel/Funnel; the official spring timing; the 9–4 hours; the Extreme Limits opening history.
- **Medium confidence:**
  - Rambo in Paradise.
  - The non-extreme runs the pipeline put in `north-face` (Schofield Road, Belleview, Avery, Shep's Chute, Rachel's, Fredo's). They sit near the North Face T-bar top but may be official Paradise-side runs.
  - Wind Tower, Monument, Triangle and Hot Rocks left in Silver Queen.
- **Unknown:**
  - Treeline elevation (11,600 ft is an estimate).
  - Per-lift wind thresholds.
  - Grooming frequency for black runs (Keystone, Sylvanite, Championship, Resurrection).
  - Whether Ruby Chief is usually groomed.
  - Whether Teocalli is a triple or a quad.
  - Where "Hourglass" is.
- **DEM check.** 11 of 12 lifts are within 30°. The High Lift is off by 54°: the T-bar climbs SE along the ridge (fall line 333°), while the Headwall/Teo terrain beside it drops NE (27°). That is expected for a ridge-climbing surface lift, not a DEM error.

## Proposed local-knowledge rows

| Run | Zone / lift | Aspect | Skis best when | Notes |
|---|---|---|---|---|
| Banana | Banana, Peel & Forest (Silver Queen / High Lift) | W | sunny afternoons once softened (~noon on); spring corn | "least reliable", rarely covered before Feb (research: FirstTracks 2003; firsttracks 2008 thread; skicb spring tips) |
| Funnel | Banana, Peel & Forest (Silver Queen / High Lift) | W | afternoon corn in spring | drops west 2,000+ ft (research: FirstTracks 2003; skicb spring tips) |
| Peel | Banana, Peel & Forest (Silver Queen / High Lift) | W | afternoon corn in spring | west side Extreme Limits (research: FirstTracks 2003; skicb spring tips) |
| Headwall | The High Lift |  | powder; packed powder holds into April | north exposure per FirstTracks; entered via Halfpipe gully (research: FirstTracks 2003; skicb top-5 steepest) |
| Big Chute | The High Lift |  | powder; holds snow into April | north exposure per FirstTracks 2003 (research: FirstTracks 2003; OpenSnow guide) |
| The North Face | North Face Lift |  | powder days (after avalanche control) | wind-scoured; coverage thin in wind-exposed spots (research: OpenSnow guide; CB News 2018) |
| The Glades | North Face Lift |  | windy or stormy days | more wind-protected than the North Face (research: CB News 2018) |
| Third Bowl | North Face Lift |  | spring mornings (early sun) | hike in and out; often open only late Feb–Mar (research: skicb spring tips; PeakRankings) |
| Upper Treasury | East River Express |  | spring mornings | East River softens early (research: skicb spring tips; Freeskier) |
| Upper Forest Queen | Paradise Express |  | midday on spring days | groomed corduroy (research: skicb spring tips; OpenSnow guide) |
| Paradise Bowl | Paradise Express |  | midday on spring days | upper Paradise wind-affected (research: skicb spring tips; firsttracks 2008 thread) |
| Upper International | Silver Queen Express |  | late morning on spring days | winch-cat groomed regularly (research: skicb spring tips) |
| Rambo | Paradise Express (cat track) |  |  | massive moguls; steepest cut run (research: Denver Gazette 2026; skicb top-5 steepest) |
| Buckley | West Wall Lift |  | afternoon corn | West Wall groomed intermediate terrain (research: skicb spring tips) |

General patterns:
- Spring order (official): Red Lady and Painter Boy, plus East River/Treasury, first. Then Silver Queen, High Lift and North Face from about 11 am. Paradise Bowl, Canaan and Forest Queen at midday. The west-facing front side (Peel, Flatiron, Funnel, Banana, West Wall) from about 2 pm (https://www.skicb.com/blog/tips-for-spring-skiing-in-crested-butte.aspx).
- Expert terrain is mostly north-facing and holds packed powder into April. The front side faces west (https://www.firsttracksonline.com/2003/01/02/crested-butte-the-anti-colorado-resort/).
- Wind: Silver Queen (the only route to the High Lift) and Red Lady have both closed for wind. North Face coverage suffers from wind, and The Glades are the sheltered alternative (CB News 2018/2019).
- The Extreme Limits T-bars usually open in early-to-mid January and need a deep natural base. In thin years they open in late February. The Peak and Third Bowl are open for only a few weeks (Vail 2019; CB News 2018/2023; PeakRankings).
- The T-bars may open late on powder mornings because of avalanche control (OpenSnow guide).
