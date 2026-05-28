"use client";

import { useEffect, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { isRebooting } from "@/lib/reboot";
import {
  evaluateConnection,
  reportConnectionState,
  INITIAL_CONNECTION_STATE,
  type ConnectionState,
} from "@/lib/reboot/connection";

const CHECK_ENDPOINT = "/cgi-bin/quecmanager/auth/check.sh";

/** How often to ping check.sh while the dashboard is open (ms) */
const POLL_INTERVAL_MS = 10_000;

function clearSessionCookie() {
  document.cookie = "qm_logged_in=; Path=/; Max-Age=0";
}

/**
 * Polls auth/check.sh every POLL_INTERVAL_MS while the dashboard is mounted.
 *
 * - 401 response        → authFetch already redirects to /login/ (session gone)
 * - Network failure      → counts toward the offline threshold
 *     - at WARN_AT fails  → shows the "reconnecting" banner
 *     - at FAILURE_THRESHOLD fails → redirect:
 *         * if a reboot we initiated is in flight → /reboot/ countdown
 *         * otherwise (unexplained silence)       → /login/?reason=offline
 * - Successful response  → resets the counter and hides the banner
 *
 * Unexpected reboots normally resolve earlier via the 401 path once the device
 * returns; the threshold is the backstop for "device never comes back".
 */
export function useAutoLogout() {
  const stateRef = useRef<ConnectionState>(INITIAL_CONNECTION_STATE);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      let pollSucceeded = false;
      try {
        // authFetch handles 401 → redirect internally
        await authFetch(CHECK_ENDPOINT);
        pollSucceeded = true;
      } catch {
        pollSucceeded = false;
      }
      if (cancelled) return;

      const { state, showBanner, action } = evaluateConnection(
        stateRef.current,
        pollSucceeded
      );
      stateRef.current = state;
      reportConnectionState(showBanner);

      if (action === "redirect") {
        if (isRebooting()) {
          window.location.href = "/reboot/";
        } else {
          clearSessionCookie();
          window.location.href = "/login/?reason=offline";
        }
      }
    };

    const id = setInterval(() => {
      if (!cancelled) void tick();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
}
