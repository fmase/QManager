"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

import type { CurrentModemSettings } from "@/types/sim-profile";
import { type PdpType } from "@/types/sim-profile";
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
// ProfileEditor — multi-step form body hosted inside ProfileEditorDialog
// =============================================================================
// Five steps, one per section card (Identity → APN → Advanced → Scenario →
// Review). Shadcn Tabs acts as the step indicator; steps are freely clickable
// AND Back/Next buttons in the dialog footer provide guided flow. The dialog
// footer is rendered here (inside the scrollable region) so it scrolls with the
// content on very small viewports but is always visible at the bottom of the
// fixed-height dialog body.
//
// Dialog owns: open/close, async profile load, dirty-guard, save delegation.
// This component owns: form state, steps, validation, error routing.
// =============================================================================

// ---------------------------------------------------------------------------
// Step configuration
// ---------------------------------------------------------------------------

type StepKey = "identity" | "apn" | "advanced" | "scenario" | "review";

/** Error key → step + focusable element id, in reading order. */
const ERROR_ROUTING: {
  key: string;
  step: StepKey;
  fieldId: string;
}[] = [
  { key: "name", step: "identity", fieldId: "profileName" },
  { key: "cid", step: "apn", fieldId: "apnCid" },
  { key: "imei", step: "advanced", fieldId: "imei" },
  { key: "ttl", step: "advanced", fieldId: "ttl" },
  { key: "hl", step: "advanced", fieldId: "hl" },
  // scenario has no field id — handled via scenarioRef.revealFirstError()
];

const STEPS: { key: StepKey; labelKey: string }[] = [
  { key: "identity", labelKey: "custom_profiles.form.steps.identity_short" },
  { key: "apn", labelKey: "custom_profiles.form.steps.apn_short" },
  { key: "advanced", labelKey: "custom_profiles.form.steps.advanced_short" },
  { key: "scenario", labelKey: "custom_profiles.form.steps.scenario_short" },
  { key: "review", labelKey: "custom_profiles.form.steps.review_short" },
];

const FIRST_STEP = STEPS[0].key;
const LAST_STEP = STEPS[STEPS.length - 1].key;

function prevStep(current: StepKey): StepKey | null {
  const idx = STEPS.findIndex((s) => s.key === current);
  return idx > 0 ? STEPS[idx - 1].key : null;
}

