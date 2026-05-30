"use client";

import { useTranslation, Trans } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  PackageIcon,
  RefreshCcwIcon,
} from "lucide-react";
import type { InstallResult } from "@/types/video-optimizer";

interface EngineOnboardingProps {
  installResult: InstallResult;
  onInstall: () => void;
  onRefresh: () => void;
}

/**
 * Shared not-installed state. One install of the nfqws engine unlocks BOTH
 * modes, so this replaces the two separate "package missing" panels the old
 * features each carried.
 */
export function EngineOnboarding({
  installResult,
  onInstall,
  onRefresh,
}: EngineOnboardingProps) {
  const { t } = useTranslation("local-network");
  const installing = installResult.status === "running";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("traffic_engine.onboarding_title")}</CardTitle>
        <CardDescription>
          {t("traffic_engine.onboarding_description")}
        </CardDescription>
      </CardHeader>
      <CardContent aria-live="polite">
        <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-xl border bg-muted/40">
            <PackageIcon className="size-7 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t("traffic_engine.onboarding_unlocks")}
            </p>
            <p className="text-xs text-muted-foreground">
              <Trans
                i18nKey="traffic_engine.onboarding_zapret_attribution"
                ns="local-network"
                components={{
                  link: (
                    <a
                      href="https://github.com/bol-van/zapret"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    />
                  ),
                }}
              />
            </p>
          </div>

          {installResult.status === "complete" && (
            <Alert className="border-success/30 bg-success/5 text-left">
              <CheckCircle2 className="text-success" />
              <AlertDescription className="text-success">
                {installResult.message}
                {installResult.detail && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({installResult.detail})
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {installResult.status === "error" && (
            <Alert variant="destructive" className="text-left">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                {installResult.message}
                {installResult.detail && (
                  <span className="mt-1 block text-xs opacity-80">
                    {installResult.detail}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-2">
            <Button onClick={onInstall} disabled={installing}>
              {installing ? (
                <>
                  <Loader2 className="animate-spin" />
                  {installResult.message ||
                    t("traffic_engine.onboarding_installing")}
                </>
              ) : (
                <>
                  <Download />
                  {t("traffic_engine.onboarding_install")}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={installing}
            >
              <RefreshCcwIcon className="size-3.5" />
              {t("traffic_engine.onboarding_check_again")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
