import { loadResort } from "@/server/data";
import { opensnowEnabled, resortStatus } from "@/server/opensnow";

export const dynamic = "force-dynamic";

/** The resort's own daily report (via OpenSnow), or { available: false } when there's no partner key or no report. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const data = await loadResort((await params).id);
  if (!data) return Response.json({ error: "unknown resort" }, { status: 404 });
  if (!opensnowEnabled()) return Response.json({ available: false, reason: "not-configured" });
  const status = await resortStatus(data.resort);
  if (!status) return Response.json({ available: false, reason: "unavailable" });
  return Response.json({ available: true, status }, { headers: { "Cache-Control": "public, max-age=600" } });
}
