"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { DogIcon, Loader2, InfoIcon } from "lucide-react";
import { useModemStatus } from "@/hooks/use-modem-status";
import { formatTimeAgo } from "@/types/modem-status";
import type { WatchcatState } from "@/types/modem-status";

interface WatchdogStatusCardProps {
  revertSim: () => Promise<boolean>;
}

const STATE_BADGE_CONFIG: Record<
  WatchcatState,
  { label: string; className: string }
> = {
  monitor: {
    label: "Monitoring",
    className: "bg-success text-success-foreground border-success",
  },
  suspect: {
    label: "Suspect",
    className: "bg-warning text-warning-foreground border-warning",
  },
  recovery: {
    label: "Recovering",
    className:
      "bg-destructive text-destructive-foreground border-destructive animate-pulse",
  },
  cooldown: {
    label: "Cooldown",
    className: "bg-info text-info-foreground border-info",
  },
  locked: {
    label: "Locked",
    className: "bg-muted text-muted-foreground border-border",
  },
  disabled: {
    label: "Disabled",
    className: "bg-muted text-muted-foreground border-border",
  },
};

const TIER_LABELS: Record<number, string> = {
  0: "\u2014",
  1: "Tier 1 \u2014 WAN Restart",
  2: "Tier 2 \u2014 Radio Toggle",
  3: "Tier 3 \u2014 SIM Failover",
  4: "Tier 4 \u2014 System Reboot",
};

export function WatchdogStatusCard({ revertSim }: WatchdogStatusCardProps) {
  const { data: modemStatus, isLoading } = useModemStatus({
    pollInterval: 5000,
  });

  const handleRevertSim = useCallback(async () => {
    const success = await revertSim();
    if (success) {
      toast.success(
        "SIM revert requested. The watchdog will process this shortly."
      );
    } else {
      toast.error("Failed to request SIM revert");
    }
  }, [revertSim]);

  const watchcat = modemStatus?.watchcat;
  const simFailover = modemStatus?.sim_failover;

  // Loading skeleton
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Watchdog Status</CardTitle>
          <CardDescription>Live connection health status.</CardDescription>
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
  if (!watchcat || !watchcat.enabled) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Watchdog Status</CardTitle>
          <CardDescription>Live connection health status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <DogIcon className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Watchdog is not active. Enable it in Settings to begin monitoring
              connection health.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stateKey = (watchcat.state as WatchcatState) || "disabled";
  const badge = STATE_BADGE_CONFIG[stateKey] || STATE_BADGE_CONFIG.disabled;
  const tierLabel = TIER_LABELS[watchcat.current_tier] || TIER_LABELS[0];

  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Watchdog Status</CardTitle>
            <CardDescription>Live connection health status.</CardDescription>
          </div>
          <Badge className={badge.className}>{badge.label}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Status rows */}
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">Current Tier</span>
            <span className="font-medium">{tierLabel}</span>

            <span className="text-muted-foreground">Failure Count</span>
            <span className="font-mono">{watchcat.failure_count}</span>

            {watchcat.cooldown_remaining > 0 && (
              <>
                <span className="text-muted-foreground">Cooldown</span>
                <span className="font-mono">
                  {watchcat.cooldown_remaining}s remaining
                </span>
              </>
            )}

            <span className="text-muted-foreground">Total Recoveries</span>
            <span className="font-mono">{watchcat.total_recoveries}</span>

            <span className="text-muted-foreground">Reboots This Hour</span>
            <span className="font-mono">{watchcat.reboots_this_hour}</span>

            {watchcat.last_recovery_time != null && (
              <>
                <span className="text-muted-foreground">Last Recovery</span>
                <span>
                  {TIER_LABELS[watchcat.last_recovery_tier ?? 0]}{" "}
                  <span className="text-muted-foreground">
                    ({formatTimeAgo(watchcat.last_recovery_time)})
                  </span>
                </span>
              </>
            )}
          </div>

          {/* SIM Failover section */}
          {simFailover?.active && (
            <div className="pt-3 border-t">
              <Alert className="mb-3">
                <InfoIcon className="size-4" />
                <AlertDescription>
                  Running on backup SIM (slot {simFailover.current_slot}) since{" "}
                  {simFailover.switched_at
                    ? formatTimeAgo(simFailover.switched_at)
                    : "recently"}
                  . Original SIM was in slot {simFailover.original_slot}.
                </AlertDescription>
              </Alert>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRevertSim}
              >
                Revert to Original SIM
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
