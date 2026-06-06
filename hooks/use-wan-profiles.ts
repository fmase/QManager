"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { authFetch } from "@/lib/auth-fetch";
import type {
  WanProfile,
  CidContext,
  WanProfilesResponse,
  WanProfileSaveRequest,
  WanProfileSaveResponse,
} from "@/types/wan-profiles";

// =============================================================================
// useWanProfiles — APN (WAN) Profile Management Hook  (v2: 5-slot model)
// =============================================================================
// Fetches five data-profile slots + the modem's live PDP contexts on mount.
// Exactly one slot is active at a time (radio semantics): activateProfile()
// makes a slot the live Internet APN and implicitly deactivates the prior one.
// saveProfile() persists a slot (and re-applies to the modem only if it is the
// active slot); clearProfile() empties a slot (refused on the active slot).
//
// Backend endpoint:
//   GET/POST /cgi-bin/quecmanager/cellular/apn.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/cellular/apn.sh";

// activate (and saving the active slot) runs an AT+COPS detach/attach cycle so
// the new APN is negotiated at re-attach. AT+COPS=0 returns OK before the
// attach fully completes, so the fresh active_cid/cids state isn't readable
// immediately — a short delayed silent refresh reconciles the optimistic patch.
const RECONCILE_DELAY_MS = 1500;

export interface UseWanProfilesReturn {
  /** The five data-profile slots (null before first fetch). */
  profiles: WanProfile[] | null;
  /** The modem's live PDP contexts (1-6), tagged for the CID picker. */
  cids: CidContext[] | null;
  /** Number of profile slots (5). */
  maxProfiles: number;
  /** Id of the active slot, or null before first fetch / 0 if none. */
  activeProfile: number | null;
  /** The live WAN-bearing CID, or null before first fetch. */
  activeCid: number | null;
  /** The CID the ISP uses for data (== activeCid), or null before first fetch. */
  internetCid: number | null;
  /** True while initial fetch is in progress. */
  isLoading: boolean;
  /** True while a save/activate/clear operation is in progress. */
  isSaving: boolean;
  /** Error message if fetch or a mutation failed. */
  error: string | null;
  /** Persist a slot's configuration. Returns true on success. */
  saveProfile: (id: number, request: WanProfileSaveRequest) => Promise<boolean>;
  /** Make a slot the active Internet APN (deactivates the prior). Returns true on success. */
  activateProfile: (id: number) => Promise<boolean>;
  /** Disable all slots (active=0): revert the modem to its carrier-default APN. Returns true on success. */
  deactivateProfile: () => Promise<boolean>;
  /** Empty a slot (refused on the active slot). Returns true on success. */
  clearProfile: (id: number) => Promise<boolean>;
  /** Re-fetch all profiles + CID contexts. */
  refresh: () => void;
}

