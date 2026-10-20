# Breckenridge: terrain research

Compiled 2026-10-19 so that Snowline doesn't have to ask the owner about Breckenridge terrain. Each claim lists its source.

**Primary source: Breckenridge's own terrain-status feed.** breckenridge.com embeds a `TerrainStatusFeed` JSON object in
its terrain-and-lift-status page. The object groups every trail into official "grooming areas" with difficulty and a daily
`IsGroomed` flag, and lists every lift with its open and close times. I read 10 web.archive.org snapshots taken on days with
60+ trails open: 2023-01-08, 01-12, 01-15, 02-05, 03-31; 2024-01-01, 02-05, 03-01, 04-01; 2026-02-14. Example:
https://web.archive.org/web/20240205154144/https://www.breckenridge.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx
"Groomed n/m" below means groomed on n of the m snapshot days that run was open. No trail map image was saved to the repo.

OSM ski area: `way 531005985` (landuse=winter_sports, name "Breckenridge", wikidata Q12053500), bounds 39.449–39.500 N,
106.115–106.047 W. Config bbox `[39.445, -106.12, 39.505, -106.04]` covers Peaks 6–10, including Kensho, Imperial and the T-Bar.

## 0. Resort constants

| Field | Value | Source |
|---|---|---|
| base | 9,600 ft at the QuickSilver SuperChair base, Peak 9 (39.4754, -106.0479; DEM 9,633 ft) | official "Base Elevation 9,600 ft" (https://www.breckenridge.com/the-mountain/about-the-mountain/mountain-info.aspx); Wikipedia |
| summit | **12,840 ft, top of the Imperial SuperChair** (39.4727, -106.1013; DEM 12,839 ft). This is the highest lift-served point. The Peak 8 summit (12,998 ft) is hike-to only, so it isn't used | official mountain-info ("Imperial SuperChair… 12,840ft"); Wikipedia ("tops out just below the Peak 8 summit at 12,840 ft") |
| treelineFt | **11,600** | No source states a number for Breck. Evidence: the DEM elevation at 600 sampled vertices of OSM forest polygons inside the ski area has p95 11,405, p99 11,613 and max 11,780 ft. A trip report treats "the alpine above 11,500" as treeless (https://www.firsttracksonline.com/boards/threads/breckenridge-4-7-2011.9612/post-60663). PeakRankings calls the E-Chair and Falcon terrain "below-treeline" (tops 11,541 and 11,597 ft), which 11,600 keeps unexposed. The official site says 40% of acreage is above treeline. Medium confidence |
| ridgeProximityFt | 400 (same as Steamboat) | — |
| hours | 8:30–16:00 | In all 10 feed snapshots, every main SuperChair (Colorado, Rocky Mountain, Independence, Freedom, Mercury, Beaver Run, QuickSilver, Falcon, Peak 8 SuperConnect, Five, Snowflake, Rip's Ride) runs 08:30–16:00. Exceptions: Imperial closes 14:45, 6-Chair and T-Bar 15:15, Zendo 15:30, Kensho 15:45, and A/C/E chairs 09:00–15:30/16:00. Official guide: "Imperial opens later and closes earlier than other lifts… Most lifts at Breck close between 3:30 and 4:00 PM" (https://www.breckenridge.com/travel-guide/getting-around-breck.aspx) |
| region / pass | Summit County, Colorado / Epic | Wikipedia; Vail Resorts ownership |

## 1. How Breckenridge divides the mountain

The resort names five peaks, Peak 6 (north) through Peak 10 (south)
(https://en.wikipedia.org/wiki/Breckenridge_Ski_Resort; https://www.breckenridge.com/travel-guide/getting-around-breck.aspx).
The official terrain feed uses 9 grooming areas: **Peak 6, Peak 7, Peak 7 Alpine, Peak 8, Back Bowls (6-Chair), T-Bar, Peak 8 Imperial,
Peak 9, Peak 10**. The feed puts the Peak 9 North Face inside "Peak 9", but the brief asks for it separately, and its terrain is distinct
(north-facing double blacks and trees off E-Chair; theavantski; evo).

### Zones chosen (config `zoneOverrides` / `zoneNames`)

| id | Name | Lifts | Why |
|---|---|---|---|
| peak-6 | Peak 6 | Kensho SuperChair, Zendo Chair | Official "Peak 6" area with both lifts. Kensho runs above treeline and serves the bowls plus the hike-to Serenity, Beyond, Six Senses and South Col. Zendo links from Peak 7 to the Kensho base (Wikipedia; official guide; feed) |
| peak-7 | Peak 7 | Independence SuperChair, Freedom Superchair | Official "Peak 7" area with both lifts. Rolling, groomed blue cruisers. Freedom (2021/22) relieved Independence and opened no new terrain (feed; Wikipedia; https://www.peakrankings.com/content/breckenridge-names-new-peak-7-chairlift-freedom-superchair-begins-construction via search) |
| peak-7-alpine | Peak 7 Alpine | (no lift: traverse/hike from the top of Imperial) | Official "Peak 7 Alpine" area: Peak 7 Bowl, The Dunes, Y-Chute, Magic Carpet, C.J.'s, Debbie's Alley, Vertigo, Art's Bowl. "Skiers and riders are now able to access… Whale's Tail on Peak 8 and upper Peak 7 terrain" from Imperial (Vail Resorts, Feb 2013, https://news.vailresorts.com/2013-02-02-North-Americas-Higest-Chairlift-opens-for-the-Season-at-Breck via search). Same pattern as Steamboat's lift-less `werner` |
| peak-8 | Peak 8 | Colorado, Rocky Mountain, Rip's Ride, FIVE SuperChair, Peak 8 SuperConnect (Upper+Lower), Snowflake, Trygve's Platter | The feed lists exactly these lifts under Peak 8, plus the gondola and carpets. The SuperConnect double blacks (Tiger, Southern Cross, Goodbye Girl) are in the official Peak 8 area |
| back-bowls | Back Bowls (6-Chair) | 6-Chair | Official "Back Bowls" area: Snowbirds, Lobo, Hombre, Way Out, Amen, Solitude, No Name, Quandary, Too Much, Adios, Psychopath, Boneyard, Double Barrel, Upper 4 O'Clock. 6-Chair is the slow lift to the T-Bar/Imperial (PeakRankings) |
| t-bar | T-Bar Bowls | Horseshoe Bowl T-Bar | Official "T-Bar" area: Horseshoe, Cucumber and Contest bowls "spread out beneath the 12,141-foot apex of the T-bar" (https://www.skimag.com/uncategorized/breckenridge-mountain-tour/). Contest Bowl isn't a named trail in the feed or OSM. Joker, King and Queen are T-Bar runs in the feed. |
| imperial | Imperial | Imperial SuperChair | Official "Peak 8 Imperial": Imperial Bowl, Lake Chutes, Whale's Tail, George's Thumb, Zoot, Wacky's, 9 Lives, Easy Street, Snow White, Imperial Ridge |
| peak-9 | Peak 9 | QuickSilver, Beaver Run, Mercury, C-Chair, A-Chair, Camelback & El Dorado platters | Official "Peak 9" lifts (minus E-Chair). Beginner/intermediate (official guide) |
| north-face | Peak 9 North Face (E-Chair) | E-Chair | Devil's Crotch, Windows, Hades, Inferno, Purgatory, Mine Shaft, Tom's Mom/Baby, E-Lift Line, Twin Chutes, The Back 9 (hike), Needle's Eye. Tree skiing off E-Chair (https://www.theavantski.com/breckenridge-expert-itinerary). DEM mean aspect 349° N |
| peak-10 | Peak 10 | Falcon SuperChair | Official "Peak 10". Expert only: "steep runs and tree skiing… Mustang and The Burn" (official guide) |

Zone corrections (`runOverrides.zone`). The lift-based assignment differed from the official area here:
- Xanadu, Wanderlust, Delirium (computed Freedom) and Whiskey River (computed Imperial) → `peak-6` (feed: Peak 6).
- Peak 6 Parkway (computed Zendo) → `peak-7` (feed: Peak 7).
- Art's Bowl, C.J.'s, Debbie's Alley, Magic Carpet, Peak 7 Bowl, The Dunes, Vertigo, Y-Chute → `peak-7-alpine`.
- Joker, King, Queen (computed 6-Chair) and Alpine Alley (computed Imperial) → `t-bar` (feed: T-Bar).
- Double Barrel (computed Imperial) → `back-bowls`. Columbine (computed T-Bar) and Lower Boneyard (computed E-Chair) → `peak-8` (feed: Peak 8).
- Needle's Eye (computed SuperConnect) → `north-face`. The feed lists it under Peak 9 with the North Face runs, and the DEM says 351° N.
- Sundown Access → `peak-9`. Flapjack (computed A-Chair) → `peak-10` (feed: Peak 10).
- Left as computed: Snowflake, Lower Sawmill and Crosscut ride the Snowflake lift (feed lifts: Peak 8) though the feed lists two of the runs under Peak 9. Gondola Ski Back and Lowest 4 O'Clock (Camelback Platter) sit in Peak 9.

## 2. Run types and grooming (`runOverrides`)

**Grooming** comes from the official feed across 10 days:
- `groomed: true` for blacks groomed most days: Centennial 10/10, Crystal 10/10, Doublejack 10/10, Cimarron 7/7, Flapjack 7/9 (Peak 10);
  Duke's Run 10/10, Frosty's Freeway 10/10 (Peak 8); Lower Forget-Me-Not 10/10 (Peak 7); Volunteer 8/10 (Peak 9); Imperial Ridge 6/7; Pika 6/8.
  Supporting quotes: "The best intermediate trails are Doublejack, Centennial and Crystal on Peak 10" (skimag) and "a decent pitched & fun groomer… Cimarron" (firsttracks 4/4/2011).
- `groomed: false` for blues and greens rarely groomed: Pathfinder 0/10, Lower Cashier 0/9, Sundown Access 0/9, Daydream 0/9, Elysian Fields 1/9, Nirvana 1/9,
  Swan City 2/10, Upper Lehman 2/10, Peak 8 Transfer 2/10, Lower Lehman 2/5, Briar Rose 3/10, Euphoria 3/8.
- Every 6-Chair black, every T-Bar double black, all of Imperial except Imperial Ridge, all Kensho double blacks, Peak 7 Alpine, E-Chair and the
  Peak 10 double blacks were groomed 0 times. The pipeline's default (blacks not groomed) already matches, and several are set explicitly.
- Left at default because it's ambiguous (about 50%): Crescendo 4/10, Freeway 4/9, Tunnel 4/10, Shock 5/8, Alpine Alley 5/10, A Lift Line 5/10, Lower Peerless 5/10, Lower Bonanza 5/9.

**Type overrides:**
| Run(s) | Set | Source |
|---|---|---|
| Kensho lines (Behold, Breathless, Chi, Contact, E.S.P, Echo, Epiphany, Felicity, Irie, Rapture, Respite, Sanctuary, Savor, Sublime, Whiff, Yugen, Wonderland + OSM-only Awakening, Foresight, Liberation, Unbound), Serenity Bowl, Beyond Bowl, Six Senses, South Col, Elysian Fields | bowl, ungroomed | Kensho runs above timberline (Wikipedia). "high-alpine skiing above treeline" (OnTheSnow trail map page). OSM tags most as `piste:grooming=backcountry`, so they defaulted to bump |
| Imperial: Imperial Bowl, Lake Chutes, Whale's Tail, George's Thumb, Zoot, Wacky's, 9 Lives, Easy Street, Snow White + OSM-only crazy Ivan 1/2, dwarves, vertical cornice, zero chute | bowl, ungroomed | Imperial runs above treeline (Wikipedia). Cornice-entry chutes (summitpost via search) |
| Peak 7 Alpine (Peak 7 Bowl, The Dunes, Y-Chute, Magic Carpet, C.J.'s, Debbie's Alley, Vertigo, Art's Bowl) | bowl, ungroomed | "whiteout conditions are common high up above the treeline" on Peak 7 (https://www.evo.com/blogs/travel-guides/breckenridge-colorado-ski-resort) |
| T-Bar: Horseshoe Bowl, Cucumber #1/#2, Brill's Thrill, Eagle's Nest, Lulu, Mule, Outlaw, Rustler, Stampede, Joker, King, Queen | bowl, ungroomed | The T-Bar goes above treeline (Wikipedia). Bowls under the T-Bar (skimag). "steep and can be deep on powder days" (evo). Weaker: theavantski says these "are all great areas with trees", so the lower parts are partly treed |
| Boundary Chutes | tree | "a north facing pitch through scattered trees" (firsttracks 4/7/2011) |
| Devils Crotch, Windows | tree | "tree skiing… Devil's Crotch off to the left of E-Chair and Windows off to the right" (theavantski) |
| Ore Bucket | tree | "The trees and glades of Ore Bucket can hold some surprisingly fun powder stashes" (evo) |
| The Burn | tree (already, OSM area) | "This tree-skiing haven…" (official guide) |
| Mach 1 | bump | "one of the steepest mogul runs around… a legendary mogul venue" (Colorado Springs Gazette, https://gazette.com/?p=1243498, via search) |
| Little Johnny, Peerless | bump | Little Johnny: "a fun trail for advanced bump skiers". Peerless: "consistent bumps from top to bottom" (gobreck.com moguls guide, read via search only, page 404s) |
| Peak 10 ungroomed: Blackhawk, Bronc, Corsair, Dark Rider, Elan, Grits, Mustang, Quiver, Spitfire, Trinity | bump | Peak 10 has "tough mogul fields" (https://www.snowmagazine.com/ski-resort-guide/1027-usa/breckenridge-ski-resort). Its below-treeline double blacks are "really just single black mogul runs" (powderhounds, via search, 403). "leg-burning moguls and tight trees" (search). Never groomed (feed). **Medium confidence**: a general statement applied run by run |

Not typed (no run-level source): 6-Chair blacks (Snowbirds, Lobo, Hombre…). Chair 6 is "famous for soft snow and great trees"
(https://news.vailresorts.com/2008-12-03-Breckenridge-Ski-Resort-Announces-Early-Openings-of-Chair-6-and-Back-Bowls-on-Peak-8), but no run is named as a glade.
These and the E-Chair blacks (Hades, Inferno, Purgatory, Mine Shaft, Tom's Mom/Baby, E Lift Line) stay "groomer, not groomed", i.e. packed/chopped.

**Terrain parks excluded:** Freeway Terrain Park & Pipe, Park Lane Terrain Park. "American" is both a black run and a terrain park in the feed, and OSM has two
"American" ways (◆ and ■) with the same name. The ■ way (OSM 128941978) is the park and is excluded with an `osm:<id>` override; the ◆ run is kept.

**Difficulty overrides** (to match the official feed): Springmeier, Columbia, Lower Cashier and Upper 4 O'Clock → intermediate (Blue). Lower Forget-Me-Not → advanced (Black).
18 runs that OSM tags `extreme` but the feed rates DoubleBlack (not "Extreme") → expert: 9 Lives, Easy Street, Wacky's, Zoot, plus 14 Kensho lines.
The official **Extreme** runs (Lake Chutes, Snow White, Serenity Bowl, Six Senses, South Col) are already `extreme` in OSM.

## 3. OSM vs official discrepancies

- Names (`nameAliases`, official → OSM): Snowbirds → Middle Snowbird (OSM splits it into East/Middle/West Snowbird), Deja Vu → Déjà Vu, Sublime → "subline" (OSM typo),
  Cucumber Bowl → cucumber #1 (OSM has #1 and #2), Powerline → "Power line", Four O'Clock → 4 O'Clock, Y-Chute → y chute, Needle's Eye → needles eye, Back 9 → The Back 9.
  Cosmetic only (handled by normalisation): Devils Crotch, Toms Baby, Rounder's, Angels Rest, Eagles nest, Brill's thrill, South col., E Lift Line, lowercase names.
- Official but not in OSM: **Boneyard** (upper), **Psychopath** (upper; OSM has only Lower Psychopath), **Humbug** (T-Bar), **Freeway** (blue run), Toyota Banked Slalom, Eldorado Terrain Park.
- In OSM but not in the feed: CJ's Cabin, union (Peak 10), Wellington (A-Chair), Blue Sky, Horseshoe Bowl as an area, cucumber #1/#2, and the Kensho/Imperial line names
  (awakening, foresight, liberation, unbound, crazy Ivan 1/2, dwarves, vertical cornice, zero chute). All are kept.
- The OSM `goods` duplicate of the T-Bar is ignored by the pipeline (not a zone lift kind). It shows twice in the validate fall-line check.
- Wikipedia lists the T-Bar as 1984 and "Horseshoe Bowl T-Bar". OSM agrees.

## 4. "Skis best when" lore and general patterns

- **Aspect.** "Breck's main exposure being east" (https://www.firsttracksonline.com/boards/threads/breckenridge-4-4-2011.9596/post-60552). Wikipedia: N 20%, S 20%, E 60%, W 0%.
  The DEM agrees: zone means are Peak 6 66°, Peak 7 65°, Peak 8 73°, Peak 9 64°, Peak 10 51°, T-Bar 70°, Imperial 93°, Back Bowls 121°, North Face 349°.
- **Spring.** "East (Breckenridge)… facing slopes will be soft around noon", and the rule of thumb is "on top by 10, down by 2" (Denver Gazette, Apr 2024, https://www.denvergazette.com/?p=392567).
  One April day: "The alpine above 11,500 only had melt/freeze if there was at least some south exposure. East seemed as good as north up there". The group "spent the entire
  morning in winter snow conditions" in Horseshoe Bowl and Whale's Tail. "After lunch the lower mountain had softened", so they moved to Peak 10 (Dark Rider "spring snow of pleasing
  consistency", Mustang "a bit heavier"). By about 3pm the Peak 8 base was "starting to firm up again" (firsttracks 4/7/2011). Peaks 7 and 8 stay open latest in spring (PeakRankings).
- **Wind.** T-Bar, Imperial, Zendo and Kensho were "temporarily on hold due to high winds" while the lower lifts ran (Summit Daily, Feb 24 2020,
  https://www.summitdaily.com/news/extreme-weather-shuts-down-ski-area-buses-and-lifts/). "high-alpine lifts regularly have wind holds" and the wind "can sometimes become intolerable"
  (https://www.peakrankings.com/content/breckenridge). The T-Bar has "a vicious crosswind", and wind "covered up nearly all powder tracks", making powder "a bit slabby" (firsttracks 4/4/2011).
  The same thread also says "the wind is what keeps south facing imperial bowl and east facing horseshoe bowl and peak 7 much more powdery". I found no mph thresholds.
- **Where powder lasts.** "The Peak 7 chutes typically hold powder longer" and E-Chair "holds some less traveled powder stashes" (evo). The Back 9: "the further out you go, the fresher
  the snow" (theavantski). In The Burn the trees are tighter and "the powder lasts a fraction longer" (powderhounds, via search). Hike-to areas have barely tracked snow (PeakRankings).
- **Flat light and storms.** "During this nasty weather is a great time to explore the trees of the 6 Chair or Peak 10". 6-Chair "is awesome on powder days with poor visibility that limit
  upper-mountain access" (evo). The alpine is hard to read in flat light (PeakRankings). Peak 8 expert terrain is "best tackled in good visibility" (OnTheSnow trail map page).
- **Crowds and timing.** Peak 10 is "often one of the least crowded areas" (evo). Imperial and the T-Bar bowls stay closed for much of the early season (PeakRankings). Imperial opens late
  and closes at 14:45 (feed; official guide). Four O'Clock is "popular at the end of the day" (OnTheSnow).

## 5. Confidence and unknowns

- **High confidence:** zone membership (from the official feed's grooming areas), official difficulty, grooming frequency (10 days of official data), lift hours, the base and summit elevations, and the OSM ski-area id.
- **Medium confidence:** treelineFt 11,600 (derived, not stated anywhere), Peak 10 bump typing (general statement), and typing the T-Bar double blacks as bowl even though their lower parts have trees.
- **Unknown:** per-lift wind thresholds; the exact extent of Contest Bowl (named only by skimag); which 6-Chair runs are glades; whether Whale's Tail counts as Peak 8 (feed: Imperial) or Peak 7 (2013 release groups them together); the hike-to status of Peak 6 bowls in a given season.
- **Validate:** 15 local-knowledge rows, 0 disagreements. Imperial Bowl was called "south facing" in a forum, but the DEM says ~132° SE (Δ 48°). As with Steamboat's Chute 1, the aspect is left blank and the conflict noted.
  Lift fall-line check: 24/26 lifts within 30°. The outliers are Zendo (63°, a cross-slope connector from Peak 7 to Peak 6, not a fall-line lift) and the T-Bar's OSM `goods` duplicate (39°). Kensho is 27°, the T-Bar 27° and the SuperConnect Lower 30°.
