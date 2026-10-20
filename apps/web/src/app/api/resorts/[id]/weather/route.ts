import { loadResort } from "@/server/data";
import { dayWeather } from "@/server/weather";
import { resortStatus } from "@/server/opensnow";
import { reportIsFor } from "@snowline/core";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const data = await loadResort((await params).id);
  if (!data) return Response.json({ error: "unknown resort" }, { status: 404 });
  const date = new URL(req.url).searchParams.get("date") ?? undefined;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "bad date" }, { status: 400 });
  try {
    const weather = await dayWeather(data.resort, date);
    if (!weather) return Response.json({ error: "date outside forecast window" }, { status: 400 });
    // Prefer the resort's own measured overnight snow, when its report is from this morning.
    const status = await resortStatus(data.resort).catch(() => null);
    if (status?.newSnow24In !== null && status?.newSnow24In !== undefined && reportIsFor(status, weather.date, data.resort.tz)) {
      const forecast = weather.newSnowIn;
      weather.newSnowIn = status.newSnow24In;
      weather.newSnowSource = "resort";
      // Keep the base's share of the forecast total, so low runs still get less when it rained down there.
      if (weather.newSnowBaseIn !== undefined && forecast > 0) weather.newSnowBaseIn = Math.round((weather.newSnowBaseIn / forecast) * status.newSnow24In * 10) / 10;
    } else weather.newSnowSource = "forecast";
    return Response.json(weather, { headers: { "Cache-Control": "public, max-age=900" } });
  } catch (err) {
    console.error("weather", err);
    return Response.json({ error: "weather unavailable" }, { status: 502 });
  }
}
