"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  Loader2Icon,
  MinusCircleIcon,
  TriangleAlertIcon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { usePublicOverview } from "@/hooks/use-public-overview";
import {
  deriveConnectionLabel,
  formatCarrierComponents,
  formatUptime,
} from "@/lib/public-overview/format";
import type { CarrierComponentRow } from "@/lib/public-overview/format";
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
import { useEffect, useState } from "react";

// ---------- Connection badge mapping ---------------------------------------

interface BadgeStyle {
  classes: string;
  Icon: LucideIcon;
  spin?: boolean;
}

function badgeStyleFor(label: ConnectionState | "modem_unreachable"): BadgeStyle {
  switch (label) {
    case "connected":
      return {
        classes:
          "bg-success/15 text-success hover:bg-success/20 border-success/30",
        Icon: CheckCircle2Icon,
      };
    case "limited":
      return {
        classes:
          "bg-warning/15 text-warning hover:bg-warning/20 border-warning/30",
        Icon: TriangleAlertIcon,
      };
    case "searching":
      return {
        classes: "bg-info/15 text-info hover:bg-info/20 border-info/30",
        Icon: Loader2Icon,
        spin: true,
      };
    case "inactive":
    case "unknown":
      return {
        classes:
          "bg-muted/50 text-muted-foreground border-muted-foreground/30",
        Icon: MinusCircleIcon,
      };
    case "disconnected":
    case "error":
    case "modem_unreachable":
    default:
      return {
        classes:
          "bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30",
        Icon: XCircleIcon,
      };
  }
}

// Temperature warning thresholds — kept in sync with device-metrics.tsx
const TEMP_WARN = 60; // °C
const TEMP_DANGER = 75; // °C

// ---------- Signal readout (Grafana lane) ----------------------------------
//
// Three stacked bars (RSRP, RSRQ, SINR) with an "Overall" verdict above,
// driven by worst-of-three across the metrics. RSRP-alone would let a strong
// signal mask poor SINR (interference); the overall label is a contract with
// the user, so the worst dimension wins. Each bar is independently colored by
// its own metric's quality bucket so the user can still see which dimension
// dragged the verdict down.
// DESIGN.md blesses both lanes: the Nokia FastMile circular meter for the
// post-login dashboard hero, and Grafana-flavored dense readouts for signal
// surfaces. The public card picks Grafana: more honest for a passerby who
// needs the actual numbers, not the gauge drama.

// Functional-color tokens for the metric's text/value. Single source of truth,
// reused by the bar's fill helper below.
function qualityTextClass(
  quality: SignalQuality,
  reachable: boolean,
): string {
  if (!reachable || quality === "none") return "text-muted-foreground";
  if (quality === "excellent" || quality === "good") return "text-success";
  if (quality === "fair") return "text-warning";
  return "text-destructive";
}

function qualityBarClass(
  quality: SignalQuality,
  reachable: boolean,
): string {
  if (!reachable || quality === "none") return "bg-muted-foreground/40";
  if (quality === "excellent" || quality === "good") return "bg-success";
  if (quality === "fair") return "bg-warning";
  return "bg-destructive";
}

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
  const textClass = qualityTextClass(quality, reachable);
  const barClass = qualityBarClass(quality, reachable);

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

interface SignalBarsProps {
  rsrp: number | null;
  rsrq: number | null;
  sinr: number | null;
  qualityLabel: string;
  qualityTextClassName: string;
  reachable: boolean;
  stale: boolean;
  overallLabel: string;
  carrierLabel: string;
  carrierValue: string;
}

