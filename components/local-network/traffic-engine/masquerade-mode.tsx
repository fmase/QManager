"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldError } from "@/components/ui/field";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  Zap,
} from "lucide-react";
import type { useTrafficMasquerade } from "@/hooks/use-traffic-masquerade";
import { validateDomainKey } from "@/lib/validate-domain";
import { ThroughputHero, type HeroState } from "./throughput-hero";
import { LiveStatTile } from "./live-stat-tile";

type TestStep = "idle" | "reading_before" | "sending_request" | "reading_after";
type TestStepDef = { key: TestStep; label: string; duration: number };

function StepIndicator({
  step,
  steps,
  currentStep,
  isComplete,
}: {
  step: TestStepDef;
  steps: TestStepDef[];
  currentStep: TestStep;
  isComplete: boolean;
}) {
  const stepIndex = steps.findIndex((s) => s.key === step.key);
  const currentIndex = steps.findIndex((s) => s.key === currentStep);
  const isDone = isComplete || stepIndex < currentIndex;
  const isActive = !isComplete && step.key === currentStep;

  return (
    <div className="flex items-center gap-2.5 text-sm">
      {isDone ? (
        <CheckCircle2 className="size-4 shrink-0 text-success" />
      ) : isActive ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
      ) : (
        <Circle className="size-4 shrink-0 text-muted-foreground/40" />
      )}
      <span
        className={
          isDone
            ? "text-success"
            : isActive
              ? "text-foreground"
              : "text-muted-foreground/60"
        }
      >
        {step.label}
      </span>
    </div>
  );
}

interface MasqueradeModeProps {
  hook: ReturnType<typeof useTrafficMasquerade>;
  heroState: HeroState;
  stateLabel: string;
  rate: number;
  deltas: number[];
  otherModeLabel: string;
  canEnable: boolean;
  /** Enable handler — owns the idle-vs-takeover confirm decision. */
  onEnable: (sniDomain: string) => void;
  onDisable: () => void;
}

/**
 * Masquerade mode body. Mosaic: hero, then uneven stat row (uptime narrow, SNI
 * wide because domains are long), then the SNI control + the stepped test-
 * injection confidence surface.
 */
