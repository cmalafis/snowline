import { describe, expect, it } from "vitest";
import { parseSnowReport, plainText, reportIsFor } from "../src/resortStatus.ts";

// Shaped like OpenSnow's documented GET /snow-report/:slug response (values made up).
const open = {
  id: 1,
  slug: "steamboat",
  name: "Steamboat",
  snow_report: {
    display_at: "2027-01-15T13:05:00Z",
    display_at_local_label: "Jan 15 at 6:05am",
    status_id: 2,
    status_display: "Open",
    status_display_detail: null,
    status_notes: "Storm Peak on wind hold.",
    status_notes_html: "<p>Storm Peak on <b>wind hold</b>.</p><p>Grooming &amp; lifts update at 8.</p>",
    conditions: "Powder",
    lifts_open: 14,
    lifts_total: 18,
    runs_open: 150,
    runs_total: 169,
    percent_open: 89,
    precip_snow_24h: 9,
    precip_snow_72h: 14,
    base_depth: 52,
  },
  attribution: { link_url: "https://opensnow.com/location/steamboat", link_text: "Steamboat on OpenSnow", description: "Data from OpenSnow.", image_light_url: "https://x/l.png", image_dark_url: "https://x/d.png" },
};

describe("parseSnowReport", () => {
  it("reads status, counts, resort-measured snow and attribution", () => {
    const s = parseSnowReport(open, "2027-01-15T13:10:00Z")!;
    expect(s.state).toBe("open");
    expect(s.liftsOpen).toBe(14);
    expect(s.runsTotal).toBe(169);
    expect(s.percentOpen).toBe(89);
    expect(s.newSnow24In).toBe(9);
    expect(s.conditions).toBe("Powder");
    expect(s.notes).toBe("Storm Peak on wind hold.\nGrooming & lifts update at 8.");
    expect(s.attribution.linkText).toBe("Steamboat on OpenSnow");
  });

  it("recognises closed and opening-soon resorts", () => {
    const closed = parseSnowReport({ snow_report: { ...open.snow_report, status_display: "Closed for the Season", lifts_open: 0 } })!;
    expect(closed.state).toBe("closed");
    const soon = parseSnowReport({ snow_report: { ...open.snow_report, status_display: "Opening Soon", status_display_detail: "Opens Nov 21", lifts_open: 0 } })!;
    expect(soon.state).toBe("opening-soon");
    expect(soon.statusDetail).toBe("Opens Nov 21");
  });

  it("tolerates missing fields and rejects junk", () => {
    expect(parseSnowReport(null)).toBeNull();
    expect(parseSnowReport({ snow_report: null })).toBeNull();
    const sparse = parseSnowReport({ snow_report: { status_display: "Open" } })!;
    expect(sparse.liftsOpen).toBeNull();
    expect(sparse.newSnow24In).toBeNull();
    expect(sparse.attribution.linkUrl).toBeNull();
  });

  it("matches a report to the resort's local date", () => {
    const s = parseSnowReport(open)!;
    expect(reportIsFor(s, "2027-01-15", "America/Denver")).toBe(true);
    expect(reportIsFor(s, "2027-01-14", "America/Denver")).toBe(false);
  });

  it("never passes HTML through", () => {
    expect(plainText('<script>alert(1)</script><a href="x">Open</a>')).toBe("alert(1)Open");
  });
});
