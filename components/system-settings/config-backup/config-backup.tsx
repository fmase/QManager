import React from "react";
import ConfigBackupCard from "./config-backup-card";
import RestoreConfigBackupCard from "./restore-backup-card";

const ConfigurationBackupComponent = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Configuration Backup</h1>
        <p className="text-muted-foreground">
          Download a backup of your current modem configuration. This can be
          useful for restoring settings after a factory reset or for
          transferring settings to a new modem. The backup file is encrypted and
          can only be restored on the same device.
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <ConfigBackupCard />
        <RestoreConfigBackupCard />
      </div>
    </div>
  );
};

export default ConfigurationBackupComponent;
