"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangleIcon } from "lucide-react";
import type {
  WatchdogSavePayload,
  UseWatchdogSettingsReturn,
} from "@/hooks/use-watchdog-settings";
import { Separator } from "@/components/ui/separator";
import { TbInfoCircleFilled } from "react-icons/tb";

type WatchdogSettingsCardProps = Pick<
  UseWatchdogSettingsReturn,
  | "settings"
  | "autoDisabled"
  | "isLoading"
  | "isSaving"
  | "error"
  | "saveSettings"
>;

export function WatchdogSettingsCard({
  settings,
  autoDisabled,
  isLoading,
  isSaving,
  error,
  saveSettings,
}: WatchdogSettingsCardProps) {
  const { t } = useTranslation("monitoring");

  // Loading skeleton
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("watchdog.settings_title")}</CardTitle>
          <CardDescription>
            {t("watchdog.settings_description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-1 @sm/card:grid-cols-2 gap-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
            <Skeleton className="h-5 w-32 mt-2" />
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-7 w-44" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Key-based remount: when settings change (initial load or post-save re-fetch),
  // the form reinitializes with fresh values from useState defaults.
  const formKey = settings
    ? `${settings.enabled}-${settings.max_failures}-${settings.check_interval}-${settings.cooldown}-${settings.backup_sim_slot}-${settings.quality_enabled}-${settings.latency_ceiling_ms}-${settings.loss_ceiling_pct}-${settings.quality_consecutive}`
    : "empty";

  return (
    <WatchdogSettingsForm
      key={formKey}
      settings={settings}
      autoDisabled={autoDisabled}
      isSaving={isSaving}
      error={error}
      saveSettings={saveSettings}
    />
  );
}

function WatchdogSettingsForm({
  settings,
  autoDisabled,
  isSaving,
  error,
  saveSettings,
}: Omit<WatchdogSettingsCardProps, "isLoading">) {
  const { t } = useTranslation("monitoring");
  const { saved, markSaved } = useSaveFlash();

  // --- Local form state (initialized from settings prop) ---
  const [isEnabled, setIsEnabled] = useState(settings?.enabled ?? false);
  const [maxFailures, setMaxFailures] = useState(
    String(settings?.max_failures ?? 5),
  );
  const [checkInterval, setCheckInterval] = useState(
    String(settings?.check_interval ?? 10),
  );
  const [cooldown, setCooldown] = useState(String(settings?.cooldown ?? 60));
  const [tier1Enabled, setTier1Enabled] = useState(
    settings?.tier1_enabled ?? true,
  );
  const [tier2Enabled, setTier2Enabled] = useState(
    settings?.tier2_enabled ?? true,
  );
  const [tier3Enabled, setTier3Enabled] = useState(
    settings?.tier3_enabled ?? false,
  );
  const [tier4Enabled, setTier4Enabled] = useState(
    settings?.tier4_enabled ?? true,
  );
  const [backupSimSlot, setBackupSimSlot] = useState<string>(
    settings?.backup_sim_slot != null ? String(settings.backup_sim_slot) : "",
  );
  const [maxRebootsPerHour, setMaxRebootsPerHour] = useState(
    String(settings?.max_reboots_per_hour ?? 3),
  );
  const [qualityEnabled, setQualityEnabled] = useState(
    settings?.quality_enabled ?? false,
  );
  const [latencyCeiling, setLatencyCeiling] = useState(
    String(settings?.latency_ceiling_ms ?? 800),
  );
  const [lossCeiling, setLossCeiling] = useState(
    String(settings?.loss_ceiling_pct ?? 20),
  );
  const [qualityConsecutive, setQualityConsecutive] = useState(
    String(settings?.quality_consecutive ?? 5),
  );

  // --- Validation ---
  const maxFailuresError =
    maxFailures &&
    (isNaN(Number(maxFailures)) ||
      Number(maxFailures) < 1 ||
      Number(maxFailures) > 20)
      ? t("watchdog.failure_threshold_error")
      : null;

  const cooldownError =
    cooldown &&
    (isNaN(Number(cooldown)) || Number(cooldown) < 10 || Number(cooldown) > 300)
      ? t("watchdog.cooldown_error")
      : null;

  const maxRebootsError =
    maxRebootsPerHour &&
    (isNaN(Number(maxRebootsPerHour)) ||
      Number(maxRebootsPerHour) < 1 ||
      Number(maxRebootsPerHour) > 10)
      ? t("watchdog.max_reboots_error")
      : null;

  const backupSimSlotError =
    tier3Enabled && !backupSimSlot
      ? t("watchdog.backup_sim_required_error")
      : null;

  // Quality-trigger validation only applies when quality monitoring is on.
  const latencyCeilingError =
    qualityEnabled &&
    latencyCeiling &&
    (isNaN(Number(latencyCeiling)) ||
      Number(latencyCeiling) < 0 ||
      Number(latencyCeiling) > 10000)
      ? t("watchdog.latency_ceiling_error")
      : null;

  const lossCeilingError =
    qualityEnabled &&
    lossCeiling &&
    (isNaN(Number(lossCeiling)) ||
      Number(lossCeiling) < 0 ||
      Number(lossCeiling) > 100)
      ? t("watchdog.loss_ceiling_error")
      : null;

  const qualityConsecutiveError =
    qualityEnabled &&
    qualityConsecutive &&
    (isNaN(Number(qualityConsecutive)) ||
      Number(qualityConsecutive) < 1 ||
      Number(qualityConsecutive) > 60)
      ? t("watchdog.quality_consecutive_error")
      : null;

  // When quality monitoring is on, at least one ceiling must be active (>0),
  // otherwise the trigger can never fire (OR logic, 0 = ignore).
  const qualityNoCeilingError =
    qualityEnabled &&
    Number(latencyCeiling) === 0 &&
    Number(lossCeiling) === 0
      ? t("watchdog.quality_no_ceiling_error")
      : null;

  const hasValidationErrors = !!(
    maxFailuresError ||
    cooldownError ||
    maxRebootsError ||
    backupSimSlotError ||
    latencyCeilingError ||
    lossCeilingError ||
    qualityConsecutiveError ||
    qualityNoCeilingError
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
      maxRebootsPerHour !== String(settings.max_reboots_per_hour) ||
      qualityEnabled !== settings.quality_enabled ||
      latencyCeiling !== String(settings.latency_ceiling_ms) ||
      lossCeiling !== String(settings.loss_ceiling_pct) ||
      qualityConsecutive !== String(settings.quality_consecutive)
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
    qualityEnabled,
    latencyCeiling,
    lossCeiling,
    qualityConsecutive,
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
        quality_enabled: qualityEnabled,
        latency_ceiling_ms: parseInt(latencyCeiling || "0", 10),
        loss_ceiling_pct: parseInt(lossCeiling || "0", 10),
        quality_consecutive: parseInt(qualityConsecutive || "5", 10),
      };

      const success = await saveSettings(payload);
      if (success) {
        markSaved();
        toast.success(t("watchdog.toast_save_success"));
      } else {
        toast.error(error || t("watchdog.toast_save_error"));
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
      qualityEnabled,
      latencyCeiling,
      lossCeiling,
      qualityConsecutive,
      saveSettings,
      error,
      markSaved,
      t,
    ],
  );

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("watchdog.settings_title")}</CardTitle>
        <CardDescription>
          {t("watchdog.settings_description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {autoDisabled && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangleIcon className="size-4" />
            <AlertDescription>
              <p>{t("watchdog.auto_disabled_alert")}</p>
            </AlertDescription>
          </Alert>
        )}

        <form className="grid gap-4" onSubmit={handleSave}>
          <FieldSet>
            <FieldGroup>
              {/* Master toggle */}
              <Field orientation="horizontal" className="w-fit">
                <FieldLabel htmlFor="watchdog-enabled">
                  {t("watchdog.enable_label")}
                </FieldLabel>
                <Switch
                  id="watchdog-enabled"
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                />
              </Field>

              <div className="grid grid-cols-1 @sm/card:grid-cols-2 gap-4">
                {/* Max Failures */}
                <Field>
                  <FieldLabel htmlFor="max-failures">
                    {t("watchdog.failure_threshold_label")}
                  </FieldLabel>
                  <Input
                    id="max-failures"
                    type="number"
                    min="1"
                    max="20"
                    placeholder={t("watchdog.failure_threshold_placeholder")}
                    className="max-w-sm"
                    value={maxFailures}
                    onChange={(e) => setMaxFailures(e.target.value)}
                    disabled={!isEnabled}
                    aria-invalid={!!maxFailuresError}
                    aria-describedby={
                      maxFailuresError
                        ? "max-failures-error"
                        : "max-failures-desc"
                    }
                  />
                  {maxFailuresError ? (
                    <FieldError id="max-failures-error">
                      {maxFailuresError}
                    </FieldError>
                  ) : (
                    <FieldDescription id="max-failures-desc">
                      {t("watchdog.failure_threshold_description")}
                    </FieldDescription>
                  )}
                </Field>

                {/* Check Interval */}
                <Field>
                  <FieldLabel htmlFor="check-interval">
                    {t("watchdog.check_interval_label")}
                  </FieldLabel>
                  <Select
                    value={checkInterval}
                    onValueChange={setCheckInterval}
                    disabled={!isEnabled}
                  >
                    <SelectTrigger id="check-interval" className="max-w-sm">
                      <SelectValue placeholder={t("watchdog.check_interval_label")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">{t("watchdog.check_interval_5s")}</SelectItem>
                      <SelectItem value="10">{t("watchdog.check_interval_10s")}</SelectItem>
                      <SelectItem value="15">{t("watchdog.check_interval_15s")}</SelectItem>
                      <SelectItem value="30">{t("watchdog.check_interval_30s")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {t("watchdog.check_interval_description")}
                  </FieldDescription>
                </Field>

                {/* Cooldown */}
                <Field>
                  <FieldLabel htmlFor="cooldown">
                    {t("watchdog.cooldown_label")}
                  </FieldLabel>
                  <Input
                    id="cooldown"
                    type="number"
                    min="10"
                    max="300"
                    placeholder={t("watchdog.cooldown_placeholder")}
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
                      {t("watchdog.cooldown_description")}
                    </FieldDescription>
                  )}
                </Field>

                {tier4Enabled && (
                  <Field>
                    <FieldLabel htmlFor="max-reboots">
                      {t("watchdog.max_reboots_label")}
                    </FieldLabel>
                    <Input
                      id="max-reboots"
                      type="number"
                      min="1"
                      max="10"
                      placeholder={t("watchdog.max_reboots_placeholder")}
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
                        {t("watchdog.max_reboots_description")}
                      </FieldDescription>
                    )}
                  </Field>
                )}

                <div aria-live="polite">
                  {tier3Enabled && (
                    <Field>
                      <FieldLabel htmlFor="backup-sim-slot">
                        {t("watchdog.backup_sim_label")}
                      </FieldLabel>
                      <Select
                        value={backupSimSlot}
                        onValueChange={setBackupSimSlot}
                        disabled={!isEnabled}
                      >
                        <SelectTrigger
                          id="backup-sim-slot"
                          className="max-w-sm"
                          aria-invalid={!!backupSimSlotError}
                          aria-describedby={
                            backupSimSlotError ? "backup-sim-error" : undefined
                          }
                        >
                          <SelectValue placeholder={t("watchdog.backup_sim_placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">{t("watchdog.backup_sim_slot_1")}</SelectItem>
                          <SelectItem value="2">{t("watchdog.backup_sim_slot_2")}</SelectItem>
                        </SelectContent>
                      </Select>
                      {backupSimSlotError ? (
                        <FieldError id="backup-sim-error">
                          {backupSimSlotError}
                        </FieldError>
                      ) : (
                        <FieldDescription>
                          {t("watchdog.backup_sim_description")}
                        </FieldDescription>
                      )}
                    </Field>
                  )}
                </div>
              </div>

              <Separator />
              <div className="grid gap-2">
                <CardTitle>{t("watchdog.recovery_steps_title")}</CardTitle>
                <CardDescription>
                  {t("watchdog.recovery_steps_description")}
                </CardDescription>
              </div>

              <div className="grid grid-cols-1 @sm/card:grid-cols-2 gap-4">
                <Field orientation="horizontal" className="w-fit">
                  <FieldLabel htmlFor="tier1-enabled">
                    {t("watchdog.tier_1_enable_label")}
                  </FieldLabel>
                  <Switch
                    id="tier1-enabled"
                    checked={tier1Enabled}
                    onCheckedChange={setTier1Enabled}
                    disabled={!isEnabled}
                  />
                </Field>

                <Field orientation="horizontal" className="w-fit">
                  <div className="flex items-center gap-1.5">
                    <Tooltip>
                      <TooltipTrigger>
                        <button
                          type="button"
                          className="inline-flex"
                          aria-label={t("watchdog.tier_2_more_info_aria")}
                        >
                          <TbInfoCircleFilled className="size-5 text-info" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t("watchdog.tier_2_tooltip")}</p>
                      </TooltipContent>
                    </Tooltip>
                    <FieldLabel htmlFor="tier2-enabled">
                      {t("watchdog.tier_2_enable_label")}
                    </FieldLabel>
                    <Switch
                      id="tier2-enabled"
                      checked={tier2Enabled}
                      onCheckedChange={setTier2Enabled}
                      disabled={!isEnabled}
                      aria-describedby={tier2Enabled ? "tier2-note" : undefined}
                    />
                  </div>
                </Field>

                <Field orientation="horizontal" className="w-fit">
                  <FieldLabel htmlFor="tier3-enabled">
                    {t("watchdog.tier_3_enable_label")}
                  </FieldLabel>
                  <Switch
                    id="tier3-enabled"
                    checked={tier3Enabled}
                    onCheckedChange={setTier3Enabled}
                    disabled={!isEnabled}
                  />
                </Field>

                <Field orientation="horizontal" className="w-fit">
                  <FieldLabel htmlFor="tier4-enabled">
                    {t("watchdog.tier_4_enable_label")}
                  </FieldLabel>
                  <Switch
                    id="tier4-enabled"
                    checked={tier4Enabled}
                    onCheckedChange={setTier4Enabled}
                    disabled={!isEnabled}
                  />
                </Field>
              </div>

              <Separator />
              <div className="grid gap-2">
                <div className="flex items-center gap-1.5">
                  <CardTitle>{t("watchdog.quality_title")}</CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <button
                        type="button"
                        className="inline-flex"
                        aria-label={t("watchdog.quality_more_info_aria")}
                      >
                        <TbInfoCircleFilled className="size-5 text-info" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>{t("watchdog.quality_tooltip")}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardDescription>
                  {t("watchdog.quality_description")}
                </CardDescription>
              </div>

              {/* Quality monitoring toggle */}
              <Field orientation="horizontal" className="w-fit">
                <FieldLabel htmlFor="quality-enabled">
                  {t("watchdog.quality_enable_label")}
                </FieldLabel>
                <Switch
                  id="quality-enabled"
                  checked={qualityEnabled}
                  onCheckedChange={setQualityEnabled}
                  disabled={!isEnabled}
                />
              </Field>

              <div aria-live="polite">
                {qualityEnabled && (
                  <div className="grid gap-4">
                    <div className="grid grid-cols-1 @sm/card:grid-cols-2 gap-4">
                      {/* Latency ceiling */}
                      <Field>
                        <FieldLabel htmlFor="latency-ceiling">
                          {t("watchdog.latency_ceiling_label")}
                        </FieldLabel>
                        <Input
                          id="latency-ceiling"
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max="10000"
                          placeholder={t("watchdog.latency_ceiling_placeholder")}
                          className="max-w-sm tabular-nums"
                          value={latencyCeiling}
                          onChange={(e) => setLatencyCeiling(e.target.value)}
                          disabled={!isEnabled}
                          aria-invalid={!!latencyCeilingError}
                          aria-describedby={
                            latencyCeilingError
                              ? "latency-ceiling-error"
                              : "latency-ceiling-desc"
                          }
                        />
                        {latencyCeilingError ? (
                          <FieldError id="latency-ceiling-error">
                            {latencyCeilingError}
                          </FieldError>
                        ) : (
                          <FieldDescription id="latency-ceiling-desc">
                            {t("watchdog.latency_ceiling_description")}
                          </FieldDescription>
                        )}
                      </Field>

                      {/* Loss ceiling */}
                      <Field>
                        <FieldLabel htmlFor="loss-ceiling">
                          {t("watchdog.loss_ceiling_label")}
                        </FieldLabel>
                        <Input
                          id="loss-ceiling"
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max="100"
                          placeholder={t("watchdog.loss_ceiling_placeholder")}
                          className="max-w-sm tabular-nums"
                          value={lossCeiling}
                          onChange={(e) => setLossCeiling(e.target.value)}
                          disabled={!isEnabled}
                          aria-invalid={!!lossCeilingError}
                          aria-describedby={
                            lossCeilingError
                              ? "loss-ceiling-error"
                              : "loss-ceiling-desc"
                          }
                        />
                        {lossCeilingError ? (
                          <FieldError id="loss-ceiling-error">
                            {lossCeilingError}
                          </FieldError>
                        ) : (
                          <FieldDescription id="loss-ceiling-desc">
                            {t("watchdog.loss_ceiling_description")}
                          </FieldDescription>
                        )}
                      </Field>

                      {/* Consecutive breaches */}
                      <Field>
                        <FieldLabel htmlFor="quality-consecutive">
                          {t("watchdog.quality_consecutive_label")}
                        </FieldLabel>
                        <Input
                          id="quality-consecutive"
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="60"
                          placeholder={t(
                            "watchdog.quality_consecutive_placeholder",
                          )}
                          className="max-w-sm tabular-nums"
                          value={qualityConsecutive}
                          onChange={(e) =>
                            setQualityConsecutive(e.target.value)
                          }
                          disabled={!isEnabled}
                          aria-invalid={!!qualityConsecutiveError}
                          aria-describedby={
                            qualityConsecutiveError
                              ? "quality-consecutive-error"
                              : "quality-consecutive-desc"
                          }
                        />
                        {qualityConsecutiveError ? (
                          <FieldError id="quality-consecutive-error">
                            {qualityConsecutiveError}
                          </FieldError>
                        ) : (
                          <FieldDescription id="quality-consecutive-desc">
                            {t("watchdog.quality_consecutive_description")}
                          </FieldDescription>
                        )}
                      </Field>
                    </div>

                    {qualityNoCeilingError && (
                      <FieldError id="quality-no-ceiling-error">
                        {qualityNoCeilingError}
                      </FieldError>
                    )}
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-2 pt-2">
                <SaveButton
                  type="submit"
                  isSaving={isSaving}
                  saved={saved}
                  className="w-fit"
                  disabled={!isDirty || hasValidationErrors}
                />
              </div>
            </FieldGroup>
          </FieldSet>
        </form>
      </CardContent>
    </Card>
  );
}
