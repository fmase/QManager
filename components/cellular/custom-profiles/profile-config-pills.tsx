"use client";

import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { SimProfile, PdpType } from "@/types/sim-profile";

// =============================================================================
// ProfileConfigPills — dense outline tags describing what a profile DOES
// =============================================================================
// The UniFi-heritage "pill-dense" readout. Surfaces a profile's defining
// settings (APN, slot, IP protocol, TTL/HL, IMEI override, MPDN lock) as a
// row of small monochrome tags, so the user understands a profile without
// opening the editor. Numeric values use tabular-nums so they never jitter.
//
// Two tones:
//   neutral — the routine settings, quiet by default
//   info    — the settings that carry consequence (IMEI override rewrites the
//             modem identity + reboots; Verizon MPDN locks data routing)
// =============================================================================

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium tabular-nums",
        tone === "info"
          ? "border-info/30 bg-info/10 text-info"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

interface ProfileConfigPillsProps {
  profile: SimProfile;
  className?: string;
}

export function ProfileConfigPills({
  profile,
  className,
}: ProfileConfigPillsProps) {
  const { t } = useTranslation("cellular");
  const s = profile.settings;

  const pdpShort: Record<PdpType, string> = {
    IP: t("custom_profiles.pills.ip_v4"),
    IPV6: t("custom_profiles.pills.ip_v6"),
    IPV4V6: t("custom_profiles.pills.ip_dual"),
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Pill>
        {s.apn.name?.trim()
          ? t("custom_profiles.pills.apn", { name: s.apn.name })
          : t("custom_profiles.pills.apn_default")}
      </Pill>
      <Pill>{t("custom_profiles.pills.cid", { cid: s.apn.cid })}</Pill>
      <Pill>{pdpShort[s.apn.pdp_type] ?? s.apn.pdp_type}</Pill>
      {s.ttl > 0 && <Pill>{t("custom_profiles.pills.ttl", { value: s.ttl })}</Pill>}
      {s.hl > 0 && <Pill>{t("custom_profiles.pills.hl", { value: s.hl })}</Pill>}
      {s.imei?.trim() && (
        <Pill tone="info">{t("custom_profiles.pills.imei_override")}</Pill>
      )}
      {profile.mno === "Verizon" && (
        <Pill tone="info">{t("custom_profiles.pills.mpdn_locked")}</Pill>
      )}
    </div>
  );
}
