"use client";

import { useTranslation } from "react-i18next";
import { DownloadIcon } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { ProfileFormData } from "@/hooks/use-sim-profiles";
import { MNO_PRESETS, MNO_CUSTOM_ID } from "@/constants/mno-presets";
import type { UpdateField } from "./form-types";

// =============================================================================
// IdentityCard — who this profile is for
// =============================================================================
// The first card in the left ("what it is") column: the profile's name, the
// carrier it targets, and the SIM it's bound to. In create mode the header
// carries the "Load current SIM" action, which pulls the inserted card's APN /
// IMEI / ICCID into the whole form at once.
// =============================================================================

interface IdentityCardProps {
  form: ProfileFormData;
  errors: Record<string, string>;
  updateField: UpdateField;
  selectedMno: string;
  onMnoChange: (mnoId: string) => void;
  isEditing: boolean;
  onLoadCurrentSettings?: () => void;
  isLoadingCurrent: boolean;
}

export function IdentityCard({
  form,
  errors,
  updateField,
  selectedMno,
  onMnoChange,
  isEditing,
  onLoadCurrentSettings,
  isLoadingCurrent,
}: IdentityCardProps) {
  const { t } = useTranslation("cellular");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("custom_profiles.form.sections.identity_title")}</CardTitle>
        <CardDescription>
          {t("custom_profiles.form.sections.identity_desc")}
        </CardDescription>
        {!isEditing && onLoadCurrentSettings && (
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onLoadCurrentSettings}
              disabled={isLoadingCurrent}
            >
              {isLoadingCurrent ? (
                <Spinner className="size-4" />
              ) : (
                <DownloadIcon className="size-4" />
              )}
              {isLoadingCurrent
                ? t("custom_profiles.form.loading_current")
                : t("custom_profiles.form.load_current_button")}
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        <Field>
          <FieldLabel htmlFor="profileName">
            {t("custom_profiles.form.fields.profile_name_label")} *
          </FieldLabel>
          <Input
            id="profileName"
            type="text"
            placeholder={t(
              "custom_profiles.form.fields.profile_name_placeholder",
            )}
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            aria-describedby={errors.name ? "profileName-error" : undefined}
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name && (
            <FieldError id="profileName-error">{errors.name}</FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="mnoSelect">
            {t("custom_profiles.form.fields.mno_label")}
          </FieldLabel>
          <Select value={selectedMno} onValueChange={onMnoChange}>
            <SelectTrigger id="mnoSelect">
              <SelectValue
                placeholder={t("custom_profiles.form.fields.mno_placeholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {MNO_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.label}
                </SelectItem>
              ))}
              <SelectItem value={MNO_CUSTOM_ID}>
                {t("custom_profiles.form.fields.mno_custom")}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="simIccid">
            {t("custom_profiles.form.fields.sim_iccid_label")}
          </FieldLabel>
          <Input
            id="simIccid"
            type="text"
            inputMode="numeric"
            placeholder={t("custom_profiles.form.fields.sim_iccid_placeholder")}
            value={form.sim_iccid}
            onChange={(e) => updateField("sim_iccid", e.target.value)}
            className="tabular-nums"
          />
          <p className="text-muted-foreground text-xs">
            {t("custom_profiles.form.fields.sim_iccid_hint")}
          </p>
        </Field>
      </CardContent>
    </Card>
  );
}
