import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

export type Plan = "free" | "basic" | "pro";

export interface AuthUser {
  id: number;
  email: string;
  plan: Plan;
  is_admin: boolean;
  scan_count: number;
  scan_month: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  isLoggedIn: boolean;
  isPro: boolean;
  isAdmin: boolean;
}

const TOKEN_KEY = "cf_jwt";
const USER_KEY = "cf_user";

function loadStored(): AuthState {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    if (token && raw) return { token, user: JSON.parse(raw) };
  } catch {}
  return { token: null, user: null };
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function apiPost<T>(path: string, body: object, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

interface TokenResponse {
  access_token: string;
  plan: Plan;
  email: string;
  is_admin: boolean;
}

interface MeResponse extends AuthUser {}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadStored);

  function persist(token: string, user: AuthUser) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState({ token, user });
  }

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiPost<TokenResponse>("/api/auth/login", { email, password });
    // Fetch full user profile
    const me = await apiGet<MeResponse>("/api/auth/me", data.access_token);
    persist(data.access_token, me);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const data = await apiPost<TokenResponse>("/api/auth/register", { email, password });
    const me = await apiGet<MeResponse>("/api/auth/me", data.access_token);
    persist(data.access_token, me);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ token: null, user: null });
  }, []);

  const refreshMe = useCallback(async () => {
    if (!state.token) return;
    const me = await apiGet<MeResponse>("/api/auth/me", state.token);
    persist(state.token, me);
  }, [state.token]);

  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setState({ token: null, user: null });
    };
    window.addEventListener("cf:unauthorized", handler);
    return () => window.removeEventListener("cf:unauthorized", handler);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        refreshMe,
        isLoggedIn: !!state.token && !!state.user,
        isPro: state.user?.plan === "pro" || state.user?.is_admin === true,
        isAdmin: state.user?.is_admin === true,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

/** Scan limit for current plan */
export function scanLimit(plan: Plan): number | null {
  if (plan === "free") return 5;
  if (plan === "basic") return 50;
  return null; // pro = unlimited
}
