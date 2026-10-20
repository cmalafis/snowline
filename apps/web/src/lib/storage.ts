"use client";
import type { Difficulty, RunType, SharedGrooming } from "@snowline/core";

// Per-device storage. No accounts in v1: everything lives in localStorage behind this small interface,
// so a sync backend can slot in later without touching components.

export interface Prefs {
  types: RunType[];
  maxDifficulty: Difficulty;
}

export interface Rating {
  resort: string;
  runId: string;
  runName: string;
  date: string;
  hour: number;
  predicted: number;
  rating: number;
  at: string;
}

export const DEFAULT_PREFS: Prefs = { types: ["groomer", "bump", "tree", "bowl"], maxDifficulty: "expert" };

const PREFIX = "snowline.";

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Private mode or quota: the app still works for this session.
  }
}

export const store = {
  deviceId(): string {
    let id = read<string | null>("device", null);
    if (!id) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);
      write("device", id);
    }
    return id;
  },
  prefs: (): Prefs => ({ ...DEFAULT_PREFS, ...read<Partial<Prefs>>("prefs", {}) }),
  setPrefs: (p: Prefs) => write("prefs", p),
  resort: (): string | null => read<string | null>("resort", null),
  setResort: (id: string) => write("resort", id),

  favorites: (resort: string): string[] => read<string[]>(`fav.${resort}`, []),
  toggleFavorite(resort: string, runId: string): string[] {
    const f = store.favorites(resort);
    const next = f.includes(runId) ? f.filter((x) => x !== runId) : [...f, runId];
    write(`fav.${resort}`, next);
    return next;
  },

  /** Grooming toggles apply to one day only. */
  groomed: (resort: string, date: string): Record<string, boolean> => read(`groomed.${resort}.${date}`, {}),
  setGroomed(resort: string, date: string, runId: string, value: boolean | null): Record<string, boolean> {
    const m = { ...store.groomed(resort, date) };
    if (value === null) delete m[runId];
    else m[runId] = value;
    write(`groomed.${resort}.${date}`, m);
    return m;
  },

  aspectFixes: (resort: string): Record<string, number> => read(`aspect.${resort}`, {}),
  setAspectFix(resort: string, runId: string, aspect: number | null): Record<string, number> {
    const m = { ...store.aspectFixes(resort) };
    if (aspect === null) delete m[runId];
    else m[runId] = aspect;
    write(`aspect.${resort}`, m);
    return m;
  },

  ratings: (): Rating[] => read<Rating[]>("ratings", []),
  addRating(r: Rating): void {
    write("ratings", [...store.ratings().filter((x) => !(x.runId === r.runId && x.date === r.date)), r].slice(-500));
  },

  /**
   * Unmarked tree areas are off until the user turns them on and accepts the cautions (recorded with the date,
   * so a later change to the cautions can ask again).
   */
  unmarked: (): { on: boolean; acceptedAt: string | null } => read("unmarked", { on: false, acceptedAt: null }),
  setUnmarked(on: boolean, accepted = false): void {
    const prev = store.unmarked();
    write("unmarked", { on, acceptedAt: accepted ? new Date().toISOString() : prev.acceptedAt });
  },

  theme: (): "system" | "light" | "dark" => {
    try {
      const t = localStorage.getItem(PREFIX + "theme");
      return t === "light" || t === "dark" ? t : "system";
    } catch {
      return "system";
    }
  },
  setTheme(t: "system" | "light" | "dark"): void {
    try {
      if (t === "system") localStorage.removeItem(PREFIX + "theme");
      else localStorage.setItem(PREFIX + "theme", t);
    } catch {}
    if (t === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  },
};

interface Queued {
  url: string;
  body: Record<string, unknown>;
}

/** POST JSON; while offline (or on a server error) queue it and retry later. Returns the response body when sent. */
async function postOrQueue<T>(url: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return ((await res.json().catch(() => ({}))) as T) ?? ({} as T);
    if (res.status >= 400 && res.status < 500) return null;
  } catch {}
  write("outbox", [...read<(Queued | Record<string, unknown>)[]>("outbox", []), { url, body }].slice(-100));
  return null;
}

/** Send feedback to the server; queue it while offline and retry later. */
export async function sendFeedback(payload: Record<string, unknown>): Promise<boolean> {
  return (await postOrQueue("/api/feedback", { device: store.deviceId(), ...payload })) !== null;
}

/** Share a "groomed today?" report with everyone (null withdraws it). Returns the run's new shared tally when sent. */
export async function sendGroomReport(resortId: string, runId: string, groomed: boolean | null): Promise<{ run: SharedGrooming | null } | null> {
  return postOrQueue(`/api/resorts/${resortId}/reports`, { device: store.deviceId(), runId, groomed });
}

/** Retry queued posts (feedback and grooming reports). Older queues held bare feedback bodies. */
export async function flushFeedback(): Promise<void> {
  const box = read<(Queued | Record<string, unknown>)[]>("outbox", []);
  if (!box.length) return;
  const left: unknown[] = [];
  for (const item of box) {
    const q: Queued = "url" in item && "body" in item ? (item as Queued) : { url: "/api/feedback", body: item as Record<string, unknown> };
    try {
      const res = await fetch(q.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q.body) });
      if (!res.ok && res.status >= 500) left.push(q);
    } catch {
      left.push(q);
    }
  }
  write("outbox", left);
}
