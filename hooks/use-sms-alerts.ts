"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";

// =============================================================================
// useSmsAlerts — Fetch & Save Hook for SMS Alert Settings
// =============================================================================
// Fetches current SMS alert configuration on mount.
// Provides saveSettings for persisting changes and sendTestSms for testing.
//
// Backend: GET/POST /cgi-bin/quecmanager/monitoring/sms_alerts.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/monitoring/sms_alerts.sh";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SmsAlertsSettings {
  enabled: boolean;
  recipient_phone: string;
  threshold_minutes: number;
}

export interface SmsAlertsSavePayload {
  action: "save_settings";
  enabled: boolean;
  recipient_phone: string;
  threshold_minutes: number;
}

export interface UseSmsAlertsReturn {
  settings: SmsAlertsSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  isSendingTest: boolean;
  error: string | null;
  saveSettings: (payload: SmsAlertsSavePayload) => Promise<boolean>;
  sendTestSms: () => Promise<boolean>;
  refresh: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useSmsAlerts(): UseSmsAlertsReturn {
  const { t } = useTranslation("errors");
  const [settings, setSettings] = useState<SmsAlertsSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch current settings
  // ---------------------------------------------------------------------------
  const fetchSettings = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();
      if (!mountedRef.current) return;

      if (!json.success) {
        setError(resolveErrorMessage(t, json.error, undefined, "Failed to fetch SMS alert settings"));
        return;
      }

      setSettings(json.settings);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch SMS alert settings",
      );
    } finally {
      if (mountedRef.current && !silent) {
        setIsLoading(false);
      }
    }
  }, [t]);

  // Fetch on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ---------------------------------------------------------------------------
  // Save settings
  // ---------------------------------------------------------------------------
  const saveSettings = useCallback(
    async (payload: SmsAlertsSavePayload): Promise<boolean> => {
      setError(null);
      setIsSaving(true);

      try {
        const resp = await authFetch(CGI_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const json = await resp.json();
        if (!mountedRef.current) return false;

        if (!json.success) {
          setError(resolveErrorMessage(t, json.error, json.detail, "Failed to save settings"));
          return false;
        }

        await fetchSettings(true);
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(
          err instanceof Error ? err.message : "Failed to save settings",
        );
        return false;
      } finally {
        if (mountedRef.current) {
          setIsSaving(false);
        }
      }
    },
    [fetchSettings, t],
  );

  // ---------------------------------------------------------------------------
  // Send test SMS
  // ---------------------------------------------------------------------------
  const sendTestSms = useCallback(async (): Promise<boolean> => {
    setError(null);
    setIsSendingTest(true);

    try {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_test" }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();
      if (!mountedRef.current) return false;

      if (!json.success) {
        setError(resolveErrorMessage(t, json.error, json.detail, "Failed to send test SMS"));
        return false;
      }
      return true;
    } catch (err) {
      if (!mountedRef.current) return false;
      setError(
        err instanceof Error ? err.message : "Failed to send test SMS",
      );
      return false;
    } finally {
      if (mountedRef.current) {
        setIsSendingTest(false);
      }
    }
  }, [t]);

  return {
    settings,
    isLoading,
    isSaving,
    isSendingTest,
    error,
    saveSettings,
    sendTestSms,
    refresh: fetchSettings,
  };
}
