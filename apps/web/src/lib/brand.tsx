// App icon and splash artwork, drawn as JSX so Next's ImageResponse renders PNGs on demand (no binary assets).

export const BRAND = { blue: "#0066CC", snow: "#FFFFFF", bg: "#1F1F1F" };

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
        background: BRAND.blue,
        borderRadius: rounded ? size * 0.25 : 0,
      }}
    >
      <svg width={inner} height={inner} viewBox="0 0 32 32">
        <path d="M5 24 L13 11 L17 17 L20 13 L27 24 Z" fill={BRAND.snow} />
        <circle cx="23" cy="9" r="3" fill={BRAND.snow} />
      </svg>
    </div>
  );
}

export function Splash({ w, h }: { w: number; h: number }) {
  const icon = Math.round(Math.min(w, h) * 0.28);
  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: BRAND.bg, gap: icon * 0.18 }}>
      <Mark size={icon} />
      <div style={{ color: BRAND.snow, fontSize: icon * 0.32, fontWeight: 700, letterSpacing: -0.5 }}>Snowline</div>
    </div>
  );
}
