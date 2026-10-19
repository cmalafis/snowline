import { describe, expect, it } from "vitest";
import { angleDiff, aspectSpread, bearingDeg, circularMean, compassPoint, compassToDeg, haversineM, pointInPolygon } from "../src/geo.ts";

describe("circularMean", () => {
  it("averages across north", () => {
    expect(circularMean([350, 10])).toBeCloseTo(0, 6);
  });
  it("respects weights", () => {
    expect(circularMean([0, 90], [1, 0])).toBeCloseTo(0, 6);
    expect(circularMean([80, 100], [1, 1])).toBeCloseTo(90, 6);
  });
  it("is NaN when bearings cancel", () => {
    expect(circularMean([0, 180])).toBeNaN();
  });
});

describe("aspectSpread", () => {
  it("measures the smallest containing arc, across north", () => {
    expect(aspectSpread([350, 10, 20])).toBeCloseTo(30, 6);
    expect(aspectSpread([0, 90, 180])).toBeCloseTo(180, 6);
    expect(aspectSpread([42])).toBe(0);
  });
  it("trims light outliers from the edges", () => {
    const angles = [100, 105, 110, 115, 120, 300];
    const weights = [10, 10, 10, 10, 10, 1];
    expect(aspectSpread(angles, weights)).toBeGreaterThan(90);
    expect(aspectSpread(angles, weights, 0.1)).toBeCloseTo(20, 6);
  });
  it("flags a run that wraps from east to west as mixed", () => {
    expect(aspectSpread([90, 120, 150, 180, 210, 240, 270], undefined, 0.1)).toBeGreaterThan(90);
  });
});

describe("compass and angles", () => {
  it("maps degrees to 8 points", () => {
    expect(compassPoint(0)).toBe("N");
    expect(compassPoint(22)).toBe("N");
    expect(compassPoint(23)).toBe("NE");
    expect(compassPoint(-90)).toBe("W");
    expect(compassPoint(337.6)).toBe("N");
    expect(compassToDeg("sw")).toBe(225);
    expect(compassToDeg("up")).toBeNull();
  });
  it("angleDiff takes the short way round", () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(90, 270)).toBe(180);
  });
});

describe("distances", () => {
  it("haversine and bearing", () => {
    // 0.01° of latitude ≈ 1112 m, due north.
    expect(haversineM([-106.8, 40.45], [-106.8, 40.46])).toBeCloseTo(1112, -1);
    expect(bearingDeg([-106.8, 40.45], [-106.8, 40.46])).toBeCloseTo(0, 6);
    expect(bearingDeg([-106.8, 40.45], [-106.79, 40.45])).toBeCloseTo(90, 1);
  });
  it("pointInPolygon", () => {
    const sq: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(pointInPolygon([5, 5], sq)).toBe(true);
    expect(pointInPolygon([15, 5], sq)).toBe(false);
  });
});
