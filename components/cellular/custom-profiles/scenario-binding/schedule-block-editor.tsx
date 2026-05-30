"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TriangleAlertIcon } from "lucide-react";

import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DayOfWeekChips } from "./day-of-week-chips";
import { ScenarioPicker } from "./scenario-picker";
import { parseHhmm } from "@/lib/scenario-schedule";
import type { ScenarioScheduleBlock, DayOfWeek } from "@/types/sim-profile";
import type { ScheduleBlockError } from "@/lib/scenario-schedule";
import type { ScenarioOption } from "@/hooks/use-scenario-list";

// =============================================================================
// ScheduleBlockEditor: the expanded body of one schedule rule
// =============================================================================
// Start/end native time inputs ("HH:MM"), day presets + day-of-week chips,
// scenario select. Surfaces a blocking error (malformed/zero-length/no days),
// a non-blocking overlap warning (D3: first-in-array wins), and an overnight
// hint when the window crosses midnight. The rule header (label, reorder,
// remove) lives on the collapsed summary row, not here.
// =============================================================================

/** Preset day sets for the quick buttons above the chips. */
const PRESET_EVERY_DAY: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];
const PRESET_WEEKDAYS: DayOfWeek[] = [1, 2, 3, 4, 5];
const PRESET_WEEKENDS: DayOfWeek[] = [0, 6];

interface ScheduleBlockEditorProps {
  block: ScenarioScheduleBlock;
  scenarios: ScenarioOption[];
  scenariosLoading?: boolean;
  error?: ScheduleBlockError;
  overlap?: boolean;
  onChange: (next: ScenarioScheduleBlock) => void;
}

export function ScheduleBlockEditor({
  block,
  scenarios,
  scenariosLoading,
  error,
  overlap,
  onChange,
}: ScheduleBlockEditorProps) {
  const { t } = useTranslation("cellular");
  const uid = useId();
  const startId = `${uid}-start`;
  const endId = `${uid}-end`;
  const scnId = `${uid}-scenario`;
  const daysLabelId = `${uid}-days-label`;
  const daysGroupId = `${uid}-days`;

  const errorText = error
    ? t(`custom_profiles.form.scenario.block_errors.${error}`)
    : undefined;

  // Overnight hint: both times valid AND end <= start (window wraps midnight).
  const s = parseHhmm(block.start);
  const e = parseHhmm(block.end);
  const showOvernight = s !== null && e !== null && e <= s;

  return (
    <div className="@container/block grid gap-3">
      <div className="grid grid-cols-1 @sm/block:grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor={startId}>
            {t("custom_profiles.form.scenario.start_label")}
          </FieldLabel>
          <Input
            id={startId}
            type="time"
            className="tabular-nums"
            value={block.start}
            onChange={(ev) => onChange({ ...block, start: ev.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={endId}>
            {t("custom_profiles.form.scenario.end_label")}
          </FieldLabel>
          <Input
            id={endId}
            type="time"
            className="tabular-nums"
            value={block.end}
            onChange={(ev) => onChange({ ...block, end: ev.target.value })}
          />
          {showOvernight && (
            <p className="text-xs text-muted-foreground">
              {t("custom_profiles.form.scenario.overnight_hint")}
            </p>
          )}
        </Field>
      </div>

      <Field>
        <FieldLabel id={daysLabelId}>
          {t("custom_profiles.form.scenario.days_label")}
        </FieldLabel>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...block, days: [...PRESET_EVERY_DAY] })}
          >
            {t("custom_profiles.form.scenario.preset_every_day")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...block, days: [...PRESET_WEEKDAYS] })}
          >
            {t("custom_profiles.form.scenario.preset_weekdays")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...block, days: [...PRESET_WEEKENDS] })}
          >
            {t("custom_profiles.form.scenario.preset_weekends")}
          </Button>
        </div>
        <DayOfWeekChips
          id={daysGroupId}
          aria-labelledby={daysLabelId}
          value={block.days}
          onChange={(days) => onChange({ ...block, days })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={scnId}>
          {t("custom_profiles.form.scenario.block_scenario_label")}
        </FieldLabel>
        <ScenarioPicker
          id={scnId}
          value={block.scenario}
          scenarios={scenarios}
          loading={scenariosLoading}
          aria-label={t("custom_profiles.form.scenario.block_scenario_label")}
          onChange={(scn) => onChange({ ...block, scenario: scn })}
        />
      </Field>

      {errorText && <FieldError>{errorText}</FieldError>}

      {!errorText && overlap && (
        <p
          role="status"
          className="flex items-center gap-1.5 text-xs text-warning"
        >
          <TriangleAlertIcon className="size-3 shrink-0" />
          {t("custom_profiles.form.scenario.overlap_warning")}
        </p>
      )}
    </div>
  );
}
