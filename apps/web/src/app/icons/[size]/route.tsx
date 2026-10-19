import { ImageResponse } from "next/og";
import { Mark } from "@/lib/brand";

const SIZES = new Set([192, 512]);

/** /icons/192, /icons/512, and /icons/512?maskable for the web manifest. */
export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("not found", { status: 404 });
  const maskable = new URL(req.url).searchParams.has("maskable");
  return new ImageResponse(<Mark size={size} pad={maskable ? 0.12 : 0} rounded={!maskable} />, {
    width: size,
    height: size,
    headers: { "Cache-Control": "public, max-age=604800, immutable" },
  });
}
