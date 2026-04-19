"use client";

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import SmsAlertsSettingsCard from "./sms-alerts-settings-card";
import SmsAlertsLogCard from "./sms-alerts-log-card";

const SmsAlertsComponent = () => {
  const { t } = useTranslation("monitoring");
  const [logRefreshKey, setLogRefreshKey] = useState(0);

  const handleTestSmsSent = useCallback(() => {
    setLogRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t("sms_alerts.page_title")}</h1>
        <p className="text-muted-foreground">
          {t("sms_alerts.page_description")}
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <SmsAlertsSettingsCard onTestSmsSent={handleTestSmsSent} />
        <SmsAlertsLogCard refreshKey={logRefreshKey} />
      </div>
    </div>
  );
};

export default SmsAlertsComponent;
