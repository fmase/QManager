import React from "react";
import { useTranslation } from "react-i18next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { SmartphoneIcon, RefreshCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { motion } from "motion/react";

interface EmptyProfileViewProps {
  onRefresh?: () => void;
}

const EmptyProfileViewComponent = ({ onRefresh }: EmptyProfileViewProps) => {
  const { t } = useTranslation("cellular");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="h-full"
    >
    <Card className="@container/card h-full">
      <CardHeader>
        <CardTitle>{t("custom_profiles.view.title")}</CardTitle>
        <CardDescription>
          {t("custom_profiles.empty_state.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="h-full flex items-center justify-center">
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
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCcwIcon className="size-4" />
                {t("custom_profiles.empty_state.refresh")}
              </Button>
            )}
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
    </motion.div>
  );
};

export default EmptyProfileViewComponent;
