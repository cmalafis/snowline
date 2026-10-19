import type { LonLat } from "./types.ts";

export const DEG = Math.PI / 180;
export const M_PER_FT = 0.3048;
const EARTH_R = 6371008.8;

export const ftToM = (ft: number) => ft * M_PER_FT;
export const mToFt = (m: number) => m / M_PER_FT;

export const normDeg = (a: number) => ((a % 360) + 360) % 360;

/** Smallest absolute difference between two bearings, 0..180. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(normDeg(a) - normDeg(b));
  return d > 180 ? 360 - d : d;
}

export function haversineM([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  const dLat = (lat2 - lat1) * DEG;
  const dLon = (lon2 - lon1) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

export function bearingDeg([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  const y = Math.sin((lon2 - lon1) * DEG) * Math.cos(lat2 * DEG);
  const x = Math.cos(lat1 * DEG) * Math.sin(lat2 * DEG) - Math.sin(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.cos((lon2 - lon1) * DEG);
  return normDeg(Math.atan2(y, x) / DEG);
}

/** Weighted circular mean of bearings. Returns NaN when the weights are zero or the bearings cancel out. */
export function circularMean(angles: number[], weights?: number[]): number {
  let s = 0;
  let c = 0;
  angles.forEach((a, i) => {
    const w = weights?.[i] ?? 1;
    s += w * Math.sin(a * DEG);
    c += w * Math.cos(a * DEG);
  });
  if (Math.hypot(s, c) < 1e-9) return NaN;
  return normDeg(Math.atan2(s, c) / DEG);
}

/**
 * Width of the smallest arc that contains every bearing: 360 minus the largest gap between neighbours.
 * Pass `trim` (0..0.5) to drop that share of total weight from the arc's edges first, so a few noisy segments don't flag a run as mixed.
 */
export function aspectSpread(angles: number[], weights?: number[], trim = 0): number {
  if (angles.length < 2) return 0;
  const items = angles.map((a, i) => ({ a: normDeg(a), w: weights?.[i] ?? 1 }));
  if (trim > 0) {
    const mean = circularMean(items.map((x) => x.a), items.map((x) => x.w));
    if (!Number.isNaN(mean)) {
      // Signed offset from the mean, so trimming takes from both tails.
      const sorted = items.map((x) => ({ ...x, off: ((x.a - mean + 540) % 360) - 180 })).sort((p, q) => p.off - q.off);
      const total = sorted.reduce((t, x) => t + x.w, 0);
      let lo = 0;
      let cut = 0;
      while (lo < sorted.length - 1 && cut + sorted[lo]!.w <= total * trim) cut += sorted[lo++]!.w;
      let hi = sorted.length - 1;
      cut = 0;
      while (hi > lo && cut + sorted[hi]!.w <= total * trim) cut += sorted[hi--]!.w;
      return sorted[hi]!.off - sorted[lo]!.off;
    }
  }
  const sorted = items.map((x) => x.a).sort((p, q) => p - q);
  let maxGap = 360 - sorted[sorted.length - 1]! + sorted[0]!;
  for (let i = 1; i < sorted.length; i++) maxGap = Math.max(maxGap, sorted[i]! - sorted[i - 1]!);
  return 360 - maxGap;
}

const POINTS8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Compass8 = (typeof POINTS8)[number];

export function compassPoint(deg: number): Compass8 {
  return POINTS8[Math.round(normDeg(deg) / 45) % 8]!;
}

export function compassToDeg(p: string): number | null {
  const i = POINTS8.indexOf(p.trim().toUpperCase() as Compass8);
  return i < 0 ? null : i * 45;
}

/** Shortest distance from point p to segment ab, in the same planar units as the inputs. */
export function pointSegmentDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function pointInPolygon([x, y]: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
