import { useState, useRef, useEffect, useMemo } from "react";
import type { FlipEntry } from "../api/client";

type View  = "profit-time" | "profit-flip" | "days-profit";
type Range = "1M" | "3M" | "8M" | "1Y" | "All";

interface ChartFlip {
  id: number;
  name: string;
  sold: string;
  purchase: number;
  sale: number;
  costs: number;
  days: number;
  source: string | null;
  profit: number;
}

// ── Design palettes ───────────────────────────────────────────────────────────
const PALETTE = {
  dark: {
    surface:      "#11151F",
    surface2:     "#161B27",
    surface3:     "#1C2230",
    border:       "#232A3B",
    borderStrong: "#2E3650",
    text:         "#E6EAF2",
    textMuted:    "#8A93A6",
    textFaint:    "#5A6178",
    grid:         "rgba(255,255,255,0.04)",
    gridStrong:   "rgba(255,255,255,0.10)",
    emerald:      "#10B981",
    emeraldSoft:  "rgba(16,185,129,0.15)",
    rose:         "#F43F5E",
    roseSoft:     "rgba(244,63,94,0.15)",
  },
  light: {
    surface:      "#FFFFFF",
    surface2:     "#F9FAFB",
    surface3:     "#F3F4F6",
    border:       "#E5E7EB",
    borderStrong: "#D1D5DB",
    text:         "#111827",
    textMuted:    "#6B7280",
    textFaint:    "#9CA3AF",
    grid:         "rgba(0,0,0,0.05)",
    gridStrong:   "rgba(0,0,0,0.12)",
    emerald:      "#059669",
    emeraldSoft:  "rgba(5,150,105,0.12)",
    rose:         "#E11D48",
    roseSoft:     "rgba(225,29,72,0.10)",
  },
};
const MONO = "'JetBrains Mono', ui-monospace, monospace";

// SVG canvas size
const W = 1000, H = 380;
const ML = 72, MT = 24, MR = 24, MB = 48;
const PW = W - ML - MR;
const PH = H - MT - MB;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtGbp(n: number) {
  return "£" + Math.round(Math.abs(n)).toLocaleString("en-GB");
}
function fmtGbpS(n: number) {
  return (n >= 0 ? "+£" : "−£") + Math.abs(Math.round(n)).toLocaleString("en-GB");
}
function fmtDateLong(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function niceTicks(min: number, max: number, n = 5) {
  const range = max - min || 1;
  const rough = range / n;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.abs(rough) || 1)));
  const norm = rough / pow;
  const step = norm < 1.5 ? pow : norm < 3 ? 2 * pow : norm < 7 ? 5 * pow : 10 * pow;
  const tickMin = Math.floor(min / step) * step;
  const tickMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = tickMin; v <= tickMax + 1e-9; v += step) ticks.push(Math.round(v * 1e9) / 1e9);
  return { ticks, min: tickMin, max: tickMax };
}
function applyRange(flips: ChartFlip[], range: Range): ChartFlip[] {
  if (range === "All") return flips;
  const days = range === "1M" ? 30 : range === "3M" ? 90 : range === "8M" ? 240 : 365;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return flips.filter(f => new Date(f.sold) >= cutoff);
}

