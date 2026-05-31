"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSimProfiles } from "@/hooks/use-sim-profiles";
import { useCurrentSettings } from "@/hooks/use-current-settings";
import { ProfileEditor } from "@/components/cellular/custom-profiles/profile-form/profile-editor";

// =============================================================================
// New Profile page — /cellular/custom-profiles/new
// =============================================================================
// Static-export friendly: a fixed route (no dynamic [id] segment, which can't
// resolve a runtime profile id under `output: export`). Hosts the create flow
// and navigates back to the registry on done / cancel.
// =============================================================================

const LIST_PATH = "/cellular/custom-profiles/";

export default function NewProfilePage() {
  const { t } = useTranslation("cellular");
  const router = useRouter();

  const { createProfile } = useSimProfiles();
  const { settings, isLoading, refresh } = useCurrentSettings(false);

  const back = () => router.push(LIST_PATH);

  return (
    <div className="@container/main mx-auto p-2">
      <header className="mb-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground -ml-2 mb-2"
        >
          <Link href={LIST_PATH}>
            <ArrowLeftIcon className="size-4" />
            {t("custom_profiles.form.back_to_list")}
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("custom_profiles.form.create_title")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t("custom_profiles.form.create_description")}
        </p>
      </header>

      <ProfileEditor
        mode="create"
        onSave={createProfile}
        onDone={back}
        onCancel={back}
        currentSettings={settings}
        onLoadCurrentSettings={refresh}
        isLoadingCurrent={isLoading}
      />
    </div>
  );
}
