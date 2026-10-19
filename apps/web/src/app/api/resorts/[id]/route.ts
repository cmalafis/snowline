import { loadResort } from "@/server/data";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const data = await loadResort((await params).id);
  if (!data) return Response.json({ error: "unknown resort" }, { status: 404 });
  return Response.json(data, { headers: { "Cache-Control": "public, max-age=3600" } });
}
