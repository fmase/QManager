"use client";

import React, { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DogIcon,
  InfoIcon,
  Loader2,
  CheckCircle2Icon,
  TriangleAlertIcon,
  AlertCircleIcon,
  ClockIcon,
  LockIcon,
  MinusCircleIcon,
} from "lucide-react";
import { useModemStatus } from "@/hooks/use-modem-status";
import { formatTimeAgo } from "@/types/modem-status";
import type { WatchcatState } from "@/types/modem-status";

interface WatchdogStatusCardProps {
  revertSim: () => Promise<boolean>;
  /** Whether the user has enabled watchdog in settings (from CGI, not daemon) */
  settingsEnabled?: boolean;
}

const STATE_BADGE_STYLES: Record<
  WatchcatState,
  { variant: "outline"; className: string; icon: React.ReactNode }
> = {
  monitor: {
    variant: "outline",
    className: "bg-success/15 text-success hover:bg-success/20 border-success/30",
    icon: <CheckCircle2Icon className="h-3 w-3" />,
  },
  suspect: {
    variant: "outline",
    className: "bg-warning/15 text-warning hover:bg-warning/20 border-warning/30",
    icon: <TriangleAlertIcon className="h-3 w-3" />,
  },
  recovery: {
    variant: "outline",
    className: "bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30 animate-pulse motion-reduce:animate-none",
    icon: <AlertCircleIcon className="h-3 w-3" />,
  },
  cooldown: {
    variant: "outline",
    className: "bg-info/15 text-info hover:bg-info/20 border-info/30",
    icon: <ClockIcon className="h-3 w-3" />,
  },
  locked: {
    variant: "outline",
    className: "bg-muted/50 text-muted-foreground border-muted-foreground/30",
    icon: <LockIcon className="h-3 w-3" />,
  },
  disabled: {
    variant: "outline",
    className: "bg-muted/50 text-muted-foreground border-muted-foreground/30",
    icon: <MinusCircleIcon className="h-3 w-3" />,
  },
};

