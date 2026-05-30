"use client";

import React from "react";
import { useTranslation } from "react-i18next";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CustomProfileForm } from "@/components/cellular/custom-profiles/custom-profile-form";
import type { SimProfile, CurrentModemSettings } from "@/types/sim-profile";
import type { ProfileFormData } from "@/hooks/use-sim-profiles";

// =============================================================================
// ProfileFormSheet — right-anchored editor surface
// =============================================================================
// Houses the create/edit form so the page's resting view stays focused on the
// registry. Made a container (@container/sheet) so the form's two-column field
// rows respond to the Sheet's own width rather than the viewport.
// =============================================================================

interface ProfileFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null = create mode; a full profile = edit mode. */
  editingProfile: SimProfile | null;
  onSave: (data: ProfileFormData) => Promise<string | null>;
  currentSettings?: CurrentModemSettings | null;
  onLoadCurrentSettings?: () => void;
  isLoadingCurrent?: boolean;
}

export function ProfileFormSheet({
  open,
  onOpenChange,
  editingProfile,
  onSave,
  currentSettings,
  onLoadCurrentSettings,
  isLoadingCurrent,
}: ProfileFormSheetProps) {
  const { t } = useTranslation("cellular");
  const isEditing = !!editingProfile;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="@container/sheet flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b">
          <SheetTitle>
            {isEditing
              ? t("custom_profiles.form.edit_title")
              : t("custom_profiles.form.create_title")}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? t("custom_profiles.form.edit_description", {
                  name: editingProfile?.name ?? "",
                })
              : t("custom_profiles.form.create_description")}
          </SheetDescription>
        </SheetHeader>

        {/* Remount the form per editing target so its internal prefill/reset
            state starts clean each time the Sheet opens. */}
        <CustomProfileForm
          key={editingProfile?.id ?? "new"}
          editingProfile={editingProfile}
          onSave={onSave}
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
          currentSettings={currentSettings}
          onLoadCurrentSettings={onLoadCurrentSettings}
          isLoadingCurrent={isLoadingCurrent}
        />
      </SheetContent>
    </Sheet>
  );
}
