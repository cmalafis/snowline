import "server-only";
import { parseSnowReport, type AppResort, type ResortStatus } from "@snowline/core";

// The resort's daily report via OpenSnow's partner API. Dormant without OPENSNOW_API_KEY (an OpenShift secret);
// refreshed at most every 30 minutes per resort, so the morning report shows up soon after it's published.

const BASE = "https://api.opensnow.com";
const TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; value: Promise<ResortStatus | null> }>();

export const opensnowEnabled = () => !!process.env.OPENSNOW_API_KEY;

export async function resortStatus(resort: AppResort): Promise<ResortStatus | null> {
  const key = process.env.OPENSNOW_API_KEY;
  if (!key || !resort.opensnowSlug) return null;
  const hit = cache.get(resort.id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const params = new URLSearchParams({ api_key: key, v: "1", units: "imperial" });
  const value = fetch(`${BASE}/snow-report/${encodeURIComponent(resort.opensnowSlug)}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) })
    .then(async (res) => {
      if (!res.ok) throw new Error(`OpenSnow ${res.status}`);
      return parseSnowReport(await res.json());
    })
    .catch((err) => {
      console.error("opensnow", resort.id, (err as Error).message);
      // Keep serving the last good report rather than nothing.
      return hit ? hit.value : null;
    });
  cache.set(resort.id, { at: Date.now(), value });
  return value;
}
