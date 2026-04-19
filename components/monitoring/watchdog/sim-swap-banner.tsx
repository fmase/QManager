"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation, Trans } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCcwIcon, XIcon } from "lucide-react";
import { useModemStatus } from "@/hooks/use-modem-status";

const CGI_ENDPOINT = "/cgi-bin/quecmanager/monitoring/watchdog.sh";

export function SimSwapBanner() {
  const { t } = useTranslation("monitoring");
  const { data: modemStatus } = useModemStatus();
  const router = useRouter();
  const [isDismissing, setIsDismissing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = useCallback(async () => {
    setIsDismissing(true);
    try {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss_sim_swap" }),
      });
      if (resp.ok) {
        setDismissed(true);
      }
    } catch {
      // Silently fail — banner just stays visible
    } finally {
      setIsDismissing(false);
    }
  }, []);

  const handleApplyProfile = useCallback(() => {
    router.push("/cellular/custom-profiles");
  }, [router]);

  const simSwap = modemStatus?.sim_swap;

  // Don't render if no swap detected or already dismissed
  if (!simSwap?.detected || dismissed) {
    return null;
  }

  const hasMatchingProfile = !!simSwap.matching_profile_id;

  return (
    <div className="px-2 lg:px-6">
      <Alert className="mb-2">
        <RefreshCcwIcon className="size-4" />
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p>
            {hasMatchingProfile ? (
              <Trans
                i18nKey="watchdog.sim_swap_with_profile"
                ns="monitoring"
                values={{ profile_name: simSwap.matching_profile_name }}
                components={{ strong: <strong className="break-all" /> }}
              />
            ) : (
              t("watchdog.sim_swap_no_profile")
            )}
          </p>
          <span className="flex items-center gap-2 shrink-0">
            {hasMatchingProfile && (
              <Button size="sm" variant="default" onClick={handleApplyProfile}>
                {t("watchdog.sim_swap_apply_button")}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              disabled={isDismissing}
              aria-label={t("watchdog.sim_swap_dismiss_aria")}
            >
              <XIcon className="size-4" />
            </Button>
          </span>
        </AlertDescription>
      </Alert>
    </div>
  );
}
