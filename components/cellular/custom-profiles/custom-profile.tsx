"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowLeftIcon, RefreshCcwIcon, SearchXIcon } from "lucide-react";

import { ActiveProfileCard } from "@/components/cellular/custom-profiles/active-profile-card";
import { ProfilesGrid } from "@/components/cellular/custom-profiles/profiles-grid";
import { EmptyProfilesState } from "@/components/cellular/custom-profiles/empty-profile";
import { ApplyProgressDialog } from "@/components/cellular/custom-profiles/apply-progress-dialog";
import { ProfileEditor } from "@/components/cellular/custom-profiles/profile-form/profile-editor";

import { useSimProfiles } from "@/hooks/use-sim-profiles";
import type { ProfileFormData } from "@/hooks/use-sim-profiles";
import { useProfileApply } from "@/hooks/use-profile-apply";
import { useModemStatus } from "@/hooks/use-modem-status";
import { useCurrentSettings } from "@/hooks/use-current-settings";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { requestRebootLater } from "@/lib/reboot";
import type { SimProfile } from "@/types/sim-profile";

// =============================================================================
// CustomProfileComponent — Registry + in-place editor, URL-param view machine
// =============================================================================
// ?compose absent/empty → REGISTRY (active card + saved grid + dialogs)
// ?compose=new         → CREATE editor (ProfileEditor mode="create")
// ?compose=<id>        → EDIT editor (ProfileEditor mode="edit" for that id)
//
// Nav helpers mirror traffic-engine's setViewModeAndUrl: URLSearchParams +
// router.replace with scroll:false. AnimatePresence crossfade (keyed "registry"
// vs "editor", EXPO ~0.28s, reduced-motion → opacity-only) between views.
// Editor brings its own page shell; registry wraps in @container/main mx-auto p-2.
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] items-stretch gap-4">
          {[0, 1, 2].map((i) => (
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

// Edit form loading skeleton — matches the editor layout shape
function EditFormSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-12 w-full rounded-lg" />
      <Card>
        <CardContent className="space-y-4 py-6">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-2/3 rounded-md" />
        </CardContent>
      </Card>
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
// Edit view inner — loads profile by id, renders skeleton/not-found/editor
// ---------------------------------------------------------------------------
interface EditViewProps {
  id: string;
  getProfile: (id: string) => Promise<SimProfile | null>;
  updateProfile: (id: string, data: ProfileFormData) => Promise<boolean>;
  onDone: () => void;
  onCancel: () => void;
  refresh: () => void;
}

function EditView({ id, getProfile, updateProfile, onDone, onCancel, refresh }: EditViewProps) {
  const { t } = useTranslation("cellular");
  // undefined=loading, null=not-found, SimProfile=loaded
  // Track the id we last resolved to detect stale state across id changes
  const [resolved, setResolved] = useState<{ id: string; profile: SimProfile | null } | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let active = true;
    getProfile(id).then((p) => {
      // Only set state in the async callback — satisfies React-compiler setState-in-effect rule
      if (active) setResolved({ id, profile: p ?? null });
    });
    return () => {
      active = false;
    };
  }, [id, getProfile]);

  // If we haven't resolved for the current id yet → loading
  const profile: SimProfile | null | undefined =
    !id ? null : resolved?.id === id ? resolved.profile : undefined;

  if (profile === undefined) {
    return <EditFormSkeleton />;
  }

  if (profile === null) {
    return (
      <div className="@container/main mx-auto p-2">
        <Card>
          <CardContent className="flex items-center justify-center py-10">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>{t("custom_profiles.edit.not_found_title")}</EmptyTitle>
                <EmptyDescription>{t("custom_profiles.edit.not_found_desc")}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={onCancel}>
                  <ArrowLeftIcon className="size-4" />
                  {t("custom_profiles.form.back_to_list")}
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ProfileEditor
      mode="edit"
      initialProfile={profile}
      onSave={(data) =>
        updateProfile(profile.id, data).then((ok) => (ok ? profile.id : null))
      }
      onDone={() => {
        onDone();
        refresh();
      }}
      onCancel={onCancel}
    />
  );
}

// ---------------------------------------------------------------------------
// Create view inner — mounts ProfileEditor in create mode with current settings
// ---------------------------------------------------------------------------
interface CreateViewProps {
  createProfile: (data: ProfileFormData) => Promise<string | null>;
  onDone: () => void;
  onCancel: () => void;
  refresh: () => void;
}

function CreateView({ createProfile, onDone, onCancel, refresh }: CreateViewProps) {
  const { settings, isLoading, refresh: refreshCurrent } = useCurrentSettings(false);

  return (
    <ProfileEditor
      mode="create"
      onSave={createProfile}
      onDone={() => {
        onDone();
        refresh();
      }}
      onCancel={onCancel}
      currentSettings={settings}
      onLoadCurrentSettings={refreshCurrent}
      isLoadingCurrent={isLoading}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const CustomProfileComponent = () => {
  const { t } = useTranslation("cellular");
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();

  const compose = searchParams.get("compose");
  // compose === "new" → create, compose is non-empty other value → edit that id,
  // compose absent/null/empty → registry
  const isEditor = compose !== null && compose !== "";
  const isCreate = compose === "new";
  const editId = isEditor && !isCreate ? compose : null;

  const EXPO = [0.16, 1, 0.3, 1] as const;

  // ---------------------------------------------------------------------------
  // URL navigation helpers — mirror traffic-engine's setViewModeAndUrl pattern
  // ---------------------------------------------------------------------------
  const openNew = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("compose", "new");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [router, searchParams]);

  const openEdit = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("compose", id);
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  const closeEditor = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("compose");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [router, searchParams]);

  // ---------------------------------------------------------------------------
  // Registry hooks — always called (no conditional hook calls)
  // ---------------------------------------------------------------------------
  const {
    profiles,
    activeProfileId,
    isLoading,
    error,
    deleteProfile,
    deactivateProfile,
    getProfile,
    createProfile,
    updateProfile,
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

  const showSkeleton = useDelayedFlag(isLoading);
  const activeSummary = profiles.find((p) => p.id === activeProfileId) ?? null;

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

  // ---------------------------------------------------------------------------
  // Render: editor view vs registry view — AnimatePresence crossfade
  // ---------------------------------------------------------------------------
  // Editor view: ProfileEditor renders its own page shell (@container/main mx-auto p-2
  // + header). We mount it directly without an extra wrapper.
  // Registry view: we own the @container/main shell + header.
  // ---------------------------------------------------------------------------

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        {isEditor ? (
          <motion.div
            key="editor"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: EXPO }}
          >
            {isCreate ? (
              <CreateView
                createProfile={createProfile}
                onDone={closeEditor}
                onCancel={closeEditor}
                refresh={refresh}
              />
            ) : editId ? (
              <EditView
                id={editId}
                getProfile={getProfile}
                updateProfile={updateProfile}
                onDone={closeEditor}
                onCancel={closeEditor}
                refresh={refresh}
              />
            ) : null}
          </motion.div>
        ) : (
          <motion.div
            key="registry"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: EXPO }}
          >
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
                <EmptyProfilesState onRefresh={refresh} onNew={openNew} />
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
                      isDeactivating={isDeactivating}
                      onEdit={openEdit}
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
                      onNew={openNew}
                      onEdit={openEdit}
                    />
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </>
  );
};

export default CustomProfileComponent;
