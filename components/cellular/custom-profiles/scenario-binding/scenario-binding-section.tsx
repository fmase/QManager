"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { ScheduleRuleRow } from "./schedule-rule-row";
import { useScenarioList } from "@/hooks/use-scenario-list";
import {
  clientKey,
  nextChangeAt,
  resolveScheduledScenario,
  validateSchedule,
} from "@/lib/scenario-schedule";
import type {
  ProfileScenarioBinding,
  ScenarioScheduleBlock,
} from "@/types/sim-profile";

// =============================================================================
// ScenarioBindingSection: collapsible "Scenario" block inside the profile form
// =============================================================================
// IA: lives inside the existing profile form card and rides its single submit
// button. No independent save. Default-scenario picker + optional schedule
// editor (enable toggle + single-open accordion of rule rows). The fallback for
// uncovered time is the chosen default scenario, shown explicitly. A live
// readout reports which scenario is active right now and when it next changes.
// =============================================================================

/** A fresh rule seeded when the user clicks "Add rule". Carries a client key. */
const newBlock = (defaultScenario: string): ScenarioScheduleBlock => ({
  start: "22:00",
  end: "06:00",
  days: [0, 1, 2, 3, 4, 5, 6],
  scenario: defaultScenario,
  _key: clientKey(),
});

/** Imperative handle: lets the form reveal the first invalid rule on submit. */
export interface ScenarioBindingSectionHandle {
  revealFirstError: () => void;
}

interface ScenarioBindingSectionProps {
  value: ProfileScenarioBinding;
  onChange: (next: ProfileScenarioBinding) => void;
  /** Auto-expand on mount (edit mode with an existing schedule). */
  defaultOpen?: boolean;
}

export const ScenarioBindingSection = forwardRef<
  ScenarioBindingSectionHandle,
  ScenarioBindingSectionProps
