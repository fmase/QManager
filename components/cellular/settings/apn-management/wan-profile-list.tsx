"use client";

import React from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { GlobeIcon, MinusCircleIcon, CircleIcon, PencilIcon } from "lucide-react";

import type { WanProfile } from "@/types/wan-profiles";

// =============================================================================
// Props
// =============================================================================

interface WanProfileListCardProps {
  profiles: WanProfile[] | null;
  isLoading: boolean;
  isSaving: boolean;
  editingId: number | null;
  onEdit: (id: number) => void;
  /** Activate a slot (mutually exclusive). Returns true on success. */
  onActivate: (id: number) => Promise<boolean>;
}

// =============================================================================
// Animation Variants
// =============================================================================

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

// =============================================================================
// Status Badge — "Active" marks the live data profile (Internet APN).
// The globe inherits the badge text color (currentColor), no color override.
// =============================================================================

function ProfileStatusBadge({ profile }: { profile: WanProfile }) {
  const { t } = useTranslation("cellular");
  const configured = !!profile.apn;

  if (profile.is_active && configured) {
    const label = t("core_settings.apn.list.status.active");
    return (
      <Badge
        variant="outline"
        className="bg-success/15 text-success hover:bg-success/20 border-success/30"
        title={label}
      >
        <GlobeIcon className="size-3" />
        <span className="sr-only @xs/card:not-sr-only">{label}</span>
      </Badge>
    );
  }

  if (!configured) {
    const label = t("core_settings.apn.list.status.empty");
    return (
      <Badge
        variant="outline"
        className="bg-muted/40 text-muted-foreground/70 border-muted-foreground/20"
        title={label}
      >
        <MinusCircleIcon className="size-3" />
        <span className="sr-only @xs/card:not-sr-only">{label}</span>
      </Badge>
    );
  }

  const label = t("core_settings.apn.list.status.idle");
  return (
    <Badge
      variant="outline"
      className="bg-muted/50 text-muted-foreground border-muted-foreground/30"
      title={label}
    >
      <CircleIcon className="size-3" />
      <span className="sr-only @xs/card:not-sr-only">{label}</span>
    </Badge>
  );
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function WanProfileListSkeleton() {
  const { t } = useTranslation("cellular");
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("core_settings.apn.list.card.title")}</CardTitle>
        <CardDescription>
          {t("core_settings.apn.list.card.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid divide-y divide-border border-y border-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[auto_1fr_auto] @md/card:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-3 gap-y-2 py-3"
            >
              <Skeleton className="size-7 rounded-full" />
              <div className="space-y-1.5 min-w-0">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-5 @xs/card:w-20 rounded-full" />
              <div className="col-start-2 col-span-2 flex items-center gap-2 justify-end @md/card:contents">
                <Skeleton className="h-[1.15rem] w-8 rounded-full" />
                <Skeleton className="size-8 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Component
// =============================================================================

export default function WanProfileListCard({
  profiles,
  isLoading,
  isSaving,
  editingId,
  onEdit,
  onActivate,
}: WanProfileListCardProps) {
  const { t } = useTranslation("cellular");
  const shouldReduceMotion = useReducedMotion();

  if (isLoading) return <WanProfileListSkeleton />;

  // Resolve a human label for toasts/aria — falls back to the slot number.
  const labelFor = (profile: WanProfile) =>
    profile.name || t("core_settings.apn.list.slot", { id: profile.id });

  const handleActivate = async (profile: WanProfile, checked: boolean) => {
    // Radio semantics: only the OFF→ON edge activates. The active slot's
    // switch is disabled below, so a turn-off edge can't reach here.
    if (!checked) return;
    const name = labelFor(profile);
    const success = await onActivate(profile.id);
    if (success) {
      toast.success(t("core_settings.apn.list.toast.activated", { name }));
    } else {
      toast.error(t("core_settings.apn.list.toast.activate_error", { name }));
    }
  };

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("core_settings.apn.list.card.title")}</CardTitle>
        <CardDescription>
          {t("core_settings.apn.list.card.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!profiles || profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MinusCircleIcon className="size-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {t("core_settings.apn.list.empty.title")}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t("core_settings.apn.list.empty.subtitle")}
            </p>
          </div>
        ) : (
          <motion.div
            className="grid divide-y divide-border border-y border-border"
            variants={containerVariants}
            initial={shouldReduceMotion ? false : "hidden"}
            animate="visible"
          >
            {profiles.map((profile) => {
              const isEditing = editingId === profile.id;
              const configured = !!profile.apn;
              const name = labelFor(profile);

              return (
                <motion.div
                  key={profile.id}
                  variants={itemVariants}
                  initial={shouldReduceMotion ? false : "hidden"}
                  animate="visible"
                  className={`grid grid-cols-[auto_1fr_auto] @md/card:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-3 gap-y-2 py-3 px-2 rounded-sm transition-colors duration-200 ${
                    isEditing ? "bg-accent/50" : ""
                  }`}
                >
                  {/* Slot id */}
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                      profile.is_active && configured
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {profile.id}
                  </span>

                  {/* Name + APN (target CID) */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {profile.name || (
                          <span className="text-muted-foreground italic">
                            {t("core_settings.apn.list.unnamed")}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {configured
                        ? t("core_settings.apn.list.apn_on_cid", {
                            apn: profile.apn,
                            cid: profile.cid,
                          })
                        : t("core_settings.apn.list.no_apn")}
                    </p>
                  </div>

                  {/* Status badge — column 3 always */}
                  <ProfileStatusBadge profile={profile} />

                  {/* Switch + Edit — row 2 on narrow, cols 4-5 inline at @md/card */}
                  <div className="col-start-2 col-span-2 flex items-center gap-2 justify-end @md/card:contents">
                    <Switch
                      checked={profile.is_active}
                      onCheckedChange={(checked) =>
                        handleActivate(profile, checked)
                      }
                      // Radio: the active slot can't be turned off (there is
                      // always one live data profile); empty slots can't be
                      // activated until an APN is saved.
                      disabled={isSaving || !configured || profile.is_active}
                      aria-label={
                        profile.is_active
                          ? t("core_settings.apn.list.aria.active_switch", { name })
                          : t("core_settings.apn.list.aria.activate_switch", { name })
                      }
                    />

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(profile.id)}
                      disabled={isSaving}
                      aria-label={t("core_settings.apn.list.aria.edit_button", { name })}
                    >
                      <PencilIcon className="size-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