export function useWanProfiles(): UseWanProfilesReturn {
  const [profiles, setProfiles] = useState<WanProfile[] | null>(null);
  const [cids, setCids] = useState<CidContext[] | null>(null);
  const [maxProfiles, setMaxProfiles] = useState(5);
  const [activeProfile, setActiveProfile] = useState<number | null>(null);
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

  // Mirror of `profiles` for reads inside async mutation callbacks (which don't
  // list `profiles` as a dep). Written in an effect, read only in callbacks —
  // never during render — so it stays clear of the React-Compiler ref rule.
  const profilesRef = useRef<WanProfile[] | null>(null);
  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  // ---------------------------------------------------------------------------
  // Fetch profiles + CID contexts
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
      setCids(data.cids ?? []);
      setMaxProfiles(data.max_profiles);
      setActiveProfile(
        typeof data.active_profile === "number" ? data.active_profile : null
      );
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
  // Optimistic helpers — return immediately; a delayed silent refresh
  // reconciles against reality shortly after.
  // ---------------------------------------------------------------------------
  const patchSlot = useCallback((id: number, patch: Partial<WanProfile>) => {
    setProfiles((prev) =>
      prev ? prev.map((p) => (p.id === id ? { ...p, ...patch } : p)) : prev
    );
  }, []);

  // Optimistically reflect a just-applied APN on its live CID so the honest
  // "Active vs Not live" badge doesn't flash "Not live" against a stale cids[]
  // snapshot during the ~1.5s before the reconcile lands. The reconcile is the
  // source of truth — if the carrier overrode the APN, it flips back to "Not
  // live" with the real value.
  const patchCidApn = useCallback((cid: number, apn: string) => {
    setCids((prev) =>
      prev ? prev.map((c) => (c.cid === cid ? { ...c, apn } : c)) : prev
    );
  }, []);

  const scheduleReconcile = useCallback(() => {
    setTimeout(() => {
      if (mountedRef.current) fetchProfiles(true);
    }, RECONCILE_DELAY_MS);
  }, [fetchProfiles]);

  // Shared POST wrapper. Returns the parsed body on HTTP success, or null.
  const postAction = useCallback(
    async (body: Record<string, unknown>): Promise<WanProfileSaveResponse | null> => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      return (await resp.json()) as WanProfileSaveResponse;
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Save a slot's configuration
  // ---------------------------------------------------------------------------
  const saveProfile = useCallback(
    async (id: number, request: WanProfileSaveRequest): Promise<boolean> => {
      setError(null);
      setIsSaving(true);
      try {
        const data = await postAction({ action: "save", id, ...request });
        if (!mountedRef.current) return false;
        if (!data?.success) {
          setError(data?.error || "Failed to save APN profile");
          return false;
        }
        patchSlot(id, {
          name: request.name,
          apn: request.apn,
          pdp_type: request.pdp_type,
          cid: request.cid,
        });
        // Saving the ACTIVE slot re-applies its APN to the modem (COPS cycle),
        // so reflect it on the live CID too — keeps the honest badge from
        // flashing "Not live" before the reconcile confirms.
        if (activeProfile === id) patchCidApn(request.cid, request.apn);
        scheduleReconcile();
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(err instanceof Error ? err.message : "Failed to save APN profile");
        return false;
      } finally {
        if (mountedRef.current) setIsSaving(false);
      }
    },
    [postAction, patchSlot, patchCidApn, scheduleReconcile, activeProfile]
  );

  // ---------------------------------------------------------------------------
  // Activate a slot — mutually exclusive (radio). The backend writes the APN
  // and reattaches; we optimistically move the active flag across all slots.
  // ---------------------------------------------------------------------------
  const activateProfile = useCallback(
    async (id: number): Promise<boolean> => {
      setError(null);
      setIsSaving(true);
      try {
        const data = await postAction({ action: "activate", id });
        if (!mountedRef.current) return false;
        if (!data?.success) {
          setError(data?.error || "Failed to activate APN profile");
          return false;
        }
        setActiveProfile(id);
        const activated = profilesRef.current?.find((p) => p.id === id);
        if (activated) patchCidApn(activated.cid, activated.apn);
        setProfiles((prev) =>
          prev ? prev.map((p) => ({ ...p, is_active: p.id === id })) : prev
        );
        scheduleReconcile();
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(err instanceof Error ? err.message : "Failed to activate APN profile");
        return false;
      } finally {
        if (mountedRef.current) setIsSaving(false);
      }
    },
    [postAction, patchCidApn, scheduleReconcile]
  );

  // ---------------------------------------------------------------------------
  // Deactivate — disable all slots (active=0). The backend writes a blank APN
  // and re-attaches, so the carrier reassigns its default. We optimistically
  // clear the active flag across all slots; the delayed reconcile picks up the
  // fresh cids[] so the "Active" badge resolves to the live carrier APN.
  // ---------------------------------------------------------------------------
  const deactivateProfile = useCallback(async (): Promise<boolean> => {
    setError(null);
    setIsSaving(true);
    try {
      const data = await postAction({ action: "deactivate" });
      if (!mountedRef.current) return false;
      if (!data?.success) {
        setError(data?.error || "Failed to disable APN profiles");
        return false;
      }
      setActiveProfile(0);
      setProfiles((prev) =>
        prev ? prev.map((p) => ({ ...p, is_active: false })) : prev
      );
      scheduleReconcile();
      return true;
    } catch (err) {
      if (!mountedRef.current) return false;
      setError(
        err instanceof Error ? err.message : "Failed to disable APN profiles"
      );
      return false;
    } finally {
      if (mountedRef.current) setIsSaving(false);
    }
  }, [postAction, scheduleReconcile]);

  // ---------------------------------------------------------------------------
  // Clear a slot (refused on the active slot by the backend)
  // ---------------------------------------------------------------------------
  const clearProfile = useCallback(
    async (id: number): Promise<boolean> => {
      setError(null);
      setIsSaving(true);
      try {
        const data = await postAction({ action: "clear", id });
        if (!mountedRef.current) return false;
        if (!data?.success) {
          setError(data?.error || "Failed to clear APN profile");
          return false;
        }
        patchSlot(id, { name: "", apn: "", pdp_type: "ipv4v6", cid: 1 });
        scheduleReconcile();
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(err instanceof Error ? err.message : "Failed to clear APN profile");
        return false;
      } finally {
        if (mountedRef.current) setIsSaving(false);
      }
    },
    [postAction, patchSlot, scheduleReconcile]
  );

  return {
    profiles,
    cids,
    maxProfiles,
    activeProfile,
    activeCid,
    internetCid,
    isLoading,
    isSaving,
    error,
    saveProfile,
    activateProfile,
    deactivateProfile,
    clearProfile,
    refresh: fetchProfiles,
  };
}
