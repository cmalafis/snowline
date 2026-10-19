# Steamboat: terrain research

Compiled 2026-10-19 so that Snowline doesn't have to ask the owner about Steamboat terrain. Each claim lists its source.
Official trail map: the current 2023+ map by Stefan Bast, with Mahogany Ridge, Wild Blue Gondola and Greenhorn Ranch.
A copy is saved at `reference/trailmaps/steamboat.jpg` (4096 px, fetched from the image OnTheSnow embeds:
https://cdn.bfldr.com/WIENNW6Q/as/7t9x3rvpr9tf3w3rtj5n5ht8/Steamboat).
steamboat.com and skimap.org are behind Cloudflare and couldn't be fetched. Official Steamboat blog posts were read from
web.archive.org copies of blog.steamboat.com.

Map context: https://www.steamboatpilot.com/news/steamboat-resort-designs-new-trail-map-for-2023-24-winter-season

## 1. How Steamboat divides the mountain

- The resort names six peaks: Mount Werner, Sunshine Peak, Storm Peak, Thunderhead Peak, Christie Peak and Pioneer Ridge.
  It adds Morningside Park, Mahogany Ridge and Fish Creek Canyon as areas. Sources:
  https://www.onthesnow.com/colorado/steamboat/ski-resort.html and https://en.wikipedia.org/wiki/Steamboat_Ski_Resort
- The official map labels only peaks (Mt. Werner 10,568', Storm Peak 10,372', Sunshine Peak 10,384'), Thunderhead Lodge,
  Four Points Lodge and Rendezvous Lodge, plus a separate **Morningside Park** inset. There are no colour-coded zones (trail map).
- The resort's own blog calls the Sunshine area the "Sunshine pod" and includes One O'Clock, Two O'Clock, Rolex, Flintlock and Quickdraw in it
  (https://blog.steamboat.com/whats-steamboats-approach-to-grooming/, Dec 2023).

### Zones chosen (config `zoneOverrides` / `zoneNames`)

| id | Name | Lifts | Why |
|---|---|---|---|
| christie | Christie Peak | Christie Peak Express, Bashor, Greenhorn Ranch Express | lower mountain below Thunderhead: night skiing, parks, learning area (OnTheSnow; Wikipedia) |
| thunderhead | Thunderhead | Thunderhead Express, Burgess Creek, Elkhead Express | terrain off the top of the gondola/Thunderhead Lodge. Elkhead runs from the Sundown/Elkhead base back up to Thunderhead (map; PeakRankings) |
| storm | Storm Peak | Storm Peak Express, Bar UE, Four Points | Storm Peak face, Four Points Lodge; Bar UE runs Nash Junction → Storm Peak; Four Points runs from near the Burgess Creek bottom to Four Points Lodge (map) |
| werner | Mt. Werner | (no lift; Morningside Lift top + short hike/gates) | Chutes 1–3, No Names, The Gully, Christmas Tree Bowl, North St. Pat's, East Face, The Ridge. You reach them from the top of the Morningside lift with a 5–15 min hike; they drain via First Chance / Last Chance / Big Meadow back to Storm Peak / Pony Express. Sources: coloradotopia; steamboatchamber 2018; dcski forum; map |
| morningside | Morningside Park | Morningside Lift | official map inset "Morningside Park": Biscuits, Gravy, Jump Start, Hot Cakes, Cowboy Coffee, Bail Out, Cheesy Grits, Frying Pan, Huevos, Rooster, Morningside Liftline, Over Easy, Alarm Clock, Wake Up Call, Snooze Bar |
| sunshine | Sunshine Peak | Sunshine Express, South Peak | South Peak runs from the Sunshine Express bottom up to Rendezvous Lodge and serves Spike, Broadway and South Peak Flats (map). Rolex/West Side sit below Rendezvous in the "Sunshine pod" (Steamboat blog) |
| sundown | Sundown | Sundown Express | Closets, Shadows, Twilight, Three O'Clock, Kuus' Cruise, Sundown Liftline (map; ski.com glades guide) |
| pioneer | Pioneer Ridge | Pony Express | "Pioneer Ridge… accessible via the Pony Express lift"; Middle Rib → Outlaw is "off of Pony Express" (Steamboat blog 2022) |
| mahogany | Mahogany Ridge & Fish Creek Canyon | Mahogany Ridge Express | 2023/24 expansion (~650 acres; opened Jan 2024) served by Mahogany Ridge Express. You reach it from the top of Pony Express via Fairway. Fish Creek Canyon double-blacks (Endless Gully, Ultimate Glades, Boulder Field, Milk Run, Two Step) end in a hike out (Steamboat Pilot; Sotheby's blog; Wikipedia) |

**Answers to specific questions**

- **Mt. Werner summit terrain.** It gets its own zone, `werner`. You ride Morningside Lift and hike to North St. Pat's and East Face
  (5–10 min along the summit ridge), and to No Names by continuing to the summit. Christmas Tree Bowl drops off that area, and Chute 3 has a gate
  (https://www.coloradotopia.com/?p=3054; https://www.steamboatchamber.com/blog/post/15-of-the-best-ski-runs-at-steamboat-resort/).
  You can also boot-pack from the top of Storm Peak Express in 10–15 min when Morningside is closed but the top gates are open
  (https://www.steamboatpilot.com/explore-steamboat/insider-tips-to-skiing-riding-steamboat/). The exits are the long, flat First Chance and
  Last Chance (Chamber 2018), or The Ridge to Big Meadow (https://firsttracksonline.com/?p=145). Each lap takes two lift rides (dcski forum 2008).
  First Chance and Last Chance are put in `werner` because they are the egress traverses.
- **Breakfast runs** (Biscuits, Gravy, Jump Start, Hot Cakes, Bail Out, Cowboy Coffee, Cheesy Grits, Frying Pan, plus Huevos, Rooster,
  Over Easy, Alarm Clock, Wake Up Call, Snooze Bar) are all drawn in the official **Morningside Park** inset. Biscuits, Gravy, Jump Start and Hot Cakes
  drop from Sunshine Peak, and Cheesy Grits and Frying Pan from Storm Peak, into Morningside Park, served by Morningside Lift (trail map;
  https://www.dcski.com/articles/555 "Jump Start and Hot Cakes… two small drop-ins to Morningside"). The pipeline had assigned
  Biscuits/Gravy/Jump Start to Sunshine and Cheesy Grits/Frying Pan to Storm Peak, so they are now overridden to `morningside`.
  Over Easy starts at the top of Morningside Lift but "comes out into Buddy's Run" (Steamboat blog 2022), so it ends on the Storm Peak side.
  It is left in `morningside` because that is the lift you ride to reach it.
- **Four Points** (triple, 1992) runs from near the bottom of Burgess Creek up to Four Points Lodge. It serves Nelson's Run, Twister, Hurricane, Pressure Drop,
  Tornado and Four Points Liftline (map; https://www.onthesnow.com/colorado/steamboat/trailmap "Nelson's Run, off the Four Points Lift"). Zone: Storm Peak.
- **Mahogany Ridge vs Pioneer Ridge.** They are distinct. Pioneer Ridge is the 1998-era Pony Express terrain. Mahogany Ridge and Fish Creek Canyon are the
  2023/24 expansion with its own lift (https://www.sothebysrealty.com/steamboatsir/blog/2024/02/02/mahogany-ridge-steamboats-new-steep-and-deep/;
  https://www.peakrankings.com/content/steamboat).
- **Elkhead Express** (HSQ, 2016) runs from the Sundown/Elkhead base up to the Thunderhead area. It is the way back from Sunshine
  and Sundown to beginner routes, and it lines up at day's end (PeakRankings; https://liftblog.com/2016/02/04/steamboat-to-build-high-speed-quad-at-elkhead/).
  **Burgess Creek** (triple, 2004) runs from below Thunderhead up to Thunderhead/Four Points and serves White Out, Norther, BC Liftline, Blizzard, Lightning and Ego.
  **South Peak** (triple, 1984) runs from the Sunshine Express bottom up to Rendezvous Lodge.
  **Bar UE** (double, 1977) runs from Nash Junction up to Storm Peak. Its terrain is quiet in storms (Steamboat Pilot insider tips; map).

## 2. Run types and grooming (`runOverrides`)

Steamboat's official blog lists "these top ten are always groomed": Quickdraw, Rainbow → Moonlight, Buddy's Run, Flintlock, Vagabond,
Heavenly Daze, High Noon, Sunshine Lift Line, Over Easy and Lower Concentration
(https://blog.steamboat.com/steamboats-top-ten-blue-runs/, Feb 2022). All of these got `groomed: true` (both Upper and Lower parts).
Others set to `groomed: true`:
- One O'Clock, Two O'Clock, Rolex, Flintlock, Quickdraw: the Director of Slope Maintenance says these natural-snow runs are groomed daily once
  the base allows (https://blog.steamboat.com/whats-steamboats-approach-to-grooming/). He also mentions Lower High Noon ("upper and lower High Noon").
- Tomahawk: "perfect corduroy" (Chamber 2018).
- Storm Peak South: "the strip they groom when getting off the Storm Peak chair" (TripAdvisor forum,
  https://www.tripadvisor.com/ShowTopic-g33657-i928-k14204724-Steamboat_easiest_black_diamond_runs-Steamboat_Springs_Colorado.html).
- Sitz, See Me, Vogue, Stampede: night-skiing trails under lights, groomed (Steamboat Pilot insider tips).

Type overrides:
| Run | Set | Source |
|---|---|---|
| White Out | bump, groomed false | "Steamboat's best bump run" (OnTheSnow); "will never see a groomer" (TripAdvisor forum) |
| Tornado, Hurricane | bump, groomed false | "awesome bump runs that will never see a groomer" (TripAdvisor forum) |
| Nelson's Run | bump | "big moguls and multiple fall lines" (OnTheSnow trail map page) |
| Vertigo | bump | "Best bump run… expert moguls" (https://westslopegear.com/blogs/guides/ski-steamboat-resort) |
| BC Liftline | bump | "White Out and Burgess Creek Lift Line" are the local mogul favorites (OnTheSnow resort page) |
| Storm Peak North | bump | "Storm Peak North, which had bumps" (TripAdvisor forum). Also "wide and open" (dcski 1582) |
| Shadows | tree (was groomer), groomed false | glades (Wikipedia; OnTheSnow; ski.com) |
| Sideburn | tree, groomed false | "hugs the side of Storm Peak South… open meadows amongst the pines" (Steamboat blog, best snowboard runs 2022) |
| Closets, Twilight, Triangle 3 | groomed false (already tree) | glade runs (ski.com; Chamber 2018) |
| Hot Cakes, Jump Start | tree, groomed false | "Both are advanced areas through the trees" (dcski 555) |
| Christmas Tree Bowl | tree (was bowl), groomed false | "steep, spaced out glades" (coloradotopia); "a larger gladed area" (FirstTracks 2001) |
| North St Pats | tree, groomed false | "hidden in the spruce trees" (Steamboat Pilot) |
| No Names | tree, groomed false | "rock features and tight glades" (Chamber 2018); "fast pillow-like rollers" (coloradotopia) |
| East Face | tree, groomed false | the trail map shows it gladed; double black reached by hike (weakest of these calls) |
| The Ridge | tree, groomed false | "The Ridge and Crowtrack: trees" (dcski 555) |
| Chute 1, 2, 3 | bowl, groomed false | "short but precipitous drops into a lightly-treed saddle" (FirstTracks 2001); cliffs (coloradotopia) |
| The Gully | groomed false | extreme ("EX") terrain at the summit. The type is left as computed |
| Mahogany/Fish Creek glades (Thick of It, Legend's Trees, Endless Gully, Ultimate Glades, Boulder Field, Two Step, Bird's Beak, Nostrils, Granola Bowl) | groomed false | "Terrain will remain uncut/ungroomed" (Sotheby's 2024) |
| All Out | exclude | official map: "All Out (closed to public)", the mogul/freestyle training course |

Conflicts I didn't resolve, so no override was set:
- **Cyclone.** "often groomed" (Chamber 2018) vs "bump run that will never see a groomer" (TripAdvisor). A "challenging mogul field"
  (dcski) and "overgrown push piles" (ski-i).
- **One O'Clock / Two O'Clock.** Called "intermediate bump runs" (Chamber 2018) vs groomed daily once the base allows (Steamboat blog 2023). I set
  `groomed: true` and kept the type as groomer, because the official source wins.
- **Longhorn.** "Sometimes bumpy and sometimes fluffy" (https://www.steamboatchamber.com/blog/post/from-a-local-favorite-runs-at-steamboat-resort/),
  but also listed as a "bluebird groomer day" favorite (Steamboat blog).
- **Buddy's Run.** "Groomed on the right and bumpy on the left" (westslopegear). Set `groomed: true` per the official top-ten list.
- **Rolex, West Side, Valley View.** Groomed only some of the time ("groomed at least a few times a week", TripAdvisor). Rolex is still set true per the 2023 official post.

## 3. OSM vs official map discrepancies

Names (aliases added in `nameAliases`):
- Official **Skidaddle** = OSM "Ski Daddle"
- Official **Highline** = OSM "High Line"
- Official/blog **Westside** = OSM "West Side"
- Blog **Sideburns** = OSM "Sideburn"
- Forum **The Face** = OSM "Storm Peak South" (TripAdvisor: "The Face… calls it Storm Peak South")
- **Burgess Creek Lift Line** = OSM "BC Liftline"
- Cosmetic only, handled by name normalisation: "Alarm CLock" (OSM typo), "Snooze bar", "North St Pats" (official "North St. Pats"),
  "Eagle's Nest" (map "Eagles Nest"), "Fool's Gold" (map "Fools Gold"), "Legend's Trees" (map "Legends Trees"), "Bug's Run" (map "Bugs Run").

On the official map but not in OSM: **Crowtrack** (◆, between The Ridge and Over Easy), **Milk Run** (EX, Fish Creek Canyon), **Kit** (■, Sunshine),
"Two-Thirty trees" (between Twilight and Three O'Clock, Steamboat blog), "Olympic Trees"/"Wally World" trees off Flintlock/High Noon (westslopegear; ski-i),
and the Duster and Chisolm Trail snowshoe routes.

In OSM but not labelled on the official map: **Bird's Beak, Nostrils, Granola Bowl** (◆◆, in the Fish Creek/Mahogany area, probably local or older names),
"Hike Out" is drawn on the map as a dotted hike-out trail with no rating (OSM rates it ◆◆), plus "Ski-in/ski-out access trail", "Elkhead Liftline",
"Mahogany Ridge Lift Line" and "To Pony". All are kept.

Difficulty: the OSM symbols match the official map for every run I checked (about 150), so no `difficulty` overrides were needed.
The official map has an extra **blue/black ("More Difficult – Advanced Intermediate")** symbol. These runs carry it:
- Two O'Clock: OSM ◆
- Sunnyside, Sunset, Eclipse, Surprise, Bear Claw: OSM ■

Both readings are defensible, so they are left as-is.
The official map's **EX ("Extreme Terrain – Experts Only")** runs are East Face, North St. Pats, No Names, The Gully, Christmas Tree Bowl, Chutes 1–3,
Endless Gully, Ultimate Glades, Boulder Field, Milk Run and Two Step. They are all ◆◆ in OSM, which is consistent.

Aspect claim vs DEM: the Chamber (2018) calls Chute 1 "east-facing". The DEM gives 339° N, and a local says "the chutes never get any sun"
(https://firsttracksonline.com/boards/threads/any-tips-for-a-first-trip-to-steamboat.2295). I trust the DEM and left the aspect blank in local-knowledge.

## 4. Terrain parks

These are already excluded: Lil' Rodeo Park, Maverick's Halfpipe and Rabbit Ears Terrain Park. All Out (closed-to-public training course) was added. Bashor is a
park and race lift (Wikipedia), but its named runs (Bashor) are ordinary trails, so they stay.

## 5. "Skis best when" lore and general patterns

- **Wind.** "When winds reach around 35 mph, we typically start slowing down lifts", depending on lift orientation. The gondola is susceptible to
  south wind mid-line and east wind at the top, and the base is sheltered from upper winds
  (https://blog.steamboat.com/navigating-windy-days-at-steamboat-ski-resort-a-qa-with-jake-ingle/, Mar 2024).
  Wind holds hit the upper lifts: Gondola, Four Points, Morningside, Sunshine and Storm Peak (https://www.steamboatpilot.com/news/lifts-on-wind-hold-at-steamboat-resort/,
  Mar 2023), and Morningside, Sundown, Sunshine, South Peak and Storm Peak closed for the day in 50 mph gusts (https://www.steamboatpilot.com/news/50-mph-wind-gusts-knock-out-power-in-steamboat/).
  Sunshine and Storm Peak are the usual first closures (KOAA, Jan 2020, via search). I found no per-lift mph thresholds.
- **Powder preservation.** Glades keep powder for days after a storm (PeakRankings; coloradotopia; OnTheSnow). Conifers hold snow and aspens bake to crust:
  "The snow stays good where the sun doesn't shine" (https://dcski.com/forum/44106). Closets and Shadows can go "firm, sun-baked" in afternoon sun while
  northern exposures stay chalky (FirstTracks 2001). No Names is "mostly out of the sun, so the powder is preserved" (Chamber 2018).
- **Powder-day picks.** Two-Thirty trees, then Closets or Sideburns, North St. Pats, and Middle Rib → Outlaw (Steamboat blog, best snowboard runs).
  Any run off Pony Express, especially Royal Flush (Chamber 2018). Triangle 3 (Chamber). Hot Cakes stays untracked because it takes several lifts to reach (westslopegear).
- **Flat light and wind.** Trees shield you from wind and give contrast in flat light (https://austintravels.com/trips/steamboat-resort/). In fog and wind, the trees and
  Storm Peak still skied well (https://cyberwest.com/steamboat-ski-area-2005). Bar UE is quiet during storms (Steamboat Pilot insider tips).
- **Groomer timing.** Heavenly Daze and Vagabond are best early and become "thoroughfares" by afternoon (firsttracks thread, via search). Heavenly Daze "turns to ice"
  later in the day (TripAdvisor). Areas near the tops of busy lifts aren't well groomed past about 10:30 (Reddit r/steamboat, via search). Tomahawk is best early (Chamber).
  Swinger often has uncut corduroy later in the day (firsttracks, via search). Fewer runs are groomed after even small snowfalls (PeakRankings).
- **Sun.** "Steamboat… largely faces west" (firsttracks forum 2006). Moonlight "follows the sun" (Steamboat blog). Heavenly Daze and Valley View catch late-day sun
  (cyberwest). Sundial is the place to "catch some rays" (Chamber).
- **Spring.** I found no Steamboat-specific source on which aspects soften first. The general rule is E, then S, then W, then N (OpenSnow spring skiing explainer,
  https://opensnow.com/news/post/spring-skiing-explained). One spring 2026 SkiTalk report skied mid-mountain because the top was crunchier and avoided Sunshine (via search only).
- **Morningside** has "much better quality snow" than the lower front side and is uncrowded (firsttracks forum 2006). The Morningside lift is a slow fixed-grip triple (PeakRankings).
- **Mahogany and Fish Creek Canyon** are ungroomed and uncut, with slopes that can exceed 50°. Expect a 30–45 min traverse/hike back to Mahogany Ridge Express (Sotheby's 2024).
  PeakRankings calls the hike back "a hike in name only… lappable".
- **First Tracks.** The Wild Blue Gondola boards 8:00–8:15 for early access to the Sundown, Sunshine and South Peak terrain (official map; Steamboat Pilot).

## 6. Confidence and unknowns

- **High confidence:** zone membership (read directly from the official map), the Morningside inset runs, the Mt. Werner access route, the official "always groomed" list,
  the wind slow-down at about 35 mph, and the official difficulty symbols.
- **Medium confidence:** bump and tree typing that rests on one forum or guide source (Storm Peak North, BC Liftline, East Face, The Ridge). The Middle Rib/Outlaw/Fetcher Glade/
  Royal Flush runs stay in Pioneer Ridge (lift-based assignment, and the blog says "off of Pony Express"), while Legend's Trees, Thick of It and
  Edge of the World are assigned to Mahogany by the pipeline. The map shows they can return to either lift.
- **Unknown:** per-lift wind-hold thresholds; which aspects soften first at Steamboat specifically; what Bird's Beak, Nostrils and Granola Bowl are officially called;
  grooming frequency for most black runs; and whether The Gully is open or treed.
- **Prototype zone aspects are wrong** for Sundown (20°), Pioneer (350°) and Morningside (85°). The lift fall lines (256°, 268°, 157°) agree with the DEM, not the prototype.
