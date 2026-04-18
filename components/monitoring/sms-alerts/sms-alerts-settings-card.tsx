"use client";

import React, { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, SendIcon, AlertCircle, RefreshCcwIcon } from "lucide-react";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  useSmsAlerts,
  type SmsAlertsSavePayload,
  type SmsAlertsSettings,
} from "@/hooks/use-sms-alerts";

// =============================================================================
// SmsAlertsSettingsCard — Toggle + Configuration Form
// =============================================================================

// E.164-ish: optional leading +, first digit 1–9, total 7–15 digits
const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

interface SmsAlertsSettingsCardProps {
  onTestSmsSent?: () => void;
}

const SmsAlertsSettingsCard = ({ onTestSmsSent }: SmsAlertsSettingsCardProps) => {
  const { t } = useTranslation("monitoring");
  const {
    settings,
    isLoading,
    isSaving,
    isSendingTest,
    error,
    saveSettings,
    sendTestSms,
    refresh,
  } = useSmsAlerts();

  // --- Local form state (synced from server data during render) -------------
  const { saved, markSaved } = useSaveFlash();
  const [prevSettings, setPrevSettings] = useState<SmsAlertsSettings | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [thresholdMinutes, setThresholdMinutes] = useState("5");

  if (settings && settings !== prevSettings) {
    setPrevSettings(settings);
    setIsEnabled(settings.enabled);
    setRecipientPhone(settings.recipient_phone);
    setThresholdMinutes(String(settings.threshold_minutes));
  }

  // --- Validation ------------------------------------------------------------
  const phoneError =
    recipientPhone && !PHONE_REGEX.test(recipientPhone)
      ? t("sms_alerts.validation_phone")
      : null;

  const thresholdError =
    thresholdMinutes &&
    (isNaN(Number(thresholdMinutes)) ||
      Number(thresholdMinutes) < 1 ||
      Number(thresholdMinutes) > 60)
      ? t("sms_alerts.validation_threshold")
      : null;

  const hasValidationErrors = !!(phoneError || thresholdError);

  // --- Dirty check -----------------------------------------------------------
  const isDirty = settings
    ? isEnabled !== settings.enabled ||
      recipientPhone !== settings.recipient_phone ||
      thresholdMinutes !== String(settings.threshold_minutes)
    : false;

  const canSave = !hasValidationErrors && isDirty && !isSaving && !isSendingTest;

  // --- Handlers --------------------------------------------------------------
  const handleToggle = (checked: boolean) => {
    setIsEnabled(checked);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    const payload: SmsAlertsSavePayload = {
      action: "save_settings",
      enabled: isEnabled,
      recipient_phone: recipientPhone,
      threshold_minutes: parseInt(thresholdMinutes, 10),
    };

    const success = await saveSettings(payload);
    if (success) {
      markSaved();
      toast.success(t("sms_alerts.toast_save_success"));
    } else {
      toast.error(error || t("sms_alerts.toast_save_error"));
    }
  };

  const handleSendTest = async () => {
    const success = await sendTestSms();
    if (success) {
      toast.success(t("sms_alerts.toast_test_success"));
    } else {
      toast.error(error || t("sms_alerts.toast_test_error"));
    }
    onTestSmsSent?.();
  };

  // Test button enabled only when fully configured and saved
  const canSendTest =
    settings?.enabled &&
    !!settings?.recipient_phone &&
    PHONE_REGEX.test(recipientPhone) &&
    !isSaving &&
    !isSendingTest;

  // --- Loading skeleton ------------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("sms_alerts.card_title")}</CardTitle>
          <CardDescription>
            {t("sms_alerts.card_description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-10 w-full max-w-sm" />
            <Skeleton className="h-10 w-full max-w-sm" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Error state (initial fetch failed) ------------------------------------
  if (!isLoading && error && !settings) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("sms_alerts.card_title")}</CardTitle>
          <CardDescription>
            {t("sms_alerts.card_description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>{t("sms_alerts.error_load_settings")}</AlertTitle>
            <AlertDescription>
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => refresh()}
              >
                <RefreshCcwIcon className="size-3.5" />
                {t("actions.retry", { ns: "common" })}
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // --- Render ----------------------------------------------------------------
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("sms_alerts.card_title")}</CardTitle>
        <CardDescription>
          {t("sms_alerts.card_description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSave}>
          <FieldSet>
            <FieldGroup>
              {/* Enable toggle */}
              <Field orientation="horizontal" className="w-fit">
                <FieldLabel htmlFor="sms-alerts-enabled">
                  {t("sms_alerts.enable_label")}
                </FieldLabel>
                <Switch
                  id="sms-alerts-enabled"
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                />
              </Field>

              {/* Recipient phone */}
              <Field>
                <FieldLabel htmlFor="recipient-phone">
                  {t("sms_alerts.recipient_phone_label")}
                </FieldLabel>
                <Input
                  id="recipient-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder={t("sms_alerts.recipient_phone_placeholder")}
                  className="max-w-sm font-mono"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  disabled={!isEnabled}
                  required={isEnabled}
                  aria-invalid={!!phoneError}
                  aria-describedby={
                    phoneError ? "recipient-phone-error" : "recipient-phone-desc"
                  }
                  autoComplete="tel"
                />
                {phoneError ? (
                  <FieldError id="recipient-phone-error">
                    {phoneError}
                  </FieldError>
                ) : (
                  <FieldDescription id="recipient-phone-desc">
                    {t("sms_alerts.recipient_phone_description")}
                  </FieldDescription>
                )}
              </Field>

              {/* Threshold duration */}
              <Field>
                <FieldLabel htmlFor="sms-threshold-minutes">
                  {t("sms_alerts.threshold_label")}
                </FieldLabel>
                <Input
                  id="sms-threshold-minutes"
                  type="number"
                  min="1"
                  max="60"
                  placeholder={t("sms_alerts.threshold_placeholder")}
                  className="max-w-sm"
                  value={thresholdMinutes}
                  onChange={(e) => setThresholdMinutes(e.target.value)}
                  disabled={!isEnabled}
                  required={isEnabled}
                  aria-invalid={!!thresholdError}
                  aria-describedby={
                    thresholdError ? "sms-threshold-error" : "sms-threshold-desc"
                  }
                />
                {thresholdError ? (
                  <FieldError id="sms-threshold-error">
                    {thresholdError}
                  </FieldError>
                ) : (
                  <FieldDescription id="sms-threshold-desc">
                    {t("sms_alerts.threshold_description")}
                  </FieldDescription>
                )}
              </Field>

              {/* Action buttons */}
              <div className="grid gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <SaveButton
                    type="submit"
                    isSaving={isSaving}
                    saved={saved}
                    disabled={!canSave}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit"
                    disabled={!canSendTest}
                    onClick={handleSendTest}
                  >
                    {isSendingTest ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t("sms_alerts.test_sms_sending")}
                      </>
                    ) : (
                      <>
                        <SendIcon className="size-4" />
                        {t("sms_alerts.test_sms_button")}
                      </>
                    )}
                  </Button>
                </div>
                {isDirty && !canSendTest && isEnabled && (
                  <p className="text-xs text-muted-foreground">
                    {t("sms_alerts.save_before_test_hint")}
                  </p>
                )}
              </div>
            </FieldGroup>
          </FieldSet>
        </form>
      </CardContent>
    </Card>
  );
};

export default SmsAlertsSettingsCard;
