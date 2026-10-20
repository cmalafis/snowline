import { todayIn } from "@snowline/core";
import { loadResort } from "@/server/data";
import { addReport, sharedGrooming } from "@/server/reports";

export const dynamic = "force-dynamic";

/** Today's shared grooming reports for a resort: { date, runs: { [runId]: { groomed, yes, no, lastAt } } }. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const data = await loadResort((await params).id);
  if (!data) return Response.json({ error: "unknown resort" }, { status: 404 });
  const date = todayIn(data.resort.tz);
  return Response.json({ date, runs: await sharedGrooming(data.resort.id, date) }, { headers: { "Cache-Control": "no-store" } });
}

/** Report whether a run was groomed today: { device, runId, groomed: true | false | null (withdraw) }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const data = await loadResort((await params).id);
  if (!data) return Response.json({ error: "unknown resort" }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 1_000) return Response.json({ error: "too large" }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const device = typeof body.device === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.device) ? body.device : null;
  const runId = typeof body.runId === "string" && data.runs.some((r) => r.id === body.runId) ? body.runId : null;
  const groomed = body.groomed === true || body.groomed === false || body.groomed === null ? body.groomed : undefined;
  if (!device || !runId || groomed === undefined) return Response.json({ error: "invalid report" }, { status: 400 });
  const err = await addReport(data.resort.id, data.resort.tz, { device, runId, groomed });
  if (err) return Response.json({ error: err }, { status: 429 });
  const date = todayIn(data.resort.tz);
  return Response.json({ ok: true, date, run: (await sharedGrooming(data.resort.id, date))[runId] ?? null });
}
