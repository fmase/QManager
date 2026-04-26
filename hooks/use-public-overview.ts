"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PublicOverview } from "@/types/public-overview";

// =============================================================================
// usePublicOverview — Polling hook for the unauthenticated overview card.
// =============================================================================
// Mirrors useModemStatus' shape and lifecycle but uses plain `fetch` (NOT
// authFetch). The endpoint is unauthenticated by design; sending a session
// cookie would be harmless but pointless.
// =============================================================================

const FETCH_ENDPOINT = "/cgi-bin/quecmanager/public/overview.sh";
const POLL_INTERVAL = 2000;
const STALE_THRESHOLD_SECONDS = 10;

export interface UsePublicOverviewReturn {
  data: PublicOverview | null;
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePublicOverview(): UsePublicOverviewReturn {
  const [data, setData] = useState<PublicOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(FETCH_ENDPOINT, {
        cache: "no-store",
        credentials: "omit",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const json = (await response.json()) as PublicOverview;
      if (!mountedRef.current) return;

      setData(json);
      setError(null);

      if (json.state === "ok") {
        const now = Math.floor(Date.now() / 1000);
        const age = now - json.timestamp;
        setIsStale(age > STALE_THRESHOLD_SECONDS);
      } else {
        // Non-ok states (setup_required / unavailable) are explicit backend
        // states, not stale data — the empty-state UI handles them.
        setIsStale(false);
      }
      setIsLoading(false);
    } catch (err) {
      if (!mountedRef.current) return;
      const message =
        err instanceof Error ? err.message : "Failed to fetch overview";
      setError(message);
      setIsStale(true);
      setIsLoading(false);
      // Retain prior `data` — never blank a working card on a transient error.
    }
  }, []);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    intervalRef.current = setInterval(fetchData, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchData]);

  return { data, isLoading, isStale, error, refresh };
}
