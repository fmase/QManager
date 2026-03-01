"use client";

import React from "react";
import IMEISettingsCard from "./imei-settings-card";
import BackupIMEICard from "./backup-imei-card";
import { useImeiSettings } from "@/hooks/use-imei-settings";

const IMEISettings = () => {
  const {
    currentImei,
    backupEnabled,
    backupImei,
    isLoading,
    isSaving,
    saveImei,
    saveBackup,
    rebootDevice,
  } = useImeiSettings();

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">IMEI Mangling Settings</h1>
        <p className="text-muted-foreground max-w-5xl">
          Manage your device&apos;s IMEI settings, including viewing, modifying,
          and resetting options.
        </p>
      </div>
      <div className="grid grid-cols-1 @xl/main:grid-cols-2 @5xl/main:grid-cols-2 grid-flow-row gap-4 *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs">
        <IMEISettingsCard
          currentImei={currentImei}
          isLoading={isLoading}
          isSaving={isSaving}
          onSave={saveImei}
          onReboot={rebootDevice}
        />
        <BackupIMEICard
          backupEnabled={backupEnabled}
          backupImei={backupImei}
          isLoading={isLoading}
          isSaving={isSaving}
          onSave={saveBackup}
        />
      </div>
    </div>
  );
};

export default IMEISettings;
