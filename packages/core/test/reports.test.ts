import { describe, expect, it } from "vitest";
import { summarizeReports, type GroomReport } from "../src/reports.ts";

const r = (device: string, runId: string, groomed: boolean | null, at: string): GroomReport => ({ device, runId, groomed, at: `2027-01-15T${at}:00Z` });

describe("summarizeReports", () => {
  it("counts each device once, using its latest report", () => {
    const s = summarizeReports([r("a", "run1", false, "13:00"), r("a", "run1", true, "13:30"), r("b", "run1", true, "14:00")]);
    expect(s.run1).toEqual({ groomed: true, confirmed: true, yes: 2, no: 0, lastAt: "2027-01-15T14:00:00Z" });
  });

  it("goes with the majority", () => {
    const s = summarizeReports([r("a", "run1", true, "13:00"), r("b", "run1", false, "13:10"), r("c", "run1", false, "13:20")]);
    expect(s.run1!.groomed).toBe(false);
    expect([s.run1!.yes, s.run1!.no]).toEqual([1, 2]);
  });

  it("breaks a tie with the most recent report", () => {
    expect(summarizeReports([r("a", "run1", true, "13:00"), r("b", "run1", false, "13:10")]).run1!.groomed).toBe(false);
    expect(summarizeReports([r("a", "run1", false, "13:00"), r("b", "run1", true, "13:10")]).run1!.groomed).toBe(true);
  });

  it("lets a device withdraw its report", () => {
    const s = summarizeReports([r("a", "run1", true, "13:00"), r("a", "run1", null, "13:05")]);
    expect(s.run1).toBeUndefined();
  });

  it("needs two matching reports to confirm", () => {
    expect(summarizeReports([r("a", "run1", false, "13:00")]).run1).toMatchObject({ groomed: false, confirmed: false, no: 1 });
    expect(summarizeReports([r("a", "run1", false, "13:00"), r("b", "run1", false, "13:10")]).run1).toMatchObject({ groomed: false, confirmed: true });
    // One each way: the latest wins the tie, but nothing is confirmed.
    expect(summarizeReports([r("a", "run1", true, "13:00"), r("b", "run1", false, "13:10")]).run1).toMatchObject({ groomed: false, confirmed: false });
    // The same device twice doesn't confirm.
    expect(summarizeReports([r("a", "run1", false, "13:00"), r("a", "run1", false, "13:30")]).run1!.confirmed).toBe(false);
  });

  it("keeps runs separate", () => {
    const s = summarizeReports([r("a", "run1", true, "13:00"), r("a", "run2", false, "13:00")]);
    expect(s.run1!.groomed).toBe(true);
    expect(s.run2!.groomed).toBe(false);
  });
});
