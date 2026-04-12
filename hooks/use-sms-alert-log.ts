"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";

// =============================================================================
// useSmsAlertLog — Fetch Hook for SMS Alert Log Entries
// =============================================================================
// Fetches SMS alert log entries on mount.
// Supports manual refresh and silent re-fetch (e.g. after sending a test SMS).
//
// Backend: GET /cgi-bin/quecmanager/monitoring/sms_alert_log.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/monitoring/sms_alert_log.sh";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SmsLogEntry {
  timestamp: string;
  trigger: string;
  status: "sent" | "failed";
  recipient: string;
}

interface SmsLogResponse {
  success: boolean;
  entries: SmsLogEntry[];
  total: number;
  error?: string;
}

export interface UseSmsAlertLogReturn {
  entries: SmsLogEntry[];
  total: number;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastFetched: Date | null;
  refresh: () => void;
  silentRefresh: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useSmsAlertLog(): UseSmsAlertLogReturn {
  const [entries, setEntries] = useState<SmsLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const fetchLog = useCallback(
    async (mode: "initial" | "refresh" | "silent" = "initial") => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (mode === "initial") setIsLoading(true);
      if (mode === "refresh") setIsRefreshing(true);
      setError(null);

      try {
        const resp = await authFetch(CGI_ENDPOINT, {
          signal: controller.signal,
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data: SmsLogResponse = await resp.json();
        if (controller.signal.aborted) return;

        if (data.success) {
          setEntries(data.entries);
          setTotal(data.total);
          setLastFetched(new Date());
        } else {
          const msg = data.error || "Failed to load SMS log";
          setError(msg);
          if (mode !== "silent") toast.error(msg);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg =
          err instanceof Error ? err.message : "Failed to load SMS alert log";
        setError(msg);
        if (mode !== "silent") toast.error(msg);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [],
  );

  // Fetch on mount
  useEffect(() => {
    fetchLog("initial");
  }, [fetchLog]);

  return {
    entries,
    total,
    isLoading,
    isRefreshing,
    error,
    lastFetched,
    refresh: useCallback(() => fetchLog("refresh"), [fetchLog]),
    silentRefresh: useCallback(() => fetchLog("silent"), [fetchLog]),
  };
}
