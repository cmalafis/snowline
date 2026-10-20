// Shared "groomed today?" reports: each device's latest report on a run counts once; the majority wins, and a tie
// goes to the most recent report. A report only overrides a run for everyone once `minConfirm` devices agree on
// the winning side; a lone report stays a hint. Reports apply to one resort-day only.

export const MIN_CONFIRMING_REPORTS = 2;

export interface GroomReport {
  device: string;
  runId: string;
  /** null withdraws this device's report. */
  groomed: boolean | null;
  at: string;
}

export interface SharedGrooming {
  groomed: boolean;
  /** Enough devices agree that it applies for everyone. */
  confirmed: boolean;
  /** Distinct devices that reported each way. */
  yes: number;
  no: number;
  lastAt: string;
}

export function summarizeReports(reports: GroomReport[], minConfirm = MIN_CONFIRMING_REPORTS): Record<string, SharedGrooming> {
  // Latest report per device per run.
  const latest = new Map<string, GroomReport>();
  for (const r of [...reports].sort((a, b) => a.at.localeCompare(b.at))) latest.set(`${r.runId}\u0000${r.device}`, r);
  const byRun = new Map<string, GroomReport[]>();
  for (const r of latest.values()) {
    if (r.groomed === null) continue;
    byRun.set(r.runId, [...(byRun.get(r.runId) ?? []), r]);
  }
  const out: Record<string, SharedGrooming> = {};
  for (const [runId, rs] of byRun) {
    const yes = rs.filter((r) => r.groomed).length;
    const no = rs.length - yes;
    const newest = rs.reduce((m, r) => (r.at > m.at ? r : m));
    const groomed = yes === no ? newest.groomed! : yes > no;
    out[runId] = { groomed, confirmed: (groomed ? yes : no) >= minConfirm, yes, no, lastAt: newest.at };
  }
  return out;
}
