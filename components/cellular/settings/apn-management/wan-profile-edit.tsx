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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import { GlobeIcon, PhoneCallIcon, SirenIcon, Trash2Icon } from "lucide-react";

import type {
  WanProfile,
  CidContext,
  WanProfileSaveRequest,
} from "@/types/wan-profiles";
import { PDP_TYPE_OPTIONS } from "@/types/wan-profiles";

// =============================================================================
// Props
// =============================================================================

interface WanProfileEditCardProps {
  profile: WanProfile;
  isSaving: boolean;
  /** The modem's live PDP contexts (1-6), tagged Internet / IMS / SOS. */
  cids: CidContext[] | null;
  onSave: (id: number, request: WanProfileSaveRequest) => Promise<boolean>;
  onClear: (id: number) => Promise<boolean>;
  onCancel: () => void;
}

// =============================================================================
// CID badge — one per modem context in the picker. Carrier (IMS/SOS) takes
// precedence over Internet; icons inherit the badge text color (currentColor).
// =============================================================================

function CidBadge({ ctx }: { ctx: CidContext }) {
  const { t } = useTranslation("cellular");

  if (ctx.apn_type === "ims") {
    return (
      <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">
        <PhoneCallIcon className="size-3" />
        {t("core_settings.apn.edit.fields.modem_profile.ims_badge")}
      </Badge>
    );
  }
  if (ctx.apn_type === "emergency") {
    return (
      <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">
        <SirenIcon className="size-3" />
        {t("core_settings.apn.edit.fields.modem_profile.sos_badge")}
      </Badge>
    );
  }
  if (ctx.is_internet) {
    return (
      <Badge variant="outline" className="bg-success/15 text-success border-success/30">
        <GlobeIcon className="size-3" />
        {t("core_settings.apn.edit.fields.modem_profile.for_internet")}
      </Badge>
    );
  }
  return null;
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function WanProfileEditSkeleton() {
  const { t } = useTranslation("cellular");
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("core_settings.apn.edit.title", { id: "" })}</CardTitle>
        <CardDescription>
          {t("core_settings.apn.edit.description_default")}
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
  cids,
  onSave,
  onClear,
  onCancel,
}: WanProfileEditCardProps) {
  const { t } = useTranslation("cellular");
  const { saved, markSaved } = useSaveFlash();

  // --- Form state (seeded from `profile`; parent remounts on slot change) ---
  const [name, setName] = useState(profile.name);
  const [apn, setApn] = useState(profile.apn);
  const [pdpType, setPdpType] = useState(profile.pdp_type || "ipv4v6");
  const [cid, setCid] = useState(String(profile.cid));

  // --- UI state ---
  const [apnError, setApnError] = useState("");
  // Stashed CID awaiting confirmation when the user picks a carrier (IMS/SOS)
  // context. The Select stays controlled by `cid`, so it visually reverts on
  // cancel without extra bookkeeping.
  const [pendingCid, setPendingCid] = useState<CidContext | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const contexts = cids ?? [];

  // --- CID selection — intercept carrier contexts for confirmation ---
  const handleCidChange = (value: string) => {
    const ctx = contexts.find((c) => String(c.cid) === value);
    if (ctx && (ctx.apn_type === "ims" || ctx.apn_type === "emergency")) {
      setPendingCid(ctx);
      return;
    }
    setCid(value);
  };

  const confirmCidChange = () => {
    if (pendingCid) setCid(String(pendingCid.cid));
    setPendingCid(null);
  };

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

    const request: WanProfileSaveRequest = {
      name: name.trim(),
      apn: apn.trim(),
      pdp_type: pdpType,
      cid: parseInt(cid, 10),
    };

    const success = await onSave(profile.id, request);
    if (success) {
      markSaved();
      toast.success(
        t("core_settings.apn.edit.toast.saved", {
          name: request.name || t("core_settings.apn.list.slot", { id: profile.id }),
        })
      );
    } else {
      toast.error(t("core_settings.apn.edit.toast.save_error"));
    }
  };

  const handleClear = async () => {
    setConfirmClear(false);
    const success = await onClear(profile.id);
    if (success) {
      toast.success(t("core_settings.apn.edit.clear.toast_success"));
      onCancel();
    } else {
      toast.error(t("core_settings.apn.edit.clear.toast_error"));
    }
  };

  if (!profile) return <WanProfileEditSkeleton />;

  const pendingType = pendingCid?.apn_type;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("core_settings.apn.edit.title", { id: profile.id })}</CardTitle>
        <CardDescription>
          {t("core_settings.apn.edit.description_default")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <FieldSet>
            <FieldGroup>
              {/* Row 1: Name + APN */}
              <div className="grid @md/card:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
                <Field>
                  <FieldLabel htmlFor={`wp-name-${profile.id}`}>
                    {t("core_settings.apn.edit.fields.name.label")}
                  </FieldLabel>
                  <Input
                    id={`wp-name-${profile.id}`}
                    placeholder={t("core_settings.apn.edit.fields.name.placeholder")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSaving}
                  />
                </Field>

                <Field data-invalid={apnError ? true : undefined}>
                  <FieldLabel htmlFor={`wp-apn-${profile.id}`}>
                    {t("core_settings.apn.edit.fields.apn.label")}
                  </FieldLabel>
                  <Input
                    id={`wp-apn-${profile.id}`}
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
                  <FieldLabel htmlFor={`wp-pdp-${profile.id}`}>
                    {t("core_settings.apn.edit.fields.pdp_type.label")}
                  </FieldLabel>
                  <Select value={pdpType} onValueChange={setPdpType} disabled={isSaving}>
                    <SelectTrigger
                      id={`wp-pdp-${profile.id}`}
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
                  <FieldLabel htmlFor={`wp-cid-${profile.id}`}>
                    {t("core_settings.apn.edit.fields.modem_profile.label")}
                  </FieldLabel>
                  <Select value={cid} onValueChange={handleCidChange} disabled={isSaving}>
                    <SelectTrigger
                      id={`wp-cid-${profile.id}`}
                      aria-label={t("core_settings.apn.edit.fields.modem_profile.aria")}
                    >
                      <SelectValue placeholder={t("core_settings.apn.edit.fields.modem_profile.placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {contexts.map((ctx) => (
                        <SelectItem key={ctx.cid} value={String(ctx.cid)}>
                          <span className="flex items-center gap-2">
                            {t("core_settings.apn.edit.fields.modem_profile.option_template", { cid: ctx.cid })}
                            <CidBadge ctx={ctx} />
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
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
              {t("core_settings.apn.edit.cancel")}
            </Button>
            {/* Clear is hidden for empty slots and disabled for the active one
                (the backend also refuses clearing the active slot). */}
            {profile.apn && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmClear(true)}
                disabled={isSaving || profile.is_active}
                title={
                  profile.is_active
                    ? t("core_settings.apn.edit.clear.disabled_active")
                    : t("core_settings.apn.edit.clear.button")
                }
                aria-label={t("core_settings.apn.edit.clear.button")}
              >
                <Trash2Icon className="size-4" />
              </Button>
            )}
          </div>
        </form>
      </CardContent>

      {/* Carrier-CID confirmation */}
      <AlertDialog open={pendingCid !== null} onOpenChange={(o) => !o && setPendingCid(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("core_settings.apn.edit.cid_confirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingType === "ims"
                ? t("core_settings.apn.edit.cid_confirm.description_ims", { cid: pendingCid?.cid })
                : t("core_settings.apn.edit.cid_confirm.description_sos", { cid: pendingCid?.cid })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("core_settings.apn.edit.cid_confirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmCidChange}
            >
              {t("core_settings.apn.edit.cid_confirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear-slot confirmation */}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("core_settings.apn.edit.clear.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("core_settings.apn.edit.clear.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("core_settings.apn.edit.clear.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleClear}
            >
              {t("core_settings.apn.edit.clear.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
