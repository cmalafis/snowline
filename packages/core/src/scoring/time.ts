// Time-zone helpers built on Intl, so they work the same in Node and the browser.

/** Offset of `tz` from UTC at instant `t`, in ms (negative west of Greenwich). */
export function tzOffsetMs(t: number, tz: string): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(t));
  const g = (k: string) => Number(p.find((x) => x.type === k)!.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second")) - t;
}

/** UTC ms for a local wall-clock time: `dateStr` is YYYY-MM-DD, `hour` is fractional (9.5 = 9:30). */
export function localToUTC(dateStr: string, hour: number, tz: string): number {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const hh = Math.floor(hour);
  const guess = Date.UTC(y, m - 1, d, hh, Math.round((hour - hh) * 60));
  const first = guess - tzOffsetMs(guess, tz);
  // Second pass settles times near a DST switch.
  return guess - tzOffsetMs(first, tz);
}

export function todayIn(tz: string, now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Local fractional hour of `now` in `tz`. */
export function hourIn(tz: string, now = Date.now()): number {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(now));
  return Number(p.find((x) => x.type === "hour")!.value) + Number(p.find((x) => x.type === "minute")!.value) / 60;
}

export function fmtTime(h: number): string {
  let hh = Math.floor(h);
  let mm = Math.round((h - hh) * 60);
  if (mm === 60) [hh, mm] = [hh + 1, 0];
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, "0")}${hh < 12 ? "am" : "pm"}`;
}
