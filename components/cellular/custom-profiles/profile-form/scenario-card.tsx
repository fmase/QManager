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
import { PlusIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

import { ScenarioPicker } from "@/components/cellular/custom-profiles/scenario-binding/scenario-picker";
import { ScheduleRuleRow } from "@/components/cellular/custom-profiles/scenario-binding/schedule-rule-row";
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
// ScenarioCard — when & how the profile applies
// =============================================================================
// Section three of the editor's single reading column. Picking the default
// scenario is the primary choice and reads first; the time-of-day schedule is an
// explicit opt-in below it. The schedule is deliberately simple: each entry is
// just a start, an end, and the scenario to run in that window. There is no
// per-day or per-week control — every entry runs every day, and the card writes
// all seven days under the hood (newBlock) so the device cron generator and the
// synced shell/TS resolver stay unchanged. A hard cap of three entries keeps the
// surface calm; the "Add" affordance disappears once three exist.
//
// Scenario *definitions* live on the connection-scenarios page; this card only
// picks and schedules. The persisted JSON, device cron, and resolution rule are
// unchanged — `_key`s stay client-only and are stripped on save by the editor.
// =============================================================================

// Hard cap on schedule entries: two or three windows is the whole feature.
const MAX_SCHEDULE_ENTRIES = 3;

// Every entry runs every day. The editor no longer asks about days, so we always
// seed (and persist) all seven — this keeps the device cron generator and the
// synced shell/TS resolver working unchanged, and passes validateSchedule
// (which rejects empty-days blocks). See types/sim-profile.ts.
const newBlock = (defaultScenario: string): ScenarioScheduleBlock => ({
  start: "22:00",
  end: "06:00",
  days: [0, 1, 2, 3, 4, 5, 6],
  scenario: defaultScenario,
  _key: clientKey(),
});

/** Imperative handle: lets the editor reveal the first invalid entry on save. */
export interface ScenarioCardHandle {
  revealFirstError: () => void;
}

interface ScenarioCardProps {
  value: ProfileScenarioBinding;
  onChange: (next: ProfileScenarioBinding) => void;
}

export const ScenarioCard = forwardRef<ScenarioCardHandle, ScenarioCardProps>(
  function ScenarioCard({ value, onChange }, ref) {
    const { t } = useTranslation("cellular");
    const { scenarios, isLoading, nameForId } = useScenarioList();

    // Single-open accordion: the _key of the currently-expanded entry (or null).
    const [openKey, setOpenKey] = useState<string | null>(null);
    const rowRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

    const blocks = value.schedule.blocks;
    const validation = useMemo(
      () => validateSchedule(value.schedule),
      [value.schedule],
    );
    const defaultName = nameForId(value.default);
    const atCap = blocks.length >= MAX_SCHEDULE_ENTRIES;

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
      if (atCap) return;
      const block = newBlock(value.default);
      setOpenKey(block._key ?? null);
      onChange({
        ...value,
        schedule: { ...value.schedule, blocks: [...blocks, block] },
      });
    };
    const swap = (a: number, b: number) => {
      if (a < 0 || b < 0 || a >= blocks.length || b >= blocks.length) return;
      const next = [...blocks];
      [next[a], next[b]] = [next[b], next[a]];
      onChange({ ...value, schedule: { ...value.schedule, blocks: next } });
    };

    // Force-expand the first entry with a blocking error so it is never hidden.
    const firstErrorIndex = useMemo(() => {
      const keys = Object.keys(validation.errors).map(Number);
      return keys.length > 0 ? Math.min(...keys) : -1;
    }, [validation.errors]);

    useEffect(() => {
      if (firstErrorIndex < 0) return;
      const key = blocks[firstErrorIndex]?._key;
      if (key && openKey !== key) setOpenKey(key);
      // Only react to which entry first errors, not to every keystroke.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firstErrorIndex]);

    useImperativeHandle(
      ref,
      () => ({
        revealFirstError: () => {
          if (firstErrorIndex < 0) return;
          const key = blocks[firstErrorIndex]?._key;
          if (!key) return;
          setOpenKey(key);
          const prefersReduced =
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

    // Live readout: active scenario now + next change, recomputed every 60s.
    const hasValidRule = useMemo(
      () => blocks.some((_, i) => validation.errors[i] === undefined),
      [blocks, validation.errors],
    );
    const showReadout = value.schedule.enabled && hasValidRule;

    const computeReadout = useCallback(() => {
      const now = new Date();
      const activeId = resolveScheduledScenario(
        now,
        value.schedule,
        value.default,
      );
      const next = nextChangeAt(now, value.schedule, value.default);
      return { scenario: nameForId(activeId), next };
    }, [value.schedule, value.default, nameForId]);

    const [readout, setReadout] = useState(computeReadout);

    useEffect(() => {
      if (!showReadout) return;
      setReadout(computeReadout());
      const id = window.setInterval(() => setReadout(computeReadout()), 60_000);
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
      <Card>
        <CardHeader>
          <CardTitle>
            {t("custom_profiles.form.scenario.section_title")}
          </CardTitle>
          <CardDescription>
            {t("custom_profiles.form.scenario.section_description")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Default scenario — the primary, common choice. */}
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
            <p className="text-muted-foreground text-xs">
              {t("custom_profiles.form.scenario.default_hint")}
            </p>
          </Field>

          {/* Schedule enable — explicit opt-in. */}
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="grid gap-0.5">
              <Label htmlFor="scenarioScheduleEnabled">
                {t("custom_profiles.form.scenario.schedule_toggle_label")}
              </Label>
              <span className="text-muted-foreground text-xs">
                {t("custom_profiles.form.scenario.schedule_toggle_hint")}
              </span>
            </div>
            <Switch
              id="scenarioScheduleEnabled"
              checked={value.schedule.enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {/* Schedule editor — only when enabled. */}
          {value.schedule.enabled && (
            <div className="grid gap-3" aria-live="polite">
              {blocks.length === 0 && (
                <div className="text-muted-foreground flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm">
                  <PlusIcon className="mt-0.5 size-4 shrink-0" />
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

              {/* Add disappears at the cap; a quiet note explains why. */}
              {atCap ? (
                <p className="text-muted-foreground text-xs">
                  {t("custom_profiles.form.scenario.entries_cap_hint", {
                    max: MAX_SCHEDULE_ENTRIES,
                  })}
                </p>
              ) : (
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
              )}

              {/* Live "active now" over the always-visible default fallback. */}
              <div className="overflow-hidden rounded-lg border text-sm">
                {showReadout && (
                  <div className="flex items-center gap-2 border-b px-3 py-2.5">
                    <span
                      className="bg-success size-2 shrink-0 rounded-full"
                      aria-hidden="true"
                    />
                    <span className="text-foreground tabular-nums">
                      {readoutLine}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-muted-foreground">
                    {t("custom_profiles.form.scenario.otherwise_label")}
                  </span>
                  <span className="text-foreground font-medium">
                    {defaultName}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
);
