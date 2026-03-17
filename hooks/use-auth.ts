"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getAuthToken,
  setAuthToken,
  clearAuthToken,
} from "@/lib/auth-fetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "setup_required";

export interface AuthContextValue {
  status: AuthStatus;
  login: (password: string) => Promise<{ success: boolean; error?: string; retry_after?: number }>;
  setup: (password: string, confirm: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (current: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider implementation (exported for auth-provider.tsx)
// ---------------------------------------------------------------------------

const CHECK_ENDPOINT = "/cgi-bin/quecmanager/auth/check.sh";
const LOGIN_ENDPOINT = "/cgi-bin/quecmanager/auth/login.sh";
const LOGOUT_ENDPOINT = "/cgi-bin/quecmanager/auth/logout.sh";
const PASSWORD_ENDPOINT = "/cgi-bin/quecmanager/auth/password.sh";

export function useAuthProvider() {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const mountedRef = useRef(true);

  // Check session on mount
  useEffect(() => {
    mountedRef.current = true;

    const checkAuth = async () => {
      try {
        const token = getAuthToken();
        const headers: HeadersInit = token
          ? { Authorization: `Bearer ${token}` }
          : {};

        const resp = await fetch(CHECK_ENDPOINT, { headers });
        const data = await resp.json();

        if (!mountedRef.current) return;

        if (data.setup_required) {
          setStatus("setup_required");
        } else if (data.authenticated) {
          setStatus("authenticated");
        } else {
          clearAuthToken();
          setStatus("unauthenticated");
        }
      } catch {
        if (!mountedRef.current) return;
        // Network error — assume unauthenticated
        clearAuthToken();
        setStatus("unauthenticated");
      }
    };

    checkAuth();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const login = useCallback(
    async (
      password: string
    ): Promise<{ success: boolean; error?: string; retry_after?: number }> => {
      try {
        const resp = await fetch(LOGIN_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await resp.json();

        if (data.success && data.token) {
          setAuthToken(data.token);
          setStatus("authenticated");
          return { success: true };
        }

        if (data.error === "setup_required") {
          setStatus("setup_required");
          return { success: false, error: "setup_required" };
        }

        return {
          success: false,
          error: data.detail || data.error || "Invalid password",
          retry_after: data.retry_after,
        };
      } catch {
        return { success: false, error: "Connection failed" };
      }
    },
    []
  );

  const setup = useCallback(
    async (
      password: string,
      confirm: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const resp = await fetch(LOGIN_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, confirm }),
        });
        const data = await resp.json();

        if (data.success && data.token) {
          setAuthToken(data.token);
          setStatus("authenticated");
          return { success: true };
        }

        return {
          success: false,
          error: data.detail || data.error || "Setup failed",
        };
      } catch {
        return { success: false, error: "Connection failed" };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (token) {
        await fetch(LOGOUT_ENDPOINT, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      clearAuthToken();
      setStatus("unauthenticated");
    }
  }, []);

  const changePassword = useCallback(
    async (
      current: string,
      newPassword: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const token = getAuthToken();
        const resp = await fetch(PASSWORD_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            current_password: current,
            new_password: newPassword,
          }),
        });
        const data = await resp.json();

        if (data.success) {
          // Session invalidated by backend — force re-login
          clearAuthToken();
          setStatus("unauthenticated");
          return { success: true };
        }

        return {
          success: false,
          error: data.detail || data.error || "Password change failed",
        };
      } catch {
        return { success: false, error: "Connection failed" };
      }
    },
    []
  );

  return { status, login, setup, logout, changePassword, AuthContext };
}

export { AuthContext };
