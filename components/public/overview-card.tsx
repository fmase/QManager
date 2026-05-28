"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import {
  CheckCircle2Icon,
  Loader2Icon,
  MinusCircleIcon,
  TriangleAlertIcon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react";
import { SiOpenwrt } from "react-icons/si";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { ModeToggle } from "@/components/public/mode-toggle";
import { usePublicOverview } from "@/hooks/use-public-overview";
import { deriveConnectionLabel } from "@/lib/public-overview/format";
import {
  formatTemperature,
  getSignalQuality,
  RSRP_THRESHOLDS,
  RSRQ_THRESHOLDS,
  SINR_THRESHOLDS,
  signalToProgress,
  worstSignalQuality,
  type SignalQuality,
  type SignalThresholds,
} from "@/types/modem-status";
import type { ConnectionState } from "@/types/modem-status";
import { useEffect, useRef, useState } from "react";

// Temperature warning thresholds — kept in sync with device-metrics.tsx
const TEMP_WARN = 60; // °C
const TEMP_DANGER = 75; // °C

type TempBand = "unknown" | "normal" | "warn" | "danger";

function temperatureBand(temp: number | null): TempBand {
  if (temp == null) return "unknown";
  if (temp >= TEMP_DANGER) return "danger";
  if (temp >= TEMP_WARN) return "warn";
  return "normal";
}

type Tone = "success" | "warning" | "info" | "destructive" | "muted";

function qualityVisual(quality: SignalQuality, reachable: boolean): {
  tone: Tone;
  Icon: LucideIcon;
} {
  if (!reachable || quality === "none")
    return { tone: "muted", Icon: MinusCircleIcon };
  if (quality === "excellent" || quality === "good")
    return { tone: "success", Icon: CheckCircle2Icon };
  if (quality === "fair") return { tone: "warning", Icon: TriangleAlertIcon };
  return { tone: "destructive", Icon: XCircleIcon };
}

// Eyebrow type style — the small uppercase label above each header / status
// cell. Centralized so the scale tunes in one place. 0.6875rem = 11px.
const EYEBROW_CLASS =
  "text-muted-foreground/80 text-[0.6875rem] font-semibold uppercase leading-none tracking-widest";

// Per-tone class strings: status cells consume `text`, signal bars consume
// `bar`. Text uses the *-on-surface variants (darker in light theme, lighter
// in dark) so functional-color values clear WCAG AA 4.5:1 against the card
// surface in both themes. The fill tokens stay tuned for 3:1 non-text.
const TONE_CLASSES: Record<Tone, { text: string; bar: string }> = {
  success: { text: "text-success-on-surface", bar: "bg-success" },
  warning: { text: "text-warning-on-surface", bar: "bg-warning" },
  info: { text: "text-info-on-surface", bar: "bg-info" },
  destructive: {
    text: "text-destructive-on-surface",
    bar: "bg-destructive",
  },
  muted: { text: "text-muted-foreground", bar: "bg-muted-foreground/40" },
};

// ---------- Signal bars ---------------------------------------------------

interface SignalBarProps {
  metric: string;
  value: number | null;
  unit: string;
  thresholds: SignalThresholds;
  reachable: boolean;
}

function SignalBar({
  metric,
  value,
  unit,
  thresholds,
  reachable,
}: SignalBarProps) {
  const reduceMotion = useReducedMotion();
  const quality: SignalQuality = reachable
    ? getSignalQuality(value, thresholds)
    : "none";
  const percent = reachable ? signalToProgress(value, thresholds) : 0;
  const { tone } = qualityVisual(quality, reachable);
  const { text: textClass, bar: barClass } = TONE_CLASSES[tone];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground font-medium">{metric}</span>
        <span
          className={cn(
            "font-semibold tabular-nums transition-colors duration-200",
            textClass,
          )}
        >
          {value != null ? `${value} ${unit}` : "—"}
        </span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <motion.div
          className={cn(
            "h-full origin-left rounded-full transition-colors duration-200",
            barClass,
          )}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: percent / 100 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
          }
        />
      </div>
    </div>
  );
}

// ---------- Header trio (Carrier / Network / Bands) ------------------------

function HeaderCell({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <span className={EYEBROW_CLASS}>{label}</span>
      <span
        className="text-foreground w-full truncate text-sm font-semibold leading-none tracking-tight"
        title={title ?? value}
      >
        {value}
      </span>
    </div>
  );
}

