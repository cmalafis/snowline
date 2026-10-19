import { ImageResponse } from "next/og";
import { Mark } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  // iOS rounds the corners itself.
  return new ImageResponse(<Mark size={180} pad={0.08} rounded={false} />, size);
}
