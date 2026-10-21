# Copper Mountain: terrain research

Compiled 2026-10-20 so that Snowline doesn't have to ask the owner about Copper terrain. Each claim lists its source.
The most useful source was Copper's own public trail/lift feed (`api.coppercolorado.com/api/v1/dor/drupal/trails` and `/lifts`, the JSON
the trail-report page loads), read once live and as 8 in-season snapshots on web.archive.org (Dec 2024 – Apr 2026). It gives Copper's own
**sector** for every run, the official difficulty, gladed/park flags and, in season, each run's grooming status. Guides: Exploring the Rockies,
Coloradotopia, Wikipedia, FirstTracks/cyberwest trip reports, SkiMaven. No trail-map image is saved in the repo.

OSM ski area: way **531005986** "Copper Mountain" (`landuse=winter_sports`, wikidata Q2362338).

## 0. Config basics

| Field | Value | Why |
|---|---|---|
| base | 39.4989, -106.1462, **9,712 ft** | Official base 9,712 ft (https://en.wikipedia.org/wiki/Copper_Mountain_(Colorado)). Point is the Super Bee bottom terminal in East Village (DEM 9,707 ft), the lowest lift station |
| summit | 39.4718, -106.1569, **12,313 ft** | **Top of the Storm King T-bar** (DEM 12,313 ft), which matches the official "top elevation 12,313 ft" (Wikipedia). Three Bears (DEM 12,321) and Mountain Chief/Celebrity Ridge (12,308) top out within ~10 ft; press puts the Three Bears top at "about 12,400 ft" near the 12,421 ft Tucker summit (search summary of https://www.summitdaily.com/news/copper-mountains-new-three-bears-chairlift-named-for-powdr-corp-s-founding-family), but the DEM does not support that |
| treelineFt | **11,800** | **No Copper-specific source found.** Derived from NLCD canopy along mapped runs: median canopy is 37–51% in the 11,200–11,800 ft bands, then **0%** from 11,800 ft up (p90 0% above 12,000 ft). Ski.com calls the bowls "above treeline" expert terrain (search snippet, https://ski.com/copper-mountain) |
| ridgeProximityFt | 400 | Same as Breck. Makes zones topping out within 400 ft of 12,313 wind-exposed: all bowls, Tucker, Union Peak, Excelerator and Super Bee/East Village (Super Bee tops at ~12,000 ft, Collage/Andy's Encore start there) |
| hours | 9:00–16:00 | "Base area lifts hours: 9am - 4pm"; Storm King, Resolution, Blackjack, Mountain Chief close 3pm; Three Bears 2:30pm; Timberline, Excelerator, Sierra, Lumberjack, Rendezvous 3:30pm (https://www.coppercolorado.com/the-mountain/trail-lift-info/lift-hours/; same hours per lift in the `/dor/drupal/lifts` feed) |
| opensnow | `copper` | https://opensnow.com/location/copper/forecast (Daily Snow is https://opensnow.com/dailysnow/copper) |

## 1. How Copper divides the mountain

Copper is "naturally divided": "The beginner runs are located entirely to the west and graduate evenly in difficulty as the lifts progress to the east"
(Wikipedia, citing the Forest Service). The official feed's sectors are: **West, Center, East, Beginner Learning, Union Peak, Spaulding & Resolution,
Copper Bowl, Tucker Mountain** (lift sectors from `/dor/drupal/lifts`: Super Bee/Alpine = East; American Eagle/American Flyer/Excelerator = Center;
Woodward/Timberline/Lumberjack/Kokomo = West; Sierra/Rendezvous/Celebrity Ridge = Union Peak; Storm King/Resolution = Spaulding & Resolution;
Mountain Chief/Black Jack = Copper Bowl; Three Bears = Tucker Mountain; Pitchfork/Gem/Easy Rider = Beginner Learning).

### Zones chosen (config `zoneOverrides` / `zoneNames`)

| id | Name | Lifts | Why |
|---|---|---|---|
| west-village | West Village (Woodward, Kokomo, Lumberjack) | Woodward Express, Kokomo Express, Lumberjack | Official West sector minus Timberline: the beginner side (Easy Feelin', Vein Glory, Woodwinds, Lyman Lane, West Ten Mile) |
| timberline | Timberline Express (West upper) | Timberline Express | Official West sector, but a separate blue pod (Windsong, Copperfield, The Moz, Jacque's Pique, Little Burn) topping out at 11,667 ft. "The Timberline Lift is a real treat for intermediate skiers" (https://exploringtherockies.com/copper-mountain-guide/top-5-cruiser-runs) |
| center-village | Center Village (American Eagle & Flyer) | American Eagle, American Flyer, Pitchfork, Gem | Official Center sector (Rhapsody, Main Vein, Bouncer, Bittersweet, Coppertone, High Point, Carefree, Leap Frog, 17 Glade, Sail Away). The two tiny Beginner Learning lifts (Pitchfork, Gem: Green Acres, Bridgeway) are merged here rather than given a 2-run zone |
| excelerator | Excelerator & Enchanted Forest | Excelerator | Official Center sector, upper part: Ptarmigan, Copperopolis, Hallelujah, Mine Dump, Brennan's Grin, CDL's, Cache Glades, plus the Lower Enchanted Forest / Looking Glass / Ute Overlook / Slip Knot trees (official sector Center). Kept apart from Center Village because it is a higher, NW-facing (DEM 321°) wind-exposed pod |
| east-village | East Village (Super Bee & Alpine) | Super Bee, Alpine | Official East sector: Andy's Encore, Oh No, West Encore, Rosi's Run, Far East, Too Much, Triple Treat, Formidable, Freefall/Black Bear glades |
| union-peak | Union Peak & Union Bowl (Sierra, Rendezvous, Celebrity Ridge) | Sierra, Rendezvous, Celebrity Ridge | Official Union Peak sector. Union Bowl is "on Union Peak, on the front side" (https://www.coloradotopia.com/?p=14340); "The terrain off the North side of Union Peak is basically a big open bowl", reached "via a very quick walk from the top of the Celebrity Ridge Poma or Mountain Chief" (https://www.exploringtherockies.com/copper-mountain-guide/top-5-steep-runs/). Union Meadows is "on the extreme west of the front side", past the Celebrity Ridge Poma (https://exploringtherockies.com/copper-mountain-guide/top-5-tree-runs) |
| spaulding-resolution | Spaulding & Resolution Bowls (Storm King, Resolution) | Storm King, Resolution | Official sector. "The Storm King gives skiers and riders access to the Spaulding Bowl as well as the Enchanted Forest"; Spaulding "faces towards the east" (coloradotopia). Hodson's Cut is "the main egress for most of Spaulding Bowl" to Resolution (exploringtherockies cruisers) |
| copper-bowl | Copper Bowl (Mountain Chief, Blackjack) | Mountain Chief, Blackjack | Official sector. "The Mountain Chief is one of two chairlifts that will get you out of the Copper Bowl"; Otto Bahn "is the lone intermediate trail through this bowl" (https://www.coloradotopia.com/ski-resorts/copper/upper-mountain/copper-bowl/). West Ridge (Schaefer's, Lallarookn) is hike-to from here (exploringtherockies steep runs / powder stashes) |
| tucker | Tucker Mountain (Three Bears) | Three Bears | Official sector. Three Bears (2019) replaced the free snowcat + ~30 min hike (Summit Daily / 5280 via search). "The terrain here is generally all black diamonds with lots of cliffs" (coloradotopia Copper Bowl) |

Run zone overrides (all follow the official sector, except Collage):
- **East:** Overlode and Home Run (OSM put them in American Eagle / Pitchfork).
- **West:** Woodwinds, West Village Traverse, Loverly Lane.
- **Center:** American Flyer (the trail), Carefree, Leap Frog.
- **Collage → East Village.** The official sector is Center, but Collage runs "from the top of the Super Bee lift all the way back to the bottom" (exploringtherockies cruisers). Its 12,003 ft top would also have made Center Village wind-exposed.
- **Copper Bowl:** Colorado Boulevard, plus West Ridge Traverse (the Copper Bowl West Ridge hike, not a Union Peak run).
- **Union Peak:** Buzzard's Alley.
- **Spaulding:** Atlantic/Pacific Cornice.
- **Excelerator:** both OSM "Lower Enchanted Forest" ways (`osm:229188259` area, `osm:1047147175` line), Enchanted Forest, Looking Glass, Ute Overlook, Slip Knot.

Ignored lifts: the carpets Easy Rider, Slingshot, Rug Rat, Stinger (OSM; the official list has Slingshot/Glide, Rugrat, Easy Rider, Tubing Hill).

## 2. Run types and grooming (`runOverrides`)

**Grooming evidence.** 8 archived snapshots of the official trail feed were checked (web.archive.org, 2024-12-02 → 2026-04-26), counting groomed (`groomed`, `groomed_am`, `groomed_pm`) over open days per run.
- **Set `groomed: true`** (advanced runs that default to ungroomed):
  - Rosi's Run 6/6.
  - Spaulding Ridge 4/5.
  - Rattler 2/2.
  - Summit Stash 2/2.
  - Rosi's is also "early morning turns on Rosi's corduroy" (exploringtherockies cruisers).
- **Set `groomed: false`** (blue/green runs that default to groomed):
  - Rarely groomed (0–1 of 4–7 open days): I-Dropper 0/7, Liberty 0/6, Foul Play 0/5, Upper Sluice 0/5, Jacque's Pique 0/6, Tempo 0/6, Copperfield 1/7, Log Chute 0/4, Woodwinds 0/6, Union Gap 0/5, Wheeler Creek 1/5, Pine Cone Alley 1/4.
  - Groomed under half the time: The Moz 2/6, Sluice 2/5, Union Park 2/5, Timber Ridge 2/5, Oh No 4/10 (upper + lower).
  - "Jacques's Pique isn't always groomed" (exploringtherockies cruisers).
- **Left groomed (default)** because they were groomed in almost every snapshot: Main Vein 8/8, Rhapsody 8/8, Ptarmigan 8/8, Windsong 7/7, Andy's Encore 10/10, Fair Play 7/7, High Point 7/7, Vein Glory 12/12, Minor Matter 7/7.
- **Conflicts** (left at default):
  - Collage: groomed 4/11 in the archive vs "always groomed" (exploringtherockies), so left groomed.
  - Hallelujah Ridge: 2/5 vs "usually perfectly groomed" (exploringtherockies), so left ungroomed.

**Bumps** (`bump`, ungroomed):
- Highline: "big, tricky, and steep moguls … The trails beneath Resolution Lift are never groomed" (https://exploringtherockies.com/copper-mountain-guide/top-5-mogul-runs).
- Far East, Too Much, Mine Dump: same mogul guide.
- Triple Treat and Hallelujah: "three classic expert mogul runs: Far East, Triple Threat and Too Much"; Hallelujah has "medium-size moguls" (https://cyberwest.com/copper-mountain-ski-resort-2006).
- Revenge and Endeavor: "Serviced by the Sierra lift, we enjoyed the bumps on Revenge and Endeavor" (https://skimaven.com/post/copper-mountain-bowls-spring-bumps-broad-cruisers-solid-snow-coverage-in-colorados-summit-coun, 2013).
- Little Burn was already `bump` (OSM `piste:grooming=mogul`; "weird, non-rhythmic moguls", mogul guide).

**Bowls** (`bowl`, ungroomed): above-treeline open terrain with canopy 0–12% at 11,900–12,300 ft.
- Copper Bowl: Matchless, Six Shooter, Julie's Vision, Golden Crest, Alicante, Bradley's Plunge, Schaefer's, Iron Mask, Lallarookn.
- Spaulding: Bariloche, Boardwalk, Park Place, Marvin Gardens, Calendar/Patrol/Cornice Chutes, So Fine, Atlantic/Pacific Cornice.
- Resolution upper chutes: Drain Pipe, Double Zero, Triple Zero.
- Union Bowl: Union Peak ("a big open bowl"), Buzzard's Alley.
- Tucker's open upper chutes: Western Slope, The Taco / Curecanti, Boulderado, Falcon Alley.
- Upper Enchanted Forest (OSM area) was already a bowl.

**Trees** (`tree`):
- Union Meadows: "relatively mellow trees with a healthy variety of open glades" (tree-runs guide).
- Lower Enchanted Forest (both ways): "the glades of Lower Enchanted Forest, rated a double-black diamond" (cyberwest 2006).
- Tucker's lower lines Denverite, Ram's Run, Buffalo Stampede, The Springs, Valentine's: "the steeps continue right on into the trees" (exploringtherockies steep runs), canopy 24–39%.

**Difficulty** (official feed wins):
- Black Bear Glade, Freefall Glade and Lower Enchanted Forest are `extreme` officially (OSM: advanced), so they are set to expert.
- Marvin Gardens is `most_difficult` officially (OSM: expert), so it is set to advanced.

**Terrain parks.** The official parks are all hosted on regular trails:
- Superpipe on Main Vein.
- Central Park on Loverly.
- Peace Park on American Flyer.
- Koko's and Miner's Progression Parks on Roundabout.
- Pipe Dream on Vein Glory.
- Red's Backyard on Loverly Lane.
- Family Cross on High Point.
- Green Acres Progression Park.

Only two OSM pistes are park-only:
- **Central Park** (`osm` 146991651, named for the park).
- **Family Cross** (the official feed flags it `terrain_parks: true`; it is a family boardercross).

Both are `exclude`d. The host trails (Main Vein, Loverly, Loverly Lane, Roundabout, Vein Glory, American Flyer) are kept, as Lower Twister was at Crested Butte. OSM has no halfpipe piste.

Totals: 83 `runOverrides`:
- 20 zone moves
- 28 bowl, 8 tree, 8 bump
- 61 `groomed:false`, 4 `groomed:true`
- 5 difficulty fixes
- 2 excludes

The pipeline output has 145 named runs: 92 groomer, 29 bowl, 16 tree, 9 bump.

## 3. OSM vs official discrepancies

- **Spelling** (handled with `nameAliases`):
  - Official names that differ from OSM: Marvin Garden (OSM Marvin Gardens), Free Fall Glade (Freefall Glade), Ore Deal (Ore-Deal), Slip Not (Slip Knot), Sail Away Glades (Sail Away Glade), See and Ski (See & Ski), Easy Road (EZ Road), Snodeal (Sno-Deal), Pinecone Alley (Pine Cone Alley), The Taco (The Taco / Curecanti).
  - Guide spellings: Schaeffer's (official Schaefer's) and Triple Threat (official Triple Treat).
  - Former names: Freemont #1 (now Boulderado) and Cross Cut (now Hodson's Cut).
  - Official (U)/(L) splits are aliased to the single OSM run.
- **Missing from OSM:**
  - Upper/Lower Looking Glass is split officially.
  - Guthrie's Chute, Lillie G (L), Lower Boulderado Hike Back, Bucksaw, Kokomo Glade, Kid's Arena, Roundabout (L) are not mapped separately.
  - Jupiter Bowl ("almost always covered in deep alpine bumps", Sierra lift, mogul guide) has no OSM or official-feed run of that name.
  - One unnamed OSM piste (way 888461650, green, near Carefree) is kept as is.
- **Indian Ridge** is in OSM but not in the 2026 official feed. It is present in older snapshots (Center).
- **Lifts:** OSM matches the official 2026 list. "Stinger" is a carpet in OSM only. Wikipedia lists Three Bears as 2019 and Timberline Express as 2024.

## 4. "Skis best when": lore and general patterns

- **Aspect.** Slope aspects are N 55%, E 25%, W 15%, S 5% (Wikipedia). The DEM agrees: front-side zones average N–NE (Excelerator 321° NW), Spaulding/Resolution 58° NE (Spaulding faces E, Resolution chutes SE), Copper Bowl 149° SE, Tucker 37° NE.
- **What softens first in spring.** Copper Bowl's south faces do: "direct south facing Six Shooter was partially softened"; "The intermittent sun had softened direct south facing Six Shooter so we skied that" (https://firsttracksonline.com/boards/threads/copper-mt-co-march-17-2025.15297). The West Ridge runs are "south facing. Thus, the sun can do all kinds of work on it" (steep-runs guide). Meanwhile the north-facing front side stays wintry: "There was zero spring or melt/frozen snow anywhere on the front side from Super Bee to the West Village" and Triple Treat "still had winter snow" in mid/late March (same thread). **No official spring order was found**, so there is no `validation.springOrder` and no `zoneTuning`.
- **Wind holds and wind damage:**
  - "the wind at the top of Three Bears was gusting 80-90mph and it had been shut down" (Mar 18 2025); Storm King was closed the same week. "Wind strips the entries to many runs." Tucker can be "too windpacked into dense chunky sastrugi" (firsttracks 2025 thread).
  - A 2021-22 SkiTalk post (search summary only, page blocked) reported Mountain Chief, Storm King and a Union Peak surface lift closed for wind: https://www.skitalk.com/threads/2021-2022-colorado-ski-resorts-conditions-meetups.24002/post-691502.
  - Upper lifts also close earlier every day (lift-hours page).
- **Where powder lasts:**
  - Wind loads Union Bowl: "The wind tends to deposit snow in Union Bowl, so the coverage is usually excellent". A local told a visitor "Union Bowl consistently has Copper's best snow" (firsttracks 2025).
  - Lower Enchanted Forest is "on the leeward side of big winds which blow over from Union Bowl. The result is usually deep and consistent snow".
  - "Union Meadows holds fresh lines the longest after a big storm". Spaulding Glades "usually stay pretty fresh long after the snow has fallen". Freefall/Black Bear "will both still be fat late in the day" (https://www.exploringtherockies.com/copper-mountain-guide/top-5-powder-stashes/, tree-runs guide).
- **Groomers:** Rosi's Run is best early, "Rosi's gets pretty icy as the day goes on"; Collage's very top "is always packed" (cruisers guide).

## 5. Unmarked tree areas (pipeline output)

There are 39 areas covering 196 ha. Most are small (1–5 ha) strips between front-side groomers in the north-facing Center/East/Timberline pods, typically 17–25°, canopy 42–57%. They look like ordinary between-trail tree skiing, and several sit next to named glades (Freefall/Black Bear, Cache Glades, Sail Away).

Hazard flags:
- 7 boundary
- 7 no run at the bottom
- 7 creek
- 3 tight trees

The ones that should worry us:
- **Trees between Colorado Boulevard and Lillie G** (17 ha, S-facing, 26°, bottom 10,967 ft): flagged for boundary, creek and no run at the bottom. It drops below the Copper Bowl lifts (Blackjack/Three Bears bottoms ~11,160–11,175 ft), so it is a likely trap.
- **Trees between Boulderado and Valentine's** (Tucker, bottom 10,973 ft, boundary, creek, no run at the bottom). It also drops below Three Bears. The official feed does list a "Lower Boulderado Hike Back" run (X), which suggests a hike-out exists, but Boulderado "is often closed thanks to avy danger" (steep-runs guide).
- **Trees between West Ridge Traverse and Union Meadows**: 32° mean pitch at 11,700–12,000 ft by the boundary. This is avalanche-prone steep terrain near the ridge.
- **Large boundary areas.** "Trees between Cabin Chute and Slot Car Track" (22 ha, E) and "Hodson's Cut/Highline" (10 ha, SE) both lie along the boundary next to the Resolution/East side.
- **Union Meadows lines.** "Trees beside Union Meadows" and "between Union Meadows and Soliloquy" are probably part of the real (unmapped) Union Meadows lettered lines. They are flagged with no run at the bottom: the official exit is a cat track with "the waterfall" ice sheet (tree-runs guide).

## 6. Confidence and unknowns

- **High:**
  - Zones (from Copper's own sectors).
  - Hours (official page).
  - Grooming defaults for core groomers and never-groomed Resolution runs (8 official snapshots plus guide).
- **Medium:**
  - Bowl and tree typing (canopy + guide descriptions).
  - Tucker bowl/tree split.
  - Treeline 11,800 (derived from canopy, no published figure).
- **Low / unknown:**
  - The spring softening order. Only one trip report covers it: Copper Bowl south faces first, front side wintry.
  - Per-run aspects for Union Bowl. The guide only says "North side"; the DEM says ~26° NE, so the aspect is left blank.
  - Schaefer's aspect: the guide says S, the DEM 120° SE.
  - Jupiter Bowl's location.
  - Whether the Tucker snowcat still runs at all now that Three Bears exists.
- **Lift fall-line check:** 18/19 lifts are within 30°. Kokomo Express (51°) is a short cross-slope connector (350 ft vertical, official feed).

## 7. Copper website automation (checked 2026-10-20, report only)

- **robots.txt:** https://www.coppercolorado.com/robots.txt has `User-agent: * Allow: /`. The sitemap URL in it is malformed.
- **Bot protection:** none. A plain `curl` with the Snowline UA gets real HTML (Cloudflare CDN, `server: cloudflare`, no challenge page) for `/the-mountain/trail-lift-info/winter-trail-report/`, `/the-mountain/conditions-weather/snow-report/` and the lift-hours page.
- **Data feed:** the trail report is a Gatsby page whose status data is loaded client-side from **`https://api.coppercolorado.com/api/v1/dor/drupal/trails`** and **`/dor/drupal/lifts`**. These are public JSON with no key or cookie, and include `groom_status` (`groomed`/`groomed_am`/`groomed_pm`/`not_groomed`), `status`, `sector`, `difficulty`, and lift `hours`. Other endpoints in the bundle: `/dor/drupal/snow-reports`, `/dor/lift-trail-report`, `/dor/weather-forecast`.
- **Terms:** POWDR's Terms of Use (https://www.powdr.com/terms/, effective 2023-03-08) apply to POWDR resort sites "which link to these Terms". They grant a "personal, non-commercial use" license and say "You agree not to: collect information from the Services using an automated software tool … use automated means to access the Services". Content may not be "redistributed, reused, or modified … without the express written permission of Powdr". Copper's footer links POWDR's privacy policy but no terms link was found, so applicability is arguable. Either way, automated polling and reuse of the feed would need POWDR's written permission. The feed was used here only for one-off manual research.
