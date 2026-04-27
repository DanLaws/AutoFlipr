import { useState } from "react";
import { useSettings, AppSettings } from "../hooks/useSettings";

type Tab = "discovery" | "costs" | "vehicle";

const TABS: { id: Tab; label: string }[] = [
  { id: "discovery", label: "Discovery" },
  { id: "costs", label: "Cost Assumptions" },
  { id: "vehicle", label: "My Vehicle" },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 border-b border-gray-100 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
  width = "w-28",
}: {
  value: number | "";
  onChange: (v: number | "") => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  width?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      {prefix && <span className="text-sm text-gray-500">{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        placeholder={placeholder ?? "—"}
        className={`${width} bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent`}
      />
      {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  width = "w-40",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "—"}
      className={`${width} bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent`}
    />
  );
}

function DiscoveryTab({
  s,
  update,
}: {
  s: AppSettings;
  update: (p: Partial<AppSettings>) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
        Search area
      </p>
      <div className="bg-white border border-gray-200 rounded-xl px-4 mb-6">
        <Field label="Home postcode" hint="Used for distance calculations (distance filter coming soon)">
          <TextInput
            value={s.homePostcode}
            onChange={(v) => update({ homePostcode: v.toUpperCase() })}
            placeholder="e.g. SW1A 1AA"
            width="w-36"
          />
        </Field>
        <Field label="Max distance" hint="Maximum miles from your postcode">
          <NumInput
            value={s.maxDistanceMiles}
            onChange={(v) => update({ maxDistanceMiles: v })}
            suffix="miles"
            placeholder="any"
          />
        </Field>
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
        Deal criteria
      </p>
      <div className="bg-white border border-gray-200 rounded-xl px-4">
        <Field label="Max price" hint="Upper limit on listing price">
          <NumInput
            value={s.maxPrice}
            onChange={(v) => update({ maxPrice: v })}
            prefix="£"
            placeholder="any"
          />
        </Field>
        <Field label="Min profit target" hint="Minimum estimated margin to flag as a deal">
          <NumInput
            value={s.minProfitTarget}
            onChange={(v) => update({ minProfitTarget: v })}
            prefix="£"
          />
        </Field>
        <Field label="Min year">
          <NumInput
            value={s.minYear}
            onChange={(v) => update({ minYear: v })}
            placeholder="any"
            width="w-24"
          />
        </Field>
        <Field label="Max mileage">
          <NumInput
            value={s.maxMileage}
            onChange={(v) => update({ maxMileage: v })}
            suffix="mi"
            placeholder="any"
          />
        </Field>
      </div>
    </div>
  );
}

function CostsTab({
  s,
  update,
}: {
  s: AppSettings;
  update: (p: Partial<AppSettings>) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
        Purchase costs
      </p>
      <div className="bg-white border border-gray-200 rounded-xl px-4 mb-6">
        <Field
          label="Repair buffer"
          hint="Contingency for unexpected repairs, added to cost estimate"
        >
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              <button
                onClick={() => update({ repairBufferMode: "percent" })}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  s.repairBufferMode === "percent"
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                %
              </button>
              <button
                onClick={() => update({ repairBufferMode: "fixed" })}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  s.repairBufferMode === "fixed"
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                £
              </button>
            </div>
            <NumInput
              value={s.repairBufferValue}
              onChange={(v) => update({ repairBufferValue: v })}
              prefix={s.repairBufferMode === "fixed" ? "£" : undefined}
              suffix={s.repairBufferMode === "percent" ? "%" : undefined}
              width="w-20"
            />
          </div>
        </Field>
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
        Selling costs
      </p>
      <div className="bg-white border border-gray-200 rounded-xl px-4">
        <Field
          label="Platform fee"
          hint="Selling platform commission (e.g. eBay Motors, AutoTrader sell)"
        >
          <NumInput
            value={s.sellingPlatformFeePct}
            onChange={(v) => update({ sellingPlatformFeePct: v })}
            suffix="%"
            width="w-20"
          />
        </Field>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-blue-700 mb-1">Full cost breakdown</p>
        <p className="text-xs text-blue-600">
          These values will power the cost breakdown section in the deal detail modal (road tax,
          MOT, repair buffer, fuel, insurance, selling fee). Coming soon.
        </p>
      </div>
    </div>
  );
}

function VehicleTab({
  s,
  update,
}: {
  s: AppSettings;
  update: (p: Partial<AppSettings>) => void;
}) {
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function doLookup() {
    const reg = s.regPlate.replace(/\s/g, "").toUpperCase();
    if (!reg) return;
    setLookupState("loading");
    try {
      const res = await fetch(`/api/vehicle-lookup?reg=${encodeURIComponent(reg)}`, {
        headers: {
          Authorization:
            "Basic " +
            btoa(
              `${import.meta.env.VITE_AUTH_USER ?? "admin"}:${
                import.meta.env.VITE_AUTH_PASS ?? "changeme"
              }`
            ),
        },
      });
      if (!res.ok) throw new Error("lookup failed");
      const data = await res.json();
      if (data.mpg) update({ mpg: data.mpg });
      setLookupState("done");
    } catch {
      setLookupState("error");
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
        Your car
      </p>
      <div className="bg-white border border-gray-200 rounded-xl px-4 mb-6">
        <Field label="Registration" hint="Used to look up MPG for running cost estimates">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={s.regPlate}
              onChange={(e) =>
                update({ regPlate: e.target.value.toUpperCase() })
              }
              placeholder="e.g. AB12 CDE"
              className="w-32 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent uppercase tracking-widest"
            />
            <button
              onClick={doLookup}
              disabled={!s.regPlate || lookupState === "loading"}
              className="px-3 py-1.5 text-sm font-medium bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white rounded-lg transition-colors"
            >
              {lookupState === "loading" ? "…" : "Lookup"}
            </button>
            {lookupState === "done" && (
              <span className="text-xs text-emerald-600 font-medium">✓ Found</span>
            )}
            {lookupState === "error" && (
              <span className="text-xs text-red-500">Not found</span>
            )}
          </div>
        </Field>
        <Field label="MPG" hint="Fuel efficiency for running cost calculations">
          <NumInput
            value={s.mpg}
            onChange={(v) => update({ mpg: v })}
            suffix="mpg"
            placeholder="e.g. 45"
            width="w-20"
          />
        </Field>
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
        Fuel price
      </p>
      <div className="bg-white border border-gray-200 rounded-xl px-4">
        <Field label="Fuel price per litre" hint="Used to estimate fuel costs when viewing deals">
          <div className="flex items-center gap-2">
            <NumInput
              value={s.fuelPricePerLitre}
              onChange={(v) => update({ fuelPricePerLitre: v })}
              prefix="£"
              suffix="/L"
              placeholder="1.45"
              width="w-20"
            />
            <button
              onClick={() => update({ fuelPricePerLitre: 1.46 })}
              className="px-3 py-1.5 text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 rounded-lg transition-colors whitespace-nowrap"
              title="UK average unleaded price (approx)"
            >
              UK avg
            </button>
          </div>
        </Field>
      </div>

      <div className="mt-4 text-xs text-gray-400 text-center">
        Reg lookup uses the DVLA vehicle enquiry service.
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("discovery");
  const { settings, update, reset } = useSettings();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-xs text-gray-400 mt-0.5">Saved locally in your browser</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium border border-gray-200 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset defaults
          </button>
          <button
            onClick={handleSave}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              saved
                ? "bg-emerald-600 text-white"
                : "bg-gray-900 hover:bg-gray-700 text-white"
            }`}
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        {tab === "discovery" && <DiscoveryTab s={settings} update={update} />}
        {tab === "costs" && <CostsTab s={settings} update={update} />}
        {tab === "vehicle" && <VehicleTab s={settings} update={update} />}
      </div>
    </div>
  );
}
