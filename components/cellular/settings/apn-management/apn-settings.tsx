"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import WanProfileListCard from "./wan-profile-list";
import WanProfileEditCard from "./wan-profile-edit";
import MBNCard from "./mbn-card";
import { useWanProfiles } from "@/hooks/use-wan-profiles";
import { useMbnSettings } from "@/hooks/use-mbn-settings";
import { useSimProfiles } from "@/hooks/use-sim-profiles";
import { ProfileOverrideAlert } from "@/components/cellular/custom-profiles/profile-override-alert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

// =============================================================================
// APNSettingsComponent — APN Management page coordinator
// =============================================================================
// Gating: when a Custom SIM Profile is active AND that profile sets a
// non-empty APN, this whole page becomes read-only. The user can still see
// the current configuration but can't edit it — the source of truth is the
// profile. We wrap the cards in a disabled <fieldset> rather than threading
// `disabled` through every WAN profile child.
// =============================================================================

const APNSettingsComponent = () => {
  const { t } = useTranslation("cellular");

  const {
    profiles,
    dataSource,
    isLoading,
    isSaving,
    error,
    saveProfile,
    toggleProfile,
    refresh,
  } = useWanProfiles();

  const {
    profiles: mbnProfiles,
    autoSel,
    isLoading: mbnLoading,
    isSaving: mbnSaving,
    saveMbn,
    rebootDevice,
  } = useMbnSettings();

  const { activeProfileId, getProfile } = useSimProfiles();

  // --- SIM Profile override check (async) ----------------------------------
  // Gate iff the active profile has a non-empty APN name. Empty APN = profile
  // does not manage APN, so we leave the page editable.
  const [profileOverride, setProfileOverride] = useState<{
    profileId: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (!activeProfileId) return;

    let cancelled = false;
    (async () => {
      const profile = await getProfile(activeProfileId);
      if (cancelled) return;

      if (profile && profile.settings.apn.name) {
        setProfileOverride({ profileId: activeProfileId, name: profile.name });
      } else {
        setProfileOverride(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProfileId, getProfile]);

  const isProfileControlled =
    !!activeProfileId && profileOverride?.profileId === activeProfileId;
  const profileName = isProfileControlled
    ? profileOverride.name
    : t("core_settings.apn.managed_by_profile_fallback");

  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const editingProfile =
    editingIndex !== null
      ? profiles?.find((p) => p.index === editingIndex) ?? null
      : null;

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {t("core_settings.apn.page.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("core_settings.apn.page.description")}
        </p>
      </div>

      {error && !isLoading && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircleIcon />
          <AlertTitle>{t("core_settings.apn.page.error_load_title")}</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            <span>{t("core_settings.apn.page.error_load_description")}</span>
            <Button variant="outline" size="sm" onClick={() => refresh()}>
              <RefreshCwIcon className="size-3.5" />
              {t("actions.retry", { ns: "common" })}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isProfileControlled && (
        <ProfileOverrideAlert
          profileName={profileName}
          controls={t("core_settings.apn.controls_label")}
        />
      )}

      {/* Fieldset wrap mirrors the TTL pattern but applies to the whole
          two-card grid. `pointer-events-none opacity-60` makes the
          disabled state visually obvious while leaving values readable. */}
      <fieldset
        disabled={isProfileControlled}
        className={
          isProfileControlled
            ? "pointer-events-none opacity-60 grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4 border-0 p-0 m-0"
            : "grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4 border-0 p-0 m-0"
        }
      >
        <WanProfileListCard
          profiles={profiles}
          isLoading={isLoading}
          isSaving={isSaving}
          onEdit={setEditingIndex}
          onToggle={toggleProfile}
          editingIndex={editingIndex}
        />

        {editingProfile !== null ? (
          <WanProfileEditCard
            key={editingProfile.index}
            profile={editingProfile}
            isSaving={isSaving}
            dataSource={dataSource}
            onSave={saveProfile}
            onCancel={() => setEditingIndex(null)}
          />
        ) : (
          <MBNCard
            profiles={mbnProfiles}
            autoSel={autoSel}
            isLoading={mbnLoading}
            isSaving={mbnSaving}
            onSave={saveMbn}
            onReboot={rebootDevice}
          />
        )}
      </fieldset>
    </div>
  );
};

export default APNSettingsComponent;
