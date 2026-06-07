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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  GlobeIcon,
  MinusCircleIcon,
  CircleIcon,
  CircleSlashIcon,
  TriangleAlertIcon,
  PencilIcon,
} from "lucide-react";

import type { WanProfile, CidContext } from "@/types/wan-profiles";

// =============================================================================
// Props
// =============================================================================

interface WanProfileListCardProps {
  profiles: WanProfile[] | null;
  /** Live modem PDP contexts — used to tell whether the active slot's stored
   *  APN actually matches what the carrier has on its target CID. */
  cids: CidContext[] | null;
  /** Id of the active slot, or 0 when no slot is active (carrier-default). */
  activeProfile: number | null;
  isLoading: boolean;
  isSaving: boolean;
  editingId: number | null;
  onEdit: (id: number) => void;
  /** Activate a slot (mutually exclusive). Returns true on success. */
  onActivate: (id: number) => Promise<boolean>;
  /** Disable all slots (active=0) — hand the APN back to the carrier. */
  onDeactivate: () => Promise<boolean>;
  /**
   * True when an active Custom SIM Profile owns the live APN. The stored
   * `active` slot pointer is then stale — its "Active" badge would over-claim
   * to be the live Internet APN, so we relabel it "Overridden" instead.
   */
  overridden?: boolean;
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

// Case-insensitive, whitespace-trimmed APN comparison. The carrier may echo a
// different case than what the user typed; only a real string difference counts
// as "not live".
const sameApn = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

// =============================================================================
// Status Badge — reflects the LIVE truth, not just stored intent.
//   • Active     (green) — slot is active AND the carrier has its APN live.
//   • Not live   (amber) — slot is active but the carrier is using a different
//                          APN (rejected/overrode it, or it hasn't applied).
//   • Overridden (muted) — a Custom SIM Profile owns the APN.
// The globe/icon inherits the badge text color (currentColor).
// =============================================================================

function ProfileStatusBadge({
  profile,
  overridden = false,
  notLive = false,
}: {
  profile: WanProfile;
  overridden?: boolean;
  notLive?: boolean;
}) {
  const { t } = useTranslation("cellular");
  const configured = !!profile.apn;

  // A Custom SIM Profile owns the live APN — the stored active slot is no
  // longer the live Internet APN, so relabel rather than claim "Active".
  if (overridden && profile.is_active && configured) {
    const label = t("core_settings.apn.list.status.overridden");
    return (
      <Badge
        variant="outline"
        className="bg-muted/50 text-muted-foreground border-muted-foreground/30"
        title={label}
      >
        <CircleSlashIcon className="size-3" />
        <span className="sr-only @xs/card:not-sr-only">{label}</span>
      </Badge>
    );
  }

  // Active intent, but the carrier is not actually serving this APN.
  if (profile.is_active && configured && notLive) {
    const label = t("core_settings.apn.list.status.not_live");
    return (
      <Badge
        variant="outline"
        className="bg-warning/15 text-warning border-warning/30"
        title={t("core_settings.apn.list.live.mismatch_title")}
      >
        <TriangleAlertIcon className="size-3" />
        <span className="sr-only @xs/card:not-sr-only">{label}</span>
      </Badge>
    );
  }

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
  cids,
  activeProfile,
  isLoading,
  isSaving,
  editingId,
  onEdit,
  onActivate,
  onDeactivate,
  overridden = false,
}: WanProfileListCardProps) {
  const { t } = useTranslation("cellular");
  const shouldReduceMotion = useReducedMotion();

  // The active slot whose OFF edge is pending confirmation (deactivate dialog).
  const [pendingDeactivate, setPendingDeactivate] =
    React.useState<WanProfile | null>(null);

  if (isLoading) return <WanProfileListSkeleton />;

  // Resolve a human label for toasts/aria — falls back to the slot number.
  const labelFor = (profile: WanProfile) =>
    profile.name || t("core_settings.apn.list.slot", { id: profile.id });

  // Live APN the modem currently holds on a given CID. null = unknown (cids not
  // loaded yet); "" = a defined-but-blank context (carrier default).
  const liveApnForCid = (cid: number): string | null => {
    if (!cids) return null;
    const found = cids.find((c) => c.cid === cid);
    return found ? found.apn : null;
  };

  // No slot is active and no profile owns the APN → the carrier is choosing.
  const showCarrierDefault = activeProfile === 0 && !overridden;

  const runActivate = async (profile: WanProfile) => {
    const name = labelFor(profile);
    // onActivate resolves false on failure (the hook never rejects); convert
    // that into a rejection so toast.promise lands on its error branch.
    const activation = onActivate(profile.id).then((success) => {
      if (!success) throw new Error("activate_failed");
    });
    toast.promise(activation, {
      loading: t("core_settings.apn.list.toast.activating", { name }),
      success: t("core_settings.apn.list.toast.activated", { name }),
      error: t("core_settings.apn.list.toast.activate_error", { name }),
    });
    await activation.catch(() => {
      // toast.promise already surfaced the error; swallow the rejection.
    });
  };

  const handleSwitch = (profile: WanProfile, checked: boolean) => {
    // Turning OFF the active slot → confirm before handing the APN to the
    // carrier (a brief WAN drop). The dialog drives the actual deactivate.
    if (profile.is_active && !checked) {
      setPendingDeactivate(profile);
      return;
    }
    // Radio semantics: only the OFF→ON edge on an inactive slot activates.
    if (!checked) return;
    runActivate(profile);
  };

  const handleConfirmDeactivate = async () => {
    setPendingDeactivate(null);
    const deactivation = onDeactivate().then((success) => {
      if (!success) throw new Error("deactivate_failed");
    });
    toast.promise(deactivation, {
      loading: t("core_settings.apn.list.toast.deactivating"),
      success: t("core_settings.apn.list.toast.deactivated"),
      error: t("core_settings.apn.list.toast.deactivate_error"),
    });
    await deactivation.catch(() => {
      // toast.promise already surfaced the error; swallow the rejection.
    });
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
        {/* Carrier-default banner — makes the active=0 state legible. */}
        {showCarrierDefault && (
          <div className="mb-4 flex items-start gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <GlobeIcon className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {t("core_settings.apn.list.carrier_default.title")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("core_settings.apn.list.carrier_default.subtitle")}
              </p>
            </div>
          </div>
        )}

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

              // The live APN on this slot's target CID (active slots only).
              const liveApn = profile.is_active
                ? liveApnForCid(profile.cid)
                : null;
              // "Not live" = active + configured, not overridden, the carrier's
              // live APN is known, and it differs from what we stored. Suppressed
              // mid-operation (isSaving) to avoid flicker during the COPS cycle.
              const notLive =
                profile.is_active &&
                configured &&
                !overridden &&
                !isSaving &&
                liveApn !== null &&
                !sameApn(liveApn, profile.apn);

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
                      profile.is_active && configured && !overridden
                        ? notLive
                          ? "bg-warning/15 text-warning"
                          : "bg-success/15 text-success"
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
                    {/* Honest live-APN line — only when the carrier disagrees. */}
                    {notLive && (
                      <p className="text-xs text-warning truncate mt-0.5">
                        {liveApn
                          ? t("core_settings.apn.list.live.mismatch", {
                              apn: liveApn,
                            })
                          : t("core_settings.apn.list.live.mismatch_default")}
                      </p>
                    )}
                  </div>

                  {/* Status badge — column 3 always */}
                  <ProfileStatusBadge
                    profile={profile}
                    overridden={overridden}
                    notLive={notLive}
                  />

                  {/* Switch + Edit — row 2 on narrow, cols 4-5 inline at @md/card */}
                  <div className="col-start-2 col-span-2 flex items-center gap-2 justify-end @md/card:contents">
                    <Switch
                      checked={profile.is_active}
                      onCheckedChange={(checked) =>
                        handleSwitch(profile, checked)
                      }
                      // The active slot CAN be turned off now (→ carrier-default,
                      // confirmed via dialog). Inactive slots need a saved APN
                      // before they can be activated.
                      disabled={isSaving || (!profile.is_active && !configured)}
                      aria-label={
                        profile.is_active
                          ? t("core_settings.apn.list.aria.deactivate_switch", {
                              name,
                            })
                          : t("core_settings.apn.list.aria.activate_switch", {
                              name,
                            })
                      }
                    />

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(profile.id)}
                      disabled={isSaving}
                      aria-label={t("core_settings.apn.list.aria.edit_button", {
                        name,
                      })}
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

      {/* Deactivate confirmation — handing the APN back to the carrier drops
          the cellular connection briefly while the modem re-attaches. */}
      <AlertDialog
        open={pendingDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeactivate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("core_settings.apn.list.deactivate.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("core_settings.apn.list.deactivate.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("core_settings.apn.list.deactivate.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeactivate}>
              {t("core_settings.apn.list.deactivate.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
