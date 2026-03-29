"use client";

import { useCallback, useState, useMemo } from "react";
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
  const { settings, isLoading, error, refresh } = hook;

  if (isLoading) return <MasqueradeSkeleton />;

  // H4: Error state — fetch failed, no settings to show
  if (error && !settings) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Traffic Masquerade</CardTitle>
          <CardDescription>
            Make HTTPS traffic appear as a whitelisted service to carrier DPI.
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Failed to load settings.</span>
              <Button variant="outline" size="sm" onClick={() => refresh()}>
                <RefreshCcwIcon className="size-3.5" />
                Retry
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
          <CardTitle>Traffic Masquerade</CardTitle>
          <CardDescription>
            Make HTTPS traffic appear as a whitelisted service to carrier DPI.
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <PackageIcon className="size-10 text-muted-foreground" />
            <div className="text-center space-y-1.5">
              <p className="text-sm font-medium">
                The <code>nfqws</code> binary is not installed on this device.
              </p>
              <p className="text-xs text-muted-foreground">
                Install it from the{" "}
                <Link
                  href="/local-network/video-optimizer"
                  className="underline underline-offset-2"
                >
                  Video Optimizer
                </Link>{" "}
                page, then check again.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refresh()}>
              <RefreshCcwIcon className="size-3.5" />
              Check Again
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
            ? "Traffic Masquerade enabled"
            : "Traffic Masquerade disabled",
        );
        onSaved?.();
      } else {
        toast.error(error || "Failed to save settings");
      }
    },
    [isEnabled, sniDomain, sniError, saveSettings, markSaved, error, onSaved],
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
        <CardTitle>Traffic Masquerade</CardTitle>
        <CardDescription>
          Make HTTPS traffic appear as a whitelisted service to carrier DPI by
          injecting fake TLS handshakes with a spoofed domain. Some carriers
          may detect this behavior and de-prioritize your connection.
        </CardDescription>
      </CardHeader>
      <CardContent aria-live="polite">
        {otherActive ? (
          <Alert className="border-warning/30 bg-warning/10 text-warning mb-4">
            <AlertTriangle className="size-4" />
            <AlertDescription className="text-warning">
              Video Optimizer is currently active. Disable it first before
              enabling Traffic Masquerade.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-warning/30 bg-warning/10 text-warning mb-4">
            <AlertTriangle className="size-4" />
            <AlertTitle className="text-warning">
              Experimental Feature
            </AlertTitle>
          </Alert>
        )}

        {!settings?.kernel_module_loaded && (
          <Alert className="mb-4">
            <AlertTriangle className="size-4" />
            <AlertDescription>
              Required kernel module not found. Run{" "}
              <code className="text-xs">opkg install kmod-nft-queue</code> on
              the device.
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
                    Enable Traffic Masquerade
                  </FieldLabel>
                  <Switch
                    id="masq-enabled"
                    checked={isEnabled}
                    onCheckedChange={setIsEnabled}
                    disabled={!canToggle || isSaving}
                    aria-label="Enable Traffic Masquerade"
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
                <FieldLabel htmlFor="sni-domain">Masquerade Domain</FieldLabel>
                <Input
                  id="sni-domain"
                  type="text"
                  value={sniDomain}
                  onChange={(e) => setSniDomain(e.target.value)}
                  disabled={!isEnabled || !canEnable || isSaving}
                  placeholder="speedtest.net"
                  className="max-w-sm"
                  aria-invalid={!!sniError && isEnabled}
                  aria-describedby={
                    sniError && isEnabled ? "sni-error" : "sni-desc"
                  }
                />
                <FieldDescription id="sni-desc">
                  The domain that appears in the fake TLS handshake sent to the
                  carrier.
                </FieldDescription>
              </Field>

              {isRunning && settings && (
                <>
                  <Separator />
                  <ServiceStats
                    stats={[
                      { label: "Uptime", value: settings.uptime },
                      { label: "Packets Processed", value: settings.packets_processed.toLocaleString() },
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
                <p className="text-sm font-medium">Remove nfqws</p>
                <p className="text-xs text-muted-foreground">
                  Uninstall the nfqws binary from this device.
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
                        Removing…
                      </>
                    ) : (
                      <>
                        <Trash2Icon className="size-4" />
                        Uninstall
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Uninstall nfqws?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the nfqws binary and disable both Video
                      Optimizer and Traffic Masquerade. You can reinstall it
                      from the Video Optimizer page.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        const success = await runUninstall();
                        if (success) {
                          toast.success("nfqws uninstalled");
                          refresh();
                        } else {
                          toast.error(
                            error || "Failed to uninstall nfqws",
                          );
                        }
                      }}
                    >
                      Uninstall
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
