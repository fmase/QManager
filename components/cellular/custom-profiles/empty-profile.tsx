"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { SmartphoneIcon, PlusIcon, RefreshCcwIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

// =============================================================================
// EmptyProfilesState — first-run teaching surface
// =============================================================================
// Shown when no profiles exist at all. Replaces both the old active-profile and
// list cards with a single calm surface whose primary action is creating the
// first profile.
// =============================================================================

interface EmptyProfilesStateProps {
  onNew: () => void;
  onRefresh?: () => void;
}

export function EmptyProfilesState({ onNew, onRefresh }: EmptyProfilesStateProps) {
  const { t } = useTranslation("cellular");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SmartphoneIcon />
              </EmptyMedia>
              <EmptyTitle>{t("custom_profiles.empty_state.title")}</EmptyTitle>
              <EmptyDescription>
                {t("custom_profiles.empty_state.description_full")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex items-center justify-center gap-2">
                <Button onClick={onNew}>
                  <PlusIcon className="size-4" />
                  {t("custom_profiles.list.new_button")}
                </Button>
                {onRefresh && (
                  <Button variant="outline" onClick={onRefresh}>
                    <RefreshCcwIcon className="size-4" />
                    {t("custom_profiles.empty_state.refresh")}
                  </Button>
                )}
              </div>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default EmptyProfilesState;
