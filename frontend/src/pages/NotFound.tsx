import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--color-page)" }}
    >
      <Helmet>
        <title>Page Not Found | AutoFlipr</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Subtle grid background */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `
            linear-gradient(var(--grid-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          WebkitMaskImage: "radial-gradient(ellipse 55% 55% at 50% 50%, black 20%, transparent 80%)",
          maskImage: "radial-gradient(ellipse 55% 55% at 50% 50%, black 20%, transparent 80%)",
        }}
      />

      <div className="relative text-center max-w-md">
        <div className="font-mono text-8xl font-bold text-text-faint mb-2 tracking-tight" style={{ letterSpacing: "-0.04em" }}>
          404
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-3 tracking-tight">
          Page not found
        </h1>
        <p className="text-sm text-text-muted leading-relaxed mb-8">
          This page doesn't exist or the listing has been removed.
          Head back to the deal feed — there are plenty more underpriced cars to find.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={() => navigate("/")}
            className="btn btn-primary"
          >
            Go to homepage
          </button>
          <button
            onClick={() => navigate(-1)}
            className="btn btn-secondary"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
