import type { ReactNode } from "react";
import { tier } from "@/lib/model";

// Small PatternFly-style building blocks: line icons (stroke = currentColor), score labels and alerts.

type IconName =
  | "pin"
  | "gear"
  | "chevronDown"
  | "chevronLeft"
  | "close"
  | "star"
  | "starFilled"
  | "map"
  | "search"
  | "info"
  | "warning"
  | "danger"
  | "tree"
  | "snowflake"
  | "sun"
  | "partly"
  | "cloud"
  | "snow"
  | "rain"
  | "wind"
  | "thermometer"
  | "offline"
  | "check";

const PATHS: Record<IconName, ReactNode> = {
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  star: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />,
  starFilled: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" fill="currentColor" />,
  map: (
    <>
      <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
      <path d="M9 3v15M15 6v15" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18h.01" />
    </>
  ),
  danger: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5h.01" />
    </>
  ),
  tree: (
    <>
      <path d="M12 2l5 7h-3l4 6h-3l3 5H6l3-5H6l4-6H7z" />
      <path d="M12 20v2" />
    </>
  ),
  snowflake: <path d="M12 2v20M4.9 7l14.2 10M4.9 17L19.1 7" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  partly: (
    <>
      <path d="M8 3v1.5M3.6 4.6l1 1M2 9h1.5" />
      <path d="M5.5 11a3.5 3.5 0 0 1 6.3-2.3" />
      <path d="M8 19h9a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 8 19z" />
    </>
  ),
  cloud: <path d="M7 18h10a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6 1.8A3.6 3.6 0 0 0 7 18z" />,
  snow: (
    <>
      <path d="M7 14h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 14z" />
      <path d="M8 18h.01M12 20h.01M16 18h.01M10 22h.01M14 22h.01" />
    </>
  ),
  rain: (
    <>
      <path d="M7 14h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 14z" />
      <path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" />
    </>
  ),
  wind: <path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8" />,
  thermometer: <path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z" />,
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </>
  ),
  offline: (
    <>
      <path d="M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 10.7 5M5 12.4a10 10 0 0 1 3-1.8M19 12.4a10 10 0 0 0-3.6-2M8.5 16a5 5 0 0 1 7 0M12 20h.01" />
      <path d="M3 3l18 18" />
    </>
  ),
};

export function Icon({ name, size = 20, className, style }: { name: IconName; size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={{ flex: "none", ...style }}
    >
      {PATHS[name]}
    </svg>
  );
}

/** Prime / Good / Fair / Skip with the score, in the tier's label colours. */
export function ScoreLabel({ score, label, small }: { score: number; label: string; small?: boolean }) {
  return (
    <span className={`label label-${tier(score)}${small ? " label-sm" : ""}`} style={small ? { fontWeight: 700 } : undefined}>
      {label} · {score}
    </span>
  );
}

const ALERT_ICON = { info: "info", warning: "warning", danger: "danger" } as const;

export function Alert({ variant, title, children, role }: { variant: "info" | "warning" | "danger"; title: ReactNode; children?: ReactNode; role?: "alert" | "status" }) {
  return (
    <div className={`alert alert-${variant}`} role={role ?? (variant === "info" ? "status" : "alert")}>
      <Icon name={ALERT_ICON[variant]} />
      <div style={{ minWidth: 0 }}>
        <div className="alert-title">{title}</div>
        {children && <div className="alert-body">{children}</div>}
      </div>
    </div>
  );
}

/** The app's mark: a peak and sun on a blue tile. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: "none" }}>
      <rect width="32" height="32" rx="8" fill="var(--pf-primary)" />
      <path d="M5 24 L13 11 L17 17 L20 13 L27 24 Z" fill="var(--pf-on-primary)" />
      <circle cx="23" cy="9" r="3" fill="var(--pf-on-primary)" />
    </svg>
  );
}
