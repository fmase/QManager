"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  TriangleAlertIcon,
  RouteIcon,
  CalendarClockIcon,
  PowerIcon,
} from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

import {
  ProfileStatusBadge,
  deriveProfileState,
} from "@/components/cellular/custom-profiles/profile-status-badge";
import { ProfileConfigPills } from "@/components/cellular/custom-profiles/profile-config-pills";
import { useScenarioList } from "@/hooks/use-scenario-list";
import type { ProfileSummary, SimProfile } from "@/types/sim-profile";

// =============================================================================
// ActiveProfileCard — the page spine
// =============================================================================
// Answers the page's first question at a glance: which profile is live, does
// it still match the inserted SIM, what does it actually do, and what is the
// one thing I can do next (deactivate). Falls back to a calm rest state when
// nothing is active — the modem keeps its current settings, which is not an
// alarm condition.
//
// The summary (name/mno/scenario/iccid) renders instantly from the list data;
// the richer config pills need the full settings bundle, fetched once per
// active-profile change via getProfile(). "Loading the full bundle" is derived
// during render (no setState-in-effect) so the skeleton tracks the fetch
// without a redundant state flag.
// =============================================================================

interface ActiveProfileCardProps {
  activeSummary: ProfileSummary | null;
  currentIccid: string | null | undefined;
  getProfile: (id: string) => Promise<SimProfile | null>;
  onDeactivate: () => void;
  isDeactivating: boolean;
}

export function ActiveProfileCard({
  activeSummary,
  currentIccid,
  getProfile,
  onDeactivate,
  isDeactivating,
}: ActiveProfileCardProps) {
  const { t } = useTranslation("cellular");
  const { nameForId } = useScenarioList();

  const [fullProfile, setFullProfile] = useState<SimProfile | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const activeId = activeSummary?.id ?? null;

  useEffect(() => {
    const load = async () => {
      if (!activeId) {
        if (mountedRef.current) setFullProfile(null);
        return;
      }
      const p = await getProfile(activeId);
      if (mountedRef.current) setFullProfile(p);
    };
    load();
  }, [activeId, getProfile]);

  // --- Rest state: no profile active ----------------------------------------
  if (!activeSummary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("custom_profiles.active_card.none_title")}</CardTitle>
          <CardDescription>
            {t("custom_profiles.active_card.none_description")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const state = deriveProfileState(
    true,
    activeSummary.sim_iccid,
    currentIccid,
  );
  const isVerizon = activeSummary.mno === "Verizon";
  const isLoadingFull = fullProfile?.id !== activeSummary.id;
  const scheduleEnabled = activeSummary.scenario?.schedule?.enabled;
  const scenarioName = activeSummary.scenario
    ? nameForId(activeSummary.scenario.default)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl tracking-tight">
          {activeSummary.name}
        </CardTitle>
        <CardDescription>
          {activeSummary.mno
            ? t("custom_profiles.active_card.subtitle_with_mno", {
                mno: activeSummary.mno,
              })
            : t("custom_profiles.active_card.subtitle")}
        </CardDescription>
        <CardAction>
          <ProfileStatusBadge state={state} />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Config readout */}
        {isLoadingFull ? (
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-6 w-28 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
        ) : (
          fullProfile && <ProfileConfigPills profile={fullProfile} />
        )}

        {/* Scenario binding */}
        {scenarioName && (
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            {scheduleEnabled ? (
              <CalendarClockIcon className="size-4 shrink-0" />
            ) : (
              <RouteIcon className="size-4 shrink-0" />
            )}
            <span>
              {scheduleEnabled
                ? t("custom_profiles.active_card.scenario_scheduled", {
                    name: scenarioName,
                  })
                : t("custom_profiles.active_card.scenario_default", {
                    name: scenarioName,
                  })}
            </span>
          </div>
        )}

        {/* SIM mismatch consequence + remedy */}
        {state === "mismatch" && (
          <div className="border-warning/30 bg-warning/10 text-warning flex items-start gap-2 rounded-md border p-3 text-sm">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            <p>{t("custom_profiles.active_card.mismatch_note")}</p>
          </div>
        )}

        {/* Verizon data-routing lock context */}
        {isVerizon && state !== "mismatch" && (
          <div className="border-info/30 bg-info/10 text-info flex items-start gap-2 rounded-md border p-3 text-sm">
            <RouteIcon className="mt-0.5 size-4 shrink-0" />
            <p>{t("custom_profiles.active_card.verizon_locked_note")}</p>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button
          variant="outline"
          onClick={onDeactivate}
          disabled={isDeactivating}
        >
          {isDeactivating ? (
            <Spinner className="size-4" />
          ) : (
            <PowerIcon className="size-4" />
          )}
          {t("custom_profiles.table.actions_menu.deactivate")}
        </Button>
      </CardFooter>
    </Card>
  );
}
