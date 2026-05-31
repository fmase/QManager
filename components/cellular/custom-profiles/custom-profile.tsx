"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, RefreshCcwIcon } from "lucide-react";

import { ActiveProfileCard } from "@/components/cellular/custom-profiles/active-profile-card";
import { ProfilesGrid } from "@/components/cellular/custom-profiles/profiles-grid";
import { EmptyProfilesState } from "@/components/cellular/custom-profiles/empty-profile";
import { ApplyProgressDialog } from "@/components/cellular/custom-profiles/apply-progress-dialog";
import { ProfileEditorDialog } from "@/components/cellular/custom-profiles/profile-form/profile-editor-dialog";

import { useSimProfiles, type ProfileFormData } from "@/hooks/use-sim-profiles";
import { useProfileApply } from "@/hooks/use-profile-apply";
import { useModemStatus } from "@/hooks/use-modem-status";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { requestRebootLater } from "@/lib/reboot";

// =============================================================================
// CustomProfileComponent — Registry page & lifecycle coordinator
// =============================================================================
// State machine: loading → error | empty | loaded.
// Loaded: active-profile card + saved-profiles grid.
// Manages activate / deactivate confirmation dialogs + apply-progress lifecycle.
// Mirrors traffic-engine.tsx shell: header → state machine → dialogs.
// =============================================================================

