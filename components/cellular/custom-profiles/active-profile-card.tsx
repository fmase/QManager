"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  TriangleAlertIcon,
  RouteIcon,
  CalendarClockIcon,
  PowerIcon,
  PencilIcon,
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
import { cn } from "@/lib/utils";
import type { ProfileSummary, SimProfile } from "@/types/sim-profile";

// =============================================================================
// ActiveProfileCard — full-width banner above the profiles grid
// =============================================================================
// Horizontal banner layout at width: identity block (name + carrier + live
// pulse-dot eyebrow) on the left, config pills + scenario line flowing in the
// middle, Deactivate + Edit actions pinned to the right.
// Collapses to stacked (the original vertical card) on narrow containers.
//
// "No profile" rest-state: a calm, muted card telling the user the modem just
// keeps its current settings — not an alarm condition.
// =============================================================================

interface ActiveProfileCardProps {
  activeSummary: ProfileSummary | null;
  currentIccid: string | null | undefined;
  getProfile: (id: string) => Promise<SimProfile | null>;
  onDeactivate: () => void;
  onEdit: (id: string) => void;
  isDeactivating: boolean;
}

export function ActiveProfileCard({
  activeSummary,
  currentIccid,
  getProfile,
  onDeactivate,
  onEdit,
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
          <CardTitle className="text-muted-foreground text-base font-medium">
            {t("custom_profiles.active_card.none_title")}
          </CardTitle>
          <CardDescription>
            {t("custom_profiles.active_card.none_description")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const state = deriveProfileState(true, activeSummary.sim_iccid, currentIccid);
  const isVerizon = activeSummary.mno === "Verizon";
  const isLoadingFull = fullProfile?.id !== activeSummary.id;
  const scheduleEnabled = activeSummary.scenario?.schedule?.enabled;
  const scenarioName = activeSummary.scenario
    ? nameForId(activeSummary.scenario.default)
    : null;

  // Live indicator dot color mirrors the badge state
  const dotColor = state === "mismatch" ? "bg-warning" : "bg-success";

  return (
    <Card>
      {/*
        Banner layout: on wide containers the card becomes a horizontal strip —
        identity (left) | pills + alerts (center, flex-1) | actions (right).
        On narrow containers it falls back to a natural vertical stack.
        We use a flex row with @container/active-banner on the card's inner
        wrapper to drive the pivot without viewport breakpoints.
      */}
      <div className="@container/active-banner">
        {/* Wide: flex-row; narrow: flex-col */}
        <div className="flex flex-col gap-0 @2xl/active-banner:flex-row">

          {/* ── LEFT: identity block ─────────────────────────────────────── */}
          <div className="min-w-0 flex-shrink-0 @2xl/active-banner:w-64 @2xl/active-banner:border-r @2xl/active-banner:pr-6">
            <CardHeader>
              {/* Live pulse-dot eyebrow */}
              <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs font-medium">
                <span className="relative flex size-2" aria-hidden="true">
                  <span
                    className={cn(
                      "absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:animate-none",
                      dotColor,
                    )}
                  />
                  <span className={cn("relative inline-flex size-2 rounded-full", dotColor)} />
                </span>
                {t("custom_profiles.active_card.subtitle")}
              </div>

              {/* Profile name + carrier — no icons in CardHeader */}
              <CardTitle className="text-xl tracking-tight">{activeSummary.name}</CardTitle>
              {activeSummary.mno && (
                <CardDescription>{activeSummary.mno}</CardDescription>
              )}

              {/* Status badge in CardAction */}
              <CardAction aria-live="polite">
                <ProfileStatusBadge state={state} />
              </CardAction>
            </CardHeader>
          </div>

          {/* ── MIDDLE: config pills + scenario + alerts ─────────────────── */}
          <div className="min-w-0 flex-1 @2xl/active-banner:pl-6">
            <CardContent className="space-y-4 @2xl/active-banner:pt-6">
              {/* Config pills — skeleton matches populated row height */}
              {isLoadingFull ? (
                <div className="flex flex-wrap gap-1.5">
                  <Skeleton className="h-6 w-28 rounded-md" />
                  <Skeleton className="h-6 w-16 rounded-md" />
                  <Skeleton className="h-6 w-20 rounded-md" />
                </div>
              ) : (
                fullProfile && <ProfileConfigPills profile={fullProfile} />
              )}

              {/* Scenario binding line — placeholder row so layout is stable */}
              <div
                className={cn(
                  "flex items-center gap-1.5 text-sm",
                  scenarioName ? "text-muted-foreground" : "invisible",
                )}
                aria-hidden={!scenarioName}
              >
                {scheduleEnabled ? (
                  <CalendarClockIcon className="size-4 shrink-0" />
                ) : (
                  <RouteIcon className="size-4 shrink-0" />
                )}
                <span>
                  {scenarioName
                    ? scheduleEnabled
                      ? t("custom_profiles.active_card.scenario_scheduled", {
                          name: scenarioName,
                        })
                      : t("custom_profiles.active_card.scenario_default", {
                          name: scenarioName,
                        })
                    : " " /* non-breaking space placeholder */}
                </span>
              </div>

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
          </div>

          {/* ── RIGHT: actions — wide: vertical column; narrow: footer row ── */}
          {/*
            On narrow: hide this panel; actions fall to the CardFooter below.
            On wide: show as a right-aligned column with border-l.
          */}
          <div className="hidden flex-shrink-0 items-start @2xl/active-banner:flex @2xl/active-banner:flex-col @2xl/active-banner:justify-center @2xl/active-banner:gap-2 @2xl/active-banner:border-l @2xl/active-banner:pl-6 @2xl/active-banner:pr-6 @2xl/active-banner:py-6">
            <Button
              variant="outline"
              size="sm"
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(activeSummary.id)}
            >
              <PencilIcon className="size-4" />
              {t("custom_profiles.active_card.edit_button")}
            </Button>
          </div>

        </div>
      </div>

      {/* Narrow-only footer: actions as a border-t row */}
      <CardFooter className="flex items-center gap-2 border-t pt-4 @2xl/active-banner:hidden">
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(activeSummary.id)}
        >
          <PencilIcon className="size-4" />
          {t("custom_profiles.active_card.edit_button")}
        </Button>
      </CardFooter>
    </Card>
  );
}
