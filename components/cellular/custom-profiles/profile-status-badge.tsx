"use client";

import { useTranslation } from "react-i18next";
import {
  CheckCircle2Icon,
  TriangleAlertIcon,
  MinusCircleIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// =============================================================================
// ProfileStatusBadge — single source of truth for a profile's lifecycle state
// =============================================================================
// Three states, all rendered with the QManager outline-badge pattern
// (variant="outline" + bg-{role}/15 + text-{role} + border-{role}/30 + size-3
// lucide icon). Functional-color contract: green = active & healthy,
// amber = active but the inserted SIM no longer matches, muted = idle.
// =============================================================================

export type ProfileState = "active" | "mismatch" | "idle";

/**
 * Derive a profile's state from the active marker and SIM identity.
 * An empty `profileIccid` means the profile is SIM-agnostic, so it can never
 * mismatch (mirrors the backend's `collect_boot_data()` auto-clear logic).
 */
export function deriveProfileState(
  isActive: boolean,
  profileIccid: string | null | undefined,
  currentIccid: string | null | undefined,
): ProfileState {
  if (!isActive) return "idle";
  if (profileIccid && currentIccid && profileIccid !== currentIccid) {
    return "mismatch";
  }
  return "active";
}

const STATE_STYLES: Record<ProfileState, string> = {
  active: "border-success/30 bg-success/15 text-success",
  mismatch: "border-warning/30 bg-warning/15 text-warning",
  idle: "border-muted-foreground/30 bg-muted/50 text-muted-foreground",
};

const STATE_ICONS: Record<ProfileState, typeof CheckCircle2Icon> = {
  active: CheckCircle2Icon,
  mismatch: TriangleAlertIcon,
  idle: MinusCircleIcon,
};

interface ProfileStatusBadgeProps {
  state: ProfileState;
  className?: string;
}

export function ProfileStatusBadge({ state, className }: ProfileStatusBadgeProps) {
  const { t } = useTranslation("cellular");
  const Icon = STATE_ICONS[state];

  const label =
    state === "active"
      ? t("custom_profiles.table.status_badge.active")
      : state === "mismatch"
        ? t("custom_profiles.table.status_badge.sim_mismatch")
        : t("custom_profiles.table.status_badge.inactive");

  return (
    <Badge variant="outline" className={cn(STATE_STYLES[state], className)}>
      <Icon />
      {label}
    </Badge>
  );
}
