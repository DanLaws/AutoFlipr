const INSPECTION_MILES = 50;
const LITRES_PER_GAL = 4.546;

export interface CostInputs {
  priceGbp: number;
  estimatedValueGbp: number | null;
  roadTaxAnnual: number;
  motFee: number;
  repairBufferMode: "percent" | "fixed";
  repairBufferValue: number | "";
  sellingPlatformFeePct: number | "";
  mpg: number | "";
  fuelPricePerLitre: number | "";
}

export interface CostLine {
  label: string;
  value: number;
  note?: string;
}

export interface CostBreakdown {
  lines: CostLine[];
  totalCosts: number;
  grossMargin: number;
  netProfit: number;
}

export function calcCostBreakdown(
  inputs: CostInputs,
  grossMargin: number,
): CostBreakdown {
  const roadTaxMonthly = Math.round(inputs.roadTaxAnnual / 12);

  const repairBuffer =
    inputs.repairBufferValue !== ""
      ? inputs.repairBufferMode === "percent"
        ? Math.round((inputs.priceGbp * Number(inputs.repairBufferValue)) / 100)
        : Number(inputs.repairBufferValue)
      : null;

  const sellingFee =
    inputs.sellingPlatformFeePct !== "" && inputs.estimatedValueGbp != null
      ? Math.round((inputs.estimatedValueGbp * Number(inputs.sellingPlatformFeePct)) / 100)
      : null;

  const inspectionFuel =
    inputs.mpg !== "" && inputs.fuelPricePerLitre !== ""
      ? Math.round(
          ((INSPECTION_MILES / Number(inputs.mpg)) *
            LITRES_PER_GAL *
            Number(inputs.fuelPricePerLitre)) *
            100,
        ) / 100
      : null;

  const lines: CostLine[] = [
    { label: "Road tax (monthly est.)", value: roadTaxMonthly, note: `£${inputs.roadTaxAnnual}/yr` },
    { label: "MOT", value: inputs.motFee, note: "Max DVSA fee" },
  ];
  if (repairBuffer != null)
    lines.push({
      label: "Repair buffer",
      value: repairBuffer,
      note: inputs.repairBufferMode === "percent" ? `${inputs.repairBufferValue}% of price` : "Fixed",
    });
  if (inspectionFuel != null)
    lines.push({
      label: "Inspection fuel",
      value: inspectionFuel,
      note: `${INSPECTION_MILES} mi @ ${inputs.mpg} mpg`,
    });
  if (sellingFee != null)
    lines.push({
      label: "Selling fee",
      value: sellingFee,
      note: `${inputs.sellingPlatformFeePct}% of est. value`,
    });

  const totalCosts = lines.reduce((sum, l) => sum + l.value, 0);
  const netProfit = grossMargin - totalCosts;

  return { lines, totalCosts, grossMargin, netProfit };
}
