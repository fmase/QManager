"use client";

import { useState, useEffect, type FormEvent } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, RotateCcwIcon } from "lucide-react";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import {
  MNO_PRESETS,
  getMnoPreset,
} from "@/constants/mno-presets";
import type { CurrentApnProfile } from "@/types/sim-profile";
import type { ApnSaveRequest } from "@/types/apn-settings";

interface APNSettingsCardProps {
  profiles: CurrentApnProfile[] | null;
  activeCid: number | null;
  isLoading: boolean;
  isSaving: boolean;
  onSave: (request: ApnSaveRequest) => Promise<boolean>;
  isProfileControlled?: boolean;
  profileName?: string | null;
}

const APNSettingsCard = ({
  profiles,
  activeCid,
  isLoading,
  isSaving,
  onSave,
  isProfileControlled = false,
  profileName = null,
}: APNSettingsCardProps) => {
  const { t } = useTranslation("cellular");
  // Form state
  const { saved, markSaved } = useSaveFlash();
  const [selectedCid, setSelectedCid] = useState<string>("");
  const [activeApn, setActiveApn] = useState<string>("");
  const [pdpType, setPdpType] = useState<string>("");
  const [autoApnPreset, setAutoApnPreset] = useState<string>("none");

  // TTL/HL from Auto APN preset (hidden, included in save request)
  const [pendingTtl, setPendingTtl] = useState<number>(0);
  const [pendingHl, setPendingHl] = useState<number>(0);

  // Sync form state from fetched data
  useEffect(() => {
    if (profiles && activeCid !== null) {
      const activeProfile = profiles.find((p) => p.cid === activeCid);
      setSelectedCid(String(activeCid));
      setActiveApn(activeProfile?.apn ?? "");
      setPdpType(activeProfile?.pdp_type ?? "IPV4V6");
      setAutoApnPreset("none");
      setPendingTtl(0);
      setPendingHl(0);
    }
  }, [profiles, activeCid]);

  // When user selects a different Carrier Profile (CID)
  const handleCidChange = (cidStr: string) => {
    setSelectedCid(cidStr);
    const profile = profiles?.find((p) => p.cid === Number(cidStr));
    if (profile) {
      setActiveApn(profile.apn);
      setPdpType(profile.pdp_type);
    }
    setAutoApnPreset("none");
    setPendingTtl(0);
    setPendingHl(0);
  };

  // When user selects an Auto APN preset
  const handleAutoApnChange = (presetId: string) => {
    setAutoApnPreset(presetId);

    if (presetId === "none") {
      // Revert to current CID's values
      const profile = profiles?.find((p) => p.cid === Number(selectedCid));
      if (profile) {
        setActiveApn(profile.apn);
        setPdpType(profile.pdp_type);
      }
      setPendingTtl(0);
      setPendingHl(0);
      return;
    }

    const preset = getMnoPreset(presetId);
    if (preset) {
      setActiveApn(preset.apn_name);
      setPendingTtl(preset.ttl);
      setPendingHl(preset.hl);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!profiles || isProfileControlled) return;

    const request: ApnSaveRequest = {
      cid: Number(selectedCid),
      pdp_type: pdpType,
      apn: activeApn,
    };

    if (pendingTtl > 0) request.ttl = pendingTtl;
    if (pendingHl > 0) request.hl = pendingHl;

    const success = await onSave(request);
    if (success) {
      markSaved();
      toast.success(t("core_settings.apn.toast.success"));
    } else {
      toast.error(t("core_settings.apn.toast.error"));
    }
  };

  const handleReset = () => {
    if (profiles && activeCid !== null) {
      const activeProfile = profiles.find((p) => p.cid === activeCid);
      setSelectedCid(String(activeCid));
      setActiveApn(activeProfile?.apn ?? "");
      setPdpType(activeProfile?.pdp_type ?? "IPV4V6");
      setAutoApnPreset("none");
      setPendingTtl(0);
      setPendingHl(0);
    }
  };

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("core_settings.apn.card.title")}</CardTitle>
          <CardDescription>
            {t("core_settings.apn.card.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid @md/card:grid-cols-2 grid-cols-1 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
            <div className="grid @md/card:grid-cols-2 grid-cols-1 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("core_settings.apn.card.title")}</CardTitle>
        <CardDescription>
          {t("core_settings.apn.card.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isProfileControlled && (
          <Alert className="mb-4">
            <InfoIcon className="size-4" />
            <AlertDescription>
              <p>
                {t("core_settings.apn.managed_by_profile", {
                  profile_name: profileName ?? t("core_settings.apn.managed_by_profile_fallback"),
                })}
              </p>
            </AlertDescription>
          </Alert>
        )}
        <form className="grid gap-4" onSubmit={handleSave}>
          <div className="w-full">
            <FieldSet disabled={isProfileControlled}>
              <FieldGroup>
                <div className="grid @md/card:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
                  <Field>
                    <FieldLabel htmlFor="active-apn">{t("core_settings.apn.fields.active_apn.label")}</FieldLabel>
                    <Input
                      id="active-apn"
                      placeholder={t("core_settings.apn.fields.active_apn.placeholder")}
                      value={activeApn}
                      onChange={(e) => setActiveApn(e.target.value)}
                      disabled={isSaving || isProfileControlled}
                      required
                      aria-required="true"
                    />
                  </Field>

                  <Field>
                    <FieldLabel>{t("core_settings.apn.fields.carrier_preset.label")}</FieldLabel>
                    <Select
                      value={
                        autoApnPreset ||
                        "none"
                      }
                      onValueChange={handleAutoApnChange}
                      disabled={isSaving || isProfileControlled}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("core_settings.apn.fields.carrier_preset.placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("core_settings.apn.fields.carrier_preset.option_none")}</SelectItem>
                        {MNO_PRESETS.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid @md/card:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
                  <Field>
                    <FieldLabel>{t("core_settings.apn.fields.connection_profile.label")}</FieldLabel>
                    <Select
                      value={
                        selectedCid ||
                        (activeCid !== null ? String(activeCid) : "")
                      }
                      onValueChange={handleCidChange}
                      disabled={isSaving || isProfileControlled}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("core_settings.apn.fields.connection_profile.placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles?.map((p) => (
                          <SelectItem key={p.cid} value={String(p.cid)}>
                            {t("core_settings.apn.fields.connection_profile.option_template", {
                              cid: p.cid,
                              apn: p.apn || t("core_settings.apn.fields.connection_profile.option_empty_apn"),
                            })}
                            {p.cid === activeCid ? t("core_settings.apn.fields.connection_profile.option_active_suffix") : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>{t("core_settings.apn.fields.ip_protocol.label")}</FieldLabel>
                    <Select
                      value={
                        pdpType ||
                        (profiles && activeCid !== null
                          ? profiles.find((p) => p.cid === activeCid)
                              ?.pdp_type ?? "IPV4V6"
                          : "")
                      }
                      onValueChange={setPdpType}
                      disabled={isSaving || isProfileControlled}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("core_settings.apn.fields.ip_protocol.placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IPV4V6">
                          {t("core_settings.apn.fields.ip_protocol.options.ipv4v6")}
                        </SelectItem>
                        <SelectItem value="IP">{t("core_settings.apn.fields.ip_protocol.options.ipv4")}</SelectItem>
                        <SelectItem value="IPV6">{t("core_settings.apn.fields.ip_protocol.options.ipv6")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </FieldGroup>
            </FieldSet>
          </div>
          <div className="flex items-center gap-x-2">
            <SaveButton
              type="submit"
              isSaving={isSaving}
              saved={saved}
              disabled={isProfileControlled}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isSaving || isProfileControlled}
              aria-label={t("core_settings.apn.reset_aria")}
            >
              <RotateCcwIcon />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default APNSettingsCard;