function SignalBars({
  rsrp,
  rsrq,
  sinr,
  qualityLabel,
  qualityTextClassName,
  reachable,
  stale,
  overallLabel,
  carrierLabel,
  carrierValue,
}: SignalBarsProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 transition-opacity duration-200",
        stale && "opacity-70",
      )}
    >
      {/* Paired hero — Overall verdict (left, color-coded) and Carrier (right,
          plain foreground). Both share the same eyebrow + value structure so
          they read as a balanced pair: "what is this connection, and how is
          it?". Color is the only stylistic differentiator — verdict carries
          the functional color tier, carrier stays neutral. Long carrier names
          truncate (full value exposed via title attr).
          aria-live wraps the whole pair so verdict bucket changes and carrier
          handoffs both get announced; the dBm/dB digits ticking every poll
          live outside this region and don't trigger announcements. */}
      <div
        aria-live="polite"
        className="grid grid-cols-2 gap-4"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-muted-foreground/80 text-[10px] font-semibold uppercase leading-none tracking-widest">
            {overallLabel}
          </span>
          <span
            className={cn(
              "text-xl font-semibold leading-none tracking-tight transition-colors duration-200 @[20rem]/overview:text-2xl",
              qualityTextClassName,
            )}
          >
            {qualityLabel}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-muted-foreground/80 text-[10px] font-semibold uppercase leading-none tracking-widest">
            {carrierLabel}
          </span>
          <span
            className="text-foreground truncate text-xl font-semibold leading-none tracking-tight @[20rem]/overview:text-2xl"
            title={carrierValue}
          >
            {carrierValue}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SignalBar
          metric="RSRP"
          value={rsrp}
          unit="dBm"
          thresholds={RSRP_THRESHOLDS}
          reachable={reachable}
        />
        <SignalBar
          metric="RSRQ"
          value={rsrq}
          unit="dB"
          thresholds={RSRQ_THRESHOLDS}
          reachable={reachable}
        />
        <SignalBar
          metric="SINR"
          value={sinr}
          unit="dB"
          thresholds={SINR_THRESHOLDS}
          reachable={reachable}
        />
      </div>
    </div>
  );
}

// ---------- Component ------------------------------------------------------

export default function OverviewCard() {
  const { t } = useTranslation("common");
  const { data, isLoading, isStale, error, refresh } = usePublicOverview();
  // Honor prefers-reduced-motion (WCAG 2.3.3) — vestibular-sensitive users
  // get a static card instead of the slide+fade entrance.
  const reduceMotion = useReducedMotion();

  // Setup gate: bounce to /setup/ on a fresh-install device.
  useEffect(() => {
    if (data?.state === "setup_required") {
      window.location.href = "/setup/";
    }
  }, [data]);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }
      }
    >
      <Card className="@container/overview w-full">
        <CardHeader className="justify-items-center text-center">
          <div className="flex size-16 items-center justify-center rounded-md p-1">
            {/* Decorative: the adjacent CardTitle ("Welcome to QManager")
                already names the product for screen readers. Matches the
                logo treatment in components/auth/login-component.tsx. */}
            <img
              src="/qmanager-logo.svg"
              alt=""
              aria-hidden="true"
              className="size-full"
            />
          </div>
          <CardTitle as="h1">{t("overview.title")}</CardTitle>
          <CardDescription>{t("overview.tagline")}</CardDescription>
        </CardHeader>

        <CardContent>
          {renderBody({ data, isLoading, isStale, error, t, refresh })}
        </CardContent>

        {/* Primary CTA in the footer with copyright underneath — conventional
            shadcn pattern; keeps content above the fold and the chrome below. */}
        <CardFooter className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/login/">{t("overview.login_button")}</Link>
          </Button>
          <p className="text-muted-foreground text-xs">
            {t("overview.copyright", { year: new Date().getFullYear() })}
          </p>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

// ---------- Body renderer --------------------------------------------------

interface BodyProps {
  data: ReturnType<typeof usePublicOverview>["data"];
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
  refresh: () => void;
}

