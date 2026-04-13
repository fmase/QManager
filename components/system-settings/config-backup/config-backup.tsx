"use client";

import React, { useState } from "react";
import ConfigBackupCard from "./config-backup-card";
import RestoreConfigBackupCard from "./restore-backup-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TriangleAlertIcon } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import {
  usePendingReboot,
  clearPendingReboot,
  setPendingReboot,
} from "@/lib/config-backup/pending-reboot";

const ConfigurationBackupComponent = () => {
  const pending = usePendingReboot();
  const [rebootBusy, setRebootBusy] = useState(false);

  const handleRebootNow = async () => {
    setRebootBusy(true);
    clearPendingReboot();
    try {
      const res = await authFetch("/cgi-bin/quecmanager/system/reboot.sh", {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(`reboot_failed: HTTP ${res.status}`);
      }
      // Page will become unreachable shortly.
    } catch {
      setPendingReboot();
      setRebootBusy(false);
    }
  };

  const handleDismiss = () => {
    clearPendingReboot();
  };

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Configuration Backup</h1>
        <p className="text-muted-foreground">
          Download a backup of your current modem configuration. This can be
          useful for restoring settings after a factory reset or for
          transferring settings to a new modem. The backup file is encrypted
          and can only be restored on the same device.
        </p>
      </div>

      {pending && (
        <Alert className="mb-4 border-warning/30 bg-warning/10 text-warning [&>svg]:text-warning">
          <TriangleAlertIcon />
          <AlertTitle>Modem reboot required</AlertTitle>
          <AlertDescription>
            <p className="text-foreground/80">
              A previous restore queued an IMEI change or profile activation
              that needs a modem reboot to take effect. Reboot now or use the
              Reboot Now button below when you are ready.
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleRebootNow}
                disabled={rebootBusy}
              >
                {rebootBusy ? "Rebooting…" : "Reboot Now"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                disabled={rebootBusy}
              >
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <ConfigBackupCard />
        <RestoreConfigBackupCard />
      </div>
    </div>
  );
};

export default ConfigurationBackupComponent;
