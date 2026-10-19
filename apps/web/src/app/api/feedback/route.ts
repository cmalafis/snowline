import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * Feedback from testers: "how did it ski?" ratings (with the predicted score), free-text comments, and run
 * corrections (aspect, groomed today). Corrections are collected now; applying them for everyone once 3 agree
 * needs the database (build step 3).
 */
interface Feedback {
  kind: "rating" | "comment" | "correction";
  device: string;
  resort?: string;
  runId?: string;
  runName?: string;
  date?: string;
  hour?: number;
  predicted?: number;
  rating?: number;
  text?: string;
  aspect?: number;
  groomed?: boolean;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
const numIn = (v: unknown, lo: number, hi: number) => (typeof v === "number" && v >= lo && v <= hi ? v : undefined);

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 8_000) return Response.json({ error: "too large" }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const kind = body.kind === "rating" || body.kind === "comment" || body.kind === "correction" ? body.kind : null;
  const fb: Feedback | null = kind && {
    kind,
    device: str(body.device, 64) ?? "unknown",
    resort: str(body.resort, 40),
    runId: str(body.runId, 120),
    runName: str(body.runName, 120),
    date: str(body.date, 10),
    hour: numIn(body.hour, 0, 24),
    predicted: numIn(body.predicted, 0, 100),
    rating: numIn(body.rating, 1, 5),
    text: str(body.text, 2_000),
    aspect: numIn(body.aspect, 0, 360),
    groomed: typeof body.groomed === "boolean" ? body.groomed : undefined,
  };
  if (
    !fb ||
    (fb.kind === "rating" && fb.rating === undefined) ||
    (fb.kind === "comment" && !fb.text?.trim()) ||
    (fb.kind === "correction" && (!fb.runId || (fb.aspect === undefined && fb.groomed === undefined)))
  ) {
    return Response.json({ error: "invalid feedback" }, { status: 400 });
  }
  const line = JSON.stringify({ at: new Date().toISOString(), ...fb });
  console.log(`feedback ${line}`);
  const dir = process.env.FEEDBACK_DIR;
  if (dir) {
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, "feedback.jsonl"), line + "\n");
  }
  return Response.json({ ok: true });
}