function nextStep(current: StepKey): StepKey | null {
  const idx = STEPS.findIndex((s) => s.key === current);
  return idx < STEPS.length - 1 ? STEPS[idx + 1].key : null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProfileEditorProps {
  mode: "create" | "edit";
  /** Seeded form state for this open session (edit: from loaded profile; create: defaults). */
  initialFormState: ProfileFormData;
  /** Persist the profile — dialog wraps create vs update. Returns id or null. */
  onSave: (data: ProfileFormData) => Promise<string | null>;
  /** Called when the user clicks Cancel — dialog handles the dirty guard. */
  onCancel: () => void;
  /** Called whenever the form's dirty state changes. */
  onDirtyChange: (dirty: boolean) => void;
  /** Current modem settings for create-mode prefill (null in edit mode). */
  currentSettings?: CurrentModemSettings | null;
  /** Trigger a fresh fetch of current modem settings (create mode only). */
  onLoadCurrentSettings?: () => void;
  isLoadingCurrent?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProfileEditor({
  mode,
  initialFormState,
  onSave,
  onCancel,
  onDirtyChange,
  currentSettings,
  onLoadCurrentSettings,
  isLoadingCurrent = false,
}: ProfileEditorProps) {
  const { t } = useTranslation("cellular");

  const isEditing = mode === "edit";

  // ---- Form state -----------------------------------------------------------
  // Seed once from initialFormState (the dialog key-remounts us when identity
  // changes, so the initializer fires fresh each open session).
  const [form, setForm] = useState<ProfileFormData>(() =>
    ensureScenarioKeysInForm(initialFormState),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const { saved, markSaved } = useSaveFlash();

  // ---- Dirty tracking -------------------------------------------------------
  // Snapshot JSON at seed time; compare on every form change.
  const snapshotRef = useRef<string>(
    JSON.stringify(ensureScenarioKeysInForm(initialFormState)),
  );

  useEffect(() => {
    const dirty =
      JSON.stringify(form) !== snapshotRef.current;
    onDirtyChange(dirty);
  }, [form, onDirtyChange]);

  // ---- Verizon warning state ------------------------------------------------
  const [pendingVerizonMnoId, setPendingVerizonMnoId] = useState<string | null>(
    null,
  );

  // ---- Refs -----------------------------------------------------------------
  const scenarioRef = useRef<ScenarioCardHandle>(null);

  // ---- Step state -----------------------------------------------------------
  const [activeStep, setActiveStep] = useState<StepKey>(FIRST_STEP);

  // ---- Derived --------------------------------------------------------------
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

  // ---- Current-settings prefill (create mode, adjust-during-render) ---------
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

  // ---- Field updater --------------------------------------------------------
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

  // ---- MNO handlers ---------------------------------------------------------
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

  // ---- Validation -----------------------------------------------------------
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

  /**
   * On save with errors: switch to the step owning the first error, then
   * after one tick (so the panel has mounted) focus/scroll to the field.
   * If the only error is scenario, call revealFirstError() on the ref.
   */
  const routeToFirstError = (found: Record<string, string>) => {
    const route = ERROR_ROUTING.find((r) => found[r.key]);
    if (route) {
      setActiveStep(route.step);
      window.setTimeout(() => {
        const el = document.getElementById(route.fieldId) as HTMLElement | null;
        if (el) {
          const prefersReduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
          el.scrollIntoView({
            behavior: prefersReduced ? "auto" : "smooth",
            block: "center",
          });
          window.setTimeout(() => el.focus({ preventScroll: true }), 80);
        }
      }, 0);
      return;
    }
    if (found.scenario) {
      setActiveStep("scenario");
      window.setTimeout(() => {
        scenarioRef.current?.revealFirstError();
      }, 0);
    }
  };

  // ---- Save -----------------------------------------------------------------
  const doSave = async () => {
    const found = validate();
    setErrors(found);

    if (Object.keys(found).length > 0) {
      routeToFirstError(found);
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
      // onSave (in the dialog) already calls onSaved() which closes the dialog.
      // Give the "Saved!" flash a moment before that happens.
      // (No additional toast here — the dialog's handleSave fires toast.)
    }
    // Failure toast is also handled by the dialog's handleSave.
  };

  // ---- Navigation -----------------------------------------------------------
  const handleBack = () => {
    const p = prevStep(activeStep);
    if (p) setActiveStep(p);
  };

  const handleNext = () => {
    const n = nextStep(activeStep);
    if (n) setActiveStep(n);
  };

  const isFirstStep = activeStep === FIRST_STEP;
  const isLastStep = activeStep === LAST_STEP;

  // ---- Render ---------------------------------------------------------------
  return (
    <>
      <Tabs
        value={activeStep}
        onValueChange={(v) => setActiveStep(v as StepKey)}
        className="flex flex-col"
      >
        {/* Step indicator — sticky so it doesn't scroll away in a long schedule */}
        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-10 border-b px-6 py-3 backdrop-blur">
          <TabsList
            className="w-full"
            aria-label={t("custom_profiles.form.steps.nav_aria")}
          >
            {STEPS.map((step) => {
              const hasError = stepHasError(step.key, errors);
              return (
                <TabsTrigger
                  key={step.key}
                  value={step.key}
                  className="flex-1 gap-1"
                  aria-current={activeStep === step.key ? "step" : undefined}
                >
                  {t(step.labelKey)}
                  {hasError && (
                    <span
                      className="bg-destructive size-1.5 rounded-full"
                      aria-label={t("custom_profiles.form.steps.state_error")}
                    />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Step panels */}
        <div className="px-6 py-5">
          <TabsContent value="identity" className="mt-0 focus-visible:outline-none">
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
          </TabsContent>

          <TabsContent value="apn" className="mt-0 focus-visible:outline-none">
            <ApnCard
              form={form}
              errors={errors}
              updateField={updateField}
              pdpTypeLabels={pdpTypeLabels}
              isVerizon={isVerizon}
            />
          </TabsContent>

          <TabsContent value="advanced" className="mt-0 focus-visible:outline-none">
            {/* AdvancedCard has its own collapsible; in the stepped layout we
                still render it as-is. Its auto-expand-on-error logic still
                works because errors.imei/ttl/hl are passed down. */}
            <AdvancedCard
              form={form}
              errors={errors}
              updateField={updateField}
            />
          </TabsContent>

          <TabsContent value="scenario" className="mt-0 focus-visible:outline-none">
            <ScenarioCard
              ref={scenarioRef}
              value={form.scenario}
              onChange={(scenario) => updateField("scenario", scenario)}
            />
          </TabsContent>

          <TabsContent value="review" className="mt-0 focus-visible:outline-none">
            <SummaryCard form={form} />
          </TabsContent>
        </div>

        {/* Footer — always visible at the bottom of the scrollable body */}
        <footer className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 mt-auto flex shrink-0 items-center justify-between gap-2 border-t px-6 py-3 backdrop-blur">
          {/* Left side: Back or Cancel */}
          {isFirstStep ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("actions.cancel", { ns: "common" })}
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={handleBack}>
              {t("custom_profiles.form.buttons.back")}
            </Button>
          )}

          {/* Right side: Next or Save */}
          {isLastStep ? (
            <SaveButton
              type="button"
              isSaving={isSaving}
              saved={saved}
              label={
                isEditing
                  ? t("custom_profiles.form.buttons.update_submit")
                  : t("custom_profiles.form.buttons.create_submit")
              }
              onClick={doSave}
            />
          ) : (
            <Button type="button" onClick={handleNext}>
              {t("custom_profiles.form.buttons.next")}
            </Button>
          )}
        </footer>
      </Tabs>

      {/* Verizon warning AlertDialog */}
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
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureScenarioKeysInForm(form: ProfileFormData): ProfileFormData {
  return {
    ...form,
    scenario: ensureScenarioKeys(form.scenario),
  };
}

/** Which errors belong to which step — used to show the error dot on triggers. */
function stepHasError(
  step: StepKey,
  errors: Record<string, string>,
): boolean {
  switch (step) {
    case "identity":
      return Boolean(errors.name);
    case "apn":
      return Boolean(errors.cid);
    case "advanced":
      return Boolean(errors.imei || errors.ttl || errors.hl);
    case "scenario":
      return Boolean(errors.scenario);
    case "review":
      return false;
  }
}
