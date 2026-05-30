"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2Icon, MinusCircleIcon } from "lucide-react";
import { EngineModeToggle, type ViewMode } from "./engine-mode-toggle";

interface EngineStatusStripProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  /** Which mode owns the running engine, or null when idle. */
  activeMode: ViewMode | null;
  /** SNI domain, for the masquerading state label. */
  sniDomain?: string;
}

/**
 * Full-width header strip: engine state on the left (outline+tint badge, green
 * when up), the segmented mode selector on the right. The single shared engine
 * reads as one thing here; the badge says whether it's up and what it's doing.
 */
export function EngineStatusStrip({
  viewMode,
  onViewModeChange,
  activeMode,
  sniDomain,
}: EngineStatusStripProps) {
  const { t } = useTranslation("local-network");

  let badge;
  if (activeMode === "video") {
    badge = (
      <Badge
        variant="outline"
        className="border-success/30 bg-success/15 text-success"
      >
        <CheckCircle2Icon className="size-3" />
        {t("traffic_engine.state_protecting")}
      </Badge>
    );
  } else if (activeMode === "masquerade") {
    badge = (
      <Badge
        variant="outline"
        className="border-success/30 bg-success/15 text-success"
      >
        <CheckCircle2Icon className="size-3" />
        {t("traffic_engine.state_masquerading", { domain: sniDomain })}
      </Badge>
    );
  } else {
    badge = (
      <Badge
        variant="outline"
        className="border-muted-foreground/30 bg-muted/50 text-muted-foreground"
      >
        <MinusCircleIcon className="size-3" />
        {t("traffic_engine.state_idle")}
      </Badge>
    );
  }

  return (
    <div className="flex flex-col gap-4 @2xl/engine:flex-row @2xl/engine:items-center @2xl/engine:justify-between">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {t("traffic_engine.engine_identity")}
        </span>
        {badge}
      </div>
      <EngineModeToggle
        value={viewMode}
        onChange={onViewModeChange}
        activeMode={activeMode}
      />
    </div>
  );
}
