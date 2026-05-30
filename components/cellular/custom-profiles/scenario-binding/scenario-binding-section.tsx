"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon, PlusIcon, CalendarClockIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { ScenarioPicker } from "./scenario-picker";
import { ScheduleBlockEditor } from "./schedule-block-editor";
import { useScenarioList } from "@/hooks/use-scenario-list";
import { validateSchedule } from "@/lib/scenario-schedule";
import type {
  ProfileScenarioBinding,
  ScenarioScheduleBlock,
} from "@/types/sim-profile";

// =============================================================================
// ScenarioBindingSection — collapsible "Scenario" block inside the profile form
// =============================================================================
// IA: lives inside the existing profile form card and rides its single submit
// button. No independent save. Default-scenario picker + optional schedule
// editor (enable toggle + block list). The fallback for uncovered time is the
// chosen default scenario, shown explicitly ("All other times → Balanced").
// =============================================================================

/** A fresh block seeded when the user clicks "Add block". */
const newBlock = (defaultScenario: string): ScenarioScheduleBlock => ({
  start: "22:00",
  end: "06:00",
  days: [0, 1, 2, 3, 4, 5, 6],
  scenario: defaultScenario,
});

interface ScenarioBindingSectionProps {
  value: ProfileScenarioBinding;
  onChange: (next: ProfileScenarioBinding) => void;
  /** Auto-expand on mount (edit mode with an existing schedule). */
  defaultOpen?: boolean;
}

export function ScenarioBindingSection({
  value,
  onChange,
  defaultOpen = false,
}: ScenarioBindingSectionProps) {
  const { t } = useTranslation("cellular");
  const { scenarios, isLoading, nameForId } = useScenarioList();
  const [open, setOpen] = useState(defaultOpen);

  const validation = useMemo(
    () => validateSchedule(value.schedule),
    [value.schedule],
  );

  const defaultName = nameForId(value.default);

  const setDefault = (id: string) =>
    onChange({ ...value, default: id });

  const setEnabled = (enabled: boolean) =>
    onChange({ ...value, schedule: { ...value.schedule, enabled } });

  const updateBlock = (index: number, block: ScenarioScheduleBlock) =>
    onChange({
      ...value,
      schedule: {
        ...value.schedule,
        blocks: value.schedule.blocks.map((b, i) => (i === index ? block : b)),
      },
    });

  const removeBlock = (index: number) =>
    onChange({
      ...value,
      schedule: {
        ...value.schedule,
        blocks: value.schedule.blocks.filter((_, i) => i !== index),
      },
    });

  const addBlock = () =>
    onChange({
      ...value,
      schedule: {
        ...value.schedule,
        blocks: [...value.schedule.blocks, newBlock(value.default)],
      },
    });

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Separator className="my-2" />
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md py-1 text-left"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2">
            <CalendarClockIcon className="size-4 text-muted-foreground" />
            <span className="font-medium">
              {t("custom_profiles.form.scenario.section_title")}
            </span>
          </span>
          <ChevronDownIcon
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="grid gap-4 pt-3">
        <p className="text-sm text-muted-foreground">
          {t("custom_profiles.form.scenario.section_description")}
        </p>

        {/* Default scenario picker */}
        <Field>
          <FieldLabel htmlFor="scenarioDefault">
            {t("custom_profiles.form.scenario.default_label")}
          </FieldLabel>
          <ScenarioPicker
            id="scenarioDefault"
            value={value.default}
            scenarios={scenarios}
            loading={isLoading}
            aria-label={t("custom_profiles.form.scenario.default_label")}
            onChange={setDefault}
          />
          <p className="text-xs text-muted-foreground">
            {t("custom_profiles.form.scenario.default_hint")}
          </p>
        </Field>

        {/* Schedule enable toggle */}
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="grid gap-0.5">
            <Label htmlFor="scenarioScheduleEnabled">
              {t("custom_profiles.form.scenario.schedule_toggle_label")}
            </Label>
            <span className="text-xs text-muted-foreground">
              {t("custom_profiles.form.scenario.schedule_toggle_hint")}
            </span>
          </div>
          <Switch
            id="scenarioScheduleEnabled"
            checked={value.schedule.enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {/* Schedule editor */}
        {value.schedule.enabled && (
          <div className="grid gap-3" aria-live="polite">
            {value.schedule.blocks.length === 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                <CalendarClockIcon className="mt-0.5 size-4 shrink-0" />
                <span>
                  {t("custom_profiles.form.scenario.empty_schedule_hint", {
                    name: defaultName,
                  })}
                </span>
              </div>
            )}

            {value.schedule.blocks.map((block, i) => (
              <ScheduleBlockEditor
                key={i}
                index={i}
                block={block}
                scenarios={scenarios}
                scenariosLoading={isLoading}
                error={validation.errors[i]}
                overlap={validation.overlapWarnings.includes(i)}
                onChange={(b) => updateBlock(i, b)}
                onRemove={() => removeBlock(i)}
              />
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={addBlock}
            >
              <PlusIcon className="size-4" />
              {t("custom_profiles.form.scenario.add_block")}
            </Button>

            {/* Fallback clarity line — always visible while scheduling */}
            <p className="text-sm text-muted-foreground">
              {t("custom_profiles.form.scenario.fallback_line", {
                name: defaultName,
              })}
            </p>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
