import { useState } from "react";
import { useSettings, type AppSettings } from "../hooks/useSettings";
import { useAuth } from "../contexts/AuthContext";
import { apiPost } from "../api/client";

type Tab = "discovery" | "costs" | "vehicle" | "billing";

const TABS: { id: Tab; label: string }[] = [
  { id: "discovery", label: "Discovery" },
  { id: "costs",     label: "Cost Assumptions" },
  { id: "vehicle",   label: "My Vehicle" },
  { id: "billing",   label: "Billing" },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 border-b border-border-faint last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {hint && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function NumInput({ value, onChange, placeholder, prefix, suffix, width = "w-28" }: {
  value: number | "";
  onChange: (v: number | "") => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  width?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      {prefix && <span className="text-sm text-text-muted">{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        placeholder={placeholder ?? "—"}
        className={`${width} input`}
      />
      {suffix && <span className="text-sm text-text-muted">{suffix}</span>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, width = "w-40" }: {
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
      className={`${width} input`}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="label-caps mb-1">{title}</p>
      <div className="card px-4">{children}</div>
    </div>
  );
}

function DiscoveryTab({ s, update }: { s: AppSettings; update: (p: Partial<AppSettings>) => void }) {
  return (
    <div>
      <Section title="Search area">
        <Field label="Home postcode" hint="Used for distance calculations">
          <TextInput value={s.homePostcode} onChange={(v) => update({ homePostcode: v.toUpperCase() })} placeholder="e.g. SW1A 1AA" width="w-36" />
        </Field>
        <Field label="Max distance" hint="Maximum miles from your postcode">
          <NumInput value={s.maxDistanceMiles} onChange={(v) => update({ maxDistanceMiles: v })} suffix="miles" placeholder="any" />
        </Field>
      </Section>
      <Section title="Deal criteria">
        <Field label="Max price" hint="Upper limit on listing price">
          <NumInput value={s.maxPrice} onChange={(v) => update({ maxPrice: v })} prefix="£" placeholder="any" />
        </Field>
        <Field label="Min profit target" hint="Minimum estimated margin to flag as a deal">
          <NumInput value={s.minProfitTarget} onChange={(v) => update({ minProfitTarget: v })} prefix="£" />
        </Field>
        <Field label="Min year">
          <NumInput value={s.minYear} onChange={(v) => update({ minYear: v })} placeholder="any" width="w-24" />
        </Field>
        <Field label="Max mileage">
          <NumInput value={s.maxMileage} onChange={(v) => update({ maxMileage: v })} suffix="mi" placeholder="any" />
        </Field>
      </Section>
    </div>
  );
}

function CostsTab({ s, update }: { s: AppSettings; update: (p: Partial<AppSettings>) => void }) {
  return (
    <div>
      <Section title="Purchase costs">
        <Field label="Repair buffer" hint="Contingency for unexpected repairs, added to cost estimate">
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border-default overflow-hidden text-sm">
              {(["percent", "fixed"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => update({ repairBufferMode: mode })}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    s.repairBufferMode === mode
                      ? "bg-text-primary text-brand-fg"
                      : "bg-surface text-text-secondary hover:bg-surface-subtle"
                  }`}
                >
                  {mode === "percent" ? "%" : "£"}
                </button>
              ))}
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
      </Section>
      <Section title="Running costs">
        <Field label="Road tax (annual)" hint="Standard VED rate used in the monthly cost breakdown">
          <NumInput value={s.roadTaxAnnual} onChange={(v) => update({ roadTaxAnnual: v === "" ? 195 : v })} prefix="£" suffix="/yr" width="w-24" />
        </Field>
        <Field label="MOT fee" hint="Max DVSA MOT fee">
          <NumInput value={s.motFee} onChange={(v) => update({ motFee: v === "" ? 54.85 : v })} prefix="£" width="w-24" />
        </Field>
      </Section>
      <Section title="Selling costs">
        <Field label="Platform fee" hint="Selling platform commission (e.g. eBay Motors, AutoTrader sell)">
          <NumInput value={s.sellingPlatformFeePct} onChange={(v) => update({ sellingPlatformFeePct: v })} suffix="%" width="w-20" />
        </Field>
      </Section>
      <div className="rounded-xl p-4" style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-info-border)" }}>
        <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-info-text)" }}>Full cost breakdown</p>
        <p className="text-xs" style={{ color: "var(--color-info-text)", opacity: 0.8 }}>
          These values power the cost breakdown in the deal detail modal (road tax, MOT, repair buffer, fuel, selling fee).
        </p>
      </div>
    </div>
  );
}

function VehicleTab({ s, update }: { s: AppSettings; update: (p: Partial<AppSettings>) => void }) {
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function doLookup() {
    const reg = s.regPlate.replace(/\s/g, "").toUpperCase();
    if (!reg) return;
    setLookupState("loading");
    try {
      const token = localStorage.getItem("cf_jwt");
      const res = await fetch(`/api/vehicle-lookup?reg=${encodeURIComponent(reg)}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
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
      <Section title="Your car">
        <Field label="Registration" hint="Used to look up MPG for running cost estimates">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={s.regPlate}
              onChange={(e) => update({ regPlate: e.target.value.toUpperCase() })}
              placeholder="e.g. AB12 CDE"
              className="w-32 bg-warning-bg border border-warning-border rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-warning-border focus:border-transparent uppercase tracking-widest"
            />
            <button
              onClick={doLookup}
              disabled={!s.regPlate || lookupState === "loading"}
              className="btn btn-primary btn-sm"
            >
              {lookupState === "loading" ? "…" : "Lookup"}
            </button>
            {lookupState === "done"  && <span className="text-xs text-success-strong font-medium">✓ Found</span>}
            {lookupState === "error" && <span className="text-xs text-danger-strong">Not found</span>}
          </div>
        </Field>
        <Field label="MPG" hint="Fuel efficiency for running cost calculations">
          <NumInput value={s.mpg} onChange={(v) => update({ mpg: v })} suffix="mpg" placeholder="e.g. 45" width="w-20" />
        </Field>
      </Section>
      <Section title="Fuel price">
        <Field label="Fuel price per litre" hint="Used to estimate fuel costs when viewing deals">
          <div className="flex items-center gap-2">
            <NumInput value={s.fuelPricePerLitre} onChange={(v) => update({ fuelPricePerLitre: v })} prefix="£" suffix="/L" placeholder="1.45" width="w-20" />
            <button
              onClick={() => update({ fuelPricePerLitre: 1.46 })}
              className="btn btn-secondary btn-sm whitespace-nowrap"
              title="UK average unleaded price (approx)"
            >
              UK avg
            </button>
          </div>
        </Field>
      </Section>
      <p className="text-xs text-text-faint text-center mt-4">Reg lookup uses the DVLA vehicle enquiry service.</p>
    </div>
  );
}

const PLAN_LABELS: Record<string, string> = { free: "Free", basic: "Basic", pro: "Pro" };

function BillingTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = user?.plan ?? "free";
  const isPaid = plan !== "free";

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost<{ url: string }>("/api/billing/portal", {
        return_url: window.location.href,
      });
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div>
      <Section title="Current plan">
        <Field label="Plan" hint={isPaid ? "Manage your subscription via the Stripe customer portal" : "Upgrade to unlock more scans and auto-discovery"}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-text-primary">{PLAN_LABELS[plan] ?? plan}</span>
            {isPaid ? (
              <button
                onClick={openPortal}
                disabled={loading}
                className="btn btn-secondary btn-sm disabled:opacity-50"
              >
                {loading ? "Opening…" : "Manage subscription"}
              </button>
            ) : (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("cf:show-pricing"))}
                className="btn btn-primary btn-sm"
              >
                Upgrade
              </button>
            )}
          </div>
        </Field>
      </Section>
      {error && (
        <div className="rounded-lg bg-danger-bg border border-danger-border px-4 py-3 text-sm text-danger-strong">
          {error}
        </div>
      )}
      <p className="text-xs text-text-faint text-center mt-4">
        Payments are handled securely by Stripe. AutoFlipr never stores your card details.
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("discovery");
  const { settings, update, reset } = useSettings();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
          <p className="text-xs text-text-muted mt-0.5">Changes are saved automatically in your browser</p>
        </div>
        <button onClick={reset} className="btn btn-secondary text-sm">Reset defaults</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-default">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-text-primary text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        {tab === "discovery" && <DiscoveryTab s={settings} update={update} />}
        {tab === "costs"     && <CostsTab     s={settings} update={update} />}
        {tab === "vehicle"   && <VehicleTab   s={settings} update={update} />}
        {tab === "billing"   && <BillingTab />}
      </div>
    </div>
  );
}