// ---------- Status trio (Overall / Internet / Temperature) -----------------
//
// Eyebrow + value, value tinted by functional-color tone. Card-less by design:
// the surrounding overview card already provides the container, so wrapping
// each cell in its own panel would create nested-card chrome. Inline icon at
// label size keeps the meaning carried by more than colour alone (WCAG 1.4.1).

function StatusCell({
  label,
  value,
  tone,
  Icon,
  spin = false,
  stale = false,
  numeric = false,
}: {
  label: string;
  value: string;
  tone?: Tone;
  Icon?: LucideIcon;
  spin?: boolean;
  stale?: boolean;
  // Temperature shows digits ("48 °C") that benefit from tabular-nums so
  // each poll's value swap doesn't jitter the baseline. Overall/Connectivity
  // are alphabetic ("Good", "Connected") and don't need the feature.
  numeric?: boolean;
}) {
  const textClass = tone ? TONE_CLASSES[tone].text : "text-foreground";
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={EYEBROW_CLASS}>{label}</span>
      <span
        className={cn(
          "flex items-center gap-1.5 text-base font-semibold leading-none tracking-tight transition-colors duration-200",
          textClass,
          numeric && "tabular-nums",
          stale && "opacity-70",
        )}
      >
        {Icon && (
          <Icon
            aria-hidden
            className={cn(
              "size-4 shrink-0",
              spin && "motion-safe:animate-spin",
            )}
          />
        )}
        <span className="truncate">{value}</span>
      </span>
    </div>
  );
}

// ---------- Component ------------------------------------------------------

export default function OverviewCard() {
  const { t } = useTranslation("common");
  const { data, isLoading, isStale, error, refresh, consecutiveFailures } =
    usePublicOverview();

  // Verdict announcer: a single sr-only aria-live region that fires only when
  // a meaningful band changes (signal quality, connection state, temperature
  // band). Without this gate the 5 s poll would re-announce the entire status
  // trio on every tick.
  const [announcement, setAnnouncement] = useState("");
  const prevVerdictRef = useRef<string>("");

  // Setup gate: bounce to /setup/ on a fresh-install device.
  useEffect(() => {
    if (data?.state === "setup_required") {
      window.location.href = "/setup/";
    }
  }, [data]);

  useEffect(() => {
    if (!data || data.state !== "ok") return;
    const reachable = data.modem_reachable;
    const connectionLabel: ConnectionState | "modem_unreachable" = reachable
      ? deriveConnectionLabel(data.network.lte_state, data.network.nr_state)
      : "modem_unreachable";
    const quality = worstSignalQuality(
      getSignalQuality(data.signal.rsrp, RSRP_THRESHOLDS),
      getSignalQuality(data.signal.rsrq, RSRQ_THRESHOLDS),
      getSignalQuality(data.signal.sinr, SINR_THRESHOLDS),
    );
    const tempBand = temperatureBand(data.temperature);
    const verdict = `${quality}|${connectionLabel}|${tempBand}`;

    // First reading: seed the ref but don't announce.
    if (prevVerdictRef.current === "") {
      prevVerdictRef.current = verdict;
      return;
    }
    if (prevVerdictRef.current === verdict) return;

    const [prevQ, prevC, prevT] = prevVerdictRef.current.split("|");
    const parts: string[] = [];
    if (prevQ !== quality) {
      parts.push(
        `${t("overview.status.overall")}: ${t(`overview.quality.${quality}`)}`,
      );
    }
    if (prevC !== connectionLabel) {
      parts.push(
        `${t("overview.status.connectivity")}: ${t(`overview.connection.${connectionLabel}`)}`,
      );
    }
    if (prevT !== tempBand) {
      parts.push(
        `${t("overview.status.temperature")}: ${formatTemperature(data.temperature)}`,
      );
    }
    if (parts.length > 0) setAnnouncement(parts.join(". "));
    prevVerdictRef.current = verdict;
  }, [data, t]);

  // No card-level entrance animation: product surfaces load into a task,
  // not into a choreographed reveal. SignalBar fills still animate because
  // there the motion carries meaning (signal growing into place).
  return (
    <Card className="@container/overview w-full">
        <CardHeader className="items-center">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center">
              {/* Decorative: the adjacent CardTitle already names the product
                  for screen readers. */}
              <img
                src="/qmanager-logo.svg"
                alt=""
                aria-hidden="true"
                width={40}
                height={40}
                className="size-full"
              />
            </div>
            <CardTitle as="h1" className="text-base">
              {t("overview.title")}
            </CardTitle>
          </div>

          {/* Top-right action cluster: LuCI passthrough + theme switcher. The
              two icon buttons live in CardAction so the header keeps the
              No-Header-Icon contract — icons appear in the action slot, not
              alongside the title. */}
          <CardAction className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              asChild
              aria-label={t("overview.actions.luci_aria")}
              title={t("overview.actions.luci")}
            >
              <a
                href="/cgi-bin/luci"
                target="_blank"
                rel="noopener noreferrer"
              >
                <SiOpenwrt className="h-[1.2rem] w-[1.2rem]" aria-hidden />
                <span className="sr-only">
                  {t("overview.actions.luci")}
                </span>
              </a>
            </Button>
            <ModeToggle />
          </CardAction>
        </CardHeader>

        <CardContent>
          {renderBody({
            data,
            isLoading,
            isStale,
            error,
            consecutiveFailures,
            t,
            refresh,
          })}
          {/* Single visually-hidden announcer for verdict transitions. Lives
              outside the polled UI surfaces so SR users hear deltas
              ("Internet: Searching") instead of the full trio every tick. */}
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {announcement}
          </span>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/login/">{t("overview.actions.login")}</Link>
          </Button>
          <p className="text-muted-foreground text-xs">
            {t("overview.copyright", { year: new Date().getFullYear() })}
          </p>
        </CardFooter>
    </Card>
  );
}

