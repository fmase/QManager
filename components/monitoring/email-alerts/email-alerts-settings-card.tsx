"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, EyeIcon, EyeOffIcon, SendIcon } from "lucide-react";
import {
  useEmailAlerts,
  type EmailAlertsSavePayload,
} from "@/hooks/use-email-alerts";

// =============================================================================
// EmailAlertsSettingsCard — Toggle + Configuration Form
// =============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EmailAlertsSettingsCard = () => {
  const {
    settings,
    isLoading,
    isSaving,
    isSendingTest,
    error,
    saveSettings,
    sendTestEmail,
  } = useEmailAlerts();

  // --- Local form state (synced from hook via useEffect) ---------------------
  const [isEnabled, setIsEnabled] = useState(false);
  const [senderEmail, setSenderEmail] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [appPassword, setAppPassword] = useState(""); // never pre-filled
  const [thresholdMinutes, setThresholdMinutes] = useState("5");
  const [showPassword, setShowPassword] = useState(false);

  // Sync form state when server data arrives
  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.enabled);
      setSenderEmail(settings.sender_email);
      setRecipientEmail(settings.recipient_email);
      setAppPassword(settings.app_password);
      setThresholdMinutes(String(settings.threshold_minutes));
    }
  }, [settings]);

  // --- Validation ------------------------------------------------------------
  const senderEmailError =
    senderEmail && !EMAIL_REGEX.test(senderEmail)
      ? "Enter a valid email address"
      : null;

  const recipientEmailError =
    recipientEmail && !EMAIL_REGEX.test(recipientEmail)
      ? "Enter a valid email address"
      : null;

  const thresholdError =
    thresholdMinutes &&
    (isNaN(Number(thresholdMinutes)) ||
      Number(thresholdMinutes) < 1 ||
      Number(thresholdMinutes) > 60)
      ? "Duration must be 1\u201360 minutes"
      : null;

  const hasValidationErrors = !!(
    senderEmailError ||
    recipientEmailError ||
    thresholdError
  );

  // --- Dirty check -----------------------------------------------------------
  const isDirty = useMemo(() => {
    if (!settings) return false;
    return (
      isEnabled !== settings.enabled ||
      senderEmail !== settings.sender_email ||
      recipientEmail !== settings.recipient_email ||
      thresholdMinutes !== String(settings.threshold_minutes) ||
      appPassword !== settings.app_password
    );
  }, [
    settings,
    isEnabled,
    senderEmail,
    recipientEmail,
    thresholdMinutes,
    appPassword,
  ]);

  const canSave = !hasValidationErrors && isDirty && !isSaving && !isSendingTest;

  // --- Handlers --------------------------------------------------------------
  const handleToggle = useCallback((checked: boolean) => {
    setIsEnabled(checked);
  }, []);

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSave) return;

      const payload: EmailAlertsSavePayload = {
        action: "save_settings",
        enabled: isEnabled,
        sender_email: senderEmail,
        recipient_email: recipientEmail,
        threshold_minutes: parseInt(thresholdMinutes, 10),
      };

      // Only include password if it changed from the saved value
      if (appPassword !== (settings?.app_password ?? "")) {
        payload.app_password = appPassword;
      }

      const success = await saveSettings(payload);
      if (success) {
        toast.success("Email alert settings saved");
      } else {
        toast.error(error || "Failed to save email alert settings");
      }
    },
    [
      canSave,
      isEnabled,
      senderEmail,
      recipientEmail,
      appPassword,
      thresholdMinutes,
      saveSettings,
      error,
    ],
  );

  const handleSendTest = useCallback(async () => {
    const success = await sendTestEmail();
    if (success) {
      toast.success("Test email sent successfully");
    } else {
      toast.error("Failed to send test email — check your configuration");
    }
  }, [sendTestEmail]);

  // Test button enabled only when fully configured and saved
  const canSendTest =
    settings?.enabled &&
    !!settings?.app_password &&
    EMAIL_REGEX.test(senderEmail) &&
    EMAIL_REGEX.test(recipientEmail) &&
    !isSaving &&
    !isSendingTest;

  // --- Loading skeleton ------------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Email Alert Settings</CardTitle>
          <CardDescription>
            Configure downtime notifications via email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-10 w-full max-w-sm" />
            <Skeleton className="h-10 w-full max-w-sm" />
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

  // --- Render ----------------------------------------------------------------
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Email Alert Settings</CardTitle>
        <CardDescription>
          Receive an email when your connection goes down for longer than the
          configured threshold.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSave}>
          <FieldSet>
            <FieldGroup>
              {/* Enable toggle */}
              <Field orientation="horizontal" className="w-fit">
                <FieldLabel htmlFor="email-alerts-enabled">
                  Enable Email Alerts
                </FieldLabel>
                <Switch
                  id="email-alerts-enabled"
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                />
              </Field>

              {/* Sender email */}
              <Field>
                <FieldLabel htmlFor="sender-email">Sender Email</FieldLabel>
                <Input
                  id="sender-email"
                  type="email"
                  placeholder="alerts@gmail.com"
                  className="max-w-sm"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  disabled={!isEnabled}
                  aria-invalid={!!senderEmailError}
                  aria-describedby={
                    senderEmailError ? "sender-email-error" : "sender-email-desc"
                  }
                  autoComplete="email"
                />
                {senderEmailError ? (
                  <FieldError id="sender-email-error">
                    {senderEmailError}
                  </FieldError>
                ) : (
                  <FieldDescription id="sender-email-desc">
                    The Gmail account that will send the alert.
                  </FieldDescription>
                )}
              </Field>

              {/* Recipient email */}
              <Field>
                <FieldLabel htmlFor="recipient-email">
                  Recipient Email
                </FieldLabel>
                <Input
                  id="recipient-email"
                  type="email"
                  placeholder="you@example.com"
                  className="max-w-sm"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  disabled={!isEnabled}
                  aria-invalid={!!recipientEmailError}
                  aria-describedby={
                    recipientEmailError
                      ? "recipient-email-error"
                      : "recipient-email-desc"
                  }
                  autoComplete="email"
                />
                {recipientEmailError ? (
                  <FieldError id="recipient-email-error">
                    {recipientEmailError}
                  </FieldError>
                ) : (
                  <FieldDescription id="recipient-email-desc">
                    Where alerts will be delivered.
                  </FieldDescription>
                )}
              </Field>

              {/* Gmail App Password */}
              <Field>
                <FieldLabel htmlFor="app-password">
                  Gmail App Password
                </FieldLabel>
                <div className="relative max-w-sm">
                  <Input
                    id="app-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="pr-10"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    disabled={!isEnabled}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </button>
                </div>
                <FieldDescription>
                  Generate an{" "}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info underline underline-offset-2 hover:text-info/80"
                  >
                    App Password
                  </a>{" "}
                  in your Google Account.
                </FieldDescription>
              </Field>

              {/* Threshold duration */}
              <Field>
                <FieldLabel htmlFor="threshold-minutes">
                  Alert After (minutes)
                </FieldLabel>
                <Input
                  id="threshold-minutes"
                  type="number"
                  min="1"
                  max="60"
                  placeholder="5"
                  className="max-w-sm"
                  value={thresholdMinutes}
                  onChange={(e) => setThresholdMinutes(e.target.value)}
                  disabled={!isEnabled}
                  aria-invalid={!!thresholdError}
                  aria-describedby={
                    thresholdError ? "threshold-error" : "threshold-desc"
                  }
                />
                {thresholdError ? (
                  <FieldError id="threshold-error">{thresholdError}</FieldError>
                ) : (
                  <FieldDescription id="threshold-desc">
                    How long the connection must be down before an alert is sent.
                    Prevents alerts for brief, transient outages.
                  </FieldDescription>
                )}
              </Field>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
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
                      Sending…
                    </>
                  ) : (
                    <>
                      <SendIcon className="size-4" />
                      Send Test Email
                    </>
                  )}
                </Button>
              </div>
            </FieldGroup>
          </FieldSet>
        </form>
      </CardContent>
    </Card>
  );
};

export default EmailAlertsSettingsCard;
