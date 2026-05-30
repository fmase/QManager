"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Trash2Icon, TriangleAlertIcon } from "lucide-react";

import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DayOfWeekChips } from "./day-of-week-chips";
import { ScenarioPicker } from "./scenario-picker";
import type { ScenarioScheduleBlock } from "@/types/sim-profile";
import type { ScheduleBlockError } from "@/lib/scenario-schedule";
import type { ScenarioOption } from "@/hooks/use-scenario-list";

// =============================================================================
// ScheduleBlockEditor — one schedule block row
// =============================================================================
// Start/end native time inputs ("HH:MM"), day-of-week chips, scenario select,
// and a remove button. Surfaces a blocking error (malformed/zero-length/no
// days) and a non-blocking overlap warning (D3: first-in-array wins).
// =============================================================================

interface ScheduleBlockEditorProps {
  index: number;
  block: ScenarioScheduleBlock;
  scenarios: ScenarioOption[];
  scenariosLoading?: boolean;
  error?: ScheduleBlockError;
  overlap?: boolean;
  onChange: (next: ScenarioScheduleBlock) => void;
  onRemove: () => void;
}

export function ScheduleBlockEditor({
  index,
  block,
  scenarios,
  scenariosLoading,
  error,
  overlap,
  onChange,
  onRemove,
}: ScheduleBlockEditorProps) {
  const { t } = useTranslation("cellular");
  const uid = useId();
  const startId = `${uid}-start`;
  const endId = `${uid}-end`;
  const scnId = `${uid}-scenario`;

  const errorText = error
    ? t(`custom_profiles.form.scenario.block_errors.${error}`)
    : undefined;

  return (
    <div className="@container/block grid gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {t("custom_profiles.form.scenario.block_label", { index: index + 1 })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("custom_profiles.form.scenario.remove_block_aria")}
          onClick={onRemove}
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>

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
            onChange={(e) => onChange({ ...block, start: e.target.value })}
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
            onChange={(e) => onChange({ ...block, end: e.target.value })}
          />
        </Field>
      </div>

      <Field>
        <FieldLabel>{t("custom_profiles.form.scenario.days_label")}</FieldLabel>
        <DayOfWeekChips
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
          onChange={(s) => onChange({ ...block, scenario: s })}
        />
      </Field>

      {errorText && <FieldError>{errorText}</FieldError>}

      {!errorText && overlap && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <TriangleAlertIcon className="size-3 shrink-0" />
          {t("custom_profiles.form.scenario.overlap_warning")}
        </p>
      )}
    </div>
  );
}
