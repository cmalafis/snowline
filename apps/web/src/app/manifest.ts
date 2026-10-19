import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Snowline",
    short_name: "Snowline",
    description: "Where the best snow is, hour by hour.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B161D",
    theme_color: "#E2570E",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512?maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
