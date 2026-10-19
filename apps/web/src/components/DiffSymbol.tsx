import type { Difficulty } from "@snowline/core";

const LABEL: Record<Difficulty, string> = {
  novice: "Green circle",
  easy: "Green circle",
  intermediate: "Blue square",
  advanced: "Black diamond",
  expert: "Double black diamond",
  freeride: "Double black diamond",
  extreme: "Double black diamond",
  unknown: "Unrated",
};

/** Standard North American trail difficulty symbols. */
export function DiffSymbol({ d, size = 20 }: { d: Difficulty; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 18 18", role: "img", "aria-label": LABEL[d], style: { flex: "none" } } as const;
  if (d === "novice" || d === "easy")
    return (
      <svg {...common}>
        <circle cx="9" cy="9" r="7" fill="var(--green)" />
      </svg>
    );
  if (d === "intermediate")
    return (
      <svg {...common}>
        <rect x="2.5" y="2.5" width="13" height="13" fill="var(--blue)" />
      </svg>
    );
  if (d === "advanced")
    return (
      <svg {...common}>
        <path d="M9 1.5 16.5 9 9 16.5 1.5 9Z" fill="var(--sym-black)" />
      </svg>
    );
  if (d === "unknown")
    return (
      <svg {...common}>
        <circle cx="9" cy="9" r="6" fill="none" stroke="var(--muted)" strokeWidth="2" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M5 3 9.5 9 5 15 .5 9Z M13 3 17.5 9 13 15 8.5 9Z" fill="var(--sym-black)" />
    </svg>
  );
}
