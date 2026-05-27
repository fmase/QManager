"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// =============================================================================
// ModeToggle — Public-surface theme switcher.
// =============================================================================
// ShadCN-canonical Sun/Moon dropdown, wired through next-themes. Lives in the
// public/ namespace because the authenticated nav uses AnimatedThemeToggler
// (view-transition circle-clip), and the pre-login surface gets the more
// conventional dropdown so first-time visitors can pick "system" explicitly.
//
// The optional `size` prop defaults to "icon-touch" so the Overview (the
// outdoor-glance surface the touch-target was sized for) keeps its current
// behaviour. /login overrides to "icon-sm" because it's an indoor focused-task
// gate, not an at-a-glance dashboard.
// =============================================================================

interface ModeToggleProps {
  size?: "icon-sm" | "icon-touch";
}

export function ModeToggle({ size = "icon-touch" }: ModeToggleProps = {}) {
  const { setTheme } = useTheme();
  const { t } = useTranslation("common");

  // Glyph size adapts to the button size for a consistent ~0.5 icon-to-button
  // ratio: 1.2rem (~19px) inside the 44px icon-touch button (Overview, outdoor
  // glance); size-4 (16px) inside the 32px icon-sm button (/login, indoor
  // focused-task gate). Matches the Languages glyph in LoginLanguagePicker so
  // the CardAction cluster on /login reads as one optical rhythm.
  const glyphClass = size === "icon-sm" ? "size-4" : "h-[1.2rem] w-[1.2rem]";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          aria-label={t("overview.actions.theme_toggle_aria")}
        >
          <Sun
            className={cn(
              glyphClass,
              "scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90",
            )}
          />
          <Moon
            className={cn(
              glyphClass,
              "absolute scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0",
            )}
          />
          <span className="sr-only">
            {t("overview.actions.theme_toggle_aria")}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          {t("overview.actions.theme_light")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          {t("overview.actions.theme_dark")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          {t("overview.actions.theme_system")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
