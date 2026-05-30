"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { AlertTriangle, RefreshCcwIcon } from "lucide-react";
import { Trans } from "react-i18next";

import { useVideoOptimizer } from "@/hooks/use-video-optimizer";
import { useTrafficMasquerade } from "@/hooks/use-traffic-masquerade";

import { EngineStatusStrip } from "./engine-status-strip";
import { VideoOptimizerMode } from "./video-optimizer-mode";
import { MasqueradeMode } from "./masquerade-mode";
import { CdnHostlistManager } from "./cdn-hostlist-manager";
import { EngineOnboarding } from "./engine-onboarding";
import { EngineAdvanced } from "./engine-advanced";
import type { ViewMode } from "./engine-mode-toggle";
import type { HeroState } from "./throughput-hero";

const RATE_WINDOW = 32; // sparkline keeps ~32 recent per-poll deltas

/**
 * Tracks per-poll deltas of a cumulative counter to derive a live pkt/s rate
 * and a sparkline series. Resets cleanly when the engine stops. 1s poll cadence
 * means each delta ≈ packets/second.
 */
function usePacketRate(packets: number | undefined, running: boolean) {
  const [deltas, setDeltas] = useState<number[]>([]);
  const [prev, setPrev] = useState<{ packets: number | null; running: boolean }>(
    { packets: null, running: false },
  );

  // Adjust state during render as the polled counter advances. This is React's
  // documented alternative to a setState-in-effect: it uses only state (no
  // refs, no effect), so it satisfies the compiler lint rules, and each branch
  // makes its own guard false on the next render, so there is no loop. The
  // hook polls every 1s while running, so each delta ≈ packets/second.
  if (running !== prev.running) {
    setPrev({ packets: running ? packets ?? null : null, running });
    if (!running && deltas.length) setDeltas([]);
  } else if (running && packets !== undefined && packets !== prev.packets) {
    const base = prev.packets;
    setPrev({ packets, running });
    if (base !== null) {
      const delta = Math.max(0, packets - base);
      setDeltas((buf) => [...buf, delta].slice(-RATE_WINDOW));
    }
  }

  const rate = deltas.length ? deltas[deltas.length - 1] : 0;
  return { deltas, rate };
}

function MosaicSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-56 rounded-md" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 @2xl/engine:grid-cols-6">
        <Skeleton className="h-24 rounded-lg @2xl/engine:col-span-2" />
        <Skeleton className="h-24 rounded-lg @2xl/engine:col-span-2" />
        <Skeleton className="h-24 rounded-lg @2xl/engine:col-span-2" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

type PendingTakeover = { target: ViewMode; apply: () => void } | null;

