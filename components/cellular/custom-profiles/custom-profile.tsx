"use client";

import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { ActiveProfileCard } from "@/components/cellular/custom-profiles/active-profile-card";
import { SavedProfilesList } from "@/components/cellular/custom-profiles/saved-profiles-list";
import { ProfileFormSheet } from "@/components/cellular/custom-profiles/profile-form-sheet";
import { EmptyProfilesState } from "@/components/cellular/custom-profiles/empty-profile";
import { ApplyProgressDialog } from "@/components/cellular/custom-profiles/apply-progress-dialog";

import { useSimProfiles, type ProfileFormData } from "@/hooks/use-sim-profiles";
import { useProfileApply } from "@/hooks/use-profile-apply";
import { useCurrentSettings } from "@/hooks/use-current-settings";
import { useModemStatus } from "@/hooks/use-modem-status";
import type { SimProfile } from "@/types/sim-profile";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
// CustomProfileComponent — Page Layout & State Coordinator
// =============================================================================
// Registry-first composition: the Active Profile spine and the Saved Profiles
// registry are the page; create/edit lives in a right-anchored Sheet. Owns the
// profile CRUD, apply lifecycle, current-SIM query, and all confirmation flows.
// =============================================================================

function ProfilesSkeleton() {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-1.5">
            <Skeleton className="h-6 w-28 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

const CustomProfileComponent = () => {
  const { t } = useTranslation("cellular");

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

  const {
    settings: currentSettings,
    isLoading: isLoadingCurrent,
    refresh: refreshCurrentSettings,
  } = useCurrentSettings(false);

  const { data: modemStatus } = useModemStatus();
  const currentIccid = modemStatus?.device?.iccid ?? null;

  // Sheet (create / edit) state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<SimProfile | null>(null);

  // Apply confirmation state
  const [activateTarget, setActivateTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showApplyProgress, setShowApplyProgress] = useState(false);

  // Deactivate confirmation state
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const activeSummary =
    profiles.find((p) => p.id === activeProfileId) ?? null;

  // ---------------------------------------------------------------------------
  // Create / Edit Sheet
  // ---------------------------------------------------------------------------
  const handleNew = useCallback(() => {
    setEditingProfile(null);
    setSheetOpen(true);
  }, []);

  const handleEdit = useCallback(
    async (id: string) => {
      const profile = await getProfile(id);
      if (profile) {
        setEditingProfile(profile);
        setSheetOpen(true);
      }
    },
    [getProfile],
  );

  const handleSheetOpenChange = useCallback((open: boolean) => {
    setSheetOpen(open);
    if (!open) setEditingProfile(null);
  }, []);

  const handleSave = useCallback(
    async (data: ProfileFormData): Promise<string | null> => {
      if (editingProfile) {
        const success = await updateProfile(editingProfile.id, data);
        return success ? editingProfile.id : null;
      }
      return await createProfile(data);
    },
    [editingProfile, createProfile, updateProfile],
  );

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  const handleDelete = useCallback(
    async (id: string): Promise<boolean> => {
      const success = await deleteProfile(id);
      if (success && editingProfile?.id === id) {
        setEditingProfile(null);
        setSheetOpen(false);
      }
      return success;
    },
    [deleteProfile, editingProfile],
  );

  // ---------------------------------------------------------------------------
  // Activate: confirm → apply
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
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">
          {t("custom_profiles.page.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("custom_profiles.page.description")}
        </p>
      </div>

      {isLoading ? (
        <ProfilesSkeleton />
      ) : profiles.length === 0 ? (
        <EmptyProfilesState onNew={handleNew} onRefresh={refresh} />
      ) : (
        <div className="grid gap-4">
          <ActiveProfileCard
            activeSummary={activeSummary}
            currentIccid={currentIccid}
            getProfile={getProfile}
            onDeactivate={handleDeactivateRequest}
            isDeactivating={isDeactivating}
          />
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
          <SavedProfilesList
            profiles={profiles}
            activeProfileId={activeProfileId}
            currentIccid={currentIccid}
            getProfile={getProfile}
            onActivate={handleActivateRequest}
            onDeactivate={handleDeactivateRequest}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onNew={handleNew}
          />
        </div>
      )}

      {/* Create / Edit Sheet */}
      <ProfileFormSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        editingProfile={editingProfile}
        onSave={handleSave}
        currentSettings={currentSettings}
        onLoadCurrentSettings={refreshCurrentSettings}
        isLoadingCurrent={isLoadingCurrent}
      />

      {/* Activate Confirmation Dialog */}
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

      {/* Deactivate Confirmation Dialog */}
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

      {/* Apply Progress Dialog */}
      <ApplyProgressDialog
        open={showApplyProgress}
        onClose={handleApplyProgressClose}
        applyState={applyState}
        error={applyError}
      />
    </div>
  );
};

export default CustomProfileComponent;
