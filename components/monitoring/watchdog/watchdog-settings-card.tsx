"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangleIcon, InfoIcon } from "lucide-react";
import type {
  WatchdogSettings,
  WatchdogSavePayload,
  UseWatchdogSettingsReturn,
} from "@/hooks/use-watchdog-settings";

type WatchdogSettingsCardProps = Pick<
  UseWatchdogSettingsReturn,
  "settings" | "autoDisabled" | "isLoading" | "isSaving" | "error" | "saveSettings"
>;

export function WatchdogSettingsCard({
  settings,
  autoDisabled,
  isLoading,
  isSaving,
  error,
  saveSettings,
}: WatchdogSettingsCardProps) {
  // --- Local form state ---
  const [isEnabled, setIsEnabled] = useState(false);
  const [maxFailures, setMaxFailures] = useState("5");
  const [checkInterval, setCheckInterval] = useState("10");
  const [cooldown, setCooldown] = useState("60");
  const [tier1Enabled, setTier1Enabled] = useState(true);
  const [tier2Enabled, setTier2Enabled] = useState(true);
  const [tier3Enabled, setTier3Enabled] = useState(false);
  const [tier4Enabled, setTier4Enabled] = useState(true);
  const [backupSimSlot, setBackupSimSlot] = useState<string>("");
  const [maxRebootsPerHour, setMaxRebootsPerHour] = useState("3");

  // Sync from server
  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.enabled);
      setMaxFailures(String(settings.max_failures));
      setCheckInterval(String(settings.check_interval));
      setCooldown(String(settings.cooldown));
      setTier1Enabled(settings.tier1_enabled);
      setTier2Enabled(settings.tier2_enabled);
      setTier3Enabled(settings.tier3_enabled);
      setTier4Enabled(settings.tier4_enabled);
      setBackupSimSlot(
        settings.backup_sim_slot != null ? String(settings.backup_sim_slot) : ""
      );
      setMaxRebootsPerHour(String(settings.max_reboots_per_hour));
    }
  }, [settings]);

  // --- Validation ---
  const maxFailuresError =
    maxFailures &&
    (isNaN(Number(maxFailures)) ||
      Number(maxFailures) < 1 ||
      Number(maxFailures) > 20)
      ? "Must be 1\u201320"
      : null;

  const cooldownError =
    cooldown &&
    (isNaN(Number(cooldown)) ||
      Number(cooldown) < 10 ||
      Number(cooldown) > 300)
      ? "Must be 10\u2013300 seconds"
      : null;

  const maxRebootsError =
    maxRebootsPerHour &&
    (isNaN(Number(maxRebootsPerHour)) ||
      Number(maxRebootsPerHour) < 1 ||
      Number(maxRebootsPerHour) > 10)
      ? "Must be 1\u201310"
      : null;

  const hasValidationErrors = !!(
    maxFailuresError ||
    cooldownError ||
    maxRebootsError
  );

  // --- Dirty check ---
  const isDirty = useMemo(() => {
    if (!settings) return false;
    return (
      isEnabled !== settings.enabled ||
      maxFailures !== String(settings.max_failures) ||
      checkInterval !== String(settings.check_interval) ||
      cooldown !== String(settings.cooldown) ||
      tier1Enabled !== settings.tier1_enabled ||
      tier2Enabled !== settings.tier2_enabled ||
      tier3Enabled !== settings.tier3_enabled ||
      tier4Enabled !== settings.tier4_enabled ||
      backupSimSlot !==
        (settings.backup_sim_slot != null
          ? String(settings.backup_sim_slot)
          : "") ||
      maxRebootsPerHour !== String(settings.max_reboots_per_hour)
    );
  }, [
    settings,
    isEnabled,
    maxFailures,
    checkInterval,
    cooldown,
    tier1Enabled,
    tier2Enabled,
    tier3Enabled,
    tier4Enabled,
    backupSimSlot,
    maxRebootsPerHour,
  ]);

  const canSave = !hasValidationErrors && isDirty && !isSaving;

  // --- Save handler ---
  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSave) return;

      const payload: WatchdogSavePayload = {
        action: "save_settings",
        enabled: isEnabled,
        max_failures: parseInt(maxFailures, 10),
        check_interval: parseInt(checkInterval, 10),
        cooldown: parseInt(cooldown, 10),
        tier1_enabled: tier1Enabled,
        tier2_enabled: tier2Enabled,
        tier3_enabled: tier3Enabled,
        tier4_enabled: tier4Enabled,
        backup_sim_slot: backupSimSlot ? parseInt(backupSimSlot, 10) : null,
        max_reboots_per_hour: parseInt(maxRebootsPerHour, 10),
      };

      const success = await saveSettings(payload);
      if (success) {
        toast.success("Watchdog settings saved");
      } else {
        toast.error(error || "Failed to save watchdog settings");
      }
    },
    [
      canSave,
      isEnabled,
      maxFailures,
      checkInterval,
      cooldown,
      tier1Enabled,
      tier2Enabled,
      tier3Enabled,
      tier4Enabled,
      backupSimSlot,
      maxRebootsPerHour,
      saveSettings,
      error,
    ]
  );

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Watchdog Settings</CardTitle>
          <CardDescription>
            Configure connection health monitoring and recovery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-10 w-full max-w-sm" />
            <Skeleton className="h-10 w-full max-w-sm" />
            <Skeleton className="h-10 w-full max-w-sm" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-48" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Watchdog Settings</CardTitle>
        <CardDescription>
          Configure connection health monitoring and recovery.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {autoDisabled && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangleIcon className="size-4" />
            <AlertDescription>
              Watchdog was automatically disabled after exceeding the reboot
              limit. Re-enable it below if the connectivity issue has been
              resolved.
            </AlertDescription>
          </Alert>
        )}

        <form className="grid gap-4" onSubmit={handleSave}>
          <FieldSet>
            <FieldGroup>
              {/* Master toggle */}
              <Field orientation="horizontal" className="w-fit">
                <FieldLabel htmlFor="watchdog-enabled">
                  Enable Watchdog
                </FieldLabel>
                <Switch
                  id="watchdog-enabled"
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                />
              </Field>

              {/* Max Failures */}
              <Field>
                <FieldLabel htmlFor="max-failures">
                  Failure Threshold
                </FieldLabel>
                <Input
                  id="max-failures"
                  type="number"
                  min="1"
                  max="20"
                  placeholder="5"
                  className="max-w-sm"
                  value={maxFailures}
                  onChange={(e) => setMaxFailures(e.target.value)}
                  disabled={!isEnabled}
                  aria-invalid={!!maxFailuresError}
                  aria-describedby={
                    maxFailuresError ? "max-failures-error" : "max-failures-desc"
                  }
                />
                {maxFailuresError ? (
                  <FieldError id="max-failures-error">
                    {maxFailuresError}
                  </FieldError>
                ) : (
                  <FieldDescription id="max-failures-desc">
                    Consecutive ping failures before triggering recovery.
                  </FieldDescription>
                )}
              </Field>

              {/* Check Interval */}
              <Field>
                <FieldLabel htmlFor="check-interval">Check Interval</FieldLabel>
                <Select
                  value={checkInterval}
                  onValueChange={setCheckInterval}
                  disabled={!isEnabled}
                >
                  <SelectTrigger id="check-interval" className="max-w-sm">
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="10">10 seconds</SelectItem>
                    <SelectItem value="15">15 seconds</SelectItem>
                    <SelectItem value="30">30 seconds</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  How often the watchdog checks ping data.
                </FieldDescription>
              </Field>

              {/* Cooldown */}
              <Field>
                <FieldLabel htmlFor="cooldown">
                  Cooldown Period (seconds)
                </FieldLabel>
                <Input
                  id="cooldown"
                  type="number"
                  min="10"
                  max="300"
                  placeholder="60"
                  className="max-w-sm"
                  value={cooldown}
                  onChange={(e) => setCooldown(e.target.value)}
                  disabled={!isEnabled}
                  aria-invalid={!!cooldownError}
                  aria-describedby={
                    cooldownError ? "cooldown-error" : "cooldown-desc"
                  }
                />
                {cooldownError ? (
                  <FieldError id="cooldown-error">{cooldownError}</FieldError>
                ) : (
                  <FieldDescription id="cooldown-desc">
                    Grace period after a recovery action before checking again.
                  </FieldDescription>
                )}
              </Field>

              {/* Recovery Tiers */}
              <div className="pt-2">
                <h3 className="text-sm font-semibold mb-1">Recovery Tiers</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Actions are tried in order from least to most disruptive.
                </p>
              </div>

              <Field orientation="horizontal" className="w-fit">
                <FieldLabel htmlFor="tier1-enabled">
                  Tier 1: WAN Restart
                </FieldLabel>
                <Switch
                  id="tier1-enabled"
                  checked={tier1Enabled}
                  onCheckedChange={setTier1Enabled}
                  disabled={!isEnabled}
                />
              </Field>

              <Field orientation="horizontal" className="w-fit">
                <FieldLabel htmlFor="tier2-enabled">
                  Tier 2: Radio Toggle
                </FieldLabel>
                <Switch
                  id="tier2-enabled"
                  checked={tier2Enabled}
                  onCheckedChange={setTier2Enabled}
                  disabled={!isEnabled}
                />
              </Field>
              {tier2Enabled && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground ml-1">
                  <InfoIcon className="size-3 mt-0.5 shrink-0" />
                  <span>
                    Automatically skipped when tower lock is active to preserve
                    your locked cells.
                  </span>
                </div>
              )}

              <Field orientation="horizontal" className="w-fit">
                <FieldLabel htmlFor="tier3-enabled">
                  Tier 3: SIM Failover
                </FieldLabel>
                <Switch
                  id="tier3-enabled"
                  checked={tier3Enabled}
                  onCheckedChange={setTier3Enabled}
                  disabled={!isEnabled}
                />
              </Field>
              {tier3Enabled && (
                <Field>
                  <FieldLabel htmlFor="backup-sim-slot">
                    Backup SIM Slot
                  </FieldLabel>
                  <Select
                    value={backupSimSlot}
                    onValueChange={setBackupSimSlot}
                    disabled={!isEnabled}
                  >
                    <SelectTrigger id="backup-sim-slot" className="max-w-sm">
                      <SelectValue placeholder="Select slot" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Slot 1</SelectItem>
                      <SelectItem value="2">Slot 2</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    The SIM slot to switch to when the primary SIM loses
                    connectivity. Must differ from the current active slot.
                  </FieldDescription>
                </Field>
              )}

              <Field orientation="horizontal" className="w-fit">
                <FieldLabel htmlFor="tier4-enabled">
                  Tier 4: System Reboot
                </FieldLabel>
                <Switch
                  id="tier4-enabled"
                  checked={tier4Enabled}
                  onCheckedChange={setTier4Enabled}
                  disabled={!isEnabled}
                />
              </Field>
              {tier4Enabled && (
                <>
                  <Field>
                    <FieldLabel htmlFor="max-reboots">
                      Max Reboots Per Hour
                    </FieldLabel>
                    <Input
                      id="max-reboots"
                      type="number"
                      min="1"
                      max="10"
                      placeholder="3"
                      className="max-w-sm"
                      value={maxRebootsPerHour}
                      onChange={(e) => setMaxRebootsPerHour(e.target.value)}
                      disabled={!isEnabled}
                      aria-invalid={!!maxRebootsError}
                      aria-describedby={
                        maxRebootsError
                          ? "max-reboots-error"
                          : "max-reboots-desc"
                      }
                    />
                    {maxRebootsError ? (
                      <FieldError id="max-reboots-error">
                        {maxRebootsError}
                      </FieldError>
                    ) : (
                      <FieldDescription id="max-reboots-desc">
                        The watchdog disables itself permanently if this limit is
                        exceeded, preventing reboot loops.
                      </FieldDescription>
                    )}
                  </Field>
                </>
              )}

              {/* Save Button */}
              <div className="flex items-center gap-2 pt-2">
                <Button type="submit" className="w-fit" disabled={!canSave}>
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Settings"
                  )}
                </Button>
              </div>
            </FieldGroup>
          </FieldSet>
        </form>
      </CardContent>
    </Card>
  );
}
