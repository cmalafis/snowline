import { describe, expect, it } from "vitest";
import { sunPosition } from "../src/scoring/solar.ts";
import { localToUTC } from "../src/scoring/time.ts";
import { angleDiff } from "../src/geo.ts";

// Steamboat base area.
const LAT = 40.4572;
const LON = -106.8045;
const TZ = "America/Denver";

// Reference values from NREL's Solar Position Algorithm (pvlib spa.py, ±0.0003°), which NOAA's Solar Calculator
// (gml.noaa.gov/grad/solcalc) matches to within ~0.01°. Apparent elevation includes standard refraction.
const CASES = [
  { date: "2026-03-20", hour: 9, elevation: 19.782, azimuth: 107.811 },
  { date: "2026-03-20", hour: 12.5, elevation: 48.365, azimuth: 163.093 },
  { date: "2026-12-21", hour: 10, elevation: 19.807, azimuth: 149.525 },
  { date: "2026-06-21", hour: 15.5, elevation: 55.946, azimuth: 250.851 },
  { date: "2027-02-15", hour: 8.5, elevation: 14.759, azimuth: 121.351 },
  { date: "2026-04-10", hour: 16, elevation: 40.13, azimuth: 241.767 },
];

describe("sunPosition (NOAA) at Steamboat", () => {
  for (const c of CASES) {
    it(`${c.date} ${c.hour}h local`, () => {
      const s = sunPosition(localToUTC(c.date, c.hour, TZ), LAT, LON);
      expect(Math.abs(s.elevationDeg - c.elevation)).toBeLessThan(0.05);
      expect(angleDiff(s.azimuthDeg, c.azimuth)).toBeLessThan(0.05);
    });
  }

  it("is below the horizon at night and highest near solar noon", () => {
    expect(sunPosition(localToUTC("2026-01-15", 2, TZ), LAT, LON).elevationDeg).toBeLessThan(-30);
    const noon = sunPosition(localToUTC("2026-06-21", 13.2, TZ), LAT, LON);
    expect(noon.elevationDeg).toBeGreaterThan(72);
    expect(angleDiff(noon.azimuthDeg, 180)).toBeLessThan(5);
  });
});

describe("localToUTC", () => {
  it("handles standard and daylight time", () => {
    expect(new Date(localToUTC("2026-01-10", 9, TZ)).toISOString()).toBe("2026-01-10T16:00:00.000Z");
    expect(new Date(localToUTC("2026-07-10", 9.25, TZ)).toISOString()).toBe("2026-07-10T15:15:00.000Z");
  });
});
