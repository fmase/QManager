"use client";

// =============================================================================
// StepWelcome — Onboarding step 1: brand intro
// =============================================================================

export function StepWelcome() {
  return (
    <div className="flex flex-col gap-7">
      {/* Brand lockup — logo inline with name, not stacked above heading */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 p-1.5">
          <img
            src="/qmanager-logo.svg"
            alt=""
            aria-hidden="true"
            className="size-full"
          />
        </div>
        <span className="text-sm font-semibold tracking-tight text-muted-foreground">
          QManager
        </span>
      </div>

      {/* Main message — left-aligned for more designed feel */}
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight leading-tight">
          Your modem,<br />intelligently managed.
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Let&apos;s get you set up in a few quick steps. Only your password is
          required — everything else is optional and adjustable anytime.
        </p>
      </div>

      {/* Step preview — helps users know what to expect */}
      <div className="flex flex-col gap-1.5 border-l-2 border-border pl-4">
        <StepPreviewItem label="Password" required />
        <StepPreviewItem label="Network mode" />
        <StepPreviewItem label="APN or SIM profile" />
        <StepPreviewItem label="Band preferences" />
      </div>
    </div>
  );
}

function StepPreviewItem({
  label,
  required,
}: {
  label: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
      <span>{label}</span>
      {required && (
        <span className="text-xs font-medium text-foreground">Required</span>
      )}
    </div>
  );
}
