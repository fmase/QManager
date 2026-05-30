"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  CheckCircle2,
  InfoIcon,
  Loader2,
  Zap,
} from "lucide-react";
import type { useVideoOptimizer } from "@/hooks/use-video-optimizer";
import { ThroughputHero } from "./throughput-hero";
import { LiveStatTile } from "./live-stat-tile";
import type { HeroState } from "./throughput-hero";

interface VideoOptimizerModeProps {
  hook: ReturnType<typeof useVideoOptimizer>;
  heroState: HeroState;
  stateLabel: string;
  rate: number;
  deltas: number[];
  otherModeLabel: string;
  canEnable: boolean;
  /** Enable handler — owns the idle-vs-takeover confirm decision. */
  onEnable: (desyncRepeats: number) => void;
  onDisable: () => void;
}

/**
 * Video Optimizer mode body. Mosaic: hero spans full width, then a deliberately
 * uneven stat-tile row (uptime, domains, desync control), then the verify
 * confidence surface, then the hostlist (mounted by the composer below).
 */
export function VideoOptimizerMode({
  hook,
  heroState,
  stateLabel,
  rate,
  deltas,
  otherModeLabel,
  canEnable,
  onEnable,
  onDisable,
}: VideoOptimizerModeProps) {
  const { t } = useTranslation("local-network");
  const { settings, isSaving, verifyResult, runVerification } = hook;

  const running = settings?.status === "running";

  const [repeatsText, setRepeatsText] = useState<string>(
    String(settings?.desync_repeats ?? 1),
  );
  const { saved, markSaved } = useSaveFlash();

  const repeatsValid = useMemo(() => {
    if (!/^\d+$/.test(repeatsText)) return false;
    const n = parseInt(repeatsText, 10);
    return n >= 1 && n <= 10;
  }, [repeatsText]);

  const repeatsDirty = useMemo(() => {
    if (!settings) return false;
    const typed = repeatsValid ? parseInt(repeatsText, 10) : NaN;
    return typed !== settings.desync_repeats;
  }, [settings, repeatsText, repeatsValid]);

  // Saving the desync value while running is a no-takeover re-apply (engine
  // already owned by this mode). Routed through onEnable so the composer keeps
  // the single save+refresh path.
  const handleSaveDesync = useCallback(async () => {
    if (!repeatsValid) {
      toast.error(t("invalid_repeats", { ns: "errors" }));
      return;
    }
    onEnable(parseInt(repeatsText, 10));
    markSaved();
  }, [repeatsValid, repeatsText, onEnable, markSaved, t]);

  const verifying = verifyResult.status === "running";

  return (
    <div className="@container/engine flex flex-col gap-4">
      <ThroughputHero
        state={heroState}
        stateLabel={stateLabel}
        packetsProcessed={settings?.packets_processed ?? 0}
        rate={rate}
        deltas={deltas}
        uptime={settings?.uptime ?? "0s"}
        otherModeLabel={otherModeLabel}
        canEnable={canEnable}
        enabling={isSaving}
        onToggle={(next) =>
          next
            ? onEnable(repeatsValid ? parseInt(repeatsText, 10) : 1)
            : onDisable()
        }
      />

      {/* Uneven stat-tile row */}
      <div className="grid grid-cols-1 gap-4 @2xl/engine:grid-cols-6">
        <LiveStatTile
          className="@2xl/engine:col-span-2"
          label={t("traffic_engine.tile_uptime")}
          value={running ? (settings?.uptime ?? "0s") : "—"}
          muted={!running}
        />
        <LiveStatTile
          className="@2xl/engine:col-span-2"
          label={t("traffic_engine.tile_domains_protected")}
          value={running ? (settings?.domains_loaded ?? 0) : "—"}
          muted={!running}
        />

        {/* Desync control tile */}
        <Card className="@2xl/engine:col-span-2">
          <CardContent className="flex h-full flex-col gap-2 p-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("video_optimizer.label_desync_repeats")}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex"
                    aria-label={t("video_optimizer.aria_desync_repeats_info")}
                  >
                    <InfoIcon className="size-3.5 text-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    {t("video_optimizer.help_desync_repeats")}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="dpi-desync-repeats"
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                step={1}
                value={repeatsText}
                onChange={(e) => setRepeatsText(e.target.value)}
                disabled={isSaving}
                aria-invalid={!repeatsValid}
                aria-label={t("video_optimizer.label_desync_repeats")}
                className="h-9 w-20 tabular-nums"
              />
              <SaveButton
                type="button"
                isSaving={isSaving}
                saved={saved}
                disabled={!repeatsDirty || !repeatsValid}
                onClick={handleSaveDesync}
                label={t("traffic_engine.tile_apply")}
                className="min-w-0 flex-1"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Verify confidence surface */}
      {running && (
        <Card>
          <CardHeader>
            <CardTitle>{t("video_optimizer.verify_title")}</CardTitle>
            <CardDescription>
              {t("video_optimizer.verify_description")}
            </CardDescription>
            <CardAction>
              <Button
                type="button"
                variant="outline"
                onClick={runVerification}
                disabled={verifying}
              >
                {verifying ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {t("video_optimizer.state_verifying")}
                  </>
                ) : (
                  <>
                    <Zap />
                    {t("video_optimizer.button_verify_service")}
                  </>
                )}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent aria-live="polite">
            {verifyResult.status === "complete" &&
              verifyResult.passed === true && (
                <Alert className="border-success/30 bg-success/5">
                  <CheckCircle2 className="text-success" />
                  <AlertDescription className="text-success">
                    {verifyResult.message}
                  </AlertDescription>
                </Alert>
              )}
            {verifyResult.status === "complete" &&
              verifyResult.passed === false && (
                <Alert className="border-warning/30 bg-warning/10">
                  <AlertTriangle className="text-warning" />
                  <AlertDescription className="text-warning">
                    {verifyResult.message}
                  </AlertDescription>
                </Alert>
              )}
            {verifyResult.status === "error" && verifyResult.error && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>{verifyResult.error}</AlertDescription>
              </Alert>
            )}
            {verifyResult.status === "idle" && (
              <p className="text-sm text-muted-foreground">
                {t("traffic_engine.verify_idle_hint")}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