function tipTitle(s: string) {
  return `<div style="font-weight:600;margin-bottom:6px;white-space:normal;max-width:200px">${s}</div>`;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FlipfolioAnalytics({ entries }: { entries: FlipEntry[] }) {
  const [view, setView]   = useState<View>("profit-time");
  const [range, setRange] = useState<Range>("All");
  const [tip, setTip]     = useState<{ x: number; y: number; html: string } | null>(null);
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

  // Track theme changes from anywhere in the app
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark")),
    );
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const C = isDark ? PALETTE.dark : PALETTE.light;

  // Tooltip row — defined here so it closes over the current C
  function tipRow(label: string, value: string, color?: string) {
    return `<div style="display:flex;justify-content:space-between;gap:16px">
      <span style="color:${C.textMuted}">${label}</span>
      <span style="font-family:${MONO};font-weight:600${color ? `;color:${color}` : ""}">${value}</span>
    </div>`;
  }

  const svgRef  = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Convert entries → ChartFlip (sold only)
  const allFlips = useMemo<ChartFlip[]>(() =>
    entries
      .filter(e => e.date_sold && e.profit != null && e.sale_price != null)
      .map(e => ({
        id:       e.id,
        name:     [e.year, e.make, e.model].filter(Boolean).join(" "),
        sold:     e.date_sold!,
        purchase: e.purchase_price,
        sale:     e.sale_price!,
        costs:    e.additional_costs,
        days:     e.days_to_sell ?? 0,
        source:   e.source,
        profit:   e.profit!,
      }))
      .sort((a, b) => a.sold.localeCompare(b.sold)),
    [entries],
  );

  const flips = useMemo(() => applyRange(allFlips, range), [allFlips, range]);

  // KPIs
  const totalProfit = flips.reduce((s, f) => s + f.profit, 0);
  const avgProfit   = flips.length ? totalProfit / flips.length : 0;
  const best        = flips.length ? flips.reduce((b, f) => f.profit > b.profit ? f : b) : null;
  const avgDays     = flips.length ? flips.reduce((s, f) => s + f.days, 0) / flips.length : 0;

  const dateRange = flips.length >= 2
    ? `${flips.length} flips · ${new Date(flips[0].sold).toLocaleDateString("en-GB", { month: "short", year: "numeric" })} — ${new Date(flips[flips.length - 1].sold).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
    : flips.length === 1
      ? `1 flip · ${new Date(flips[0].sold).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
      : "No data for selected range";

  // Tooltip helpers for SVG event listeners
  function showTip(svgX: number, svgY: number, html: string) {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    setTip({ x: (svgX / W) * rect.width, y: (svgY / H) * rect.height, html });
  }
  function hideTip() { setTip(null); }

  // ── SVG drawing ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.innerHTML = "";
    setTip(null);
    if (flips.length === 0) return;

    const svgEl = svg;
    function el<K extends keyof SVGElementTagNameMap>(
      tag: K,
      attrs: Record<string, string | number> = {},
      text?: string,
    ): SVGElementTagNameMap[K] {
      const e = document.createElementNS("http://www.w3.org/2000/svg", tag) as SVGElementTagNameMap[K];
      for (const k in attrs) (e as Element).setAttribute(k, String(attrs[k]));
      if (text != null) e.textContent = text;
      svgEl.appendChild(e);
      return e;
    }

    // ── View 1: Profit over time ───────────────────────────────────────────
    if (view === "profit-time") {
      let running = 0;
      const data = flips.map(f => ({ ...f, cum: (running += f.profit) }));
      const tMin = new Date(data[0].sold).getTime();
      const tMax = new Date(data[data.length - 1].sold).getTime();
      const tSpan = tMax - tMin || 1;
      const yVals = data.map(d => d.cum).concat([0]);
      const { ticks: yTicks, min: yMin, max: yMax } = niceTicks(Math.min(...yVals), Math.max(...yVals), 5);
      const ySpan = yMax - yMin || 1;
      const xs = (t: number) => ML + ((t - tMin) / tSpan) * PW;
      const ys = (v: number) => MT + PH - ((v - yMin) / ySpan) * PH;

      // Defs: gradients + clip paths for above/below zero colouring
      const z0 = ys(0); // pixel y of the zero line
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      defs.innerHTML = `
        <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(16,185,129,0.35)"/>
          <stop offset="100%" stop-color="rgba(16,185,129,0.04)"/>
        </linearGradient>
        <linearGradient id="areaRose" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(244,63,94,0.04)"/>
          <stop offset="100%" stop-color="rgba(244,63,94,0.35)"/>
        </linearGradient>
        <clipPath id="clipAbove">
          <rect x="${ML}" y="${MT}" width="${PW}" height="${Math.max(0, z0 - MT)}"/>
        </clipPath>
        <clipPath id="clipBelow">
          <rect x="${ML}" y="${z0}" width="${PW}" height="${Math.max(0, MT + PH - z0)}"/>
        </clipPath>
      `;
      svgEl.appendChild(defs);

      // Y gridlines + labels
      yTicks.forEach(v => {
        el("line", { x1: ML, x2: ML + PW, y1: ys(v), y2: ys(v), stroke: v === 0 ? C.gridStrong : C.grid });
        el("text", { x: ML - 10, y: ys(v) + 4, "text-anchor": "end", fill: C.textFaint, "font-size": 11, "font-family": MONO }, fmtGbp(v));
      });

      // X-axis month labels — positioned at the first data point in each month
      const seen = new Set<string>();
      data.forEach(d => {
        const dt = new Date(d.sold);
        const key = `${dt.getFullYear()}-${dt.getMonth()}`;
        if (seen.has(key)) return;
        seen.add(key);
        const label = dt.toLocaleDateString("en-GB", { month: "short" }) +
          (dt.getMonth() === 0 ? " '" + String(dt.getFullYear()).slice(2) : "");
        el("text", { x: xs(new Date(d.sold).getTime()), y: MT + PH + 22, "text-anchor": "middle", fill: C.textFaint, "font-size": 11 }, label);
      });

      // Build shared paths
      const pts = data.map(d => [xs(new Date(d.sold).getTime()), ys(d.cum)] as [number, number]);
      const areaPath = `M ${pts[0][0]} ${z0} ` +
        pts.map(([x, y]) => `L ${x} ${y}`).join(" ") +
        ` L ${pts[pts.length - 1][0]} ${z0} Z`;
      const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");

      // Area: green above zero, rose below zero
      el("path", { d: areaPath, fill: "url(#areaGreen)", "clip-path": "url(#clipAbove)" });
      el("path", { d: areaPath, fill: "url(#areaRose)",  "clip-path": "url(#clipBelow)" });
      // Line: emerald above zero, rose below zero
      el("path", { d: linePath, fill: "none", stroke: C.emerald, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round", "clip-path": "url(#clipAbove)" });
      el("path", { d: linePath, fill: "none", stroke: C.rose,    "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round", "clip-path": "url(#clipBelow)" });

      // Points with hover
      data.forEach((d, i) => {
        const [cx, cy] = pts[i];
        const color = d.profit >= 0 ? C.emerald : C.rose;
        el("circle", { cx, cy, r: 4.5, fill: C.surface3, stroke: color, "stroke-width": 2 });
        const hit = el("circle", { cx, cy, r: 14, fill: "transparent", style: "cursor:pointer" });
        hit.addEventListener("mouseenter", () => showTip(cx, cy,
          tipTitle(d.name) +
          tipRow("Sold", fmtDateLong(d.sold)) +
          tipRow("Profit", fmtGbpS(d.profit), d.profit >= 0 ? C.emerald : C.rose) +
          tipRow("Running", fmtGbpS(d.cum)),
        ));
        hit.addEventListener("mouseleave", hideTip);
      });

      el("text", { x: 14, y: MT + PH / 2, transform: `rotate(-90 14 ${MT + PH / 2})`, "text-anchor": "middle", fill: C.textFaint, "font-size": 10, "letter-spacing": "0.1em" }, "CUMULATIVE PROFIT (£)");
    }

    // ── View 2: Profit per flip ────────────────────────────────────────────
    if (view === "profit-flip") {
      const yVals = flips.map(f => f.profit).concat([0]);
      const { ticks: yTicks, min: yMin, max: yMax } = niceTicks(Math.min(...yVals), Math.max(...yVals), 5);
      const ySpan = yMax - yMin || 1;
      const ys  = (v: number) => MT + PH - ((v - yMin) / ySpan) * PH;
      const n   = flips.length;
      const slot = PW / n;
      const barW = Math.max(4, Math.min(slot * 0.62, 80));

      yTicks.forEach(v => {
        el("line", { x1: ML, x2: ML + PW, y1: ys(v), y2: ys(v), stroke: v === 0 ? C.gridStrong : C.grid });
        el("text", { x: ML - 10, y: ys(v) + 4, "text-anchor": "end", fill: C.textFaint, "font-size": 11, "font-family": MONO }, fmtGbp(v));
      });

      flips.forEach((f, i) => {
        const cx  = ML + slot * (i + 0.5);
        const x   = cx - barW / 2;
        const y0  = ys(0), y1 = ys(f.profit);
        const y   = Math.min(y0, y1);
        const h   = Math.abs(y1 - y0) || 2;
        const color = f.profit >= 0 ? C.emerald : C.rose;
        const soft  = f.profit >= 0 ? C.emeraldSoft : C.roseSoft;

        el("rect", { x, y, width: barW, height: h, fill: soft, stroke: color, "stroke-width": 1.5, rx: 3 });

        const hit = el("rect", { x: x - 4, y: y - 4, width: barW + 8, height: h + 8, fill: "transparent", style: "cursor:pointer" });
        hit.addEventListener("mouseenter", () => showTip(cx, y,
          tipTitle(f.name) +
          tipRow("Sold", fmtDateLong(f.sold)) +
          tipRow("Buy", fmtGbp(f.purchase)) +
          tipRow("Sale", fmtGbp(f.sale)) +
          tipRow("Costs", fmtGbp(f.costs)) +
          tipRow("Profit", fmtGbpS(f.profit), f.profit >= 0 ? C.emerald : C.rose),
        ));
        hit.addEventListener("mouseleave", hideTip);

        // X labels (show if enough room)
        if (slot >= 48) {
          const parts = f.name.split(" ");
          el("text", { x: cx, y: MT + PH + 22, "text-anchor": "middle", fill: C.textFaint, "font-size": 10, "font-family": MONO }, `${parts[0]} ${parts[1] ?? ""}`);
          if (parts.length > 2 && slot >= 64) {
            el("text", { x: cx, y: MT + PH + 34, "text-anchor": "middle", fill: C.textFaint, "font-size": 9, opacity: 0.7 }, parts.slice(2, 4).join(" "));
          }
        }
      });

      el("text", { x: 14, y: MT + PH / 2, transform: `rotate(-90 14 ${MT + PH / 2})`, "text-anchor": "middle", fill: C.textFaint, "font-size": 10, "letter-spacing": "0.1em" }, "PROFIT (£)");
    }

    // ── View 3: Days to sell vs profit ────────────────────────────────────
    if (view === "days-profit") {
      const xMax = Math.max(...flips.map(f => f.days), 1);
      const { ticks: xTicks, max: xPad } = niceTicks(0, xMax, 5);
      const yVals = flips.map(f => f.profit).concat([0]);
      const { ticks: yTicks, min: yMin, max: yMax } = niceTicks(Math.min(...yVals), Math.max(...yVals), 5);
      const xs = (v: number) => ML + (v / xPad) * PW;
      const ys = (v: number) => MT + PH - ((v - yMin) / (yMax - yMin || 1)) * PH;
      const sMax = Math.max(...flips.map(f => f.sale), 1);
      const sMin = Math.min(...flips.map(f => f.sale));
      const radius = (v: number) => 6 + ((v - sMin) / (sMax - sMin || 1)) * 10;

      yTicks.forEach(v => {
        el("line", { x1: ML, x2: ML + PW, y1: ys(v), y2: ys(v), stroke: v === 0 ? C.gridStrong : C.grid });
        el("text", { x: ML - 10, y: ys(v) + 4, "text-anchor": "end", fill: C.textFaint, "font-size": 11, "font-family": MONO }, fmtGbp(v));
      });
      xTicks.forEach(v => {
        el("line", { x1: xs(v), x2: xs(v), y1: MT, y2: MT + PH, stroke: C.grid });
        el("text", { x: xs(v), y: MT + PH + 22, "text-anchor": "middle", fill: C.textFaint, "font-size": 11, "font-family": MONO }, `${v}d`);
      });

      el("text", { x: ML + 10, y: MT + 16, fill: C.textFaint, "font-size": 10, "letter-spacing": "0.08em" }, "SWEET SPOT — FAST & PROFITABLE");

      flips.forEach(f => {
        const cx = xs(f.days), cy = ys(f.profit);
        const r  = radius(f.sale);
        const color = f.profit >= 0 ? C.emerald : C.rose;
        const soft  = f.profit >= 0 ? C.emeraldSoft : C.roseSoft;

        el("circle", { cx, cy, r: r + 5, fill: soft });
        el("circle", { cx, cy, r, fill: color, "fill-opacity": 0.85, stroke: C.surface3, "stroke-width": 1.5 });

        const hit = el("circle", { cx, cy, r: r + 10, fill: "transparent", style: "cursor:pointer" });
        hit.addEventListener("mouseenter", () => showTip(cx, cy,
          tipTitle(f.name) +
          tipRow("Days", String(f.days)) +
          tipRow("Sale", fmtGbp(f.sale)) +
          tipRow("Profit", fmtGbpS(f.profit), f.profit >= 0 ? C.emerald : C.rose) +
          (f.source ? tipRow("Source", f.source) : ""),
        ));
        hit.addEventListener("mouseleave", hideTip);
      });

      el("text", { x: 14, y: MT + PH / 2, transform: `rotate(-90 14 ${MT + PH / 2})`, "text-anchor": "middle", fill: C.textFaint, "font-size": 10, "letter-spacing": "0.1em" }, "PROFIT (£)");
      el("text", { x: ML + PW / 2, y: H - 4, "text-anchor": "middle", fill: C.textFaint, "font-size": 10, "letter-spacing": "0.1em" }, "DAYS TO SELL");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, flips, isDark]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (allFlips.length === 0) return null;

  const VIEWS: { id: View; label: string }[] = [
    { id: "profit-time", label: "Profit over time" },
    { id: "profit-flip", label: "Profit per flip" },
    { id: "days-profit", label: "Days to sell vs profit" },
  ];
  const RANGES: Range[] = ["1M", "3M", "8M", "1Y", "All"];
  const META: Record<View, { title: string; desc: string }> = {
    "profit-time": { title: "Cumulative profit",         desc: "Running total across all closed flips, by date sold. Points coloured by individual flip outcome." },
    "profit-flip": { title: "Profit per flip",           desc: "Each bar is one car. Sorted chronologically by date sold." },
    "days-profit": { title: "Days to sell vs profit",    desc: "Top-left quadrant = fast and profitable. Bubble size scales with sale price." },
  };

  const kpis = [
    { label: "Total profit",     value: fmtGbpS(totalProfit), color: totalProfit >= 0 ? C.emerald : C.rose },
    { label: "Avg profit / car", value: fmtGbpS(avgProfit),   color: avgProfit >= 0 ? C.emerald : C.rose },
    { label: "Best flip",        value: best ? fmtGbpS(best.profit) : "—", color: C.emerald, sub: best?.name },
    { label: "Avg days to sell", value: flips.length ? avgDays.toFixed(1) + "d" : "—", color: C.text },
  ];

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 24 }}>

      {/* Header */}
      <div style={{ padding: "24px 28px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.emerald, boxShadow: `0 0 0 4px rgba(16,185,129,0.18)`, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textFaint }}>Flipfolio · Analytics</span>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "8px 0 0", letterSpacing: "-0.01em", color: C.text }}>Performance overview</h2>
          <div style={{ color: C.textMuted, fontSize: 13, marginTop: 2 }}>{dateRange}</div>
        </div>

        {/* Range toggle */}
        <div style={{ display: "inline-flex", padding: 3, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8 }}>
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: "6px 12px", border: "none", cursor: "pointer", borderRadius: 6,
              fontSize: 12, fontWeight: 600, fontFamily: "inherit",
              background: range === r ? C.surface3 : "transparent",
              color: range === r ? C.text : C.textMuted,
              boxShadow: range === r ? "0 1px 2px rgba(0,0,0,0.4)" : "none",
            }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: C.border, borderBottom: `1px solid ${C.border}` }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: C.surface, padding: "18px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textFaint }}>{k.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: k.color, fontFeatureSettings: "'tnum'" }}>{k.value}</span>
            {k.sub && <span style={{ fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.sub}</span>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "16px 28px 0", borderBottom: `1px solid ${C.border}` }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            padding: "10px 14px", border: "none", background: "transparent",
            color: view === v.id ? C.text : C.textMuted,
            fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer",
            borderBottom: `2px solid ${view === v.id ? C.text : "transparent"}`,
            marginBottom: -1,
            display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: view === v.id ? C.emerald : C.textFaint, display: "inline-block", flexShrink: 0 }} />
            {v.label}
          </button>
        ))}
      </div>

      {/* Chart area */}
      <div style={{ padding: "24px 28px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{META[view].title}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{META[view].desc}</div>
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 11, color: C.textMuted, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: C.emerald, display: "inline-block" }} /> Profit
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: C.rose, display: "inline-block" }} /> Loss
            </span>
            {view === "profit-time" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "inline-block", width: 20, height: 2, background: C.textMuted }} /> Running total
              </span>
            )}
          </div>
        </div>

        {flips.length === 0 ? (
          <div style={{ height: 380, display: "flex", alignItems: "center", justifyContent: "center", color: C.textFaint, fontSize: 13 }}>
            No sold flips in this range
          </div>
        ) : (
          <div ref={wrapRef} style={{ position: "relative", width: "100%", height: 380 }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}
            />
            {tip && (
              <div
                dangerouslySetInnerHTML={{ __html: tip.html }}
                style={{
                  position: "absolute",
                  left: tip.x,
                  top: tip.y,
                  transform: "translate(-50%, calc(-100% - 12px))",
                  background: C.surface3,
                  border: `1px solid ${C.borderStrong}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  pointerEvents: "none",
                  fontSize: 12,
                  lineHeight: 1.6,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  whiteSpace: "nowrap",
                  color: C.text,
                  zIndex: 10,
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "14px 28px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: C.textFaint, background: C.surface2 }}>
        <span>Source: Flipfolio ledger · {flips.length} sold flip{flips.length !== 1 ? "s" : ""}</span>
        <span style={{ fontFamily: MONO }}>AutoFlipr</span>
      </div>
    </div>
  );
}
