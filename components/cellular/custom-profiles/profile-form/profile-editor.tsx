"use client";

import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeftIcon, CheckCircle2Icon, XCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
// ProfileEditor — tabbed create/edit surface
// =============================================================================
// Five free-navigation tabs (Identity → APN → Advanced → Scenario → Review)
// replace the old single reading column. The Summary companion card pins to a
// sticky right rail at @5xl/main and is hidden on the Review tab (where
// SummaryCard is the panel itself). A sticky action bar keeps Save reachable on
// every tab. Validation routes the user to the offending tab before focusing the
// first bad field, accounting for the fact that hidden tabs are unmounted.
//
// A dirty-discard guard protects unsaved edits when the user clicks "← Back"
// or "Cancel". After a successful save the guard is bypassed (onDone navigates).
//
// All state and logic from the original single-page editor is preserved verbatim.
// Only the render tree and its wiring have changed.
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

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------
const TAB_IDS = ["identity", "apn", "advanced", "scenario", "review"] as const;
type TabId = (typeof TAB_IDS)[number];

/** Error key → which tab owns it. */
const ERROR_TAB_MAP: Record<string, TabId> = {
  name: "identity",
  cid: "apn",
  imei: "advanced",
  ttl: "advanced",
  hl: "advanced",
  scenario: "scenario",
};

/** Error key → focusable element id, in the order the form reads. */
const ERROR_FIELD_ORDER: { key: string; id: string }[] = [
  { key: "name", id: "profileName" },
  { key: "cid", id: "apnCid" },
  { key: "imei", id: "imei" },
  { key: "ttl", id: "ttl" },
  { key: "hl", id: "hl" },
];

/** Which error keys belong to each tab (for the tab-dot indicator). */
const TAB_ERROR_KEYS: Record<TabId, string[]> = {
  identity: ["name"],
  apn: ["cid"],
  advanced: ["imei", "ttl", "hl"],
  scenario: ["scenario"],
  review: [],
};

