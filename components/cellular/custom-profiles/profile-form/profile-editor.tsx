"use client";

import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { SimProfile, CurrentModemSettings } from "@/types/sim-profile";
import { type PdpType, DEFAULT_SCENARIO_BINDING } from "@/types/sim-profile";
import type { ProfileFormData } from "@/hooks/use-sim-profiles";
import {
  MNO_PRESETS,
  MNO_CUSTOM_ID,
  getMnoPreset,
} from "@/constants/mno-presets";
import {
  ensureScenarioKeys,
  hasBlockingScheduleErrors,
  stripScenarioKeys,
} from "@/lib/scenario-schedule";

import { IdentityCard } from "./identity-card";
import { ApnCard } from "./apn-card";
import { AdvancedCard } from "./advanced-card";
import { ScenarioCard, type ScenarioCardHandle } from "./scenario-card";
import { SummaryCard } from "./summary-card";
import type { UpdateField } from "./form-types";

// =============================================================================
// ProfileEditor — single-page create/edit surface
// =============================================================================
// One calm reading column of grouped section-cards, the macOS System Settings
// way: Identity & Carrier → APN & Connection → Advanced (collapsed) →
// Connection Scenario. The Preview is a quiet companion, not a second column of
// inputs: it stacks at the end of the reading order on narrow/medium screens,
// and only at the widest container (@5xl/main) does it lift into a sticky right
// rail so it stays in view while the user works down the form. This is the core
// de-clutter move over the old two-busy-columns layout — the form always reads
// top-to-bottom, and the preview never competes with the inputs for space.
//
// A full-width sticky action bar keeps Save reachable no matter how long the
// schedule grows. Validation is inline + on save. A save with blocking errors
// focuses the first offending field (and reveals the first bad schedule entry)
// rather than failing silently. The backend contract is unchanged: `_key`s are
// stripped on save.
// =============================================================================

const DEFAULT_FORM_STATE: ProfileFormData = {
  name: "",
  mno: "Custom",
  sim_iccid: "",
  cid: 1,
  apn_name: "",
  pdp_type: "IPV4V6",
  imei: "",
  ttl: 64,
  hl: 64,
  scenario: ensureScenarioKeys(DEFAULT_SCENARIO_BINDING),
};

function profileToFormData(profile: SimProfile): ProfileFormData {
  const s = profile.settings;
  return {
    name: profile.name,
    mno: profile.mno,
    sim_iccid: profile.sim_iccid,
    cid: profile.mno === "Verizon" ? 3 : s.apn.cid,
    apn_name: s.apn.name,
    pdp_type: s.apn.pdp_type,
    imei: s.imei,
    ttl: s.ttl,
    hl: s.hl,
    scenario: ensureScenarioKeys(profile.scenario ?? DEFAULT_SCENARIO_BINDING),
  };
}

/** Error key → focusable element id, in the order the form reads. */
const ERROR_FIELD_ORDER: { key: string; id: string }[] = [
  { key: "name", id: "profileName" },
  { key: "cid", id: "apnCid" },
  { key: "imei", id: "imei" },
  { key: "ttl", id: "ttl" },
  { key: "hl", id: "hl" },
];

interface ProfileEditorProps {
  mode: "create" | "edit";
  /** Pre-loaded profile for edit mode (the route loads it before mounting). */
  initialProfile?: SimProfile | null;
  /** Persist the profile. Returns the id on success, null on failure. */
  onSave: (data: ProfileFormData) => Promise<string | null>;
  /** Called after a successful save (navigate back to the registry). */
  onDone: () => void;
  /** Called when the user cancels. */
  onCancel: () => void;
  currentSettings?: CurrentModemSettings | null;
  onLoadCurrentSettings?: () => void;
  isLoadingCurrent?: boolean;
}