>(function ScenarioBindingSection({ value, onChange, defaultOpen = false }, ref) {
  const { t } = useTranslation("cellular");
  const { scenarios, isLoading, nameForId } = useScenarioList();
  const [open, setOpen] = useState(defaultOpen);

  // Single-open accordion: the _key of the currently-expanded rule (or null).
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Row element refs keyed by rule _key, for scroll-into-view on error.
  const rowRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const blocks = value.schedule.blocks;

  const validation = useMemo(
    () => validateSchedule(value.schedule),
    [value.schedule],
  );

  const defaultName = nameForId(value.default);

  const setDefault = (id: string) => onChange({ ...value, default: id });

  const setEnabled = (enabled: boolean) =>
    onChange({ ...value, schedule: { ...value.schedule, enabled } });

  const updateBlock = (index: number, block: ScenarioScheduleBlock) =>
    onChange({
      ...value,
      schedule: {
        ...value.schedule,
        blocks: blocks.map((b, i) => (i === index ? block : b)),
      },
    });

  const removeBlock = (index: number) =>
    onChange({
      ...value,
      schedule: {
        ...value.schedule,
        blocks: blocks.filter((_, i) => i !== index),
      },
    });

  const addBlock = () => {
    const block = newBlock(value.default);
    // Auto-expand the freshly-added rule (decision 1).
    setOpenKey(block._key ?? null);
    onChange({
      ...value,
      schedule: {
        ...value.schedule,
        blocks: [...blocks, block],
      },
    });
  };

  const swap = (a: number, b: number) => {
    if (a < 0 || b < 0 || a >= blocks.length || b >= blocks.length) return;
    const next = [...blocks];
    [next[a], next[b]] = [next[b], next[a]];
    onChange({
      ...value,
      schedule: { ...value.schedule, blocks: next },
    });
  };

  // Force-expand the first rule that carries a blocking error so the error is
  // never hidden behind a collapsed summary (decision 1).
  const firstErrorIndex = useMemo(() => {
    const keys = Object.keys(validation.errors).map(Number);
    return keys.length > 0 ? Math.min(...keys) : -1;
  }, [validation.errors]);

  useEffect(() => {
    if (firstErrorIndex < 0) return;
    const key = blocks[firstErrorIndex]?._key;
    if (key && openKey !== key) setOpenKey(key);
    // Only react to which rule first errors, not to every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstErrorIndex]);

  // Imperative reveal: open the section, expand the first invalid rule, and
  // scroll it into view (decision: respect reduced-motion).
  useImperativeHandle(
    ref,
    () => ({
      revealFirstError: () => {
        if (firstErrorIndex < 0) return;
        setOpen(true);
        const key = blocks[firstErrorIndex]?._key;
        if (!key) return;
        setOpenKey(key);
        const prefersReduced =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        // Defer to the next frame so the section has expanded before scrolling.
        requestAnimationFrame(() => {
          rowRefs.current.get(key)?.scrollIntoView({
            behavior: prefersReduced ? "auto" : "smooth",
            block: "nearest",
          });
        });
      },
    }),
    [firstErrorIndex, blocks],
  );

  // Live readout: recompute the active scenario + next change every 60s while
  // the schedule is enabled and has at least one valid rule (decision 3).
  const hasValidRule = useMemo(
    () => blocks.some((_, i) => validation.errors[i] === undefined),
    [blocks, validation.errors],
  );

  const showReadout = value.schedule.enabled && hasValidRule;

  const computeReadout = useCallback(() => {
    const now = new Date();
    const activeId = resolveScheduledScenario(now, value.schedule, value.default);
    const next = nextChangeAt(now, value.schedule, value.default);
    return { scenario: nameForId(activeId), next };
  }, [value.schedule, value.default, nameForId]);

  const [readout, setReadout] = useState(computeReadout);

  useEffect(() => {
    if (!showReadout) return;
    // Recompute immediately when inputs change, then tick every 60s.
    setReadout(computeReadout());
    const id = window.setInterval(() => {
      setReadout(computeReadout());
    }, 60_000);
    return () => window.clearInterval(id);
  }, [showReadout, computeReadout]);

  const readoutLine = readout.next
    ? t("custom_profiles.form.scenario.active_now_line_with_next", {
        scenario: readout.scenario,
        time: readout.next,
      })
    : t("custom_profiles.form.scenario.active_now_line", {
        scenario: readout.scenario,
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
              "size-4 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
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
            {blocks.length === 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                <CalendarClockIcon className="mt-0.5 size-4 shrink-0" />
                <span>
                  {t("custom_profiles.form.scenario.empty_schedule_hint", {
                    name: defaultName,
                  })}
                </span>
              </div>
            )}

            {blocks.map((block, i) => {
              const key = block._key ?? `idx-${i}`;
              return (
                <ScheduleRuleRow
                  key={key}
                  index={i}
                  block={block}
                  scenarios={scenarios}
                  scenariosLoading={isLoading}
                  error={validation.errors[i]}
                  overlap={validation.overlapWarnings.includes(i)}
                  open={openKey === block._key}
                  onOpenChange={(isOpen) =>
                    setOpenKey(isOpen ? (block._key ?? null) : null)
                  }
                  nameForId={nameForId}
                  canReorder={blocks.length > 1}
                  isFirst={i === 0}
                  isLast={i === blocks.length - 1}
                  onMoveUp={() => swap(i, i - 1)}
                  onMoveDown={() => swap(i, i + 1)}
                  onChange={(b) => updateBlock(i, b)}
                  onRemove={() => removeBlock(i)}
                  rowRef={(el) => {
                    if (block._key) {
                      if (el) rowRefs.current.set(block._key, el);
                      else rowRefs.current.delete(block._key);
                    }
                  }}
                />
              );
            })}

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

            {/* Live readout: only when enabled with at least one valid rule */}
            {showReadout && (
              <p className="text-sm text-muted-foreground tabular-nums">
                {readoutLine}
              </p>
            )}

            {/* Fallback clarity line: always visible while scheduling */}
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
});