// ---------------------------------------------------------------------------
// Motion constants — copied verbatim from traffic-engine.tsx
// ---------------------------------------------------------------------------
const EXPO = [0.16, 1, 0.3, 1] as const;

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
  const reduceMotion = useReducedMotion();

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

  // ---------------------------------------------------------------------------
  // Tab navigation state
  // ---------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<TabId>("identity");
  const [dir, setDir] = useState(0);

  const setTab = (next: string) => {
    const nextTab = next as TabId;
    const oldIdx = TAB_IDS.indexOf(activeTab);
    const newIdx = TAB_IDS.indexOf(nextTab);
    setDir(newIdx > oldIdx ? 1 : -1);
    setActiveTab(nextTab);
  };

  // ---------------------------------------------------------------------------
  // Dirty-discard guard
  // ---------------------------------------------------------------------------
  // Capture the initial form seed once at mount; compare as JSON to detect edits.
  // Held in state (initialized lazily) rather than a ref so the dirty check reads
  // only state during render — refs accessed in render trip the React-Compiler
  // refs rule.
  const [initialSnapshot] = useState(() =>
    JSON.stringify(
      initialProfile ? profileToFormData(initialProfile) : DEFAULT_FORM_STATE,
    ),
  );
  const isDirty = JSON.stringify(form) !== initialSnapshot;

  const [showDiscard, setShowDiscard] = useState(false);

  /** Navigate away — guarded by dirty check. */
  const requestExit = () => {
    if (isDirty) {
      setShowDiscard(true);
    } else {
      onCancel();
    }
  };

  // ---------------------------------------------------------------------------
  // Existing logic — preserved verbatim
  // ---------------------------------------------------------------------------
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

  /** Switch to the tab that owns the first error, then defer focus to after
   *  the panel has mounted (hidden panels are unmounted, so the DOM element
   *  doesn't exist until its tab becomes active). */
  const focusFirstError = (found: Record<string, string>) => {
    // Find the first error in reading order and its owning tab.
    const field = ERROR_FIELD_ORDER.find((f) => found[f.key]);

    if (field) {
      const targetTab = ERROR_TAB_MAP[field.key];
      if (targetTab && targetTab !== activeTab) {
        // Switch tab first, then focus after the panel mounts.
        const oldIdx = TAB_IDS.indexOf(activeTab);
        const newIdx = TAB_IDS.indexOf(targetTab);
        setDir(newIdx > oldIdx ? 1 : -1);
        setActiveTab(targetTab);
      }
      // Defer DOM focus until after the newly-active panel is rendered.
      window.setTimeout(() => {
        const el = document.getElementById(field.id) as HTMLElement | null;
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
      if (activeTab !== "scenario") {
        const oldIdx = TAB_IDS.indexOf(activeTab);
        const newIdx = TAB_IDS.indexOf("scenario");
        setDir(newIdx > oldIdx ? 1 : -1);
        setActiveTab("scenario");
      }
      // Defer reveal until after the scenario panel mounts.
      window.setTimeout(() => {
        scenarioRef.current?.revealFirstError();
      }, 0);
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

  // ---------------------------------------------------------------------------
  // Motion variants (copied from traffic-engine)
  // ---------------------------------------------------------------------------
  const panelVariants = {
    enter: (d: number) => ({ opacity: 0, x: reduceMotion ? 0 : d * 24 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: reduceMotion ? 0 : d * -24 }),
  };
  const panelTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: EXPO };

  // ---------------------------------------------------------------------------
  // Tab-dot helpers
  // ---------------------------------------------------------------------------
  // Only show dots after a save attempt (errors is non-empty means we tried).
  const hasSaveAttempt = Object.keys(errors).length > 0;

  const tabHasError = (tabId: TabId) =>
    hasSaveAttempt && TAB_ERROR_KEYS[tabId].some((k) => errors[k]);

  const tabIsComplete = (tabId: TabId) =>
    hasSaveAttempt &&
    tabId !== "review" &&
    TAB_ERROR_KEYS[tabId].every((k) => !errors[k]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="@container/main mx-auto p-2">
      {/* Editor-owned page header */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-2 mb-2"
        onClick={requestExit}
      >
        <ArrowLeftIcon className="size-4" />
        {t("custom_profiles.form.back_to_list")}
      </Button>
      <h1 className="text-3xl font-bold tracking-tight">
        {isEditing
          ? t("custom_profiles.form.edit_title")
          : t("custom_profiles.form.create_title")}
      </h1>
      <p className="text-muted-foreground mt-2">
        {isEditing
          ? t("custom_profiles.form.edit_description")
          : t("custom_profiles.form.create_description")}
      </p>

      <form onSubmit={handleSubmit} className="mt-6">
        {/* Two-column at @5xl/main: tabs+panel | sticky summary rail */}
        <div className="grid gap-5 @5xl/main:grid-cols-[minmax(0,1fr)_20rem] @5xl/main:items-start">
          {/* Column 1: tab strip + animated panel */}
          <div>
            <Tabs value={activeTab} onValueChange={setTab}>
              <TabsList
                className="grid w-full grid-cols-5"
                aria-label={t("custom_profiles.form.steps.nav_aria")}
              >
                {TAB_IDS.map((tabId) => (
                  <TabsTrigger key={tabId} id={`tab-${tabId}`} value={tabId}>
                    {t(`custom_profiles.form.steps.${tabId}_short`)}
                    {tabHasError(tabId) && (
                      <>
                        <XCircleIcon
                          className="ml-1 size-3 text-destructive"
                          aria-hidden="true"
                        />
                        <span className="sr-only">
                          {t("custom_profiles.form.steps.state_error")}
                        </span>
                      </>
                    )}
                    {tabIsComplete(tabId) && (
                      <>
                        <CheckCircle2Icon
                          className="text-success ml-1 size-3"
                          aria-hidden="true"
                        />
                        <span className="sr-only">
                          {t("custom_profiles.form.steps.state_complete")}
                        </span>
                      </>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Manually-rendered panels with dir-based crossfade animation.
                  role=tabpanel preserves the tab semantics Radix's TabsContent
                  would otherwise provide. */}
              <div className="relative mt-4">
                <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                  <motion.div
                    key={activeTab}
                    role="tabpanel"
                    aria-labelledby={`tab-${activeTab}`}
                    custom={dir}
                    variants={panelVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={panelTransition}
                    className="flex flex-col gap-5"
                  >
                    {activeTab === "identity" && (
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
                    )}
                    {activeTab === "apn" && (
                      <ApnCard
                        form={form}
                        errors={errors}
                        updateField={updateField}
                        pdpTypeLabels={pdpTypeLabels}
                        isVerizon={isVerizon}
                      />
                    )}
                    {activeTab === "advanced" && (
                      <AdvancedCard
                        form={form}
                        errors={errors}
                        updateField={updateField}
                        forceOpen
                      />
                    )}
                    {activeTab === "scenario" && (
                      <ScenarioCard
                        ref={scenarioRef}
                        value={form.scenario}
                        onChange={(scenario) =>
                          updateField("scenario", scenario)
                        }
                      />
                    )}
                    {activeTab === "review" && (
                      <div className="flex flex-col gap-4">
                        <p className="text-muted-foreground text-sm">
                          {t("custom_profiles.form.steps.review_desc")}
                        </p>
                        <SummaryCard form={form} />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </Tabs>
          </div>

          {/* Column 2: sticky summary companion — hidden on the review tab
              (where SummaryCard is the panel itself). Animated out with a
              fade + tiny y, matching how traffic-engine hides its CDN column. */}
          <AnimatePresence mode="wait" initial={false}>
            {activeTab !== "review" && (
              <motion.div
                key="summary-rail"
                className="@5xl/main:sticky @5xl/main:top-6 hidden @5xl/main:block"
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={
                  reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }
                }
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.28, ease: EXPO }
                }
              >
                <SummaryCard form={form} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sticky action bar: always reachable on every tab. */}
        <footer className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 mt-5 flex items-center justify-between gap-2 border-t py-3 backdrop-blur">
          <Button type="button" variant="outline" onClick={requestExit}>
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
      </form>

      {/* Verizon CID-3 warning (existing, unchanged) */}
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

      {/* Dirty-discard guard (new) */}
      <AlertDialog
        open={showDiscard}
        onOpenChange={(open) => {
          if (!open) setShowDiscard(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("custom_profiles.form.discard_dialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("custom_profiles.form.discard_dialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDiscard(false)}>
              {t("custom_profiles.form.discard_dialog.keep")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowDiscard(false);
                onCancel();
              }}
            >
              {t("custom_profiles.form.discard_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
