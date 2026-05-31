"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
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

import { ProfileCard } from "@/components/cellular/custom-profiles/profile-card";
import { useScenarioList } from "@/hooks/use-scenario-list";
import type { ProfileSummary } from "@/types/sim-profile";

// =============================================================================
// ProfilesGrid — saved-profiles section header + equal-height card grid
// =============================================================================
// "Saved profiles" label + count on the left, New Profile button on the right.
// Below: auto-fill card grid (minmax 18rem, 1fr) with items-stretch so every
// card in a row shares the same height regardless of optional fields.
// When the only profile is the active one, a dashed-border hint stands in.
// Delete confirmation lives here (the AlertDialog), so ProfileCard stays pure.
// =============================================================================

const NEW_PATH = "/cellular/custom-profiles/new/";

interface ProfilesGridProps {
  profiles: ProfileSummary[];
  activeProfileId: string | null;
  onActivate: (id: string) => void;
  onDelete: (id: string) => Promise<boolean>;
}

export function ProfilesGrid({
  profiles,
  activeProfileId,
  onActivate,
  onDelete,
}: ProfilesGridProps) {
  const { t } = useTranslation("cellular");
  const { nameForId } = useScenarioList();

  const [deleteTarget, setDeleteTarget] = useState<ProfileSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const inactive = useMemo(
    () => profiles.filter((p) => p.id !== activeProfileId),
    [profiles, activeProfileId],
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await onDelete(deleteTarget.id);
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <section>
      {/* Section header — label + count left, New button right */}
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {t("custom_profiles.view.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("custom_profiles.view.count", { count: profiles.length })}
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href={NEW_PATH}>
            <PlusIcon className="size-4" />
            {t("custom_profiles.list.new_button")}
          </Link>
        </Button>
      </header>

      {inactive.length === 0 ? (
        /* Only-active hint: dashed border, centered muted copy */
        <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          {t("custom_profiles.list.only_active_hint")}
        </div>
      ) : (
        /* Equal-height grid: items-stretch + h-full on every card */
        <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] items-stretch gap-4">
          {inactive.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              scenarioName={p.scenario ? nameForId(p.scenario.default) : null}
              onActivate={onActivate}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation — destructive AlertDialog, title + description
          clearly spell out the consequence. Destructive variant on the action. */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("custom_profiles.table.delete_confirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("custom_profiles.table.delete_confirm.description", {
                name: deleteTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("actions.cancel", { ns: "common" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting
                ? t("custom_profiles.table.delete_confirm.deleting")
                : t("custom_profiles.table.delete_confirm.confirm_button")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
