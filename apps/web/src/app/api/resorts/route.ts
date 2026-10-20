import { hourIn, sampleHourly } from "@snowline/core";
import { listResorts, loadResort } from "@/server/data";
import { dayWeather } from "@/server/weather";

export const dynamic = "force-dynamic";

/** Resorts for the picker. `?conditions=1` adds a live snapshot (new snow, summit temperature, sky, wind) to each. */
export async function GET(req: Request) {
  const resorts = await listResorts();
  if (!new URL(req.url).searchParams.has("conditions")) {
    return Response.json(resorts, { headers: { "Cache-Control": "public, max-age=300" } });
  }
  const withConditions = await Promise.all(
    resorts.map(async (r) => {
      try {
        const data = (await loadResort(r.id))!;
        const w = await dayWeather(data.resort);
        if (!w) return { ...r, conditions: null };
        const st = w.summit ?? w.base;
        const h = hourIn(data.resort.tz);
        return {
          ...r,
          conditions: {
            newSnowIn: w.newSnowIn,
            stormTotalIn: w.stormTotalIn ?? null,
            summitTempF: Math.round(sampleHourly(st.hourly, h, (p) => p.temperatureF) ?? 0),
            cloudCover: Math.round(sampleHourly(st.hourly, h, (p) => p.cloudCover) ?? 0),
            gustMph: Math.round(sampleHourly(st.hourly, h, (p) => p.gustMph) ?? 0),
          },
        };
      } catch (err) {
        console.error("conditions", r.id, err);
        return { ...r, conditions: null };
      }
    }),
  );
  return Response.json(withConditions, { headers: { "Cache-Control": "public, max-age=900" } });
}
