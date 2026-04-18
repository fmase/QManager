"use client";

import { useCallback, useState, useMemo } from "react";
import { useTranslation, Trans } from "react-i18next";
import { toast } from "sonner";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Loader2, PackageIcon, RefreshCcwIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useTrafficMasquerade } from "@/hooks/use-traffic-masquerade";
import { ServiceStats } from "../service-stats";
import { ServiceStatusBadge } from "../service-status-badge";

function MasqueradeSkeleton() {
  return (
    <Card className="@container/card">
      <CardHeader>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="grid gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </CardContent>
    </Card>
  );
}

interface TrafficMasqueradeSettingsCardProps {
  hook: ReturnType<typeof useTrafficMasquerade>;
  otherActive?: boolean;
  onSaved?: () => void;
}

export default function TrafficMasqueradeSettingsCard({
  hook,
  otherActive = false,
  onSaved,
}: TrafficMasqueradeSettingsCardProps) {
  const { t } = useTranslation("local-network");
  const { settings, isLoading, error, refresh } = hook;

  if (isLoading) return <MasqueradeSkeleton />;

  // H4: Error state — fetch failed, no settings to show
  if (error && !settings) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("masquerade.card_title")}</CardTitle>
          <CardDescription>
            {t("masquerade.card_description")}
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{t("masquerade.error_load_failed")}</span>
              <Button variant="outline" size="sm" onClick={() => refresh()}>
                <RefreshCcwIcon className="size-3.5" />
                {t("actions.retry", { ns: "common" })}
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Not installed state — nfqws binary missing
  if (settings && !settings.binary_installed) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("masquerade.card_title")}</CardTitle>
          <CardDescription>
            {t("masquerade.card_description")}
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <PackageIcon className="size-10 text-muted-foreground" />
            <div className="text-center space-y-1.5">
              <p className="text-sm font-medium">
                {t("masquerade.error_binary_not_installed")}
              </p>
              <p className="text-xs text-muted-foreground">
                <Trans
                  i18nKey="masquerade.error_install_from_video_optimizer"
                  t={t}
                  components={{
                    link: (
                      <Link
                        href="/local-network/video-optimizer"
                        className="underline underline-offset-2"
                      />
                    ),
                  }}
                />
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refresh()}>
              <RefreshCcwIcon className="size-3.5" />
              {t("masquerade.button_check_again")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // H3: Key-based remount — when settings change (initial load or post-save
  // re-fetch), the form reinitializes with fresh values from useState defaults.
  const formKey = settings
    ? `${settings.enabled}-${settings.sni_domain}`
    : "empty";

  return (
    <TrafficMasqueradeForm
      key={formKey}
      hook={hook}
      otherActive={otherActive}
      onSaved={onSaved}
    />
  );
}

