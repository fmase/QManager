"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import ConfigBackupCard from "./config-backup-card";
import RestoreConfigBackupCard from "./restore-backup-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);

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

  const handleConfirmDismiss = () => {
    clearPendingReboot();
    setDismissDialogOpen(false);
  };

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Configuration Backup</h1>
        <p className="text-muted-foreground">
          Save an encrypted snapshot of your modem settings. Use it to recover
          after a factory reset or to clone configuration onto another modem —
          different models are supported, but incompatible sections will be
          skipped during restore.
        </p>
      </div>

      <AnimatePresence initial={false}>
        {pending && (
          <motion.div
            key="pending-reboot-banner"
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <Alert variant="warning" className="mb-6">
              <TriangleAlertIcon />
              <AlertTitle>Modem reboot required</AlertTitle>
              <AlertDescription>
                <p className="text-foreground/80">
                  A previous restore queued an IMEI change or profile
                  activation that needs a modem reboot to take effect. Reboot
                  now or use the Reboot Now button below when you are ready.
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
                    onClick={() => setDismissDialogOpen(true)}
                    disabled={rebootBusy}
                  >
                    Dismiss
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={dismissDialogOpen} onOpenChange={setDismissDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss reboot reminder?</AlertDialogTitle>
            <AlertDialogDescription>
              Any IMEI change or profile activation queued by the restore will
              not take effect until you reboot the modem. Dismiss only if you
              have already rebooted through another method.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep reminder</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDismiss}>
              Dismiss anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4 items-stretch">
        <div className="h-full">
          <ConfigBackupCard />
        </div>
        <div className="h-full">
          <RestoreConfigBackupCard />
        </div>
      </div>
    </div>
  );
};

export default ConfigurationBackupComponent;
