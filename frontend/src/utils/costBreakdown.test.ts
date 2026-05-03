import { describe, it, expect } from "vitest";
import { calcCostBreakdown, type CostInputs } from "./costBreakdown";

const BASE: CostInputs = {
  priceGbp: 10_000,
  estimatedValueGbp: 12_000,
  roadTaxAnnual: 195,
  motFee: 54.85,
  repairBufferMode: "percent",
  repairBufferValue: "",
  sellingPlatformFeePct: "",
  mpg: "",
  fuelPricePerLitre: "",
};

describe("calcCostBreakdown", () => {
  it("includes road tax and MOT as baseline lines", () => {
    const result = calcCostBreakdown(BASE, 2_000);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].label).toBe("Road tax (monthly est.)");
    expect(result.lines[0].value).toBe(Math.round(195 / 12)); // £16
    expect(result.lines[1].label).toBe("MOT");
    expect(result.lines[1].value).toBe(54.85);
  });

  it("road tax monthly rounds correctly", () => {
    const result = calcCostBreakdown({ ...BASE, roadTaxAnnual: 180 }, 0);
    expect(result.lines[0].value).toBe(15); // 180/12 = 15 exactly
  });

  it("uses custom roadTaxAnnual and motFee", () => {
    const result = calcCostBreakdown({ ...BASE, roadTaxAnnual: 600, motFee: 40 }, 0);
    expect(result.lines[0].value).toBe(50); // 600/12
    expect(result.lines[1].value).toBe(40);
  });

  it("calculates percent repair buffer correctly", () => {
    const result = calcCostBreakdown(
      { ...BASE, repairBufferMode: "percent", repairBufferValue: 10 },
      5_000,
    );
    const bufferLine = result.lines.find((l) => l.label === "Repair buffer");
    expect(bufferLine).toBeDefined();
    expect(bufferLine!.value).toBe(1_000); // 10% of £10,000
  });

  it("calculates fixed repair buffer correctly", () => {
    const result = calcCostBreakdown(
      { ...BASE, repairBufferMode: "fixed", repairBufferValue: 750 },
      5_000,
    );
    const bufferLine = result.lines.find((l) => l.label === "Repair buffer");
    expect(bufferLine!.value).toBe(750);
  });

  it("omits repair buffer when value is empty", () => {
    const result = calcCostBreakdown({ ...BASE, repairBufferValue: "" }, 0);
    expect(result.lines.find((l) => l.label === "Repair buffer")).toBeUndefined();
  });

  it("calculates selling fee correctly", () => {
    const result = calcCostBreakdown({ ...BASE, sellingPlatformFeePct: 3 }, 0);
    const feeLine = result.lines.find((l) => l.label === "Selling fee");
    expect(feeLine).toBeDefined();
    expect(feeLine!.value).toBe(360); // 3% of £12,000
  });

  it("omits selling fee when estimated value is null", () => {
    const result = calcCostBreakdown(
      { ...BASE, estimatedValueGbp: null, sellingPlatformFeePct: 3 },
      0,
    );
    expect(result.lines.find((l) => l.label === "Selling fee")).toBeUndefined();
  });

  it("calculates inspection fuel correctly", () => {
    // 50 miles / 50 mpg * 4.546 L/gal * £1.50/L = 50/50 * 4.546 * 1.50 = 6.819 → rounded to 6.82
    const result = calcCostBreakdown({ ...BASE, mpg: 50, fuelPricePerLitre: 1.50 }, 0);
    const fuelLine = result.lines.find((l) => l.label === "Inspection fuel");
    expect(fuelLine).toBeDefined();
    expect(fuelLine!.value).toBeCloseTo(6.82, 2);
  });

  it("omits inspection fuel when mpg is empty", () => {
    const result = calcCostBreakdown({ ...BASE, mpg: "", fuelPricePerLitre: 1.50 }, 0);
    expect(result.lines.find((l) => l.label === "Inspection fuel")).toBeUndefined();
  });

  it("computes totalCosts as sum of all lines", () => {
    const result = calcCostBreakdown(
      { ...BASE, repairBufferValue: 500, repairBufferMode: "fixed" },
      0,
    );
    const expected = result.lines.reduce((s, l) => s + l.value, 0);
    expect(result.totalCosts).toBeCloseTo(expected, 2);
  });

  it("netProfit = grossMargin - totalCosts", () => {
    const result = calcCostBreakdown(BASE, 2_500);
    expect(result.netProfit).toBeCloseTo(2_500 - result.totalCosts, 2);
  });

  it("netProfit is negative when costs exceed margin", () => {
    const result = calcCostBreakdown(BASE, 10);
    expect(result.netProfit).toBeLessThan(0);
  });
});
