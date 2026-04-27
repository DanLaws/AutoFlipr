/**
 * Shared score colour utilities — used by DealsGrid, DealModal, and Scan.
 */

/** Tailwind classes for the score badge background/text in card grid view. */
export function scoreColourBadge(score: number | null): string {
  if (score === null) return "bg-gray-800/70 text-gray-300";
  if (score >= 70) return "bg-emerald-500 text-white";
  if (score >= 50) return "bg-amber-400 text-white";
  return "bg-gray-500 text-white";
}

/** Tailwind classes for the score display in the scan result card (border variant). */
export function scoreColourBorder(score: number): string {
  if (score >= 75) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (score >= 50) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
}