// ---------- Body renderer --------------------------------------------------

interface BodyProps {
  data: ReturnType<typeof usePublicOverview>["data"];
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  consecutiveFailures: number;
  t: (key: string, opts?: Record<string, unknown>) => string;
  refresh: () => void;
}

// After this many consecutive fetch failures, swap from "stale data + chip"
// to a full EmptyState so the user gets an obvious retry affordance instead
// of staring at indefinitely stale numbers.
const FAILURE_EMPTY_STATE_THRESHOLD = 3;

function renderBody({
  data,
  isLoading,
  isStale,
  error,
  consecutiveFailures,
  t,
  refresh,
}: BodyProps) {
  if (isLoading && !data) {
    return <SkeletonBody loadingLabel={t("overview.loading_status")} />;
  }
  if (data?.state === "setup_required") {
    return (
      <div
        className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm"
        role="status"
      >
        <Loader2Icon className="size-4 motion-safe:animate-spin" aria-hidden />
        {t("overview.redirecting_setup")}
      </div>
    );
  }

  if (error && !data) {
    return (
      <EmptyState
        title={t("overview.empty.title")}
        subtitle={t("overview.empty.fetch_error")}
        retryLabel={t("overview.empty.retry")}
        onRetry={refresh}
      />
    );
  }
  // Repeated fetch failures with prior data: stop pretending the screen is
  // live and surface the recovery affordance.
  if (error && consecutiveFailures >= FAILURE_EMPTY_STATE_THRESHOLD) {
    return (
      <EmptyState
        title={t("overview.empty.title")}
        subtitle={t("overview.empty.fetch_error")}
        retryLabel={t("overview.empty.retry")}
        onRetry={refresh}
      />
    );
  }
  if (data?.state === "unavailable") {
    return (
      <EmptyState
        title={t("overview.empty.title")}
        subtitle={t("overview.empty.subtitle")}
        retryLabel={t("overview.empty.retry")}
        onRetry={refresh}
      />
    );
  }
  if (!data || data.state !== "ok") return <SkeletonBody />;

  const reachable = data.modem_reachable;
  const connectionLabel: ConnectionState | "modem_unreachable" = reachable
    ? deriveConnectionLabel(data.network.lte_state, data.network.nr_state)
    : "modem_unreachable";

  const carrier = data.network.carrier || t("overview.field.empty");
  const networkType = data.network.type || t("overview.field.empty");
  // Compact band summary — "B1, N41" style. The detailed per-band readout
  // (PCI + per-component RSRP) is power-user material that belongs on the
  // authenticated dashboard; the pre-login card stays at-a-glance.
  const bandSummary =
    data.network.bands && data.network.bands.length > 0
      ? data.network.bands
          .map((b) => b.band)
          .filter(Boolean)
          .join(", ") || t("overview.field.empty")
      : t("overview.field.empty");

  // Overall = worst of RSRP/RSRQ/SINR. RSRP-alone would mask a strong-signal /
  // poor-SINR scene (interference-bound link).
  const quality = worstSignalQuality(
    getSignalQuality(data.signal.rsrp, RSRP_THRESHOLDS),
    getSignalQuality(data.signal.rsrq, RSRQ_THRESHOLDS),
    getSignalQuality(data.signal.sinr, SINR_THRESHOLDS),
  );
  const qualityLabel = t(`overview.quality.${quality}`);
  const connectionText = t(`overview.connection.${connectionLabel}`);
  const tempText = formatTemperature(data.temperature);

  return (
    <div className="flex flex-col gap-5">
      {/* Stale indicator stays as a chip above the header trio so screen
          readers (aria-live) catch the warning without re-announcing every
          poll tick from the cells themselves. */}
      {isStale && (
        <div aria-live="polite" className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="bg-warning/15 text-warning-on-surface hover:bg-warning/20 border-warning/30"
          >
            <TriangleAlertIcon className="size-3" aria-hidden />
            {t("overview.stale_indicator")}
          </Badge>
        </div>
      )}

      {/* Header trio — Carrier · Network · Bands. Bare, left-aligned metadata
          row that shares its left edge with the signal bars and status trio
          below. The previous tonal inset competed with the status trio for
          "contained zone"; dropping the surface lets state (the verdict) be
          the visual hero, with identity playing a calm supporting role. */}
      <div
        className={cn(
          "grid grid-cols-3 gap-3 transition-opacity duration-200",
          isStale && "opacity-80",
        )}
      >
        <HeaderCell
          label={t("overview.header.carrier")}
          value={carrier}
          title={data.network.carrier}
        />
        <HeaderCell
          label={t("overview.header.network")}
          value={networkType}
        />
        <HeaderCell
          label={t("overview.header.bands")}
          value={bandSummary}
          title={bandSummary}
        />
      </div>

      {/* Signal bars — unchanged: each bar tinted by its own metric's quality
          so a weak SINR under good RSRP shows up immediately. */}
      <div
        className={cn(
          "flex flex-col gap-3 transition-opacity duration-200",
          isStale && "opacity-70",
        )}
      >
        <SignalBar
          metric={t("overview.metrics.rsrp")}
          value={data.signal.rsrp}
          unit="dBm"
          thresholds={RSRP_THRESHOLDS}
          reachable={reachable}
        />
        <SignalBar
          metric={t("overview.metrics.rsrq")}
          value={data.signal.rsrq}
          unit="dB"
          thresholds={RSRQ_THRESHOLDS}
          reachable={reachable}
        />
        <SignalBar
          metric={t("overview.metrics.sinr")}
          value={data.signal.sinr}
          unit="dB"
          thresholds={SINR_THRESHOLDS}
          reachable={reachable}
        />
      </div>

      {/* Status trio — Overall · Internet · Temperature. No aria-live here —
          per-poll numeric ticks would flood screen readers. Verdict
          transitions are announced by the dedicated sr-only region in
          OverviewCard, gated on band changes only. */}
      <div className="grid grid-cols-1 gap-4 @[18rem]/overview:grid-cols-3 @[18rem]/overview:gap-3">
        <StatusCell
          label={t("overview.status.overall")}
          value={qualityLabel}
          stale={isStale}
        />
        <StatusCell
          label={t("overview.status.connectivity")}
          value={connectionText}
          stale={isStale}
        />
        <StatusCell
          label={t("overview.status.temperature")}
          value={tempText}
          stale={isStale}
          numeric
        />
      </div>
    </div>
  );
}

