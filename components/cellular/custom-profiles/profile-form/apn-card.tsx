"use client";

import { useTranslation } from "react-i18next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { PdpType } from "@/types/sim-profile";
import type { ProfileFormData } from "@/hooks/use-sim-profiles";
import type { UpdateField } from "./form-types";

// =============================================================================
// ApnCard — how the modem connects
// =============================================================================
// The data-path settings: APN name, IP protocol, and PDP context slot. The CID
// field locks to 3 under Verizon (the network only delivers data on a
// non-default context), surfacing that as a hint rather than an editable value.
// =============================================================================

interface ApnCardProps {
  form: ProfileFormData;
  errors: Record<string, string>;
  updateField: UpdateField;
  pdpTypeLabels: Record<PdpType, string>;
  isVerizon: boolean;
}

export function ApnCard({
  form,
  errors,
  updateField,
  pdpTypeLabels,
  isVerizon,
}: ApnCardProps) {
  const { t } = useTranslation("cellular");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("custom_profiles.form.sections.apn_title")}</CardTitle>
        <CardDescription>
          {t("custom_profiles.form.sections.apn_desc")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <Field>
          <FieldLabel htmlFor="apnName">
            {t("custom_profiles.form.fields.apn_name_label")}
          </FieldLabel>
          <Input
            id="apnName"
            type="text"
            placeholder={t("custom_profiles.form.fields.apn_name_placeholder")}
            value={form.apn_name}
            onChange={(e) => updateField("apn_name", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 @md/main:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="pdpType">
              {t("custom_profiles.form.fields.ip_protocol_label")}
            </FieldLabel>
            <Select
              value={form.pdp_type}
              onValueChange={(v) => updateField("pdp_type", v)}
            >
              <SelectTrigger id="pdpType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(pdpTypeLabels) as [PdpType, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="apnCid">
              {t("custom_profiles.form.fields.cid_label")}
            </FieldLabel>
            <Input
              id="apnCid"
              type="number"
              min={1}
              max={15}
              disabled={isVerizon}
              value={form.cid}
              onChange={(e) => updateField("cid", parseInt(e.target.value) || 1)}
              className="tabular-nums"
              aria-describedby={
                isVerizon
                  ? "apnCid-verizon-hint"
                  : errors.cid
                    ? "apnCid-error"
                    : undefined
              }
              aria-invalid={!isVerizon && errors.cid ? true : undefined}
            />
            {isVerizon ? (
              <p
                id="apnCid-verizon-hint"
                className="text-muted-foreground text-xs"
              >
                {t("custom_profiles.form.fields.cid_locked_verizon")}
              </p>
            ) : (
              errors.cid && (
                <FieldError id="apnCid-error">{errors.cid}</FieldError>
              )
            )}
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
