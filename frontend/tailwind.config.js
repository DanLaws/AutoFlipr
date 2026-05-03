/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      colors: {
        // Surfaces
        page:             "var(--color-page)",
        surface:          "var(--color-surface)",
        "surface-subtle": "var(--color-surface-subtle)",
        "surface-raised": "var(--color-surface-raised)",

        // Borders
        "border-default": "var(--color-border)",
        "border-faint":   "var(--color-border-faint)",
        "border-strong":  "var(--color-border-strong)",

        // Text
        "text-primary":   "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-muted":     "var(--color-text-muted)",
        "text-faint":     "var(--color-text-faint)",

        // Brand (gray-900 per design — professional, not emerald)
        brand:         "var(--color-brand)",
        "brand-hover": "var(--color-brand-hover)",
        "brand-fg":    "var(--color-brand-fg)",

        // Success
        "success-bg":     "var(--color-success-bg)",
        "success-border": "var(--color-success-border)",
        "success-text":   "var(--color-success-text)",
        "success-strong": "var(--color-success-strong)",

        // Warning
        "warning-bg":     "var(--color-warning-bg)",
        "warning-border": "var(--color-warning-border)",
        "warning-text":   "var(--color-warning-text)",
        "warning-strong": "var(--color-warning-strong)",

        // Danger
        "danger-bg":     "var(--color-danger-bg)",
        "danger-border": "var(--color-danger-border)",
        "danger-text":   "var(--color-danger-text)",
        "danger-strong": "var(--color-danger-strong)",

        // Info (blue — used for negotiation assistant panel)
        "info-bg":     "var(--color-info-bg)",
        "info-border": "var(--color-info-border)",
        "info-text":   "var(--color-info-text)",

        // Score ring colours
        "score-good": "var(--color-score-good)",
        "score-fair": "var(--color-score-fair)",
        "score-poor": "var(--color-score-poor)",

        // Legacy score band backgrounds (keep for backwards compat)
        "score-high-bg":   "var(--color-score-high-bg)",
        "score-high-text": "var(--color-score-high-text)",
        "score-mid-bg":    "var(--color-score-mid-bg)",
        "score-mid-text":  "var(--color-score-mid-text)",
        "score-low-bg":    "var(--color-score-low-bg)",
        "score-low-text":  "var(--color-score-low-text)",
      },
      zIndex: {
        "35": "35",
      },
      spacing: {
        "4.5": "1.125rem",
        "13":  "3.25rem",
        "15":  "3.75rem",
        "18":  "4.5rem",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        sm:         "var(--shadow-sm)",
        card:       "var(--shadow-sm)",
        "card-hover": "var(--shadow-md)",
        md:         "var(--shadow-md)",
        lg:         "var(--shadow-lg)",
        popover:    "var(--shadow-lg)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to:   { transform: "translateX(0)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "fade-in":        "fade-in 0.15s ease-out",
        "slide-in-right": "slide-in-right 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-slow":     "pulse 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