// ---------------------------------------------------------------------------
// Registry loading skeleton — mirrors the LOADED layout so there is no layout
// snap. One tall card (active-profile spine) + a 3-column grid of profile
// cards below.
// ---------------------------------------------------------------------------
function RegistrySkeleton() {
  return (
    <div className="space-y-8">
      {/* Active profile card skeleton */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-6 w-28 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
        <Skeleton className="h-4 w-52" />
        <div className="border-t pt-4 flex gap-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>

      {/* Saved profiles section */}
      <div className="space-y-4">
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
        <div className="grid grid-cols-1 items-stretch gap-4 @3xl/main:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border bg-card flex flex-col">
              <div className="p-6 space-y-1.5">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="px-6 pb-4 flex-1 space-y-2.5">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="border-t p-4">
                <Skeleton className="h-8 w-full rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Suppresses the skeleton flash on fast loads (the app runs on the modem;
 * sub-100ms loads are common). Only shows the skeleton once the flag has held
 * for `delayMs`. setState in the timer callback only — satisfies the
 * React-compiler setState-in-effect rule.
 */
function useDelayedFlag(active: boolean, delayMs = 160) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setShown(true), delayMs);
    return () => {
      clearTimeout(id);
      setShown(false);
    };
  }, [active, delayMs]);
  return active && shown;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const CustomProfileComponent = () => {
  const { t } = useTranslation("cellular");
  const reduceMotion = useReducedMotion();

  const {
    profiles,
    activeProfileId,
    isLoading,
    error,
    createProfile,
    updateProfile,
    deleteProfile,
    deactivateProfile,
    getProfile,
    refresh,
  } = useSimProfiles();

  const {
    applyState,
    applyProfile,
    reset: resetApply,
    error: applyError,
  } = useProfileApply();

  const { data: modemStatus } = useModemStatus();
  const currentIccid = modemStatus?.device?.iccid ?? null;

  // Activate confirmation state
  const [activateTarget, setActivateTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showApplyProgress, setShowApplyProgress] = useState(false);

  // Deactivate confirmation state
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // In-page create/edit editor dialog (replaces the old /new and /edit routes)
  const [editor, setEditor] = useState<{
    open: boolean;
    mode: "create" | "edit";
    profileId: string | null;
  }>({ open: false, mode: "create", profileId: null });

  const handleNew = useCallback(() => {
    setEditor({ open: true, mode: "create", profileId: null });
  }, []);

  const handleEdit = useCallback((id: string) => {
    setEditor({ open: true, mode: "edit", profileId: id });
  }, []);

  // Bind create vs update by the dialog's mode. Returns the id on success.
  const handleEditorSave = useCallback(
    async (data: ProfileFormData): Promise<string | null> => {
      if (editor.mode === "edit" && editor.profileId) {
        const ok = await updateProfile(editor.profileId, data);
        return ok ? editor.profileId : null;
      }
      return createProfile(data);
    },
    [editor.mode, editor.profileId, updateProfile, createProfile],
  );

  // The CRUD hook already refetches on success; just close the dialog.
  const handleEditorSaved = useCallback(() => {
    setEditor((e) => ({ ...e, open: false }));
  }, []);

  const showSkeleton = useDelayedFlag(isLoading);
  const activeSummary = profiles.find((p) => p.id === activeProfileId) ?? null;

  const EXPO = [0.16, 1, 0.3, 1] as const;

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  const handleDelete = useCallback(
    (id: string): Promise<boolean> => deleteProfile(id),
    [deleteProfile],
  );

  // ---------------------------------------------------------------------------
  // Activate: confirm → apply progress
  // ---------------------------------------------------------------------------
  const handleActivateRequest = useCallback(
    (id: string) => {
      const profile = profiles.find((p) => p.id === id);
      if (profile) setActivateTarget({ id: profile.id, name: profile.name });
    },
    [profiles],
  );

  const handleActivateConfirm = useCallback(async () => {
    if (!activateTarget) return;
    setActivateTarget(null);
    setShowApplyProgress(true);
    await applyProfile(activateTarget.id);
  }, [activateTarget, applyProfile]);

  const handleApplyProgressClose = useCallback(() => {
    setShowApplyProgress(false);
    resetApply();
    refresh();
  }, [resetApply, refresh]);

  // ---------------------------------------------------------------------------
  // Deactivate: confirm → clear marker
  // ---------------------------------------------------------------------------
  const handleDeactivateRequest = useCallback(() => {
    setShowDeactivateConfirm(true);
  }, []);

  const handleDeactivateConfirm = useCallback(async () => {
    setIsDeactivating(true);
    const result = await deactivateProfile();
    if (result.requiresReboot) {
      requestRebootLater("verizon_revert");
    }
    setIsDeactivating(false);
    setShowDeactivateConfirm(false);
  }, [deactivateProfile]);

  return (
    <div className="@container/main mx-auto p-2">
      {/* Page header — matches traffic-engine shell exactly */}
      <header className="mb-6">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">
          {t("custom_profiles.page.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("custom_profiles.page.description")}
        </p>
      </header>

      {/* State machine: loading / error / empty / loaded */}
      {isLoading ? (
        showSkeleton ? (
          <RegistrySkeleton />
        ) : null
      ) : error && profiles.length === 0 ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertTriangle className="size-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{t("custom_profiles.page.error_load_failed")}</span>
            <Button variant="outline" size="sm" onClick={() => refresh()}>
              <RefreshCcwIcon className="size-3.5" />
              {t("actions.retry", { ns: "common" })}
            </Button>
          </AlertDescription>
        </Alert>
      ) : profiles.length === 0 ? (
        <EmptyProfilesState onRefresh={refresh} onNew={handleNew} />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key="loaded"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: EXPO }}
            className="space-y-8"
          >
            {/* Active profile spine */}
            <ActiveProfileCard
              activeSummary={activeSummary}
              currentIccid={currentIccid}
              getProfile={getProfile}
              onDeactivate={handleDeactivateRequest}
              onEdit={handleEdit}
              isDeactivating={isDeactivating}
            />

            {/* Soft error banner — stale data still shown, error reported inline */}
            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}

            {/* Saved profiles registry */}
            <ProfilesGrid
              profiles={profiles}
              activeProfileId={activeProfileId}
              onActivate={handleActivateRequest}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onNew={handleNew}
            />
          </motion.div>
        </AnimatePresence>
      )}

      {/* Activate confirmation */}
      <AlertDialog
        open={!!activateTarget}
        onOpenChange={(open) => !open && setActivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("custom_profiles.activate_dialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("custom_profiles.activate_dialog.description", {
                name: activateTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("actions.cancel", { ns: "common" })}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleActivateConfirm}>
              {t("custom_profiles.activate_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate confirmation */}
      <AlertDialog
        open={showDeactivateConfirm}
        onOpenChange={(open) =>
          !open && !isDeactivating && setShowDeactivateConfirm(false)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("custom_profiles.deactivate_dialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("custom_profiles.deactivate_dialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeactivating}>
              {t("actions.cancel", { ns: "common" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateConfirm}
              disabled={isDeactivating}
            >
              {isDeactivating
                ? t("custom_profiles.deactivate_dialog.deactivating")
                : t("custom_profiles.deactivate_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Apply progress pipeline — not redesigned, mounted exactly as before */}
      <ApplyProgressDialog
        open={showApplyProgress}
        onClose={handleApplyProgressClose}
        applyState={applyState}
        error={applyError}
      />

      {/* In-page create/edit editor — replaces the old /new and /edit routes */}
      <ProfileEditorDialog
        open={editor.open}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
        mode={editor.mode}
        profileId={editor.profileId}
        getProfile={getProfile}
        onSave={handleEditorSave}
        onSaved={handleEditorSaved}
      />
    </div>
  );
};

export default CustomProfileComponent;
