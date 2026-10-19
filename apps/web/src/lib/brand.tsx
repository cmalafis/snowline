// App icon and splash artwork, drawn as JSX so Next's ImageResponse renders PNGs on demand (no binary assets).

export const BRAND = { orange: "#E2570E", ink: "#0F1E28", snow: "#FFFFFF", sun: "#FFC64A", bg: "#0B161D" };

/** A sun over a snowline peak. `pad` shrinks the art for maskable icons' safe zone. */
export function Mark({ size, pad = 0, rounded = true }: { size: number; pad?: number; rounded?: boolean }) {
  const inner = size * (1 - pad * 2);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND.orange,
        borderRadius: rounded ? size * 0.22 : 0,
      }}
    >
      <svg width={inner} height={inner} viewBox="0 0 100 100">
        <circle cx="70" cy="30" r="13" fill={BRAND.sun} />
        <path d="M8 84 L40 34 L52 52 L62 40 L92 84 Z" fill={BRAND.ink} />
        <path d="M40 34 L30 50 L36 47 L40 53 L45 46 L49 48 Z M62 40 L56 48 L61 46 L65 50 L68 47 Z" fill={BRAND.snow} />
      </svg>
    </div>
  );
}

export function Splash({ w, h }: { w: number; h: number }) {
  const icon = Math.round(Math.min(w, h) * 0.28);
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: BRAND.bg, gap: icon * 0.18 }}>
      <Mark size={icon} />
      <div style={{ color: BRAND.snow, fontSize: icon * 0.32, fontWeight: 800, letterSpacing: -1 }}>Snowline</div>
    </div>
  );
}
