import "server-only";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { addDays, summarizeReports, todayIn, type GroomReport, type SharedGrooming } from "@snowline/core";

// Shared "groomed today?" reports. Held in memory (one replica) and appended to FEEDBACK_DIR/reports.jsonl on the
// persistent volume, so a restart doesn't lose the morning's reports. Only the last few days are kept.

interface Stored extends GroomReport {
  resort: string;
  date: string;
}

const KEEP_DAYS = 3;
const MAX_PER_DEVICE_PER_DAY = 200;
const file = () => (process.env.FEEDBACK_DIR ? path.join(process.env.FEEDBACK_DIR, "reports.jsonl") : null);

let loaded: Promise<Map<string, Stored[]>> | null = null;
const key = (resort: string, date: string) => `${resort}|${date}`;

async function store(): Promise<Map<string, Stored[]>> {
  loaded ??= (async () => {
    const m = new Map<string, Stored[]>();
    const f = file();
    if (!f || !existsSync(f)) return m;
    const cutoff = addDays(new Date().toISOString().slice(0, 10), -KEEP_DAYS);
    const kept: string[] = [];
    for (const line of (await readFile(f, "utf8")).split("\n")) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line) as Stored;
        if (r.date < cutoff) continue;
        kept.push(line);
        const k = key(r.resort, r.date);
        m.set(k, [...(m.get(k) ?? []), r]);
      } catch {
        // Skip a torn line.
      }
    }
    await writeFile(f, kept.length ? kept.join("\n") + "\n" : "");
    return m;
  })();
  return loaded;
}

export async function sharedGrooming(resort: string, date: string): Promise<Record<string, SharedGrooming>> {
  return summarizeReports((await store()).get(key(resort, date)) ?? []);
}

/** Record a report for today at the resort. Returns an error message, or null when stored. */
export async function addReport(resort: string, tz: string, report: Omit<GroomReport, "at">): Promise<string | null> {
  const date = todayIn(tz);
  const m = await store();
  const list = m.get(key(resort, date)) ?? [];
  if (list.filter((r) => r.device === report.device).length >= MAX_PER_DEVICE_PER_DAY) return "too many reports today";
  const stored: Stored = { ...report, at: new Date().toISOString(), resort, date };
  m.set(key(resort, date), [...list, stored]);
  const f = file();
  if (f) {
    await mkdir(path.dirname(f), { recursive: true });
    await appendFile(f, JSON.stringify(stored) + "\n");
  }
  return null;
}
