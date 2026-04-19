"use client";

import { useTranslation } from "react-i18next";
import { useVideoOptimizer } from "@/hooks/use-video-optimizer";
import VideoOptimizerSettingsCard from "./video-optimizer-settings-card";
import CdnHostlistCard from "./cdn-hostlist-card";

export default function VideoOptimizerComponent() {
  const { t } = useTranslation("local-network");
  const videoOptimizer = useVideoOptimizer();

  const masqActive = videoOptimizer.settings?.other_enabled === true;

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t("video_optimizer.page_title")}</h1>
        <p className="text-muted-foreground">
          {t("video_optimizer.page_description")}
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <VideoOptimizerSettingsCard
          hook={videoOptimizer}
          otherActive={masqActive}
        />
        {videoOptimizer.settings?.binary_installed && <CdnHostlistCard />}
      </div>
    </div>
  );
}
