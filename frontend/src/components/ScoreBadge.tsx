interface Props {
  score: number | null;
  confidence?: string | null;
  size?: number;
}

/**
 * Numeric score centered inside a thin SVG radial progress ring.
 * Ring colour: emerald (≥70) · amber (≥50) · gray (<50)
 * Center:      dark bg + white text (good) · amber bg (fair) · subtle bg (poor)
 */
export default function ScoreBadge({ score, confidence, size = 48 }: Props) {
  if (score === null || score === undefined) {
    return (
      <div
        style={{ width: size, height: size }}
        className="inline-flex items-center justify-center text-text-faint text-lg"
      >
        —
      </div>
    );
  }

  const tier = score >= 70 ? "good" : score >= 50 ? "fair" : "poor";

  const ringColor =
    tier === "good" ? "var(--color-score-good)"
    : tier === "fair" ? "var(--color-score-fair)"
    : "var(--color-score-poor)";

  const centerBg =
    tier === "good" ? "var(--color-text-primary)"
    : tier === "fair" ? "var(--color-score-fair)"
    : "var(--color-surface-subtle)";

  const centerFg =
    tier === "good" ? "var(--color-brand-fg)"
    : tier === "fair" ? "#FFFFFF"
    : "var(--color-text-secondary)";

  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const innerSize = size - 10;
  const fontSize = Math.round(size * 0.33);

  return (
    <div
      style={{ width: size, height: size }}
      className="relative inline-flex items-center justify-center shrink-0"
    >
      {/* SVG ring */}
      <svg
        width={size}
        height={size}
        className="absolute inset-0"
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="var(--color-border-default)"
          strokeWidth="2"
          fill="none"
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={ringColor}
          strokeWidth="2"
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>

      {/* Center disc */}
      <div
        style={{
          width: innerSize,
          height: innerSize,
          background: centerBg,
          color: centerFg,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          fontSize,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {Math.round(score)}
        {confidence === "low" && (
          <span style={{ fontSize: fontSize * 0.55, marginLeft: 1, opacity: 0.65 }}>?</span>
        )}
      </div>
    </div>
  );
}
