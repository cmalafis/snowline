import type { Metadata, Viewport } from "next";
// Fonts are bundled from npm (@fontsource) so builds never need the network.
import "@fontsource/red-hat-display/latin-500.css";
import "@fontsource/red-hat-display/latin-700.css";
import "@fontsource/red-hat-text/latin-400.css";
import "@fontsource/red-hat-text/latin-500.css";
import "@fontsource/red-hat-text/latin-700.css";
import "@fontsource/red-hat-mono/latin-400.css";
import "@fontsource/red-hat-mono/latin-500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Snowline",
  description: "Where the best snow is, hour by hour: runs ranked by sun, slope aspect, temperature and grooming.",
  applicationName: "Snowline",
  appleWebApp: { capable: true, title: "Snowline", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#292929" },
  ],
};

// iPhone portrait launch screens: [CSS width, CSS height, pixel ratio].
const SPLASH: [number, number, number][] = [
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 2],
  [375, 667, 2],
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {SPLASH.map(([w, h, r]) => (
          <link
            key={`${w}x${h}`}
            rel="apple-touch-startup-image"
            href={`/splash/${w * r}/${h * r}`}
            media={`(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`}
          />
        ))}
        {/* Apply a saved theme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("snowline.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
