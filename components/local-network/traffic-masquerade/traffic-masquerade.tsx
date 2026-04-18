"use client";

import { useTranslation } from "react-i18next";
import { useTrafficMasquerade } from "@/hooks/use-traffic-masquerade";
import TrafficMasqueradeSettingsCard from "./traffic-masquerade-settings-card";
import TestInjectionCard from "./test-injection-card";

export default function TrafficMasqueradeComponent() {
  const { t } = useTranslation("local-network");
  const trafficMasquerade = useTrafficMasquerade();

  const voActive = trafficMasquerade.settings?.other_enabled === true;
  const isRunning = trafficMasquerade.settings?.status === "running";

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t("masquerade.page_title")}</h1>
        <p className="text-muted-foreground">
          {t("masquerade.page_description")}
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <TrafficMasqueradeSettingsCard
          hook={trafficMasquerade}
          otherActive={voActive}
        />
        <TestInjectionCard
          testResult={trafficMasquerade.testResult}
          runTest={trafficMasquerade.runTest}
          serviceRunning={isRunning}
        />
      </div>
    </div>
  );
}
