"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon, TriangleAlertIcon } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { ProfileFormData } from "@/hooks/use-sim-profiles";
import type { UpdateField } from "./form-types";

// =============================================================================
// AdvancedCard — the consequential, rarely-touched settings (collapsed)
// =============================================================================
// IMEI rewrite + IPv4 TTL + IPv6 Hop Limit. Most users never open this, so the
// whole section is collapsed by default — the entire CardHeader is the toggle
// (a rotating chevron sits in CardAction), the macOS System Settings way. The
// collapsed header carries a quiet one-line summary of only the values that
// deviate from the defaults (TTL/HL 64, IMEI blank), so a card with nothing
// special to say reads as exactly that: nothing to worry about.
//
// The IMEI field keeps its amber reboot warning: changing it rewrites the modem
// identity and forces a reset on activation (deferred by the apply pipeline,
// never inline). Left blank, the modem keeps its current IMEI.
//
// Auto-expands when a blocking validation error lands on one of its fields, so a
// bad value is never hidden behind a collapsed section on save.
// =============================================================================

const DEFAULT_TTL = 64;
const DEFAULT_HL = 64;

interface AdvancedCardProps {
  form: ProfileFormData;
  errors: Record<string, string>;
  updateField: UpdateField;
}

export function AdvancedCard({ form, errors, updateField }: AdvancedCardProps) {
  const { t } = useTranslation("cellular");

  const hasError = Boolean(errors.imei || errors.ttl || errors.hl);
  const [open, setOpen] = useState(false);

  // A field-level error forces the section open and keeps it open, so a bad
  // value can never hide behind the collapsed header on submit. Adjust during
  // render (React-Compiler safe) rather than via an effect.
  const [prevHadError, setPrevHadError] = useState(false);
  if (hasError !== prevHadError) {
    setPrevHadError(hasError);
    if (hasError && !open) setOpen(true);
  }

  // Collapsed summary: only the values that deviate from default. Empty when
  // everything is at default — the calm "nothing special here" state.
  const summaryParts: string[] = [];
  if (form.imei.trim()) {
    summaryParts.push(t("custom_profiles.form.advanced.summary_imei"));
  }
  if (form.ttl !== DEFAULT_TTL) {
    summaryParts.push(
      t("custom_profiles.form.advanced.summary_ttl", { value: form.ttl }),
    );
  }
  if (form.hl !== DEFAULT_HL) {
    summaryParts.push(
      t("custom_profiles.form.advanced.summary_hl", { value: form.hl }),
    );
  }
  const summary = summaryParts.join(" · ");

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* The whole header is the toggle. The trigger carries the CardHeader
            grid classes directly (rather than wrapping a CardHeader) so the
            layout — title/description in col 1, chevron in col 2 — is preserved
            while the entire row stays a single keyboard-focusable button. */}
        <CollapsibleTrigger
          aria-expanded={open}
          className="@container/card-header grid w-full cursor-pointer grid-cols-[1fr_auto] grid-rows-[auto_auto] items-start gap-2 px-6 text-left"
        >
          <CardTitle>
            {t("custom_profiles.form.sections.advanced_title")}
          </CardTitle>
          <CardDescription>
            {/* Collapsed: show the deviation summary when there is one;
                otherwise the standing description. Expanded: standing
                description. */}
            {!open && summary
              ? summary
              : t("custom_profiles.form.sections.advanced_desc")}
          </CardDescription>
          <CardAction className="row-span-2 self-center">
            <ChevronDownIcon
              className={cn(
                "text-muted-foreground size-4 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                open && "rotate-180",
              )}
              aria-hidden="true"
            />
          </CardAction>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-5 pt-2">
            <Field>
              <FieldLabel htmlFor="imei">
                {t("custom_profiles.form.fields.imei_label")}
              </FieldLabel>
              <Input
                id="imei"
                type="text"
                inputMode="numeric"
                placeholder={t("custom_profiles.form.fields.imei_placeholder")}
                maxLength={15}
                value={form.imei}
                onChange={(e) => updateField("imei", e.target.value)}
                className="tabular-nums"
                aria-describedby={errors.imei ? "imei-error" : "imei-danger"}
                aria-invalid={errors.imei ? true : undefined}
              />
              {errors.imei ? (
                <FieldError id="imei-error">{errors.imei}</FieldError>
              ) : (
                <p
                  id="imei-danger"
                  className="text-warning flex items-start gap-1.5 text-xs"
                >
                  <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                  {t("custom_profiles.form.fields.imei_danger")}
                </p>
              )}
            </Field>

            <div className="grid grid-cols-1 gap-4 @md/main:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="ttl">
                  {t("custom_profiles.form.fields.ttl_label")}
                </FieldLabel>
                <Input
                  id="ttl"
                  type="number"
                  min={0}
                  max={255}
                  value={form.ttl}
                  onChange={(e) =>
                    updateField("ttl", parseInt(e.target.value) || 0)
                  }
                  className="tabular-nums"
                  aria-describedby={errors.ttl ? "ttl-error" : undefined}
                  aria-invalid={errors.ttl ? true : undefined}
                />
                {errors.ttl && (
                  <FieldError id="ttl-error">{errors.ttl}</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="hl">
                  {t("custom_profiles.form.fields.hl_label")}
                </FieldLabel>
                <Input
                  id="hl"
                  type="number"
                  min={0}
                  max={255}
                  value={form.hl}
                  onChange={(e) =>
                    updateField("hl", parseInt(e.target.value) || 0)
                  }
                  className="tabular-nums"
                  aria-describedby={errors.hl ? "hl-error" : undefined}
                  aria-invalid={errors.hl ? true : undefined}
                />
                {errors.hl && <FieldError id="hl-error">{errors.hl}</FieldError>}
              </Field>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
