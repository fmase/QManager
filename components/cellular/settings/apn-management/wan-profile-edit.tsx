"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldError,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import { GlobeIcon } from "lucide-react";

import type { WanProfile, WanProfileSaveRequest } from "@/types/wan-profiles";
import { PDP_TYPE_OPTIONS } from "@/types/wan-profiles";

// =============================================================================
// Props
// =============================================================================

interface WanProfileEditCardProps {
  profile: WanProfile;
  isSaving: boolean;
  /** The CID the ISP uses for data — flagged "For Internet" in the CID list. */
  internetCid: number | null;
  onSave: (index: number, request: WanProfileSaveRequest) => Promise<boolean>;
  onCancel: () => void;
}

const MAX_CID = 6;

// =============================================================================
// Loading Skeleton
// =============================================================================

function WanProfileEditSkeleton() {
  const { t } = useTranslation("cellular");
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("core_settings.apn.edit.title", { index: "" })}</CardTitle>
        <CardDescription>
          {t("core_settings.apn.edit.description_default", { index: "" })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid @md/card:grid-cols-2 grid-cols-1 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <div className="grid @md/card:grid-cols-2 grid-cols-1 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Component
// =============================================================================

export default function WanProfileEditCard({
  profile,
  isSaving,
  internetCid,
  onSave,
  onCancel,
}: WanProfileEditCardProps) {
  const { t } = useTranslation("cellular");
  const { saved, markSaved } = useSaveFlash();

  // --- Form state ---
  const [name, setName] = useState(profile.name);
  const [apn, setApn] = useState(profile.apn);
  const [pdpType, setPdpType] = useState(profile.pdp_type || "ipv4v6");
  const [cid, setCid] = useState(String(profile.cid));

  // --- UI state ---
  const [apnError, setApnError] = useState("");

  // Form state is seeded from `profile` via useState initializers above. When
  // the user switches to a different CID row, the parent remounts this card
  // with a new `key={profile.index}`, so the initializers re-run with fresh
  // values — no setState-in-effect sync needed.

  // --- Validation ---
  const validateForm = (): boolean => {
    if (!apn.trim()) {
      setApnError(t("core_settings.apn.edit.fields.apn.error_required"));
      return false;
    }
    setApnError("");
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const targetCid = parseInt(cid, 10);
    const request: WanProfileSaveRequest = {
      name: name.trim(),
      apn: apn.trim(),
      pdp_type: pdpType,
    };

    const success = await onSave(targetCid, request);
    if (success) {
      markSaved();
      toast.success(t("core_settings.apn.edit.toast.saved", { index: targetCid }));
    } else {
      toast.error(t("core_settings.apn.edit.toast.save_error", { index: targetCid }));
    }
  };

  if (!profile) return <WanProfileEditSkeleton />;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("core_settings.apn.edit.title", { index: profile.index })}</CardTitle>
        <CardDescription>
          {t("core_settings.apn.edit.description_default", { index: profile.index })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <FieldSet>
            <FieldGroup>
              {/* Row 1: Name + APN */}
              <div className="grid @md/card:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
                <Field>
                  <FieldLabel htmlFor={`wp-name-${profile.index}`}>
                    {t("core_settings.apn.edit.fields.name.label")}
                  </FieldLabel>
                  <Input
                    id={`wp-name-${profile.index}`}
                    placeholder={t("core_settings.apn.edit.fields.name.placeholder")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSaving}
                  />
                </Field>

                <Field data-invalid={apnError ? true : undefined}>
                  <FieldLabel htmlFor={`wp-apn-${profile.index}`}>
                    {t("core_settings.apn.edit.fields.apn.label")}
                  </FieldLabel>
                  <Input
                    id={`wp-apn-${profile.index}`}
                    placeholder={t("core_settings.apn.edit.fields.apn.placeholder")}
                    value={apn}
                    onChange={(e) => {
                      setApn(e.target.value);
                      if (apnError) setApnError("");
                    }}
                    disabled={isSaving}
                    required
                    aria-required="true"
                    aria-invalid={!!apnError}
                  />
                  {apnError && <FieldError>{apnError}</FieldError>}
                </Field>
              </div>

              {/* Row 2: PDP Type + CID */}
              <div className="grid @md/card:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
                <Field>
                  <FieldLabel htmlFor={`wp-pdp-${profile.index}`}>
                    {t("core_settings.apn.edit.fields.pdp_type.label")}
                  </FieldLabel>
                  <Select
                    value={pdpType}
                    onValueChange={setPdpType}
                    disabled={isSaving}
                  >
                    <SelectTrigger
                      id={`wp-pdp-${profile.index}`}
                      aria-label={t("core_settings.apn.edit.fields.pdp_type.aria")}
                    >
                      <SelectValue placeholder={t("core_settings.apn.edit.fields.pdp_type.placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {PDP_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(`core_settings.apn.edit.fields.pdp_type.options.${opt.value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor={`wp-cid-${profile.index}`}>
                    {t("core_settings.apn.edit.fields.modem_profile.label")}
                  </FieldLabel>
                  <Select
                    value={cid}
                    onValueChange={setCid}
                    disabled={isSaving}
                  >
                    <SelectTrigger
                      id={`wp-cid-${profile.index}`}
                      aria-label={t("core_settings.apn.edit.fields.modem_profile.aria")}
                    >
                      <SelectValue placeholder={t("core_settings.apn.edit.fields.modem_profile.placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: MAX_CID }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          <span className="flex items-center gap-2">
                            {t("core_settings.apn.edit.fields.modem_profile.option_template", { cid: n })}
                            {internetCid === n && (
                              <Badge
                                variant="outline"
                                className="bg-success/15 text-success border-success/30"
                              >
                                <GlobeIcon className="size-3" />
                                {t("core_settings.apn.edit.fields.modem_profile.for_internet")}
                              </Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>

          {/* --- Actions --- */}
          <div className="flex items-center gap-2">
            <SaveButton
              type="submit"
              isSaving={isSaving}
              saved={saved}
              label={t("core_settings.apn.edit.save_button")}
            />
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
            >
              {t("core_settings.apn.edit.cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