export function ProfileEditor({
  mode,
  initialProfile,
  onSave,
  onDone,
  onCancel,
  currentSettings,
  onLoadCurrentSettings,
  isLoadingCurrent = false,
}: ProfileEditorProps) {
  const { t } = useTranslation("cellular");

  const isEditing = mode === "edit";

  // Seed once from the pre-loaded profile (route mounts the editor fresh).
  const [form, setForm] = useState<ProfileFormData>(() =>
    initialProfile ? profileToFormData(initialProfile) : DEFAULT_FORM_STATE,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { saved, markSaved } = useSaveFlash();

  const [pendingVerizonMnoId, setPendingVerizonMnoId] = useState<string | null>(
    null,
  );

  const scenarioRef = useRef<ScenarioCardHandle>(null);

  const isVerizon = form.mno === "Verizon";

  const pdpTypeLabels = useMemo<Record<PdpType, string>>(
    () => ({
      IP: t("custom_profiles.form.fields.ip_protocol_ipv4"),
      IPV6: t("custom_profiles.form.fields.ip_protocol_ipv6"),
      IPV4V6: t("custom_profiles.form.fields.ip_protocol_dual"),
    }),
    [t],
  );

  const selectedMno = useMemo(() => {
    const match = MNO_PRESETS.find((p) => p.label === form.mno);
    return match ? match.id : MNO_CUSTOM_ID;
  }, [form.mno]);

  // Pre-fill from current modem settings (create mode only). Compare during
  // render instead of useEffect to avoid cascading setState (React-Compiler).
  const [prevSettings, setPrevSettings] = useState<CurrentModemSettings | null>(
    null,
  );
  if (currentSettings && currentSettings !== prevSettings && !isEditing) {
    setPrevSettings(currentSettings);
    const apnPrefill =
      currentSettings.apn_profiles?.length > 0
        ? (() => {
            const activeCid = currentSettings.active_cid;
            const primary =
              currentSettings.apn_profiles.find((a) => a.cid === activeCid) ||
              currentSettings.apn_profiles[0];
            return {
              cid: primary.cid,
              apn_name: primary.apn || "",
              pdp_type: primary.pdp_type || "IPV4V6",
            };
          })()
        : {};
    setForm((prev) => ({
      ...prev,
      sim_iccid: currentSettings.iccid || prev.sim_iccid,
      imei: currentSettings.imei || prev.imei,
      ...apnPrefill,
    }));
  }

  const updateField: UpdateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleMnoChange = (mnoId: string) => {
    if (mnoId === "vzw" && form.mno !== "Verizon") {
      setPendingVerizonMnoId(mnoId);
      return;
    }
    const preset = getMnoPreset(mnoId);
    if (preset) {
      setForm((prev) => ({
        ...prev,
        mno: preset.label,
        apn_name: preset.apn_name,
        ttl: preset.ttl,
        hl: preset.hl,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        mno: "Custom",
        cid: prev.mno === "Verizon" ? 1 : prev.cid,
      }));
    }
  };

  const handleVerizonConfirm = () => {
    if (!pendingVerizonMnoId) return;
    const preset = getMnoPreset(pendingVerizonMnoId);
    if (preset) {
      setForm((prev) => ({
        ...prev,
        mno: preset.label,
        apn_name: preset.apn_name,
        ttl: preset.ttl,
        hl: preset.hl,
        cid: 3,
      }));
    }
    setPendingVerizonMnoId(null);
  };

  const handleVerizonCancel = () => setPendingVerizonMnoId(null);

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) {
      e.name = t("custom_profiles.form.fields.profile_name_required");
    }
    if (form.cid < 1 || form.cid > 15) {
      e.cid = t("custom_profiles.form.fields.cid_error");
    }
    if (form.imei && !/^\d{15}$/.test(form.imei)) {
      e.imei = t("custom_profiles.form.fields.imei_error");
    }
    if (form.ttl < 0 || form.ttl > 255) {
      e.ttl = t("custom_profiles.form.fields.ttl_error");
    }
    if (form.hl < 0 || form.hl > 255) {
      e.hl = t("custom_profiles.form.fields.hl_error");
    }
    if (hasBlockingScheduleErrors(form.scenario.schedule)) {
      e.scenario = t("custom_profiles.form.scenario.schedule_invalid");
    }
    return e;
  };

  /** Move the user to the first blocking error: focus the field, or reveal the
   *  bad schedule rule when the only error is the schedule. */
  const focusFirstError = (found: Record<string, string>) => {
    const field = ERROR_FIELD_ORDER.find((f) => found[f.key]);
    if (field) {
      const el = document.getElementById(field.id) as HTMLElement | null;
      if (el) {
        const prefersReduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        el.scrollIntoView({
          behavior: prefersReduced ? "auto" : "smooth",
          block: "center",
        });
        // Focus after the scroll settles so it doesn't fight the smooth scroll.
        window.setTimeout(() => el.focus({ preventScroll: true }), 80);
      }
      return;
    }
    if (found.scenario) {
      scenarioRef.current?.revealFirstError();
    }
  };

  const doSave = async () => {
    const found = validate();
    setErrors(found);

    if (Object.keys(found).length > 0) {
      focusFirstError(found);
      return;
    }

    const payload: ProfileFormData = {
      ...form,
      scenario: stripScenarioKeys(form.scenario),
    };

    setIsSaving(true);
    const result = await onSave(payload);
    setIsSaving(false);

    if (result) {
      markSaved();
      toast.success(
        isEditing
          ? t("custom_profiles.form.toast.update_success")
          : t("custom_profiles.form.toast.create_success"),
      );
      // Let the "Saved!" flash land before navigating away.
      window.setTimeout(onDone, 650);
    } else {
      toast.error(
        isEditing
          ? t("custom_profiles.form.toast.update_error")
          : t("custom_profiles.form.toast.create_error"),
      );
    }
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    doSave();
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Single reading column by default; at the widest container the preview
          lifts into a fixed-width sticky right rail. The form column stays the
          same shape in both layouts, so the reading order never reflows. */}
      <div className="grid gap-5 @5xl/main:grid-cols-[minmax(0,1fr)_20rem] @5xl/main:items-start">
        {/* The form: one column of grouped section-cards, top to bottom. */}
        <div className="space-y-5">
          <IdentityCard
            form={form}
            errors={errors}
            updateField={updateField}
            selectedMno={selectedMno}
            onMnoChange={handleMnoChange}
            isEditing={isEditing}
            onLoadCurrentSettings={onLoadCurrentSettings}
            isLoadingCurrent={isLoadingCurrent}
          />
          <ApnCard
            form={form}
            errors={errors}
            updateField={updateField}
            pdpTypeLabels={pdpTypeLabels}
            isVerizon={isVerizon}
          />
          <AdvancedCard form={form} errors={errors} updateField={updateField} />
          <ScenarioCard
            ref={scenarioRef}
            value={form.scenario}
            onChange={(scenario) => updateField("scenario", scenario)}
          />
        </div>

        {/* Quiet companion preview: stacked here on narrow/medium screens,
            sticky rail at @5xl/main. */}
        <div className="@5xl/main:sticky @5xl/main:top-6">
          <SummaryCard form={form} />
        </div>
      </div>

      {/* Sticky action bar: always reachable, even deep in a long schedule. */}
      <footer className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 mt-5 flex items-center justify-between gap-2 border-t py-3 backdrop-blur">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("actions.cancel", { ns: "common" })}
        </Button>
        <SaveButton
          type="submit"
          isSaving={isSaving}
          saved={saved}
          label={
            isEditing
              ? t("custom_profiles.form.buttons.update_submit")
              : t("custom_profiles.form.buttons.create_submit")
          }
        />
      </footer>

      <AlertDialog
        open={pendingVerizonMnoId !== null}
        onOpenChange={(open) => {
          if (!open) handleVerizonCancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("custom_profiles.verizon_warning.title")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-muted-foreground space-y-3 text-sm">
                <p>{t("custom_profiles.verizon_warning.body_intro")}</p>
                <p>
                  <strong>
                    {t("custom_profiles.verizon_warning.body_warning_lead")}
                  </strong>{" "}
                  {t("custom_profiles.verizon_warning.body_warning_rest")}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleVerizonCancel}>
              {t("custom_profiles.verizon_warning.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleVerizonConfirm}>
              {t("custom_profiles.verizon_warning.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