function TrafficMasqueradeForm({
  hook,
  otherActive,
  onSaved,
}: {
  hook: ReturnType<typeof useTrafficMasquerade>;
  otherActive: boolean;
  onSaved?: () => void;
}) {
  const { t } = useTranslation("local-network");
  const { settings, isSaving, isUninstalling, error, saveSettings, runUninstall, refresh } = hook;

  const [isEnabled, setIsEnabled] = useState(settings?.enabled ?? false);
  const [sniDomain, setSniDomain] = useState(
    settings?.sni_domain || "speedtest.net",
  );
  const { saved, markSaved } = useSaveFlash();

  const isDirty = useMemo(() => {
    if (!settings) return false;
    return isEnabled !== settings.enabled || sniDomain !== settings.sni_domain;
  }, [settings, isEnabled, sniDomain]);

  const sniError = useMemo(() => {
    if (!sniDomain.trim()) return "Domain is required";
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(sniDomain))
      return "Invalid domain format";
    if (!sniDomain.includes(".")) return "Must contain at least one dot";
    if (sniDomain.length > 253) return "Domain too long (max 253 chars)";
    return null;
  }, [sniDomain]);

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (sniError) return;

      const success = await saveSettings(isEnabled, sniDomain);
      if (success) {
        markSaved();
        toast.success(
          isEnabled
            ? t("masquerade.toast_success_enabled")
            : t("masquerade.toast_success_disabled"),
        );
        onSaved?.();
      } else {
        toast.error(error || t("masquerade.toast_error_apply"));
      }
    },
    [isEnabled, sniDomain, sniError, saveSettings, markSaved, error, onSaved, t],
  );

  const canEnable =
    settings?.binary_installed &&
    settings?.kernel_module_loaded &&
    !otherActive;
  const canToggle = canEnable || settings?.enabled;
  const isRunning = settings?.status === "running";

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("masquerade.card_title")}</CardTitle>
        <CardDescription>
          {t("masquerade.card_description_full")}
        </CardDescription>
      </CardHeader>
      <CardContent aria-live="polite">
        {otherActive ? (
          <Alert className="border-warning/30 bg-warning/10 text-warning mb-4">
            <AlertTriangle className="size-4" />
            <AlertDescription className="text-warning">
              {t("masquerade.alert_video_optimizer_active")}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-warning/30 bg-warning/10 text-warning mb-4">
            <AlertTriangle className="size-4" />
            <AlertTitle className="text-warning">
              {t("masquerade.badge_experimental")}
            </AlertTitle>
          </Alert>
        )}

        {!settings?.kernel_module_loaded && (
          <Alert className="mb-4">
            <AlertTriangle className="size-4" />
            <AlertDescription>
              {t("masquerade.alert_kernel_module_missing")}
            </AlertDescription>
          </Alert>
        )}

        <form className="grid gap-4" onSubmit={handleSave}>
          <FieldSet>
            <Separator />
            <FieldGroup>
              <div className="flex items-center justify-between">
                <Field orientation="horizontal" className="w-fit">
                  <FieldLabel htmlFor="masq-enabled">
                    {t("masquerade.label_enable")}
                  </FieldLabel>
                  <Switch
                    id="masq-enabled"
                    checked={isEnabled}
                    onCheckedChange={setIsEnabled}
                    disabled={!canToggle || isSaving}
                    aria-label={t("masquerade.aria_enable")}
                  />
                </Field>
                {settings && (
                  <CardAction>
                    <ServiceStatusBadge
                      status={settings.status}
                      installed={settings.binary_installed}
                    />
                  </CardAction>
                )}
              </div>

              <Field>
                <FieldLabel htmlFor="sni-domain">{t("masquerade.label_domain")}</FieldLabel>
                <Input
                  id="sni-domain"
                  type="text"
                  value={sniDomain}
                  onChange={(e) => setSniDomain(e.target.value)}
                  disabled={!isEnabled || !canEnable || isSaving}
                  placeholder={t("masquerade.placeholder_domain")}
                  className="max-w-sm"
                  aria-invalid={!!sniError && isEnabled}
                  aria-describedby={
                    sniError && isEnabled ? "sni-error" : "sni-desc"
                  }
                />
                <FieldDescription id="sni-desc">
                  {t("masquerade.helper_domain")}
                </FieldDescription>
              </Field>

              {isRunning && settings && (
                <>
                  <Separator />
                  <ServiceStats
                    stats={[
                      { label: t("masquerade.stat_uptime"), value: settings.uptime },
                      { label: t("masquerade.stat_packets_processed"), value: settings.packets_processed.toLocaleString() },
                    ]}
                  />
                </>
              )}

              <Separator />
            </FieldGroup>
          </FieldSet>
          <div>
            <SaveButton
              type="submit"
              isSaving={isSaving}
              saved={saved}
              disabled={!isDirty || !canToggle || (isEnabled && !!sniError)}
            />
          </div>
        </form>

        {!isRunning && (
          <>
            <Separator className="mt-4" />
            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm font-medium">{t("masquerade.section_remove_binary")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("masquerade.section_remove_binary_desc")}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isUninstalling || isRunning}
                  >
                    {isUninstalling ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t("masquerade.state_removing")}
                      </>
                    ) : (
                      <>
                        <Trash2Icon className="size-4" />
                        {t("masquerade.button_uninstall")}
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("masquerade.dialog_uninstall_title")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("masquerade.dialog_uninstall_desc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("actions.cancel", { ns: "common" })}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        const success = await runUninstall();
                        if (success) {
                          toast.success(t("masquerade.toast_uninstall_success"));
                          refresh();
                        } else {
                          toast.error(
                            error || t("masquerade.toast_uninstall_error"),
                          );
                        }
                      }}
                    >
                      {t("masquerade.button_uninstall")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
