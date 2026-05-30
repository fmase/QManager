"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { MiniSparkline } from "./mini-sparkline";

export type HeroState =
  | "protecting"
  | "masquerading"
  | "idle"
  | "off-other-owns";

interface ThroughputHeroProps {
  state: HeroState;
  /** Resolved, human-readable state label (already localized). */
  stateLabel: string;
  /** Cumulative packets processed by the engine. */
  packetsProcessed: number;
  /** Derived instantaneous rate in packets/second. */
  rate: number;
  /** Recent per-poll deltas for the sparkline, oldest first. */
  deltas: number[];
  uptime: string;
  /** The other mode's name, for the off-other-owns context line. */
  otherModeLabel?: string;
  /** Whether the engine can be enabled at all (binary + kernel ok). */
  canEnable: boolean;
  enabling: boolean;
  /** Toggle handler. Receives the desired enabled state. */
  onToggle: (next: boolean) => void;
}

function EngineDot({ live }: { live: boolean }) {
  if (!live) {
    return (
      <span
        className="size-2.5 shrink-0 rounded-full bg-muted-foreground/40"
        aria-hidden="true"
      />
    );
  }
  return (
    <span className="relative flex size-2.5 shrink-0 items-center justify-center">
      <span className="absolute inline-flex size-4 rounded-full bg-success/30 animate-halo-breathe" />
      <span className="relative inline-flex size-2.5 rounded-full bg-success" />
    </span>
  );
}

export function ThroughputHero({
  state,
  stateLabel,
  packetsProcessed,
  rate,
  deltas,
  uptime,
  otherModeLabel,
  canEnable,
  enabling,
  onToggle,
}: ThroughputHeroProps) {
  const { t } = useTranslation("local-network");

  const running = state === "protecting" || state === "masquerading";
  const idle = state === "idle";
  const offOther = state === "off-other-owns";

  return (
    <section
      className="@container/hero rounded-xl border bg-card p-6 shadow-sm @lg/engine:p-8 @3xl/engine:p-10"
      aria-live="polite"
    >
      <div className="flex flex-col gap-8 @2xl/hero:flex-row @2xl/hero:items-stretch @2xl/hero:gap-10">
        {/* Left: identity + ledger */}
        <div className="flex min-w-0 flex-col @2xl/hero:basis-[55%]">
          <div className="flex items-center gap-2.5">
            <EngineDot live={running} />
            <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
              {stateLabel}
            </h2>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
            {t("traffic_engine.engine_identity")}
          </p>

          <div className="mt-8 @2xl/hero:mt-auto @2xl/hero:pt-8">
            <div
              className={cn(
                "text-5xl font-semibold leading-none tracking-tight tabular-nums @lg/engine:text-6xl",
                "transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                running ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {packetsProcessed.toLocaleString()}
            </div>
            <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
              {t("traffic_engine.hero_packets_label")}
            </p>
          </div>
        </div>

        {/* Right: pulse */}
        <div className="flex min-w-0 flex-col justify-between gap-4 @2xl/hero:basis-[45%]">
          <div className="flex items-baseline justify-between gap-3 @2xl/hero:justify-end">
            <span className="text-xs uppercase tracking-wide text-muted-foreground @2xl/hero:hidden">
              {t("traffic_engine.hero_rate_label")}
            </span>
            <span className="flex items-baseline gap-1.5">
              <span
                className={cn(
                  "text-3xl font-semibold leading-none tabular-nums",
                  "transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  running ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {running ? rate.toLocaleString() : "0"}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("traffic_engine.hero_rate_unit")}
              </span>
            </span>
          </div>

          <MiniSparkline data={deltas} active={running} height={80} />

          {offOther && (
            <p className="text-xs text-muted-foreground">
              {t("traffic_engine.hero_other_owns_context", {
                mode: otherModeLabel,
              })}
            </p>
          )}
        </div>
      </div>

      {/* Enable affordance — prominence tracks state */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
        <div className="min-w-0">
          {running ? (
            <p className="text-sm text-muted-foreground tabular-nums">
              {t("traffic_engine.hero_uptime_inline", { uptime })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {idle
                ? t("traffic_engine.hero_idle_prompt")
                : t("traffic_engine.hero_takeover_prompt", {
                    mode: otherModeLabel,
                  })}
            </p>
          )}
        </div>

        {running ? (
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-medium text-foreground">
              {t("traffic_engine.hero_toggle_on")}
            </span>
            <Switch
              checked
              disabled={enabling}
              onCheckedChange={(v) => onToggle(v)}
              aria-label={t("traffic_engine.aria_disable_engine")}
            />
          </div>
        ) : (
          <Button
            type="button"
            variant={offOther ? "outline" : "default"}
            disabled={!canEnable || enabling}
            onClick={() => onToggle(true)}
          >
            {offOther
              ? t("traffic_engine.hero_button_take_over", {
                  mode: otherModeLabel,
                })
              : t("traffic_engine.hero_button_enable")}
          </Button>
        )}
      </div>
    </section>
  );
}
