/**
 * Authenticated fetch wrapper.
 * Injects the Authorization header from sessionStorage and handles 401 redirects.
 *
 * Usage: Replace `fetch(url, init)` with `authFetch(url, init)` in all hooks/components.
 */

const AUTH_TOKEN_KEY = "qm_auth_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    clearAuthToken();
    // Avoid redirect loops if already on login page
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.location.href = "/login/";
    }
  }

  return response;
}
