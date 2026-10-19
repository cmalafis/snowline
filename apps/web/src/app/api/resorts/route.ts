import { listResorts } from "@/server/data";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await listResorts(), { headers: { "Cache-Control": "public, max-age=300" } });
}
