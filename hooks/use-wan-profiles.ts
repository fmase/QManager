"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { authFetch } from "@/lib/auth-fetch";
import type {
  WanProfile,
  WanProfilesResponse,
  WanProfileSaveRequest,
  WanProfileSaveResponse,
  WanProfileToggleRequest,
} from "@/types/wan-profiles";

// =============================================================================
// useWanProfiles — APN (WAN) Profile Management Hook (AT-only)
// =============================================================================
// Fetches the modem's data APN profiles on mount. The backend persists profiles
// to a config file and detects the live WAN-bearing CID each request, so the
// hook also exposes `activeCid` / `internetCid`. Provides saveProfile and
// toggleProfile for configuration changes via POST.
//
// Backend endpoint:
//   GET/POST /cgi-bin/quecmanager/cellular/apn.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/cellular/apn.sh";

// A save runs an AT+COPS detach/attach cycle so the new APN is negotiated at
// re-attach. AT+COPS=0 returns OK before the attach fully completes, so the
// fresh active_cid/enabled state isn't readable immediately — a short delayed
// silent refresh reconciles the optimistic patch against reality.
const RECONCILE_DELAY_MS = 1500;

export interface UseWanProfilesReturn {
  /** All data APN profiles (null before first fetch) */
  profiles: WanProfile[] | null;
  /** Maximum number of profile slots (typically 6) */
  maxProfiles: number;
  /** The live WAN-bearing CID, or null before first fetch */
  activeCid: number | null;
  /** The CID the ISP uses for data (== activeCid), or null before first fetch */
  internetCid: number | null;
  /** True while initial fetch is in progress */
  isLoading: boolean;
  /** True while a save/toggle operation is in progress */
  isSaving: boolean;
  /** Error message if fetch or save failed */
  error: string | null;
  /** Save a profile's configuration to the chosen CID. Returns true on success. */
  saveProfile: (index: number, request: WanProfileSaveRequest) => Promise<boolean>;
  /** Toggle a profile's enabled state. Returns true on success. */
  toggleProfile: (index: number, enabled: boolean) => Promise<boolean>;
  /** Re-fetch all APN profiles */
  refresh: () => void;
}

export function useWanProfiles(): UseWanProfilesReturn {
  const [profiles, setProfiles] = useState<WanProfile[] | null>(null);
  const [maxProfiles, setMaxProfiles] = useState(6);
  const [activeCid, setActiveCid] = useState<number | null>(null);
  const [internetCid, setInternetCid] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch APN profiles
  // ---------------------------------------------------------------------------
  const fetchProfiles = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: WanProfilesResponse = await resp.json();
      if (!mountedRef.current) return;

      if (!data.success) {
        setError(data.error || "Failed to fetch APN profiles");
        return;
      }

      setProfiles(data.profiles);
      setMaxProfiles(data.max_profiles);
      setActiveCid(typeof data.active_cid === "number" ? data.active_cid : null);
      setInternetCid(
        typeof data.internet_cid === "number" ? data.internet_cid : null
      );
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error ? err.message : "Failed to fetch APN profiles"
      );
    } finally {
      if (mountedRef.current && !silent) {
        setIsLoading(false);
      }
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // ---------------------------------------------------------------------------
  // Merge a partial update into the matching profile slot. Returns immediately;
  // a delayed silent refresh reconciles with reality shortly after.
  // ---------------------------------------------------------------------------
  const applyOptimistic = useCallback(
    (index: number, patch: Partial<WanProfile>) => {
      setProfiles((prev) =>
        prev ? prev.map((p) => (p.index === index ? { ...p, ...patch } : p)) : prev
      );
    },
    []
  );

  const scheduleReconcile = useCallback(() => {
    setTimeout(() => {
      if (mountedRef.current) fetchProfiles(true);
    }, RECONCILE_DELAY_MS);
  }, [fetchProfiles]);

  // ---------------------------------------------------------------------------
  // Save profile configuration
  // ---------------------------------------------------------------------------
  const saveProfile = useCallback(
    async (index: number, request: WanProfileSaveRequest): Promise<boolean> => {
      setError(null);
      setIsSaving(true);

      try {
        const resp = await authFetch(CGI_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save", index, ...request }),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const data: WanProfileSaveResponse = await resp.json();
        if (!mountedRef.current) return false;

        if (!data.success) {
          setError(data.error || "Failed to save APN profile");
          return false;
        }

        applyOptimistic(index, {
          name: request.name,
          apn: request.apn,
          pdp_type: request.pdp_type,
        });
        scheduleReconcile();
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(
          err instanceof Error ? err.message : "Failed to save APN profile"
        );
        return false;
      } finally {
        if (mountedRef.current) {
          setIsSaving(false);
        }
      }
    },
    [applyOptimistic, scheduleReconcile]
  );

  // ---------------------------------------------------------------------------
  // Toggle profile enabled/disabled
  // ---------------------------------------------------------------------------
  const toggleProfile = useCallback(
    async (index: number, enabled: boolean): Promise<boolean> => {
      setError(null);
      setIsSaving(true);

      try {
        const resp = await authFetch(CGI_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggle", index, enabled } as WanProfileToggleRequest & { action: string }),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const data: WanProfileSaveResponse = await resp.json();
        if (!mountedRef.current) return false;

        if (!data.success) {
          setError(data.error || "Failed to toggle APN profile");
          return false;
        }

        applyOptimistic(index, { enabled });
        scheduleReconcile();
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(
          err instanceof Error ? err.message : "Failed to toggle APN profile"
        );
        return false;
      } finally {
        if (mountedRef.current) {
          setIsSaving(false);
        }
      }
    },
    [applyOptimistic, scheduleReconcile]
  );

  return {
    profiles,
    maxProfiles,
    activeCid,
    internetCid,
    isLoading,
    isSaving,
    error,
    saveProfile,
    toggleProfile,
    refresh: fetchProfiles,
  };
}
