"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
import { RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";

import type { UpdateInfo } from "@/hooks/use-software-update";

// ─── Props ──────────────────────────────────────────────────────────────────

interface UpdatePreferencesCardProps {
  updateInfo: UpdateInfo | null;
  isLoading: boolean;
  isUpdating: boolean;
  rollback: () => Promise<void>;
  togglePrerelease: (enabled: boolean) => Promise<void>;
  saveAutoUpdate: (enabled: boolean, time: string) => Promise<void>;
}

// ─── Component ──────────────────────────────────────────────────────────────

const AUTO_UPDATE_DEBOUNCE = 800;

export function UpdatePreferencesCard({
  updateInfo,
  isLoading,
  isUpdating,
  rollback,
  togglePrerelease,
  saveAutoUpdate,
}: UpdatePreferencesCardProps) {
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [prereleaseToggling, setPrereleaseToggling] = useState(false);
  const [autoUpdateToggling, setAutoUpdateToggling] = useState(false);
  const [autoUpdateTime, setAutoUpdateTime] = useState("03:00");
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local time from server data
  useEffect(() => {
    if (updateInfo?.auto_update_time) {
      setAutoUpdateTime(updateInfo.auto_update_time);
    }
  }, [updateInfo?.auto_update_time]);

  const handleTogglePrerelease = useCallback(
    async (checked: boolean) => {
      setPrereleaseToggling(true);
      try {
        await togglePrerelease(checked);
        toast.success(
          checked
            ? "Pre-release updates enabled"
            : "Pre-release updates disabled"
        );
      } catch {
        toast.error("Failed to update preference");
      } finally {
        setPrereleaseToggling(false);
      }
    },
    [togglePrerelease]
  );

  const handleRollback = useCallback(async () => {
    setShowRollbackDialog(false);
    try {
      await rollback();
    } catch {
      toast.error("Failed to start rollback");
    }
  }, [rollback]);

  const handleAutoUpdateToggle = useCallback(
    async (checked: boolean) => {
      setAutoUpdateToggling(true);
      try {
        await saveAutoUpdate(checked, autoUpdateTime);
        toast.success(
          checked
            ? "Automatic updates enabled"
            : "Automatic updates disabled"
        );
      } catch {
        toast.error("Failed to update preference");
      } finally {
        setAutoUpdateToggling(false);
      }
    },
    [saveAutoUpdate, autoUpdateTime]
  );

  const handleAutoUpdateTimeChange = useCallback(
    (newTime: string) => {
      setAutoUpdateTime(newTime);
      if (!updateInfo?.auto_update_enabled) return;

      // Debounced save
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      autoTimerRef.current = setTimeout(async () => {
        try {
          await saveAutoUpdate(true, newTime);
          toast.success("Update schedule saved");
        } catch {
          toast.error("Failed to save schedule");
        }
      }, AUTO_UPDATE_DEBOUNCE);
    },
    [saveAutoUpdate, updateInfo?.auto_update_enabled]
  );

  // Clean up debounce timer
  useEffect(() => {
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, []);

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Update Preferences</CardTitle>
          <CardDescription>
            Configure update channel and version management.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Separator />
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-6 w-12" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-6 w-12" />
            </div>
            <Separator />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Update Preferences</CardTitle>
          <CardDescription>
            Configure update channel and version management.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {/* ── Pre-release toggle ──────────────────────────────── */}
            <Separator />
            <div className="flex items-center justify-between">
              <p className="font-semibold text-muted-foreground text-sm">
                Include pre-releases
              </p>
              <div className="flex items-center space-x-2">
                <Switch
                  id="include-prerelease"
                  checked={updateInfo?.include_prerelease ?? false}
                  onCheckedChange={handleTogglePrerelease}
                  disabled={prereleaseToggling || isUpdating}
                />
                <Label htmlFor="include-prerelease">
                  {updateInfo?.include_prerelease ? "Enabled" : "Disabled"}
                </Label>
              </div>
            </div>

            {/* ── Automatic updates ─────────────────────────────── */}
            <Separator />
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-muted-foreground text-sm">
                  Automatic updates
                </p>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-update"
                    checked={updateInfo?.auto_update_enabled ?? false}
                    onCheckedChange={handleAutoUpdateToggle}
                    disabled={autoUpdateToggling || isUpdating}
                  />
                  <Label htmlFor="auto-update">
                    {updateInfo?.auto_update_enabled ? "Enabled" : "Disabled"}
                  </Label>
                </div>
              </div>
              {updateInfo?.auto_update_enabled && (
                <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      Update at
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Checks for updates and installs automatically. The device
                      will reboot if an update is found.
                    </p>
                  </div>
                  <Input
                    type="time"
                    value={autoUpdateTime}
                    onChange={(e) => handleAutoUpdateTimeChange(e.target.value)}
                    disabled={isUpdating}
                    className="w-28 shrink-0"
                  />
                </div>
              )}
            </div>

            {/* ── Rollback section ────────────────────────────────── */}
            <Separator />
            {updateInfo?.rollback_available && updateInfo?.rollback_version ? (
              <div className="flex flex-col gap-2">
                <p className="font-semibold text-sm">Version Rollback</p>
                <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      Previous version
                    </span>
                    <span className="text-sm font-medium">
                      {updateInfo.rollback_version}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRollbackDialog(true)}
                    disabled={isUpdating}
                  >
                    <RotateCcwIcon className="size-4" />
                    Restore
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="font-semibold text-sm">Version Rollback</p>
                <p className="text-sm text-muted-foreground">
                  No previous version available for rollback.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Rollback confirmation dialog ─────────────────────────────── */}
      <AlertDialog
        open={showRollbackDialog}
        onOpenChange={setShowRollbackDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Previous Version</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore QManager to{" "}
              <strong>{updateInfo?.rollback_version}</strong>. The device will
              reboot automatically after the rollback. Do not power off the
              device during this process.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRollback}>
              <RotateCcwIcon className="size-4" />
              Restore Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
