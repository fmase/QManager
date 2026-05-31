"use client";

import { useTranslation } from "react-i18next";
import { useReducedMotion } from "motion/react";
import { motion } from "motion/react";
import { SmartphoneNfcIcon, PlusIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// =============================================================================
// EmptyProfilesState — teaching empty state, engine-onboarding pattern
// =============================================================================
// Shown when no profiles exist at all. One card with a centered icon chip,
// a plain-language paragraph explaining what a Custom SIM Profile is and does,
// and a primary New Profile CTA. A secondary Refresh sits alongside.
// Mirrors engine-onboarding.tsx: max-w-md, size-14 icon chip, teaching copy,
// dual buttons.
// New profile is a callback (onNew) — no Link navigation.
// =============================================================================

interface EmptyProfilesStateProps {
  onRefresh?: () => void;
  onNew: () => void;
}

export function EmptyProfilesState({ onRefresh, onNew }: EmptyProfilesStateProps) {
  const { t } = useTranslation("cellular");
  const reduceMotion = useReducedMotion();

  const EXPO = [0.16, 1, 0.3, 1] as const;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EXPO }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{t("custom_profiles.empty_state.card_title")}</CardTitle>
          <CardDescription>
            {t("custom_profiles.empty_state.card_description")}
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-8 text-center">
            {/* Icon chip — matches engine-onboarding: size-14 rounded-xl border bg-muted/40 */}
            <div className="flex size-14 items-center justify-center rounded-xl border bg-muted/40">
              <SmartphoneNfcIcon className="size-7 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">
                {t("custom_profiles.empty_state.teaching_headline")}
              </p>
              <p className="text-muted-foreground text-xs">
                {t("custom_profiles.empty_state.teaching_body")}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={onNew}>
                <PlusIcon />
                {t("custom_profiles.empty_state.cta_new")}
              </Button>
              {onRefresh && (
                <Button variant="outline" size="sm" onClick={onRefresh}>
                  {t("custom_profiles.empty_state.cta_refresh")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default EmptyProfilesState;
