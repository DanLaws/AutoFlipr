/** Tiny inline badge on DealCard (top-left of image) */
export function scoreColourBadge(score: number | null): string {
  if (score === null) return "bg-surface-subtle text-text-muted";
  if (score >= 70) return "badge-score-high";
  if (score >= 50) return "badge-score-mid";
  return "badge-score-low";
}

/** Border/bg for ScoreBadge in old box-style (kept for Scan page legacy use) */
export function scoreColourBorder(score: number): string {
  if (score >= 70) return "text-score-high-text bg-score-high-bg border-success-border";
  if (score >= 50) return "text-score-mid-text bg-score-mid-bg border-warning-border";
  return "text-score-low-text bg-score-low-bg border-border-default";
}
