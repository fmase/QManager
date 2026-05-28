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
import {
  CheckCircle2Icon,
  MinusCircleIcon,
  XCircleIcon,
  PencilIcon,
} from "lucide-react";

import type { WanProfile } from "@/types/wan-profiles";
import { isCarrierProfile, isProfileConnected } from "@/types/wan-profiles";

// =============================================================================
// Props
// =============================================================================

interface WanProfileListCardProps {
  profiles: WanProfile[] | null;
  isLoading: boolean;
  isSaving: boolean;
  editingIndex: number | null;
  onEdit: (index: number) => void;
  onToggle: (index: number, enabled: boolean) => Promise<boolean>;
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
// Status Badge
// =============================================================================

function ProfileStatusBadge({ profile }: { profile: WanProfile }) {
  const { t } = useTranslation("cellular");
  const connected = isProfileConnected(profile);

  if (connected) {
    const label = t("core_settings.apn.list.status.connected");
    return (
      <Badge
        variant="outline"
        className="bg-success/15 text-success hover:bg-success/20 border-success/30"
        title={label}
      >
        <CheckCircle2Icon className="size-3" />
        <span className="sr-only @xs/card:not-sr-only">{label}</span>
      </Badge>
    );
  }

  if (profile.pdp_error && profile.enabled) {
    const label = t("core_settings.apn.list.status.error");
    return (
      <Badge
        variant="outline"
        className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30"
        title={label}
      >
        <XCircleIcon className="size-3" />
        <span className="sr-only @xs/card:not-sr-only">{label}</span>
      </Badge>
    );
  }

  const label = t("core_settings.apn.list.status.disconnected");
  return (
    <Badge
      variant="outline"
      className="bg-muted/50 text-muted-foreground border-muted-foreground/30"
      title={label}
    >
      <MinusCircleIcon className="size-3" />
      <span className="sr-only @xs/card:not-sr-only">{label}</span>
    </Badge>
  );
}

// =============================================================================
// APN Type Badge (for carrier-provisioned profiles)
// =============================================================================

function ApnTypeBadge({ apnType }: { apnType: string }) {
  const { t } = useTranslation("cellular");
  if (apnType === "default" || !apnType) return null;

  const label =
    apnType === "ims"
      ? t("core_settings.apn.list.apn_type.ims_label")
      : apnType === "emergency"
        ? t("core_settings.apn.list.apn_type.sos_label")
        : apnType.toUpperCase();
  const tooltip =
    apnType === "ims"
      ? t("core_settings.apn.list.apn_type.ims_tooltip")
      : apnType === "emergency"
        ? t("core_settings.apn.list.apn_type.sos_tooltip")
        : t("core_settings.apn.list.apn_type.other_tooltip", { label });

  return (
    <Badge
      variant="outline"
      className="bg-info/15 text-info hover:bg-info/20 border-info/30"
      title={tooltip}
    >
      {label}
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
          {Array.from({ length: 6 }).map((_, i) => (
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
  editingIndex,
  onEdit,
  onToggle,
}: WanProfileListCardProps) {
  const { t } = useTranslation("cellular");
  const shouldReduceMotion = useReducedMotion();

  if (isLoading) return <WanProfileListSkeleton />;

  const handleToggle = async (profile: WanProfile, checked: boolean) => {
    const success = await onToggle(profile.index, checked);
    if (success) {
      toast.success(
        checked
          ? t("core_settings.apn.list.toast.enabled", { index: profile.index })
          : t("core_settings.apn.list.toast.disabled", { index: profile.index })
      );
    } else {
      toast.error(
        checked
          ? t("core_settings.apn.list.toast.enable_error", { index: profile.index })
          : t("core_settings.apn.list.toast.disable_error", { index: profile.index })
      );
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
              const carrier = isCarrierProfile(profile);
              const isEditing = editingIndex === profile.index;

              return (
                <motion.div
                  key={profile.index}
                  variants={itemVariants}
                  initial={shouldReduceMotion ? false : "hidden"}
                  animate="visible"
                  className={`grid grid-cols-[auto_1fr_auto] @md/card:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-3 gap-y-2 py-3 px-2 rounded-sm transition-colors duration-200 ${
                    isEditing ? "bg-accent/50" : ""
                  }`}
                >
                  {/* Profile number */}
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
                    {profile.index}
                  </span>

                  {/* Name + APN */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {profile.name || (
                          <span className="text-muted-foreground italic">
                            {t("core_settings.apn.list.unnamed")}
                          </span>
                        )}
                      </p>
                      <ApnTypeBadge apnType={profile.apn_type} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {profile.apn || t("core_settings.apn.list.no_apn")}
                    </p>
                  </div>

                  {/* Status badge — column 3 always */}
                  <ProfileStatusBadge profile={profile} />

                  {/* Switch + Edit — row 2 on narrow, cols 4-5 inline at @md/card */}
                  <div className="col-start-2 col-span-2 flex items-center gap-2 justify-end @md/card:contents">
                    <Switch
                      checked={profile.enabled}
                      onCheckedChange={(checked) =>
                        handleToggle(profile, checked)
                      }
                      disabled={isSaving || carrier}
                      aria-label={
                        profile.enabled
                          ? t("core_settings.apn.list.aria.disable_switch", { index: profile.index })
                          : t("core_settings.apn.list.aria.enable_switch", { index: profile.index })
                      }
                    />

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(profile.index)}
                      disabled={isSaving}
                      aria-label={t("core_settings.apn.list.aria.edit_button", { index: profile.index })}
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
