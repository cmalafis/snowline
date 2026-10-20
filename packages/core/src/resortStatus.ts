// The resort's own daily report, as relayed by OpenSnow's partner API (GET /snow-report/:slug). Pure: the server
// fetches, this parses. Field names follow https://opensnow.com/api/routes/snow-report_:id_or_slug__GET.html.

export interface ResortStatus {
  source: "opensnow";
  fetchedAt: string;
  /** When the resort published this report (ISO, UTC) and OpenSnow's local label for it. */
  reportAt: string | null;
  reportLabel: string | null;
  /** open: lifts turning. closed: closed for the day or season. opening-soon: before opening day. */
  state: "open" | "closed" | "opening-soon" | "unknown";
  statusText: string;
  /** e.g. the opening date when opening soon. */
  statusDetail: string | null;
  /** Operating notes, plain text (HTML stripped). */
  notes: string | null;
  conditions: string | null;
  liftsOpen: number | null;
  liftsTotal: number | null;
  runsOpen: number | null;
  runsTotal: number | null;
  percentOpen: number | null;
  /** Resort-measured new snow, inches. */
  newSnow24In: number | null;
  newSnow72In: number | null;
  baseDepthIn: number | null;
  /** OpenSnow's attribution: must be shown with the data. */
  attribution: { linkUrl: string | null; linkText: string | null; description: string | null; logoLight: string | null; logoDark: string | null };
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Strip tags and decode the handful of entities the notes use, so nothing from the feed is rendered as HTML. */
export function plainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stateOf(display: string | null, liftsOpen: number | null): ResortStatus["state"] {
  const d = (display ?? "").toLowerCase();
  if (/opening|coming soon|pre-?season/.test(d)) return "opening-soon";
  if (/closed|clos/.test(d)) return "closed";
  if (/open/.test(d) || (liftsOpen ?? 0) > 0) return "open";
  return "unknown";
}

export function parseSnowReport(body: unknown, fetchedAt = new Date().toISOString()): ResortStatus | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const r = root.snow_report as Record<string, unknown> | undefined | null;
  if (!r || typeof r !== "object") return null;
  const a = (root.attribution ?? {}) as Record<string, unknown>;
  const statusText = str(r.status_display) ?? "Unknown";
  const notesHtml = str(r.status_notes_html) ?? str(r.status_notes);
  const liftsOpen = num(r.lifts_open);
  return {
    source: "opensnow",
    fetchedAt,
    reportAt: str(r.display_at),
    reportLabel: str(r.display_at_local_label),
    state: stateOf(statusText, liftsOpen),
    statusText,
    statusDetail: str(r.status_display_detail),
    notes: notesHtml ? plainText(notesHtml) : null,
    conditions: str(r.conditions),
    liftsOpen,
    liftsTotal: num(r.lifts_total),
    runsOpen: num(r.runs_open),
    runsTotal: num(r.runs_total),
    percentOpen: num(r.percent_open),
    newSnow24In: num(r.precip_snow_24h),
    newSnow72In: num(r.precip_snow_72h),
    baseDepthIn: num(r.base_depth),
    attribution: {
      linkUrl: str(a.link_url),
      linkText: str(a.link_text),
      description: str(a.description),
      logoLight: str(a.image_light_url),
      logoDark: str(a.image_dark_url),
    },
  };
}

/** Whether a report was published on `date` (YYYY-MM-DD) in the resort's time zone. */
export function reportIsFor(status: ResortStatus, date: string, tz: string): boolean {
  if (!status.reportAt) return false;
  const d = new Date(status.reportAt);
  if (Number.isNaN(d.getTime())) return false;
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d) === date;
}
