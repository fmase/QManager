"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import type { SimProfile } from "@/types/sim-profile";
import { DEFAULT_SCENARIO_BINDING } from "@/types/sim-profile";
import type { ProfileFormData } from "@/hooks/use-sim-profiles";
import { useCurrentSettings } from "@/hooks/use-current-settings";
import { ensureScenarioKeys } from "@/lib/scenario-schedule";

import { ProfileEditor } from "./profile-editor";

// =============================================================================
// ProfileEditorDialog — Dialog shell for the multi-step profile form
// =============================================================================
// Owns: open/close lifecycle, async profile load (edit mode), dirty-discard
// guard, and create-mode currentSettings prefill. Delegates form state + steps
// + validation to ProfileEditor, which is rendered inside the dialog body.
//
// The dialog is intentionally wide (max-w-2xl) and has a scrollable body with a
// fixed footer so Back/Next/Save are always reachable regardless of schedule
// length. The dialog close button (×) is suppressed; the Cancel/Back buttons in
// the footer are the escape hatches so the dirty guard always fires.
// =============================================================================

export interface ProfileEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  /** Edit mode: the id to load. Dialog fetches full profile via getProfile. */
  profileId?: string | null;
  /** Fetch a single profile by id. Provided by the coordinator. */
  getProfile: (id: string) => Promise<SimProfile | null>;
  /**
   * Persist. Coordinator binds create vs update by mode.
   * Returns the profile id on success, null on failure.
   */
  onSave: (data: ProfileFormData) => Promise<string | null>;
  /** Called after a successful save. Coordinator refreshes the list. */
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Body skeleton — matches the dialog body shape while loading
// ---------------------------------------------------------------------------

function DialogBodySkeleton() {
  return (
    <div className="space-y-6 px-6 py-4">
      {/* Tabs row */}
      <div className="flex gap-2">
        {[80, 60, 80, 80, 64].map((w, i) => (
          <Skeleton key={i} className="h-8 rounded-md" style={{ width: w }} />
        ))}
      </div>
      {/* Card skeleton */}
      <div className="space-y-4 rounded-lg border p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ProfileEditorDialog({
  open,
  onOpenChange,
  mode,
  profileId,
  getProfile,
  onSave,
  onSaved,
}: ProfileEditorDialogProps) {
  const { t } = useTranslation("cellular");

  const isEditing = mode === "edit";

  // ---- Edit-mode: async profile load ----------------------------------------
  const [loadedProfile, setLoadedProfile] = useState<SimProfile | null>(null);
  // Start as "loading" in edit mode so we never flash DEFAULT_FORM_STATE before
  // the effect fires. The effect will set this to false when the fetch resolves.
  const [isLoadingProfile, setIsLoadingProfile] = useState(
    () => isEditing && !!profileId,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  // Active-flag ref to guard against setState after unmount.
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!isEditing || !profileId) {
      setLoadedProfile(null);
      setIsLoadingProfile(false);
      setLoadError(null);
      return;
    }

    setIsLoadingProfile(true);
    setLoadError(null);
    setLoadedProfile(null);

    getProfile(profileId).then((profile) => {
      if (!activeRef.current) return;
      if (profile) {
        setLoadedProfile(profile);
      } else {
        setLoadError(t("custom_profiles.edit.not_found_desc"));
      }
      setIsLoadingProfile(false);
    });
  }, [open, isEditing, profileId, getProfile, t]);

  // ---- Create-mode: current settings prefill --------------------------------
  const {
    settings: currentSettings,
    isLoading: isLoadingCurrent,
    refresh: refreshCurrentSettings,
  } = useCurrentSettings(false);

  // ---- Dirty-discard guard --------------------------------------------------
  // ProfileEditor calls back with its current dirty state so the dialog can
  // intercept close attempts without coupling the guard into the form itself.
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  // When a save completes successfully, bypass the guard for the imminent close.
  const bypassGuardRef = useRef(false);

  // Reset per-open state whenever the dialog closes.
  useEffect(() => {
    if (!open) {
      setIsDirty(false);
      bypassGuardRef.current = false;
    }
  }, [open]);

  // Intercept close attempts (X, overlay, Escape, Cancel button).
  const handleOpenChange = (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (bypassGuardRef.current || !isDirty) {
      onOpenChange(false);
      return;
    }
    setShowDiscardDialog(true);
  };

  const handleDiscardConfirm = () => {
    setShowDiscardDialog(false);
    onOpenChange(false);
  };

  const handleDiscardKeep = () => {
    setShowDiscardDialog(false);
  };

  // ---- Save callback --------------------------------------------------------
  const handleSave = async (data: ProfileFormData): Promise<string | null> => {
    const result = await onSave(data);
    if (result) {
      bypassGuardRef.current = true;
      toast.success(
        isEditing
          ? t("custom_profiles.form.toast.update_success")
          : t("custom_profiles.form.toast.create_success"),
      );
      onSaved();
    } else {
      toast.error(
        isEditing
          ? t("custom_profiles.form.toast.update_error")
          : t("custom_profiles.form.toast.create_error"),
      );
    }
    return result;
  };

  // ---- Derive initial form state for this open session ----------------------
  // In edit mode: from the loaded profile. In create mode: DEFAULT_FORM_STATE.
  // Both are re-derived when the dialog opens (via key on ProfileEditor).
  const initialFormState: ProfileFormData = isEditing && loadedProfile
    ? profileToFormData(loadedProfile)
    : DEFAULT_FORM_STATE;

  // ---- Title text -----------------------------------------------------------
  const dialogTitle = isEditing
    ? t("custom_profiles.form.edit_title")
    : t("custom_profiles.form.create_title");
  const dialogDescription = isEditing
    ? (loadedProfile
        ? t("custom_profiles.form.edit_description", { name: loadedProfile.name })
        : t("custom_profiles.form.edit_description", { name: "…" }))
    : t("custom_profiles.form.create_description");

  // ---- Render ---------------------------------------------------------------
  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="flex h-[90dvh] max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl"
          showCloseButton={false}
        >
          {/* Fixed header — never scrolls away */}
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoadingProfile ? (
              <DialogBodySkeleton />
            ) : loadError ? (
              <div className="px-6 py-6">
                <Alert variant="destructive">
                  <AlertDescription>{loadError}</AlertDescription>
                </Alert>
                <div className="mt-4 flex justify-end">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    {t("actions.cancel", { ns: "common" })}
                  </Button>
                </div>
              </div>
            ) : (
              <ProfileEditor
                // Re-mount whenever the open session changes identity so form
                // state is always seeded fresh. Key changes on open+profile combo.
                key={`${open ? "open" : "closed"}-${isEditing ? profileId ?? "new" : "create"}`}
                mode={mode}
                initialFormState={initialFormState}
                onSave={handleSave}
                onCancel={() => handleOpenChange(false)}
                onDirtyChange={setIsDirty}
                currentSettings={!isEditing ? currentSettings : null}
                onLoadCurrentSettings={
                  !isEditing ? refreshCurrentSettings : undefined
                }
                isLoadingCurrent={!isEditing ? isLoadingCurrent : false}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dirty-discard confirm — nested AlertDialog outside the main Dialog so
          both can be open simultaneously without z-index conflict. */}
      <AlertDialog open={showDiscardDialog} onOpenChange={(open) => {
        if (!open) handleDiscardKeep();
      }}>
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
            <AlertDialogCancel onClick={handleDiscardKeep}>
              {t("custom_profiles.form.discard_dialog.keep")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardConfirm}>
              {t("custom_profiles.form.discard_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
