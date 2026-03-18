"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

// =============================================================================
// OnboardingShell — Full-screen centered card wrapper for onboarding wizard
// =============================================================================
// Provides:
//   - Progress dot indicator (6 dots) with accessible step label
//   - Step content slot with fade + translate-y transition
//   - Back / Skip / Continue footer buttons
// =============================================================================

const TOTAL_STEPS = 6;

const STEP_LABELS = [
  "Welcome",
  "Password",
  "Network Mode",
  "Connection",
  "Band Preferences",
  "Complete",
];

interface OnboardingShellProps {
  /** 1-based step index */
  currentStep: number;
  /** Called when "Continue" or "Get Started" is clicked */
  onNext: () => void;
  /** Called when "Back" is clicked */
  onBack: () => void;
  /** Called when "Skip" is clicked — undefined hides the Skip button */
  onSkip?: () => void;
  /** Whether the Continue button is in a loading state */
  isLoading?: boolean;
  /** Custom label for the Continue button */
  continueLabel?: string;
  /** Whether the Continue button is disabled */
  continueDisabled?: boolean;
  children: React.ReactNode;
}

export function OnboardingShell({
  currentStep,
  onNext,
  onBack,
  onSkip,
  isLoading = false,
  continueLabel,
  continueDisabled = false,
  children,
}: OnboardingShellProps) {
  // Track the previously rendered step so we can animate transitions
  const [visibleStep, setVisibleStep] = useState(currentStep);
  const [isVisible, setIsVisible] = useState(true);
  const liveRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (currentStep === visibleStep) return;
    setIsVisible(false);
    const timer = setTimeout(() => {
      setVisibleStep(currentStep);
      setIsVisible(true);
    }, 150);
    return () => clearTimeout(timer);
  }, [currentStep, visibleStep]);

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === TOTAL_STEPS;
  const showBack = !isFirstStep && !isLastStep;
  const showSkip = !!onSkip && !isFirstStep && !isLastStep;

  const defaultContinueLabel = isFirstStep
    ? "Get Started"
    : isLastStep
      ? "Go to Dashboard"
      : "Continue";

  const currentStepLabel = STEP_LABELS[currentStep - 1] ?? "";

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      {/* Screen-reader live region — announces step changes */}
      <p
        ref={liveRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {currentStepLabel ? `Step ${currentStep} of ${TOTAL_STEPS}: ${currentStepLabel}` : ""}
      </p>

      <div className="w-full max-w-md">
        {/* Card — uses rounded-xl to match the design system (--radius-xl ≈ 0.9rem) */}
        <div className="rounded-xl border border-border bg-card shadow-2xl ring-1 ring-border/50 px-10 py-10 flex flex-col gap-8">
          {/* Progress dots — accessible step indicator */}
          <div
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
            aria-label={`Step ${currentStep} of ${TOTAL_STEPS}`}
            className="flex items-center justify-center gap-2"
          >
            {Array.from({ length: TOTAL_STEPS }, (_, i) => {
              const step = i + 1;
              const isPast = step < currentStep;
              const isCurrent = step === currentStep;
              return (
                <span
                  key={step}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "block rounded-full transition-colors duration-300",
                    isPast && "h-2 w-2 bg-primary",
                    isCurrent &&
                      "h-2 w-2 bg-primary ring-2 ring-primary/30 ring-offset-1 ring-offset-background",
                    !isPast && !isCurrent && "h-2 w-2 bg-muted-foreground/25"
                  )}
                />
              );
            })}
          </div>

          {/* Step content with fade transition — respects reduced motion */}
          <div
            className={cn(
              "transition-opacity duration-150 motion-reduce:transition-none",
              isVisible ? "opacity-100" : "opacity-0"
            )}
          >
            {children}
          </div>

          {/* Footer buttons */}
          {!isLastStep && (
            <div className="flex items-center justify-between gap-3">
              {showBack ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  disabled={isLoading}
                  className="gap-1.5 text-muted-foreground"
                >
                  <ArrowLeftIcon className="size-3.5" />
                  Back
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                {showSkip && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSkip}
                    disabled={isLoading}
                    className="text-muted-foreground"
                  >
                    Skip
                  </Button>
                )}
                <Button
                  onClick={onNext}
                  disabled={isLoading || continueDisabled}
                  size="sm"
                  className="gap-1.5 min-w-[100px]"
                >
                  {isLoading ? (
                    <>
                      <Spinner className="size-3.5" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      {continueLabel ?? defaultContinueLabel}
                      {!isFirstStep && (
                        <ArrowRightIcon className="size-3.5" />
                      )}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Branding footer */}
        <p className="mt-4 text-center text-xs text-muted-foreground/50">
          QManager — Quectel Modem Management
        </p>
      </div>
    </div>
  );
}