function renderBody({
  data,
  isLoading,
  isStale,
  error,
  t,
  refresh,
}: BodyProps) {
  // Loading skeleton (first paint, no data yet)
  if (isLoading && !data) {
    return <SkeletonBody />;
  }

  // Setup-required: hook is redirecting; keep the body neutral.
  if (data?.state === "setup_required") {
    return <SkeletonBody />;
  }

  // Network error with no usable data → empty state.
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

  // Unavailable (poller down, parse error)
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

  // From here on, data.state === "ok"
  if (!data || data.state !== "ok") {
    return <SkeletonBody />;
  }

  const reachable = data.modem_reachable;
  const connectionLabel: ConnectionState | "modem_unreachable" = reachable
    ? deriveConnectionLabel(data.network.lte_state, data.network.nr_state)
    : "modem_unreachable";
  const badge = badgeStyleFor(connectionLabel);
  // Network type is independent of connection state. Empty type → omit the
  // suffix entirely (don't borrow "Unknown" from the connection-state
  // vocabulary; that's reserved for ConnectionState === "unknown").
  const networkType = data.network.type;
  const connectionText =
    connectionLabel === "modem_unreachable"
      ? t("overview.connection.modem_unreachable")
      : networkType
      ? `${t(`overview.connection.${connectionLabel}`)} · ${networkType}`
      : t(`overview.connection.${connectionLabel}`);

  // "Overall" verdict = worst of RSRP/RSRQ/SINR. The label commits us to a
  // summary metric; RSRP-alone would understate a connection where the dish
  // has signal but is drowning in interference (good RSRP, poor SINR).
  const quality = worstSignalQuality(
    getSignalQuality(data.signal.rsrp, RSRP_THRESHOLDS),
    getSignalQuality(data.signal.rsrq, RSRQ_THRESHOLDS),
    getSignalQuality(data.signal.sinr, SINR_THRESHOLDS),
  );
  const qualityLabel = t(`overview.quality.${quality}`);
  const qualityTextClassName = qualityTextClass(quality, reachable);

  const uptime = formatUptime(data.uptime_seconds);
  const uptimeText = t(`overview.uptime.${uptime.key}`, { ...uptime });

  const rowsMutedClass = reachable ? "" : "text-muted-foreground";

  return (
    <div className="flex flex-col gap-5">
      {/* Connection state row.
          aria-live wraps ONLY the connection badge so screen readers announce
          state transitions (e.g. connected → searching) but ignore the stale
          indicator toggling on/off — otherwise a flapping signal would re-
          announce the full row on every poll.
          aria-atomic dropped intentionally: when only the network type changes
          ("Connected · LTE" → "Connected · NSA"), the live region announces
          just the diff, not the full label. */}
      <div className="flex flex-wrap items-center gap-2">
        <div aria-live="polite">
          <Badge
            variant="outline"
            className={cn("tabular-nums", badge.classes)}
          >
            <badge.Icon
              className={cn(
                "size-3",
                badge.spin && "motion-safe:animate-spin",
              )}
              aria-hidden
            />
            {connectionText}
          </Badge>
        </div>
        {isStale && (
          <Badge
            variant="outline"
            className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30"
          >
            <TriangleAlertIcon className="size-3" aria-hidden />
            {t("overview.stale_indicator")}
          </Badge>
        )}
        {data.temperature !== null && data.temperature >= TEMP_WARN && (
          <Badge
            variant="outline"
            className={
              data.temperature >= TEMP_DANGER
                ? "bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30"
                : "bg-warning/15 text-warning hover:bg-warning/20 border-warning/30"
            }
          >
            {data.temperature >= TEMP_DANGER ? (
              <AlertCircleIcon className="size-3" aria-hidden />
            ) : (
              <TriangleAlertIcon className="size-3" aria-hidden />
            )}
            {data.temperature >= TEMP_DANGER
              ? t("overview.field.temp_danger")
              : t("overview.field.temp_warn")}
          </Badge>
        )}
      </div>

      {/* Hero — three-bar signal readout. Status word above is RSRP-driven;
          each bar is colored by its own metric's quality so a weak SINR in
          good RSRP shows up immediately. */}
      <SignalBars
        rsrp={data.signal.rsrp}
        rsrq={data.signal.rsrq}
        sinr={data.signal.sinr}
        qualityLabel={qualityLabel}
        qualityTextClassName={qualityTextClassName}
        reachable={reachable}
        stale={isStale}
        overallLabel={t("overview.quality.overall_label")}
        carrierLabel={t("overview.field.carrier")}
        carrierValue={data.network.carrier || t("overview.field.empty")}
      />

      {/* Field grid — Uptime + Temp. Carrier moved into the paired hero
          above; what remains is always two cells, so the grid simplifies to
          1-col mobile / 2-col at @[18rem]. No more orphaned Temp cell. */}
      <dl
        className={`grid grid-cols-1 gap-4 @[18rem]/overview:grid-cols-2 ${rowsMutedClass}`}
      >
        <Field
          label={t("overview.field.uptime")}
          value={uptimeText}
          numeric
        />
        <Field
          label={t("overview.field.temperature")}
          value={formatTemperature(data.temperature)}
          numeric
        />
      </dl>

      {/* Carrier Aggregation lives behind a disclosure — the public surface
          stays calm by default, power-user detail is one click away. Hidden
          entirely on single-carrier sessions (nothing to disclose). */}
      <CarrierAggregation
        rows={formatCarrierComponents(data.network.bands)}
        mutedClass={rowsMutedClass}
        t={t}
      />
    </div>
  );
}

