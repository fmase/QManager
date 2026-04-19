"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileTable } from "@/components/cellular/custom-profiles/custom-profile-table";
import EmptyProfileViewComponent from "@/components/cellular/custom-profiles/empty-profile";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProfileSummary } from "@/types/sim-profile";

// =============================================================================
// CustomProfileViewComponent — Profile List Card
// =============================================================================

interface CustomProfileViewProps {
  profiles: ProfileSummary[];
  activeProfileId: string | null;
  isLoading: boolean;
  error: string | null;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<boolean>;
  onActivate: (id: string) => void;
  onDeactivate: () => void;
  onRefresh: () => void;
  currentIccid?: string | null;
}

const CustomProfileViewComponent = ({
  profiles,
  activeProfileId,
  isLoading,
  error,
  onEdit,
  onDelete,
  onActivate,
  onDeactivate,
  onRefresh,
  currentIccid,
}: CustomProfileViewProps) => {
  const { t } = useTranslation("cellular");

  if (isLoading) {
    return (
      <Card className="@container/card h-full">
        <CardHeader>
          <CardTitle>{t("custom_profiles.view.title")}</CardTitle>
          <CardDescription>{t("custom_profiles.view.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (profiles.length === 0) {
    return <EmptyProfileViewComponent onRefresh={onRefresh} />;
  }

  return (
    <Card className="@container/card h-full">
      <CardHeader>
        <CardTitle>{t("custom_profiles.view.title")}</CardTitle>
        <CardDescription>
          {t("custom_profiles.view.count", { count: profiles.length })}
          {error && (
            <span className="text-destructive ml-2">{error}</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileTable
          data={profiles}
          activeProfileId={activeProfileId}
          onEdit={onEdit}
          onDelete={onDelete}
          onActivate={onActivate}
          onDeactivate={onDeactivate}
          currentIccid={currentIccid}
        />
      </CardContent>
    </Card>
  );
};

export default CustomProfileViewComponent;
