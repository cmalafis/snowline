import { ImageResponse } from "next/og";
import { Splash } from "@/lib/brand";

/** iOS launch images (apple-touch-startup-image), one per device size in layout.tsx. */
export async function GET(_req: Request, { params }: { params: Promise<{ w: string; h: string }> }) {
  const { w, h } = await params;
  const [width, height] = [Number(w), Number(h)];
  if (!(width >= 320 && width <= 3000 && height >= 320 && height <= 3000)) return new Response("not found", { status: 404 });
  return new ImageResponse(<Splash w={width} h={height} />, { width, height, headers: { "Cache-Control": "public, max-age=604800, immutable" } });
}