export function MasqueradeMode({
  hook,
  heroState,
  stateLabel,
  rate,
  deltas,
  otherModeLabel,
  canEnable,
  onEnable,
  onDisable,
}: MasqueradeModeProps) {
  const { t } = useTranslation("local-network");
  const { settings, isSaving, testResult, runTest } = hook;

  const running = settings?.status === "running";

  const [sniDomain, setSniDomain] = useState(
    settings?.sni_domain || "speedtest.net",
  );
  const { saved, markSaved } = useSaveFlash();

  const sniErrorKey = useMemo(() => validateDomainKey(sniDomain), [sniDomain]);
  const sniError = sniErrorKey ? t(sniErrorKey) : null;

  const sniDirty = useMemo(
    () => !!settings && sniDomain !== settings.sni_domain,
    [settings, sniDomain],
  );

  // Re-apply SNI while already running (no takeover). Routed through onEnable so
  // the composer owns the single save+refresh path.
  const handleSaveSni = useCallback(() => {
    if (sniError) return;
    onEnable(sniDomain);
    markSaved();
  }, [sniError, sniDomain, onEnable, markSaved]);

  // --- Stepped test progress (ported faithfully) ---
  const steps: TestStepDef[] = useMemo(
    () => [
      {
        key: "reading_before",
        label: t("masquerade.test_step_reading_before"),
        duration: 500,
      },
      {
        key: "sending_request",
        label: t("masquerade.test_step_sending_request"),
        duration: 5000,
      },
      {
        key: "reading_after",
        label: t("masquerade.test_step_reading_after"),
        duration: 1500,
      },
    ],
    [t],
  );

  const [activeStep, setActiveStep] = useState<TestStep>("idle");
  const currentStep = testResult.status === "running" ? activeStep : "idle";

  useEffect(() => {
    if (testResult.status !== "running") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cumulativeDelay = 0;
    for (const step of steps) {
      const timer = setTimeout(() => setActiveStep(step.key), cumulativeDelay);
      timers.push(timer);
      cumulativeDelay += step.duration;
    }
    return () => {
      timers.forEach(clearTimeout);
      setActiveStep("idle");
    };
  }, [testResult.status, steps]);

  const testing = testResult.status === "running";

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
        onToggle={(next) => (next ? onEnable(sniDomain) : onDisable())}
      />

      {/* Uneven stat row: uptime narrow, SNI wide */}
      <div className="grid grid-cols-1 gap-4 @2xl/engine:grid-cols-6">
        <LiveStatTile
          className="@2xl/engine:col-span-2"
          label={t("traffic_engine.tile_uptime")}
          value={running ? (settings?.uptime ?? "0s") : "—"}
          muted={!running}
        />
        <LiveStatTile
          className="@2xl/engine:col-span-4"
          label={t("traffic_engine.tile_current_sni")}
          value={settings?.sni_domain || "—"}
          muted={!running}
          truncateValue
          title={settings?.sni_domain}
        />
      </div>

      {/* SNI control */}
      <Card>
        <CardHeader>
          <CardTitle>{t("masquerade.label_domain")}</CardTitle>
          <CardDescription>{t("masquerade.helper_domain")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start gap-2">
            <div className="flex-1 space-y-1.5">
              <Input
                id="sni-domain"
                type="text"
                value={sniDomain}
                onChange={(e) => setSniDomain(e.target.value)}
                disabled={isSaving}
                placeholder={t("masquerade.placeholder_domain")}
                className="max-w-sm"
                aria-invalid={!!sniError}
                aria-describedby={sniError ? "sni-error" : undefined}
                aria-label={t("masquerade.label_domain")}
              />
              {sniError && <FieldError id="sni-error">{sniError}</FieldError>}
            </div>
            {running && (
              <SaveButton
                type="button"
                isSaving={isSaving}
                saved={saved}
                disabled={!sniDirty || !!sniError}
                onClick={handleSaveSni}
                label={t("traffic_engine.tile_apply")}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test-injection confidence surface */}
      {running && (
        <Card>
          <CardHeader>
            <CardTitle>{t("masquerade.test_title")}</CardTitle>
            <CardDescription>
              {t("masquerade.test_description")}
            </CardDescription>
            <CardAction>
              <Button
                type="button"
                variant="outline"
                onClick={runTest}
                disabled={testing}
              >
                {testing ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {t("masquerade.state_testing")}
                  </>
                ) : (
                  <>
                    <Zap />
                    {t("masquerade.button_run_test")}
                  </>
                )}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-4" aria-live="polite">
            {testing && currentStep !== "idle" && (
              <div className="space-y-2 rounded-lg border p-3">
                {steps.map((step) => (
                  <StepIndicator
                    key={step.key}
                    step={step}
                    steps={steps}
                    currentStep={currentStep}
                    isComplete={false}
                  />
                ))}
              </div>
            )}

            {testResult.status === "complete" && (
              <div className="space-y-3">
                <div className="space-y-2 rounded-lg border p-3">
                  {steps.map((step) => (
                    <StepIndicator
                      key={step.key}
                      step={step}
                      steps={steps}
                      currentStep={currentStep}
                      isComplete
                    />
                  ))}
                </div>
                <Alert
                  className={
                    testResult.injected
                      ? "border-success/30 bg-success/5"
                      : "border-destructive/30 bg-destructive/10"
                  }
                >
                  {testResult.injected ? (
                    <CheckCircle2 className="text-success" />
                  ) : (
                    <AlertTriangle className="text-destructive" />
                  )}
                  <AlertDescription
                    className={
                      testResult.injected ? "text-success" : "text-destructive"
                    }
                  >
                    {testResult.message}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {testResult.status === "error" && testResult.error && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>{testResult.error}</AlertDescription>
              </Alert>
            )}

            {testResult.status === "idle" && (
              <p className="text-sm text-muted-foreground">
                {t("traffic_engine.test_idle_hint")}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
