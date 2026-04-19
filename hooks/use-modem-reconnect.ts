"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";

const CGI_ENDPOINT = "/cgi-bin/quecmanager/at_cmd/send_command.sh";

export type ReconnectStep = "disconnecting" | "reconnecting";

interface AtCommandResponse {
  success: boolean;
  error?: string;
  detail?: string;
  response?: string;
}

interface ReconnectOptions {
  onStep?: (step: ReconnectStep) => void;
}

export interface ReconnectResult {
  success: boolean;
  error?: string;
}

export interface UseModemReconnectReturn {
  isReconnecting: boolean;
  step: ReconnectStep | null;
  error: string | null;
  reconnectModem: (options?: ReconnectOptions) => Promise<ReconnectResult>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useModemReconnect(): UseModemReconnectReturn {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [step, setStep] = useState<ReconnectStep | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sendAtCommand = useCallback(async (command: string): Promise<void> => {
    const resp = await authFetch(CGI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }

    const json: AtCommandResponse = await resp.json();
    if (!json.success) {
      throw new Error(json.detail || json.error || `Failed AT command: ${command}`);
    }
  }, []);

  const reconnectModem = useCallback(
    async (options?: ReconnectOptions): Promise<ReconnectResult> => {
      if (isReconnecting) {
        return { success: false, error: "Reconnect already in progress" };
      }

      if (mountedRef.current) {
        setError(null);
        setIsReconnecting(true);
      }

      let disconnected = false;
      const notifyStep = (nextStep: ReconnectStep) => {
        if (mountedRef.current) {
          setStep(nextStep);
        }
        options?.onStep?.(nextStep);
      };

      try {
        notifyStep("disconnecting");
        await sendAtCommand("AT+COPS=2");
        disconnected = true;

        await sleep(3000);

        notifyStep("reconnecting");
        await sendAtCommand("AT+COPS=0");

        return { success: true };
      } catch (err) {
        let message =
          err instanceof Error ? err.message : "Failed to reconnect modem";

        if (disconnected) {
          try {
            notifyStep("reconnecting");
            await sendAtCommand("AT+COPS=0");
          } catch (recoverErr) {
            const recoverMessage =
              recoverErr instanceof Error
                ? recoverErr.message
                : "Failed to restore network registration";
            message = `${message}. Recovery failed: ${recoverMessage}`;
          }
        }

        if (mountedRef.current) {
          setError(message);
        }

        return { success: false, error: message };
      } finally {
        if (mountedRef.current) {
          setIsReconnecting(false);
          setStep(null);
        }
      }
    },
    [isReconnecting, sendAtCommand],
  );

  return {
    isReconnecting,
    step,
    error,
    reconnectModem,
  };
}
