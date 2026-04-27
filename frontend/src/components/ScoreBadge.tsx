interface Props {
  score: number | null;
  confidence: string | null;
}

export default function ScoreBadge({ score, confidence }: Props) {
  if (score === null) return <span className="text-gray-400 text-sm">—</span>;

  const style =
    score >= 70
      ? "bg-gray-900 text-white border-gray-900"
      : score >= 50
      ? "bg-gray-100 text-gray-700 border-gray-200"
      : "bg-gray-50 text-gray-400 border-gray-200";

  return (
    <span className={`inline-flex items-center gap-1 border rounded-lg px-2.5 py-1 text-sm font-semibold font-mono ${style}`}>
      {score.toFixed(0)}
      {confidence === "low" && (
        <span className="text-xs opacity-50" title="Low confidence — few comparables">?</span>
      )}
    </span>
  );
}