// ---------- Sub-components -------------------------------------------------

function SkeletonBody({ loadingLabel }: { loadingLabel?: string } = {}) {
  // Mirrors the rendered layout (header trio → 3 bars → status trio) so the
  // first paint → data arrival transition does not shift.
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      {loadingLabel && <span className="sr-only">{loadingLabel}</span>}
      {/* Header trio skeleton — heights mirror the rendered cell so first
          paint → data arrival doesn't shift. Eyebrow h-2.5 ≈ 11px text;
          value h-3.5 ≈ 14px text-sm. */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex flex-col items-start gap-1.5"
          >
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>

      {/* Signal bars skeleton */}
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>

      {/* Status trio skeleton — eyebrow h-2.5 ≈ 11px; value h-4 matches the
          rendered cell's effective height (16px icon + 16px text-base text). */}
      <div className="grid grid-cols-1 gap-4 @[18rem]/overview:grid-cols-3 @[18rem]/overview:gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
  retryLabel,
  onRetry,
}: {
  title: string;
  subtitle: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  // Warning amber, not destructive: this surface appears on transient fetch
  // failure or poller "unavailable" — degraded, recoverable, not failed.
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <TriangleAlertIcon
        className="text-warning-on-surface size-8"
        aria-hidden
      />
      <div className="flex flex-col gap-1">
        <div className="text-base font-medium">{title}</div>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>
      {onRetry && retryLabel && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