// ---------- Sub-components -------------------------------------------------

function Field({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm font-medium leading-tight break-words",
          numeric && "tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function CarrierAggregation({
  rows,
  mutedClass,
  t,
}: {
  rows: CarrierComponentRow[];
  mutedClass: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  // Zero carrier components → nothing to disclose.
  if (rows.length === 0) return null;

  // 1 component → "Single carrier" (factual state, not a setting). 2+ →
  // "Active bands" (no count in the trigger; the disclosed list IS the count).
  // Avoids the CA acronym entirely on the public surface — it's still expert
  // jargon for casual passers-by, and the count moved from chrome to content.
  const toggleLabel =
    rows.length === 1
      ? t("overview.bands.toggle_single_band")
      : t("overview.bands.toggle_multi_band");

  return (
    <div className={cn("flex min-w-0 flex-col", mutedClass)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:ring-ring/50 -mx-2 flex items-center justify-between rounded-md px-2 py-2 text-xs font-medium uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2"
      >
        <span>{toggleLabel}</span>
        <ChevronDownIcon
          className={cn(
            "size-3 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            key="bands-list"
            initial={
              reduceMotion ? false : { opacity: 0, height: 0 }
            }
            animate={{ opacity: 1, height: "auto" }}
            exit={
              reduceMotion
                ? { opacity: 0, height: 0 }
                : { opacity: 0, height: 0 }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
            }
            className="flex flex-col gap-1 overflow-hidden pt-2"
          >
            {rows.map((row, idx) => {
              const bandText =
                row.bandwidth != null
                  ? t("overview.aggregation.band_with_bw", {
                      band: row.band,
                      bandwidth: row.bandwidth,
                    })
                  : t("overview.aggregation.band_only", { band: row.band });
              // Explicit 3-column grid: band | PCI | RSRP. minmax(0,1fr) lets
              // the band column shrink and wrap (long translated labels) without
              // pushing PCI/RSRP off-axis. The auto tracks keep PCI and RSRP at
              // their content width, so the dBm column lines up vertically
              // across every row regardless of card width — replaces the old
              // flex-wrap + ml-auto, which lost right-alignment on wrap.
              return (
                <li
                  key={`${row.band}-${idx}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-3 text-sm font-medium tabular-nums"
                >
                  <span className="min-w-0 break-words">{bandText}</span>
                  <span className="text-muted-foreground justify-self-start">
                    {row.pci != null && (
                      <>
                        <span>{t("overview.aggregation.pci_label")}</span>{" "}
                        {row.pci}
                      </>
                    )}
                  </span>
                  <span className="text-muted-foreground justify-self-end">
                    {row.rsrp != null &&
                      t("overview.bands.rsrp_unit", { rsrp: row.rsrp })}
                  </span>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function SkeletonBody() {
  // Mirrors the real layout (badge → status word + 3 bars → 3-col fields →
  // collapsed bands trigger) so first paint → data arrival does not shift.
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <Skeleton className="h-5 w-32 rounded-full" />

      <div className="flex flex-col gap-5">
        {/* Paired hero placeholder — Overall + Carrier eyebrow+value blocks.
            Heights track the rendered text-xl @[20rem]:text-2xl line-box so
            first paint doesn't jump when data arrives. */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-6 w-24 @[20rem]/overview:h-7" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-6 w-20 @[20rem]/overview:h-7" />
          </div>
        </div>
        {/* Three bar placeholders. */}
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
      </div>

      <div className="grid grid-cols-1 gap-4 @[18rem]/overview:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      <Skeleton className="h-7 w-full" />
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
  // Functional-Color Promise: this surface appears only on fetch failure or
  // poller "unavailable" — both are degraded, recoverable states. Warning
  // (amber) is the right tier; Muted would imply "deliberately disabled."
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <TriangleAlertIcon className="text-warning size-8" aria-hidden />
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

