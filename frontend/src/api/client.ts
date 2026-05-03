export interface Deal {
  id: number;
  source: string;
  url: string;
  make: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  mileage: number | null;
  price_gbp: number | null;
  registration: string | null;
  seller_type: string | null;
  seller_name: string | null;
  body_type: string | null;
  colour: string | null;
  urgency_tags: string[] | null;
  image_urls: string[] | null;
  score: number | null;
  estimated_value_gbp: number | null;
  estimated_margin_gbp: number | null;
  price_deviation_pct: number | null;
  comparable_count: number | null;
  confidence: string | null;
  location: string | null;
  distance_miles: number | null;
  mot_narrative: string | null;
  risk_score: number | null;
  red_flags: string[] | null;
  condition_notes: string[] | null;
  positives: string[] | null;
  analysis_narrative: string | null;
  analysis_confidence_pct: number | null;
  price_history: { price_gbp: number; recorded_at: string }[];
}

export interface DealsFilter {
  min_score?: number;
  max_price?: number;
  max_mileage?: number;
  min_margin?: number;
  make?: string;
  model?: string;
  seller_type?: string;
  year_from?: number;
  year_to?: number;
  limit?: number;
  offset?: number;
  sort_by?: string;
  profitable_only?: boolean;
  source?: string;
  home_postcode?: string;
  max_distance_miles?: number;
}

function getAuthHeader(): string {
  const token = localStorage.getItem("cf_jwt");
  if (token) return `Bearer ${token}`;
  return "";
}

function handleUnauthorized() {
  // Fire a global event; AuthProvider listens and calls logout() to clear both
  // localStorage and React state, letting RequireAuth redirect to /login cleanly.
  window.dispatchEvent(new Event("cf:unauthorized"));
}

const REQUEST_TIMEOUT_MS = 15_000;

function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

export async function apiFetch<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetchWithTimeout(url.toString(), {
    headers: { Authorization: getAuthHeader() },
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error("Unauthorized"); }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export interface ListingSummary {
  id: number;
  source: string;
  url: string;
  make: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  mileage: number | null;
  price_gbp: number | null;
  registration: string | null;
  seller_type: string | null;
  seller_name: string | null;
  body_type: string | null;
  colour: string | null;
  image_urls: string[] | null;
  llm_status: string;
  first_seen_at: string | null;
}

export interface PipelineStats {
  total: number;
  pending: number;
  valid: number;
  invalid: number;
}

export interface ScrapeRunSummary {
  id: number;
  source: string | null;
  started_at: string | null;
  completed_at: string | null;
  listings_found: number | null;
  listings_new: number | null;
  status: string | null;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(path, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error("Unauthorized"); }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(path, {
    method: "PATCH",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error("Unauthorized"); }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(path, {
    method: "PUT",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error("Unauthorized"); }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetchWithTimeout(path, {
    method: "DELETE",
    headers: { Authorization: getAuthHeader() },
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error("Unauthorized"); }
  if (!res.ok) throw new Error(`API error ${res.status}`);
}

export interface FlipEntry {
  id: number;
  make: string;
  model: string;
  year: number | null;
  mileage: number | null;
  purchase_price: number;
  sale_price: number | null;
  additional_costs: number;
  total_cost: number;
  profit: number | null;
  date_bought: string;
  date_sold: string | null;
  days_to_sell: number | null;
  source: string | null;
  notes: string | null;
}

export interface FlipIn {
  make: string;
  model: string;
  year: number | null;
  mileage: number | null;
  purchase_price: number;
  sale_price: number | null;
  additional_costs: number;
  date_bought: string;
  date_sold: string | null;
  source: string | null;
  notes: string | null;
}

export const api = {
  deals: (filter: DealsFilter) =>
    apiFetch<Deal[]>("/api/deals", filter as Record<string, string | number | boolean | undefined>),
  dealsByIds: (ids: number[]) =>
    apiFetch<Deal[]>("/api/deals/by-ids", { ids: ids.join(",") }),
  listings: (params?: { llm_status?: string; limit?: number; offset?: number }) =>
    apiFetch<ListingSummary[]>("/api/listings", params as Record<string, string | number | undefined>),
  pipelineStats: () =>
    apiFetch<PipelineStats>("/api/listings/pipeline/stats"),
  scrapeRuns: (limit = 20) =>
    apiFetch<ScrapeRunSummary[]>("/api/listings/scrape-runs/recent", { limit }),
  reportListing: (listingId: number, reportType: "scam" | "finance" | "duplicate" | "other", notes?: string) =>
    apiPost<{ id: number }>(`/api/listings/${listingId}/report`, { report_type: reportType, notes }),
};
