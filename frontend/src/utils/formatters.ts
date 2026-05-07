const LOCALE = "en-GB";

export const fmt = {
  /** £1,234 — null/undefined → "—" */
  gbp: (v: number | null | undefined): string =>
    v != null ? `£${Math.round(v).toLocaleString(LOCALE)}` : "—",

  /** 45,000 mi — null/undefined → "—" */
  miles: (v: number | null | undefined): string =>
    v != null ? `${v.toLocaleString(LOCALE)} mi` : "—",

  /** +3.5% / -1.2% — null/undefined → "—" */
  pct: (v: number | null | undefined): string =>
    v != null ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : "—",

  /** +£500 / −£200 (always signed, uses minus sign U+2212) */
  signed: (v: number | null | undefined): string =>
    v != null
      ? `${v >= 0 ? "+" : "−"}£${Math.abs(Math.round(v)).toLocaleString(LOCALE)}`
      : "—",

  /** Relative time: "2 hours ago", "just now" */
  rel: (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min${mins !== 1 ? "s" : ""} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  },
};
