import { getAdminBasic } from "../pages/AdminLogin";

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

/**
 * Returns the Authorization header value.
 *
 * Priority:
 *  1. Admin Basic creds (stored in sessionStorage after admin login)
 *  2. JWT token (stored in localStorage after user login)
 *  3. Fallback env-based Basic (dev only)
 */
function getAuthHeader(): string {
  // Admin route: use Basic creds from session
  const adminBasic = getAdminBasic();
  if (adminBasic) return adminBasic;

  // User route: use JWT
  const token = localStorage.getItem("cf_jwt");
  if (token) return `Bearer ${token}`;

  // Dev fallback
  const user = import.meta.env.VITE_AUTH_USER ?? "admin";
  const pass = import.meta.env.VITE_AUTH_PASS ?? "changeme";
  return "Basic " + btoa(`${user}:${pass}`);
}

async function apiFetch<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: getAuthHeader() },
  });
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

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const api = {
  deals: (filter: DealsFilter) =>
    apiFetch<Deal[]>("/api/deals", filter as Record<string, string | number | boolean | undefined>),
  listings: (params?: { llm_status?: string; limit?: number; offset?: number }) =>
    apiFetch<ListingSummary[]>("/api/listings", params as Record<string, string | number | undefined>),
  pipelineStats: () =>
    apiFetch<PipelineStats>("/api/listings/pipeline/stats"),
  reportListing: (listingId: number, reportType: "scam" | "spam" | "duplicate" | "other", notes?: string) =>
    apiPost<{ id: number }>(`/api/listings/${listingId}/report`, { report_type: reportType, notes }),
};
