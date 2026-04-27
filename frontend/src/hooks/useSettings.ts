import { useState, useCallback } from "react";

export interface AppSettings {
  // Discovery
  homePostcode: string;
  maxDistanceMiles: number | "";
  maxPrice: number | "";
  minProfitTarget: number | "";
  minYear: number | "";
  maxMileage: number | "";

  // Cost assumptions
  repairBufferMode: "percent" | "fixed";
  repairBufferValue: number | "";
  sellingPlatformFeePct: number | "";

  // My Vehicle
  regPlate: string;
  mpg: number | "";
  fuelPricePerLitre: number | "";
}

const DEFAULTS: AppSettings = {
  homePostcode: "",
  maxDistanceMiles: "",
  maxPrice: "",
  minProfitTarget: 500,
  minYear: "",
  maxMileage: "",
  repairBufferMode: "percent",
  repairBufferValue: 10,
  sellingPlatformFeePct: 3,
  regPlate: "",
  mpg: "",
  fuelPricePerLitre: "",
};

function load(): AppSettings {
  try {
    const raw = localStorage.getItem("cf_settings");
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(load);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("cf_settings", JSON.stringify(next));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem("cf_settings");
    setSettings(DEFAULTS);
  }, []);

  return { settings, update, reset };
}
