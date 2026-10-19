import { loadResort } from "@/server/data";
import { dayWeather } from "@/server/weather";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const data = await loadResort((await params).id);
  if (!data) return Response.json({ error: "unknown resort" }, { status: 404 });
  const date = new URL(req.url).searchParams.get("date") ?? undefined;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "bad date" }, { status: 400 });
  try {
    const weather = await dayWeather(data.resort, date);
    if (!weather) return Response.json({ error: "date outside forecast window" }, { status: 400 });
    return Response.json(weather, { headers: { "Cache-Control": "public, max-age=900" } });
  } catch (err) {
    console.error("weather", err);
    return Response.json({ error: "weather unavailable" }, { status: 502 });
  }
}
