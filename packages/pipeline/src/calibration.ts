import { SCENARIOS, buildDayContext, scoreRunDay, type AppResortData, type ResortConfig } from "@snowline/core";

export type SpringOrder = NonNullable<NonNullable<ResortConfig["validation"]>["springOrder"]>;

export interface SpringOrderResult {
  label: string;
  expectedHour: number;
  zones: { id: string; onset: number | null; ok: boolean }[];
}

/**
 * Replay the bluebird-spring scenario at a resort (scenario stations placed at its base and summit) and find when
 * each zone goes prime: the median of its runs' first prime step. Compare with a published spring order.
 */
export function springOrderCheck(data: AppResortData, order: SpringOrder, toleranceHours = 0.75): { groups: SpringOrderResult[]; ordered: boolean } {
  const r = data.resort;
  const sc = SCENARIOS.find((s) => s.id === "spring")!.weather;
  const weather = { ...sc, base: { ...sc.base, elevationFt: r.base.elevationFt }, summit: sc.summit && { ...sc.summit, elevationFt: r.summit.elevationFt } };
  const ctx = buildDayContext({ lat: r.base.lat, lon: r.base.lon, tz: r.tz, openHour: r.openHour, closeHour: r.closeHour, treelineFt: r.treelineFt }, weather);
  const zones = new Map(data.zones.map((z) => [z.id, z]));

  const onset = (zoneId: string): number | null => {
    const hours = data.runs
      .filter((run) => run.zone === zoneId)
      .map((run) => scoreRunDay(run, zones.get(zoneId), ctx).find((s) => s.state === "prime")?.hour ?? Infinity)
      .sort((a, b) => a - b);
    const mid = hours[Math.floor(hours.length / 2)];
    return mid === undefined || !Number.isFinite(mid) ? null : mid;
  };

  const groups = order.map((g) => ({
    label: g.label,
    expectedHour: g.hour,
    zones: g.zones.map((id) => {
      const h = onset(id);
      return { id, onset: h, ok: h !== null && Math.abs(h - g.hour) <= toleranceHours };
    }),
  }));
  // Each group's latest zone should go no later than the next group's earliest.
  const ordered = groups.every((g, i) => {
    const next = groups[i + 1];
    if (!next) return true;
    const latest = Math.max(...g.zones.map((z) => z.onset ?? Infinity));
    const earliest = Math.min(...next.zones.map((z) => z.onset ?? Infinity));
    return latest <= earliest;
  });
  return { groups, ordered };
}
