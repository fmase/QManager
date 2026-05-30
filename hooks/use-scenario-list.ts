"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import type {
  ScenarioListResponse,
  StoredScenario,
} from "@/types/connection-scenario";

// =============================================================================
// useScenarioList — Lightweight read of selectable connection scenarios
// =============================================================================
// Provides the {id,name} options for the scenario pickers in the profile form's
// Scenario section. Decoupled from useConnectionScenarios (which carries the
// full activation/CRUD surface) so the form stays light. Built-in defaults
// (balanced/gaming/streaming) are always present; custom scenarios come from
// scenarios/list.sh.
// =============================================================================

const CGI_BASE = "/cgi-bin/quecmanager/scenarios";

export interface ScenarioOption {
  id: string;
  name: string;
  /** True for the built-in balanced/gaming/streaming scenarios. */
  isDefault: boolean;
}

export interface UseScenarioListReturn {
  scenarios: ScenarioOption[];
  isLoading: boolean;
  /** Resolve an id → display name, with a graceful fallback for stale ids. */
  nameForId: (id: string) => string;
  refresh: () => void;
}

export function useScenarioList(): UseScenarioListReturn {
  const { t } = useTranslation("cellular");
  const [custom, setCustom] = useState<StoredScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const defaults: ScenarioOption[] = [
    { id: "balanced", name: t("scenarios.default_balanced_name"), isDefault: true },
    { id: "gaming", name: t("scenarios.default_gaming_name"), isDefault: true },
    { id: "streaming", name: t("scenarios.default_streaming_name"), isDefault: true },
  ];

  const fetchList = useCallback(async () => {
    try {
      const resp = await authFetch(`${CGI_BASE}/list.sh`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: ScenarioListResponse = await resp.json();
      if (!mountedRef.current) return;
      setCustom(data.scenarios || []);
    } catch {
      // Keep defaults-only on failure; the picker still works.
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const scenarios: ScenarioOption[] = [
    ...defaults,
    ...custom.map((s) => ({ id: s.id, name: s.name, isDefault: false })),
  ];

  const nameForId = useCallback(
    (id: string): string => {
      const match = scenarios.find((s) => s.id === id);
      if (match) return match.name;
      return t("custom_profiles.form.scenario.deleted_scenario");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenarios, t],
  );

  return {
    scenarios,
    isLoading,
    nameForId,
    refresh: fetchList,
  };
}
