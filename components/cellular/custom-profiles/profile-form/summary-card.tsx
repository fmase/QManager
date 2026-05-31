"use client";

import { useTranslation } from "react-i18next";
import { CalendarClockIcon, RotateCwIcon, RouteIcon } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileConfigPills } from "@/components/cellular/custom-profiles/profile-config-pills";
import {
  ProfileStatusBadge,
  deriveProfileState,
} from "@/components/cellular/custom-profiles/profile-status-badge";
import { FactRow } from "@/components/cellular/custom-profiles/fact-row";
import { useScenarioList } from "@/hooks/use-scenario-list";
import type { ProfileFormData } from "@/hooks/use-sim-profiles";
import type { PdpType, SimProfile } from "@/types/sim-profile";

// =============================================================================
// SummaryCard — quiet live preview of the profile being built
// =============================================================================
// The editor's companion: on wide screens it pins to a sticky right rail and
// stays visible as the user fills the column on the left; on narrow screens it
// stacks below. It is a PREVIEW, not a second set of inputs — it reads the form
// back the way the registry will: the same title, carrier subtitle, status
// badge, and ProfileConfigPills the saved card uses, plus the scenario binding
// line and a reboot note when an IMEI override is set. Reusing the registry's
// exact pill + badge vocabulary means "what you see while building" matches
// "what you get after saving" with no second rendering to drift.
// =============================================================================

interface SummaryCardProps {
  form: ProfileFormData;
}

export function SummaryCard({ form }: SummaryCardProps) {
  const { t } = useTranslation("cellular");
  const { nameForId } = useScenarioList();

  // Synthesize the registry shape from form state for the shared pill readout.
  // Never persisted — id/timestamps are placeholders the pills don't read.
  const preview: SimProfile = {
    id: "",
    name: form.name,
    mno: form.mno,
    sim_iccid: form.sim_iccid,
    created_at: 0,
    updated_at: 0,
    settings: {
      apn: {
        name: form.apn_name,
        cid: form.cid,
        pdp_type: form.pdp_type as PdpType,
      },
      imei: form.imei,
      ttl: form.ttl,
      hl: form.hl,
    },
    scenario: form.scenario,
  };

  const hasName = form.name.trim().length > 0;
  const scheduleEnabled = form.scenario.schedule.enabled;
  const scenarioName = nameForId(form.scenario.default);
  const hasImei = form.imei.trim().length > 0;

  // A profile under construction is never active; the badge reads "Inactive",
  // matching how it will first appear in the registry after save.
  const previewState = deriveProfileState(false, form.sim_iccid, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("custom_profiles.form.summary.title")}</CardTitle>
        <CardDescription>
          {t("custom_profiles.form.summary.desc")}
        </CardDescription>
        <CardAction>
          <ProfileStatusBadge state={previewState} />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <p
            className={
              hasName
                ? "text-base font-semibold tracking-tight"
                : "text-muted-foreground text-base font-medium"
            }
          >
            {hasName ? form.name : t("custom_profiles.form.summary.untitled")}
          </p>
          {form.mno && (
            <p className="text-muted-foreground text-sm">{form.mno}</p>
          )}
        </div>

        <ProfileConfigPills profile={preview} />

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

        <FactRow
          label={t("custom_profiles.card.label_iccid")}
          value={form.sim_iccid || null}
          mono
        />

        {hasImei && (
          <div className="border-warning/30 bg-warning/10 text-warning flex items-start gap-2 rounded-md border p-3 text-sm">
            <RotateCwIcon className="mt-0.5 size-4 shrink-0" />
            <p>{t("custom_profiles.form.summary.reboot_note")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
