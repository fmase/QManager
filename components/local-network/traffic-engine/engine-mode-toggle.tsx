"use client";

import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type ViewMode = "video" | "masquerade";

interface EngineModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  /** Which mode (if any) currently owns the running engine — gets a green dot. */
  activeMode: ViewMode | null;
}

const MODES: ViewMode[] = ["video", "masquerade"];

/**
 * Segmented view selector for the two engine modes. The mutex is the grammar:
 * this picks which mode you're *looking at*, not which is running. A sliding
 * indicator (layoutId, ease-out-quart) settles under the selected segment; the
 * segment matching the running mode carries a small green dot. Radix ToggleGroup
 * gives radiogroup semantics + arrow-key navigation; reduced-motion skips the
 * slide.
 */
export function EngineModeToggle({
  value,
  onChange,
  activeMode,
}: EngineModeToggleProps) {
  const { t } = useTranslation("local-network");
  const reduceMotion = useReducedMotion();

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v === "video" || v === "masquerade") onChange(v);
      }}
      variant="outline"
      className="bg-muted/40 p-0.5"
      aria-label={t("traffic_engine.aria_mode_selector")}
    >
      {MODES.map((mode) => {
        const selected = value === mode;
        const isActive = activeMode === mode;
        return (
          <ToggleGroupItem
            key={mode}
            value={mode}
            aria-label={t(`traffic_engine.mode_${mode}`)}
            className={cn(
              "relative h-8 gap-2 border-0 bg-transparent px-3.5 text-sm font-medium",
              "data-[state=on]:bg-transparent data-[state=on]:text-foreground",
              "text-muted-foreground hover:text-foreground",
            )}
          >
            {selected && (
              <motion.span
                layoutId="engine-mode-indicator"
                className="absolute inset-0 -z-10 rounded-md border bg-card shadow-sm"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }
                }
              />
            )}
            <span className="relative flex items-center gap-2">
              {isActive && (
                <span
                  className="size-1.5 rounded-full bg-success"
                  aria-hidden="true"
                />
              )}
              {t(`traffic_engine.mode_${mode}`)}
            </span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
