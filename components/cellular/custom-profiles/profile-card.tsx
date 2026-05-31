"use client";

import { useTranslation } from "react-i18next";
import {
  PlayIcon,
  PencilIcon,
  Trash2Icon,
  MoreVerticalIcon,
  CalendarClockIcon,
  RouteIcon,
} from "lucide-react";
import Link from "next/link";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { MinusCircleIcon } from "lucide-react";

import type { ProfileSummary } from "@/types/sim-profile";
import { formatProfileDate } from "@/types/sim-profile";
import { FactRow } from "@/components/cellular/custom-profiles/fact-row";

// =============================================================================
// ProfileCard — one inactive profile in the equal-height grid
// =============================================================================
// Anatomy for equal-height discipline: CardHeader (name + carrier + status badge
// + overflow menu in CardAction), CardContent (APN, ICCID-or-dash, scenario,
// updated date — every row always present as placeholder so cards never shrink),
// CardFooter (border-t: Activate primary).
//
// Summary-level by design: zero extra round-trips, reads from ProfileSummary
// only. The active profile never appears here; it lives in ActiveProfileCard.
// =============================================================================

const editPath = (id: string) =>
  `/cellular/custom-profiles/edit/?id=${encodeURIComponent(id)}`;

interface ProfileCardProps {
  profile: ProfileSummary;
  scenarioName: string | null;
  onActivate: (id: string) => void;
  onDelete: (profile: ProfileSummary) => void;
}

export function ProfileCard({
  profile,
  scenarioName,
  onActivate,
  onDelete,
}: ProfileCardProps) {
  const { t } = useTranslation("cellular");

  const scheduleEnabled = profile.scenario?.schedule?.enabled;

  const scenarioValue = scenarioName
    ? scheduleEnabled
      ? t("custom_profiles.active_card.scenario_scheduled", {
          name: scenarioName,
        })
      : t("custom_profiles.active_card.scenario_default", {
          name: scenarioName,
        })
    : null;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="truncate">{profile.name}</CardTitle>
        {/* Carrier as CardDescription; placeholder dash keeps equal height */}
        <CardDescription className="truncate">
          {profile.mno || "—"}
        </CardDescription>

        {/* CardAction: status badge (always inactive here) + overflow menu */}
        <CardAction className="flex items-center gap-1">
          <Badge
            variant="outline"
            className="border-muted-foreground/30 bg-muted/50 text-muted-foreground"
          >
            <MinusCircleIcon className="size-3" />
            {t("custom_profiles.table.status_badge.inactive")}
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground size-8"
                aria-label={t("custom_profiles.table.actions_menu.open_menu")}
              >
                <MoreVerticalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem asChild>
                <Link href={editPath(profile.id)}>
                  <PencilIcon className="size-4" />
                  {t("custom_profiles.table.actions_menu.edit")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(profile)}
              >
                <Trash2Icon className="size-4" />
                {t("custom_profiles.table.actions_menu.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>

      {/* CardContent: compact fact list — every row always present for equal height */}
      <CardContent className="flex-1 space-y-2.5">
        {/* Scenario binding with icon */}
        <div
          className={
            scenarioName
              ? "text-muted-foreground flex items-center gap-1.5 text-sm"
              : "text-muted-foreground/40 flex items-center gap-1.5 text-sm"
          }
        >
          {scheduleEnabled ? (
            <CalendarClockIcon className="size-4 shrink-0" />
          ) : (
            <RouteIcon className="size-4 shrink-0" />
          )}
          <span className="truncate">{scenarioValue ?? "—"}</span>
        </div>

        {/* ICCID — always a row; "—" when SIM-agnostic */}
        <FactRow
          label={t("custom_profiles.card.label_iccid")}
          value={profile.sim_iccid || null}
          mono
        />

        {/* Updated date — always present */}
        <FactRow
          label={t("custom_profiles.card.label_updated")}
          value={formatProfileDate(profile.updated_at)}
        />
      </CardContent>

      {/* CardFooter: border-t, primary Activate action */}
      <CardFooter className="border-t pt-4">
        <Button
          className="w-full"
          size="sm"
          onClick={() => onActivate(profile.id)}
        >
          <PlayIcon className="size-4" />
          {t("custom_profiles.table.actions_menu.activate")}
        </Button>
      </CardFooter>
    </Card>
  );
}
