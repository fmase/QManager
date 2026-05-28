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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { EyeIcon, EyeOffIcon, InfoIcon } from "lucide-react";
import { TbInfoCircleFilled } from "react-icons/tb";

import type { WanProfile, WanProfileSaveRequest } from "@/types/wan-profiles";
import {
  PDP_TYPE_OPTIONS,
  AUTH_TYPE_OPTIONS,
  VLAN_OPTIONS,
  isCarrierProfile,
} from "@/types/wan-profiles";

// =============================================================================
// Props
// =============================================================================

interface WanProfileEditCardProps {
  profile: WanProfile;
  isSaving: boolean;
  /** Backend data source. On "at" (AT-only modems), the wmmd-only controls
   *  — default route, IP passthrough, VLAN mapping — have no equivalent and
   *  are hidden, since saving them would be a silent no-op. */
  dataSource: "rdb" | "at";
  onSave: (index: number, request: WanProfileSaveRequest) => Promise<boolean>;
  onCancel: () => void;
}

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
          <Skeleton className="h-px w-full" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
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
  dataSource,
  onSave,
  onCancel,
}: WanProfileEditCardProps) {
  const { t } = useTranslation("cellular");
  const carrier = isCarrierProfile(profile);
  // wmmd-only controls have no AT equivalent — hide them on AT-only modems.
  const showWmmdControls = dataSource === "rdb";
  const { saved, markSaved } = useSaveFlash();

  // --- Form state ---
  const [name, setName] = useState(profile.name);
  const [apn, setApn] = useState(profile.apn);
  const [pdpType, setPdpType] = useState(profile.pdp_type);
  const [authType, setAuthType] = useState(profile.auth_type);
  const [username, setUsername] = useState(profile.username);
  const [password, setPassword] = useState("");
  const [mtu, setMtu] = useState(profile.mtu !== null ? String(profile.mtu) : "");
  const [modemProfile, setModemProfile] = useState(String(profile.modem_profile));
  const [ipPassthrough, setIpPassthrough] = useState(profile.ip_passthrough);
  const [defaultRoute, setDefaultRoute] = useState(profile.default_route);
  const [vlanIndex, setVlanIndex] = useState(profile.vlan_index ?? "");

  // --- UI state ---
  const [showPassword, setShowPassword] = useState(false);
  const [apnError, setApnError] = useState("");
  const [mtuError, setMtuError] = useState("");

  // Form state is seeded from `profile` via useState initializers above. When
  // the user switches to a different slot, the parent remounts this card with
  // a new `key={profile.index}`, so the initializers re-run with fresh values
  // — no setState-in-effect sync needed.

  // --- Validation ---
  const validateForm = (): boolean => {
    let valid = true;

    if (!apn.trim()) {
      setApnError(t("core_settings.apn.edit.fields.apn.error_required"));
      valid = false;
    } else {
      setApnError("");
    }

    const mtuNum = mtu.trim() ? parseInt(mtu, 10) : null;
    if (mtu.trim() && (isNaN(mtuNum!) || mtuNum! < 1 || mtuNum! > 1500)) {
      setMtuError(t("core_settings.apn.edit.fields.mtu.error_range"));
      valid = false;
    } else {
      setMtuError("");
    }

    return valid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const request: WanProfileSaveRequest = {
      name: name.trim(),
      apn: apn.trim(),
      pdp_type: pdpType,
      auth_type: authType,
      username: authType !== "none" ? username.trim() : "",
      password: authType !== "none" ? password : "",
      mtu: mtu.trim() ? parseInt(mtu, 10) : null,
      ip_passthrough: ipPassthrough,
      modem_profile: parseInt(modemProfile, 10),
      default_route: defaultRoute,
      vlan_index: vlanIndex,
    };

    const success = await onSave(profile.index, request);
    if (success) {
      markSaved();
      toast.success(t("core_settings.apn.edit.toast.saved", { index: profile.index }));
    } else {
      toast.error(t("core_settings.apn.edit.toast.save_error", { index: profile.index }));
    }
  };

  if (!profile) return <WanProfileEditSkeleton />;

  const carrierTypeLabel =
    profile.apn_type === "ims"
      ? t("core_settings.apn.edit.carrier_type.ims")
      : profile.apn_type === "emergency"
        ? t("core_settings.apn.edit.carrier_type.sos")
        : null;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("core_settings.apn.edit.title", { index: profile.index })}</CardTitle>
        <CardDescription>
          {carrier && carrierTypeLabel
            ? t("core_settings.apn.edit.description_carrier", { type: carrierTypeLabel })
            : t("core_settings.apn.edit.description_default", { index: profile.index })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {carrier && (
          <Alert className="mb-4">
            <InfoIcon />
            <AlertTitle>{t("core_settings.apn.edit.carrier_alert.title")}</AlertTitle>
            <AlertDescription>
              {t("core_settings.apn.edit.carrier_alert.description")}
            </AlertDescription>
          </Alert>
        )}

        <fieldset disabled={carrier || undefined}>
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

                {/* Row 2: PDP Type + Auth Type */}
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
                    <FieldLabel htmlFor={`wp-auth-${profile.index}`}>
                      {t("core_settings.apn.edit.fields.auth_type.label")}
                    </FieldLabel>
                    <Select
                      value={authType}
                      onValueChange={(v) => {
                        setAuthType(v);
                        if (v === "none") {
                          setUsername("");
                          setPassword("");
                        }
                      }}
                      disabled={isSaving}
                    >
                      <SelectTrigger
                        id={`wp-auth-${profile.index}`}
                        aria-label={t("core_settings.apn.edit.fields.auth_type.aria")}
                      >
                        <SelectValue placeholder={t("core_settings.apn.edit.fields.auth_type.placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {AUTH_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {t(`core_settings.apn.edit.fields.auth_type.options.${opt.value}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {/* Row 3: Username + Password (conditional on auth type) */}
                {authType !== "none" && (
                  <div className="grid @md/card:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
                    <Field>
                      <FieldLabel htmlFor={`wp-user-${profile.index}`}>
                        {t("core_settings.apn.edit.fields.username.label")}
                      </FieldLabel>
                      <Input
                        id={`wp-user-${profile.index}`}
                        placeholder={t("core_settings.apn.edit.fields.username.placeholder")}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={isSaving}
                        autoComplete="username"
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor={`wp-pass-${profile.index}`}>
                        {t("core_settings.apn.edit.fields.password.label")}
                      </FieldLabel>
                      <div className="relative">
                        <Input
                          id={`wp-pass-${profile.index}`}
                          type={showPassword ? "text" : "password"}
                          placeholder={t("core_settings.apn.edit.fields.password.placeholder")}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isSaving}
                          autoComplete="new-password"
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword((v) => !v)}
                          tabIndex={-1}
                          aria-label={
                            showPassword
                              ? t("core_settings.apn.edit.fields.password.hide_aria")
                              : t("core_settings.apn.edit.fields.password.show_aria")
                          }
                        >
                          {showPassword ? (
                            <EyeOffIcon className="size-4" />
                          ) : (
                            <EyeIcon className="size-4" />
                          )}
                        </Button>
                      </div>
                    </Field>
                  </div>
                )}

                {/* Row 4: MTU + Modem Profile */}
                <div className="grid @md/card:grid-cols-2 grid-cols-1 grid-flow-row gap-4">
                  <Field data-invalid={mtuError ? true : undefined}>
                    <FieldLabel htmlFor={`wp-mtu-${profile.index}`}>
                      {t("core_settings.apn.edit.fields.mtu.label")}
                    </FieldLabel>
                    <Input
                      id={`wp-mtu-${profile.index}`}
                      type="number"
                      placeholder={t("core_settings.apn.edit.fields.mtu.placeholder")}
                      min={1}
                      max={1500}
                      value={mtu}
                      onChange={(e) => {
                        setMtu(e.target.value);
                        if (mtuError) setMtuError("");
                      }}
                      disabled={isSaving}
                      aria-invalid={!!mtuError}
                    />
                    {mtuError && <FieldError>{mtuError}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor={`wp-cid-${profile.index}`}>
                      {t("core_settings.apn.edit.fields.modem_profile.label")}
                    </FieldLabel>
                    <Select
                      value={modemProfile}
                      onValueChange={setModemProfile}
                      disabled={isSaving}
                    >
                      <SelectTrigger
                        id={`wp-cid-${profile.index}`}
                        aria-label={t("core_settings.apn.edit.fields.modem_profile.aria")}
                      >
                        <SelectValue placeholder={t("core_settings.apn.edit.fields.modem_profile.placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map((cid) => (
                          <SelectItem key={cid} value={String(cid)}>
                            {t("core_settings.apn.edit.fields.modem_profile.option_template", { cid })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {/* Rows 5-6 — wmmd-only controls; hidden on AT-only modems */}
                {showWmmdControls && (
                  <>
                    {/* Row 5: VLAN Mapping (full width) */}
                    <Field>
                      <FieldLabel htmlFor={`wp-vlan-${profile.index}`}>
                        {t("core_settings.apn.edit.fields.vlan.label")}
                      </FieldLabel>
                      <Select
                        value={vlanIndex || "_default"}
                        onValueChange={(v) => setVlanIndex(v === "_default" ? "" : v)}
                        disabled={isSaving}
                      >
                        <SelectTrigger
                          id={`wp-vlan-${profile.index}`}
                          aria-label={t("core_settings.apn.edit.fields.vlan.aria")}
                        >
                          <SelectValue placeholder={t("core_settings.apn.edit.fields.vlan.placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {VLAN_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value || "_default"}>
                              {opt.value
                                ? t("core_settings.apn.edit.fields.vlan.option_vlan", { n: opt.value })
                                : t("core_settings.apn.edit.fields.vlan.option_default")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    {/* Row 6: Default Route + IP Passthrough toggles */}
                    <div className="grid @md/card:grid-cols-2 grid-cols-1 gap-4">
                      <Field orientation="horizontal">
                        <div className="flex flex-auto items-center gap-1.5">
                          <FieldLabel htmlFor={`wp-default-route-${profile.index}`}>
                            {t("core_settings.apn.edit.fields.default_route.label")}
                          </FieldLabel>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex"
                                aria-label={t("core_settings.apn.edit.fields.default_route.info_aria")}
                              >
                                <TbInfoCircleFilled className="size-4 text-info" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-56">
                                {t("core_settings.apn.edit.fields.default_route.tooltip")}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Switch
                          id={`wp-default-route-${profile.index}`}
                          checked={defaultRoute}
                          onCheckedChange={setDefaultRoute}
                          disabled={isSaving}
                          aria-label={t("core_settings.apn.edit.fields.default_route.aria")}
                        />
                      </Field>

                      <Field orientation="horizontal">
                        <div className="flex flex-auto items-center gap-1.5">
                          <FieldLabel htmlFor={`wp-passthrough-${profile.index}`}>
                            {t("core_settings.apn.edit.fields.ip_passthrough.label")}
                          </FieldLabel>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex"
                                aria-label={t("core_settings.apn.edit.fields.ip_passthrough.info_aria")}
                              >
                                <TbInfoCircleFilled className="size-4 text-info" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-56">
                                {t("core_settings.apn.edit.fields.ip_passthrough.tooltip")}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Switch
                          id={`wp-passthrough-${profile.index}`}
                          checked={ipPassthrough}
                          onCheckedChange={setIpPassthrough}
                          disabled={isSaving}
                          aria-label={t("core_settings.apn.edit.fields.ip_passthrough.aria")}
                        />
                      </Field>
                    </div>
                  </>
                )}
              </FieldGroup>
            </FieldSet>

            {/* --- Actions --- */}
            <div className="flex items-center gap-2">
              {!carrier && (
                <SaveButton
                  type="submit"
                  isSaving={isSaving}
                  saved={saved}
                  label={t("core_settings.apn.edit.save_button")}
                />
              )}
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSaving}
              >
                {carrier
                  ? t("core_settings.apn.edit.back")
                  : t("core_settings.apn.edit.cancel")}
              </Button>
            </div>
          </form>
        </fieldset>
      </CardContent>
    </Card>
  );
}
