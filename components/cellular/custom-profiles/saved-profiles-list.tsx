"use client";

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PlusIcon,
  PlayIcon,
  PowerIcon,
  PencilIcon,
  Trash2Icon,
  MoreVerticalIcon,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ProfileStatusBadge,
  deriveProfileState,
} from "@/components/cellular/custom-profiles/profile-status-badge";
import { ProfileConfigPills } from "@/components/cellular/custom-profiles/profile-config-pills";
import type { ProfileSummary, SimProfile } from "@/types/sim-profile";
import { formatProfileDate } from "@/types/sim-profile";
import { cn } from "@/lib/utils";

// =============================================================================
// SavedProfilesList — the registry
// =============================================================================
// Replaces the old data table with UniFi-heritage pill-dense rows. Each row
// carries its identity and status at rest, and expands to reveal the full
// settings bundle (lazy getProfile, cached per id). The primary lifecycle
// action (Activate / Deactivate) sits inline; edit + delete live behind an
// overflow menu. The expand trigger and the action buttons are siblings, not
// nested, so the row stays keyboard-accessible.
// =============================================================================

const PAGE_SIZE = 10;

interface SavedProfilesListProps {
  profiles: ProfileSummary[];
  activeProfileId: string | null;
  currentIccid: string | null | undefined;
  getProfile: (id: string) => Promise<SimProfile | null>;
  onActivate: (id: string) => void;
  onDeactivate: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<boolean>;
  onNew: () => void;
}

export function SavedProfilesList({
  profiles,
  activeProfileId,
  currentIccid,
  getProfile,
  onActivate,
  onDeactivate,
  onEdit,
  onDelete,
  onNew,
}: SavedProfilesListProps) {
  const { t } = useTranslation("cellular");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, SimProfile | null>>(
    {},
  );
  const [deleteTarget, setDeleteTarget] = useState<ProfileSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [page, setPage] = useState(0);

  const pageCount = Math.ceil(profiles.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  const pageItems = useMemo(
    () => profiles.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [profiles, safePage],
  );

  const handleExpand = (value: string) => {
    setExpandedId(value || null);
    if (value && !(value in detailCache)) {
      getProfile(value).then((p) =>
        setDetailCache((prev) => ({ ...prev, [value]: p })),
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await onDelete(deleteTarget.id);
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("custom_profiles.view.title")}</CardTitle>
        <CardDescription>
          {t("custom_profiles.view.count", { count: profiles.length })}
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={onNew}>
            <PlusIcon className="size-4" />
            {t("custom_profiles.list.new_button")}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Accordion
            type="single"
            collapsible
            value={expandedId ?? ""}
            onValueChange={handleExpand}
          >
            {pageItems.map((p) => {
              const isActive = p.id === activeProfileId;
              const state = deriveProfileState(isActive, p.sim_iccid, currentIccid);
              const detail = detailCache[p.id];
              const isLoadingDetail =
                expandedId === p.id && !(p.id in detailCache);

              return (
                <AccordionItem
                  key={p.id}
                  value={p.id}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "border-b px-3 last:border-b-0",
                    isActive && "bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-1">
                    <AccordionTrigger className="flex-1 items-center py-3 hover:no-underline">
                      <span className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {p.name}
                          </span>
                          {p.mno && (
                            <span className="text-muted-foreground block truncate text-xs">
                              {p.mno}
                            </span>
                          )}
                        </span>
                        <ProfileStatusBadge state={state} />
                        <span className="text-muted-foreground ml-auto hidden text-xs tabular-nums sm:inline">
                          {formatProfileDate(p.updated_at)}
                        </span>
                      </span>
                    </AccordionTrigger>

                    <div className="flex shrink-0 items-center gap-1">
                      {isActive ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={onDeactivate}
                        >
                          <PowerIcon className="size-4" />
                          <span className="sr-only sm:not-sr-only">
                            {t("custom_profiles.table.actions_menu.deactivate")}
                          </span>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onActivate(p.id)}
                        >
                          <PlayIcon className="size-4" />
                          <span className="sr-only sm:not-sr-only">
                            {t("custom_profiles.table.actions_menu.activate")}
                          </span>
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground size-8"
                          >
                            <MoreVerticalIcon className="size-4" />
                            <span className="sr-only">
                              {t("custom_profiles.table.actions_menu.open_menu")}
                            </span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => onEdit(p.id)}>
                            <PencilIcon className="size-4" />
                            {t("custom_profiles.table.actions_menu.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <Trash2Icon className="size-4" />
                            {t("custom_profiles.table.actions_menu.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <AccordionContent className="pb-3">
                    {isLoadingDetail ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Skeleton className="h-6 w-28 rounded-md" />
                        <Skeleton className="h-6 w-16 rounded-md" />
                        <Skeleton className="h-6 w-20 rounded-md" />
                      </div>
                    ) : detail ? (
                      <div className="space-y-3">
                        <ProfileConfigPills profile={detail} />
                        {detail.sim_iccid && (
                          <p className="text-muted-foreground text-xs tabular-nums">
                            {t("custom_profiles.list.bound_sim", {
                              iccid: detail.sim_iccid,
                            })}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        {t("custom_profiles.list.detail_unavailable")}
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between pt-3">
            <span className="text-muted-foreground text-sm tabular-nums">
              {t("custom_profiles.table.pagination.page_info", {
                current: safePage + 1,
                total: pageCount,
              })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((n) => Math.max(0, n - 1))}
                disabled={safePage === 0}
              >
                {t("custom_profiles.table.pagination.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((n) => Math.min(pageCount - 1, n + 1))}
                disabled={safePage >= pageCount - 1}
              >
                {t("custom_profiles.table.pagination.next")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Delete confirmation */}
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
    </Card>
  );
}
