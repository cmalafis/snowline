// Shared "groomed today?" reports: each device's latest report on a run counts once; the majority wins, and a tie
// goes to the most recent report. Reports apply to one resort-day only.

export interface GroomReport {
  device: string;
  runId: string;
  /** null withdraws this device's report. */
  groomed: boolean | null;
  at: string;
}

export interface SharedGrooming {
  groomed: boolean;
  /** Distinct devices that reported each way. */
  yes: number;
  no: number;
  lastAt: string;
}

export function summarizeReports(reports: GroomReport[]): Record<string, SharedGrooming> {
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
    out[runId] = { groomed: yes === no ? newest.groomed! : yes > no, yes, no, lastAt: newest.at };
  }
  return out;
}