export function WatchdogStatusCard({
  revertSim,
  settingsEnabled,
}: WatchdogStatusCardProps) {
  const { t } = useTranslation("monitoring");
  const { data: modemStatus, isLoading } = useModemStatus({
    pollInterval: 5000,
  });
  const [isReverting, setIsReverting] = useState(false);

  const tierLabels = useMemo<Record<number, string>>(
    () => ({
      0: t("watchdog.tier_label_none"),
      1: t("watchdog.tier_label_1"),
      2: t("watchdog.tier_label_2"),
      3: t("watchdog.tier_label_3"),
      4: t("watchdog.tier_label_4"),
    }),
    [t],
  );

  const stateBadgeLabels = useMemo<Record<string, string>>(
    () => ({
      monitor: t("watchdog.status_badge_monitoring"),
      suspect: t("watchdog.status_badge_suspect"),
      recovery: t("watchdog.status_badge_recovery"),
      cooldown: t("watchdog.status_badge_cooldown"),
      locked: t("watchdog.status_badge_locked"),
      disabled: t("watchdog.status_badge_disabled"),
    }),
    [t],
  );

  const handleRevertSim = useCallback(async () => {
    setIsReverting(true);
    try {
      const success = await revertSim();
      if (success) {
        toast.success(t("watchdog.toast_sim_revert_success"));
      } else {
        toast.error(t("watchdog.toast_sim_revert_error"));
      }
    } finally {
      setIsReverting(false);
    }
  }, [revertSim, t]);

  const watchcat = modemStatus?.watchcat;
  const simFailover = modemStatus?.sim_failover;

  // Loading skeleton
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("watchdog.status_title")}</CardTitle>
          <CardDescription>{t("watchdog.status_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-6 w-28" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty/disabled state
  const daemonReporting = watchcat?.enabled;
  const enabledButNotReporting = settingsEnabled && !daemonReporting;

  if (!daemonReporting && !enabledButNotReporting) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("watchdog.status_title")}</CardTitle>
          <CardDescription>{t("watchdog.status_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <DogIcon className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              {t("watchdog.status_empty")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Enabled in settings but daemon hasn't reported yet (starting up / boot settle)
  if (enabledButNotReporting) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("watchdog.status_title")}</CardTitle>
          <CardDescription>{t("watchdog.status_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="size-10 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground text-center">
              {t("watchdog.status_starting")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // At this point watchcat is guaranteed to be defined and enabled
  // (both early returns above handle the undefined/disabled cases)
  if (!watchcat) return null;

  const stateKey = (watchcat.state as WatchcatState) || "disabled";
  const badgeStyle = STATE_BADGE_STYLES[stateKey] || STATE_BADGE_STYLES.disabled;
  const badgeLabel = stateBadgeLabels[stateKey] ?? stateBadgeLabels.disabled;
  const tierLabel = tierLabels[watchcat.current_tier] || tierLabels[0];

  const statusRows: { label: string; value: React.ReactNode }[] = [
    { label: t("watchdog.status_row_current_step"), value: tierLabel },
    {
      label: t("watchdog.status_row_failed_checks"),
      value: <span className="font-mono">{watchcat.failure_count}</span>,
    },
    ...(watchcat.cooldown_remaining > 0
      ? [
          {
            label: t("watchdog.status_row_cooldown"),
            value: (
              <span className="font-mono">
                {t("watchdog.status_cooldown_remaining", { count: watchcat.cooldown_remaining })}
              </span>
            ),
          },
        ]
      : []),
    {
      label: t("watchdog.status_row_total_recoveries"),
      value: <span className="font-mono">{watchcat.total_recoveries}</span>,
    },
    {
      label: t("watchdog.status_row_reboots_this_hour"),
      value: <span className="font-mono">{watchcat.reboots_this_hour}</span>,
    },
    ...(watchcat.last_recovery_time != null
      ? [
          {
            label: t("watchdog.status_row_last_recovery"),
            value: (
              <span>
                {tierLabels[watchcat.last_recovery_tier ?? 0]}{" "}
                <span className="text-muted-foreground">
                  ({formatTimeAgo(watchcat.last_recovery_time)})
                </span>
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("watchdog.status_title")}</CardTitle>
        <CardDescription>{t("watchdog.status_description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {/* State badge — animates when state changes */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">{t("watchdog.status_row_state")}</p>
            <AnimatePresence mode="wait">
              <motion.div
                key={stateKey}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.18, type: "spring", stiffness: 400, damping: 24 }}
              >
                <Badge variant={badgeStyle.variant} className={badgeStyle.className}>{badgeStyle.icon}{badgeLabel}</Badge>
              </motion.div>
            </AnimatePresence>
          </div>
          {/* Status rows — stagger in on mount */}
          <motion.div
            className="grid gap-2"
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } }}
          >
            {statusRows.map((row) => (
              <motion.div
                key={row.label}
                variants={{ hidden: { opacity: 0, x: -6 }, visible: { opacity: 1, x: 0 } }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <Separator />
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm font-semibold text-muted-foreground">
                    {row.label}
                  </p>
                  <p className="text-sm font-semibold">{row.value}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
          <Separator />

          {/* SIM Failover section */}
          {simFailover?.active && (
            <div className="pt-3 border-t">
              <Alert className="mb-3">
                <InfoIcon className="size-4" />
                <AlertDescription>
                  <p>
                    {t("watchdog.status_sim_failover_message", {
                      current_slot: simFailover.current_slot,
                      switched_at: simFailover.switched_at
                        ? formatTimeAgo(simFailover.switched_at)
                        : t("watchdog.status_sim_failover_recently"),
                      original_slot: simFailover.original_slot,
                    })}
                  </p>
                </AlertDescription>
              </Alert>

              {/* H1: Confirmation dialog for destructive SIM revert */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isReverting}
                  >
                    {isReverting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t("watchdog.status_sim_reverting")}
                      </>
                    ) : (
                      t("watchdog.status_sim_revert_button")
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("watchdog.status_sim_revert_dialog_title")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("watchdog.status_sim_revert_dialog_description", {
                        original_slot: simFailover.original_slot,
                      })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("watchdog.status_sim_revert_cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRevertSim}>
                      {t("watchdog.status_sim_revert_confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