export default function TrafficEngine() {
  const { t } = useTranslation("local-network");
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const vo = useVideoOptimizer();
  const masq = useTrafficMasquerade();

  // viewMode initialised from ?mode=, defaulting to video.
  const initialMode: ViewMode =
    searchParams.get("mode") === "masquerade" ? "masquerade" : "video";
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [pendingTakeover, setPendingTakeover] = useState<PendingTakeover>(null);

  const setViewModeAndUrl = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      const params = new URLSearchParams(searchParams.toString());
      if (mode === "masquerade") params.set("mode", "masquerade");
      else params.delete("mode");
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  // --- Derived engine truth (mutex guarantees at most one running) ---
  const voRunning = vo.settings?.status === "running";
  const masqRunning = masq.settings?.status === "running";
  const activeMode: ViewMode | null = voRunning
    ? "video"
    : masqRunning
      ? "masquerade"
      : null;

  const installed = vo.settings?.binary_installed ?? false;
  const kernelOk = vo.settings?.kernel_module_loaded ?? false;

  const voRate = usePacketRate(vo.settings?.packets_processed, voRunning);
  const masqRate = usePacketRate(masq.settings?.packets_processed, masqRunning);

  const refreshBoth = useCallback(() => {
    vo.refresh(true);
    masq.refresh(true);
  }, [vo, masq]);

  // --- Save handlers (single call; backend auto-takes-over) ---
  const saveVideo = useCallback(
    async (enabled: boolean, desyncRepeats: number) => {
      const ok = await vo.saveSettings({ enabled, desync_repeats: desyncRepeats });
      if (ok) {
        toast.success(
          enabled
            ? t("traffic_engine.toast_video_enabled")
            : t("traffic_engine.toast_video_disabled"),
        );
        refreshBoth();
      } else {
        toast.error(vo.error || t("video_optimizer.toast_error_apply"));
      }
    },
    [vo, refreshBoth, t],
  );

  const saveMasq = useCallback(
    async (enabled: boolean, sni: string) => {
      const ok = await masq.saveSettings(enabled, sni);
      if (ok) {
        toast.success(
          enabled
            ? t("traffic_engine.toast_masquerade_enabled")
            : t("traffic_engine.toast_masquerade_disabled"),
        );
        refreshBoth();
      } else {
        toast.error(masq.error || t("masquerade.toast_error_apply"));
      }
    },
    [masq, refreshBoth, t],
  );

  // Enabling a mode while the OTHER mode owns the engine requires confirm.
  // Idle engine, or re-applying the already-running mode, needs no confirm.
  const requestEnableVideo = useCallback(
    (desyncRepeats: number) => {
      if (masqRunning) {
        setPendingTakeover({
          target: "video",
          apply: () => saveVideo(true, desyncRepeats),
        });
        return;
      }
      saveVideo(true, desyncRepeats);
    },
    [masqRunning, saveVideo],
  );

  const requestEnableMasq = useCallback(
    (sni: string) => {
      if (voRunning) {
        setPendingTakeover({
          target: "masquerade",
          apply: () => saveMasq(true, sni),
        });
        return;
      }
      saveMasq(true, sni);
    },
    [voRunning, saveMasq],
  );

  // --- Hero state per current view ---
  const heroState: HeroState = useMemo(() => {
    if (viewMode === "video") {
      if (voRunning) return "protecting";
      if (masqRunning) return "off-other-owns";
      return "idle";
    }
    if (masqRunning) return "masquerading";
    if (voRunning) return "off-other-owns";
    return "idle";
  }, [viewMode, voRunning, masqRunning]);

  const videoLabel = t("traffic_engine.mode_video");
  const masqueradeLabel = t("traffic_engine.mode_masquerade");

  const heroStateLabel = useMemo(() => {
    switch (heroState) {
      case "protecting":
        return t("traffic_engine.state_protecting");
      case "masquerading":
        return t("traffic_engine.state_masquerading", {
          domain: masq.settings?.sni_domain,
        });
      case "off-other-owns":
        return t("traffic_engine.hero_off_other", {
          mode: viewMode === "video" ? masqueradeLabel : videoLabel,
        });
      default:
        return t("traffic_engine.state_idle");
    }
  }, [heroState, t, masq.settings?.sni_domain, viewMode, masqueradeLabel, videoLabel]);

  const canEnable = installed && kernelOk;

  // ---------------- State machine ----------------
  const isLoading = vo.isLoading || masq.isLoading;
  const loadError =
    (vo.error && !vo.settings) || (masq.error && !masq.settings);
  const anyRunning = voRunning || masqRunning;

  return (
    <div className="@container/main mx-auto flex flex-col gap-6 p-2">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("traffic_engine.page_title")}
        </h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          {t("traffic_engine.page_description")}
        </p>
      </header>

      {isLoading ? (
        <div className="@container/engine">
          <MosaicSkeleton />
        </div>
      ) : loadError ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertTriangle className="size-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{t("traffic_engine.error_load_failed")}</span>
            <Button variant="outline" size="sm" onClick={() => refreshBoth()}>
              <RefreshCcwIcon className="size-3.5" />
              {t("actions.retry", { ns: "common" })}
            </Button>
          </AlertDescription>
        </Alert>
      ) : !installed ? (
        <EngineOnboarding
          installResult={vo.installResult}
          onInstall={vo.runInstall}
          onRefresh={() => vo.refresh()}
        />
      ) : (
        <div className="@container/engine flex flex-col gap-6">
          <EngineStatusStrip
            viewMode={viewMode}
            onViewModeChange={setViewModeAndUrl}
            activeMode={activeMode}
            sniDomain={masq.settings?.sni_domain}
          />

          {!kernelOk && (
            <Alert aria-live="polite">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                <Trans
                  i18nKey="traffic_engine.alert_kernel_module_missing"
                  ns="local-network"
                  components={{
                    code: (
                      <code className="rounded bg-muted px-1 py-0.5 text-xs" />
                    ),
                  }}
                />
              </AlertDescription>
            </Alert>
          )}

          {/* Mode body — cross-fades on switch, frame stays put */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={viewMode}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={
                reduceMotion ? { duration: 0 } : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }
              }
            >
              {viewMode === "video" ? (
                <div className="flex flex-col gap-4">
                  <VideoOptimizerMode
                    hook={vo}
                    heroState={heroState}
                    stateLabel={heroStateLabel}
                    rate={voRate.rate}
                    deltas={voRate.deltas}
                    otherModeLabel={masqueradeLabel}
                    canEnable={canEnable}
                    onEnable={requestEnableVideo}
                    onDisable={() =>
                      saveVideo(false, vo.settings?.desync_repeats ?? 1)
                    }
                  />
                  <CdnHostlistManager />
                </div>
              ) : (
                <MasqueradeMode
                  hook={masq}
                  heroState={heroState}
                  stateLabel={heroStateLabel}
                  rate={masqRate.rate}
                  deltas={masqRate.deltas}
                  otherModeLabel={videoLabel}
                  canEnable={canEnable}
                  onEnable={requestEnableMasq}
                  onDisable={() =>
                    saveMasq(false, masq.settings?.sni_domain ?? "speedtest.net")
                  }
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Shared danger zone — only when nothing is running */}
          {!anyRunning && (
            <EngineAdvanced
              isUninstalling={vo.isUninstalling}
              onUninstall={vo.runUninstall}
              onUninstalled={refreshBoth}
              errorMessage={vo.error}
            />
          )}
        </div>
      )}

      {/* Takeover confirm — switching which mode owns the single engine */}
      <AlertDialog
        open={pendingTakeover !== null}
        onOpenChange={(open) => !open && setPendingTakeover(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingTakeover &&
                t("traffic_engine.takeover_title", {
                  mode:
                    pendingTakeover.target === "video"
                      ? videoLabel
                      : masqueradeLabel,
                })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingTakeover &&
                t("traffic_engine.takeover_desc", {
                  enabling:
                    pendingTakeover.target === "video"
                      ? videoLabel
                      : masqueradeLabel,
                  stopping:
                    pendingTakeover.target === "video"
                      ? masqueradeLabel
                      : videoLabel,
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("actions.cancel", { ns: "common" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                pendingTakeover?.apply();
                setPendingTakeover(null);
              }}
            >
              {pendingTakeover &&
                t("traffic_engine.takeover_confirm", {
                  mode:
                    pendingTakeover.target === "video"
                      ? videoLabel
                      : masqueradeLabel,
                })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
