"use client";

import { cn } from "@/lib/utils";

// =============================================================================
// FactRow — label + value, the shared registry/preview fact line
// =============================================================================
// Extracted from profile-card.tsx so the editor's Preview reads facts the same
// way the saved card does. Label is the QManager uppercase/muted label
// typography; the value is body text and renders a "—" placeholder when empty,
// so a list of rows keeps a stable shape regardless of optional fields. Numeric
// values opt into tabular-nums via `mono` so they never jitter.
// =============================================================================

interface FactRowProps {
  label: string;
  value: string | null | undefined;
  /** Render the value in tabular-nums (ICCID, IMEI, numeric readouts). */
  mono?: boolean;
}

export function FactRow({ label, value, mono }: FactRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground shrink-0 text-[11px] font-medium uppercase tracking-wide">
        {label}
      </span>
      <span
        className={cn(
          value ? "text-foreground truncate text-xs" : "text-muted-foreground/50 text-xs",
          mono && "tabular-nums",
        )}
        title={value ?? undefined}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}
