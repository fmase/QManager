"use client";

import { useTranslation } from "react-i18next";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DayOfWeek } from "@/types/sim-profile";

// =============================================================================
// DayOfWeekChips — 7-chip multiselect for days (0=Sun … 6=Sat)
// =============================================================================
// Built on shadcn ToggleGroup (multiple). Each chip is a real button with
// aria-pressed handled by Radix; we add an aria-label with the full day name.
// =============================================================================

const DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

interface DayOfWeekChipsProps {
  value: DayOfWeek[];
  onChange: (days: DayOfWeek[]) => void;
  disabled?: boolean;
  /** Forwarded to the group root so a FieldLabel can target it. */
  id?: string;
  /** Associates an external label with the group (a11y). */
  "aria-labelledby"?: string;
}

export function DayOfWeekChips({
  value,
  onChange,
  disabled,
  id,
  "aria-labelledby": ariaLabelledby,
}: DayOfWeekChipsProps) {
  const { t } = useTranslation("cellular");

  const shortLabel = (d: DayOfWeek) =>
    t(`custom_profiles.form.scenario.days_short.${d}`);
  const fullLabel = (d: DayOfWeek) =>
    t(`custom_profiles.form.scenario.days_full.${d}`);

  return (
    <ToggleGroup
      type="multiple"
      spacing={2}
      variant="outline"
      size="sm"
      disabled={disabled}
      id={id}
      aria-labelledby={ariaLabelledby}
      value={value.map(String)}
      onValueChange={(vals: string[]) =>
        onChange(
          vals
            .map((v) => Number(v) as DayOfWeek)
            .sort((a, b) => a - b),
        )
      }
      className="flex-wrap"
    >
      {DAYS.map((d) => (
        <ToggleGroupItem
          key={d}
          value={String(d)}
          aria-label={fullLabel(d)}
          className="rounded-md"
        >
          {shortLabel(d)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
