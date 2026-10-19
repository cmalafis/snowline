import { describe, expect, it } from "vitest";
import type { ResortConfig, Run, Zone } from "@snowline/core";
import { compare, matchRuns, parseLocalKnowledge } from "../src/localKnowledge.ts";

const MD = `# Local knowledge

## Steamboat

| Run | Zone / lift | Aspect | Skis best when | Notes |
|---|---|---|---|---|
| Example: Buddy's Run | Storm Peak Express | W | late morning on spring days | gets scraped by afternoon |
| Shadows | Sundown | N | powder days | |
|  |  |  |  |  |

## Breckenridge

| Run | Zone / lift | Aspect | Skis best when | Notes |
|---|---|---|---|---|
| Four O'Clock | Peak 8 | NE | | |
`;

const cfg = { name: "Steamboat", nameAliases: { "Buddys": "Buddy's Run" } } as unknown as ResortConfig;

const run = (name: string, aspectDeg: number, lengthM: number, zone: string): Run =>
  ({ name, aspectDeg, lengthM, zone, pitchDeg: 15, segments: [] }) as unknown as Run;

const runs = [run("Buddy's Run Upper", 300, 500, "storm"), run("Buddy's Run Lower", 280, 500, "storm"), run("Shadows", 250, 800, "sundown")];
const zones = [
  { id: "storm", name: "Storm Peak", lifts: ["Storm Peak Express", "Bar UE"] },
  { id: "sundown", name: "Sundown & Priest Creek", lifts: ["Sundown Express"] },
] as Zone[];

describe("parseLocalKnowledge", () => {
  it("reads only the resort's table, skipping blanks and marking the example", () => {
    const rows = parseLocalKnowledge(MD, "Steamboat");
    expect(rows.map((r) => r.run)).toEqual(["Buddy's Run", "Shadows"]);
    expect(rows[0]!.example).toBe(true);
    expect(rows[0]!.aspect).toBe("W");
    expect(parseLocalKnowledge(MD, "Breckenridge").map((r) => r.run)).toEqual(["Four O'Clock"]);
  });
});

describe("matching and comparing", () => {
  it("matches a run OSM splits into Upper/Lower, and aliases", () => {
    expect(matchRuns("Buddy's Run", runs, cfg).map((r) => r.name)).toEqual(["Buddy's Run Upper", "Buddy's Run Lower"]);
    expect(matchRuns("Buddys", runs, cfg)).toHaveLength(2); // alias -> "Buddy's Run", which OSM splits
    expect(matchRuns("The Shadows", runs, { ...cfg, nameAliases: { "The Shadows": "Shadows" } }).map((r) => r.name)).toEqual(["Shadows"]);
  });

  it("agrees when aspect is within a compass point and the lift is in the zone", () => {
    const [buddy] = parseLocalKnowledge(MD, "Steamboat");
    const c = compare(buddy!, runs, zones, cfg);
    expect(c.computedAspect).toBe(290);
    expect(c.aspectDiff).toBe(20);
    expect(c.zoneAgrees).toBe(true);
    expect(c.disagreements).toEqual([]);
  });

  it("flags aspect and zone disagreements", () => {
    const shadows = parseLocalKnowledge(MD, "Steamboat")[1]!;
    const c = compare(shadows, runs, zones, cfg);
    expect(c.aspectDiff).toBe(110);
    expect(c.zoneAgrees).toBe(true); // "Sundown" is in "Sundown & Priest Creek"
    expect(c.disagreements).toEqual(["aspect off by 110°"]);
    const missing = compare({ ...shadows, run: "Nonexistent" }, runs, zones, cfg);
    expect(missing.disagreements).toContain("not found in OSM runs");
  });
});
