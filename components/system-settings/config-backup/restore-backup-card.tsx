"use client";

import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import {
  ArchiveRestoreIcon,
  CheckCircle2Icon,
  Loader2Icon,
  LockIcon,
  TriangleAlertIcon,
  XCircleIcon,
} from "lucide-react";
import { useConfigRestore } from "@/hooks/use-config-restore";
import { useModemStatus } from "@/hooks/use-modem-status";
import { RestorePasswordDialog } from "./restore-password-dialog";
import { RestoreProgressList } from "./restore-progress-list";

const RestoreConfigBackupCard = () => {
  const modem = useModemStatus();
  const {
    state,
    readFile,
    tryPassword,
    confirmModelWarning,
    startApply,
    cancel,
    reset,
  } = useConfigRestore(modem.data?.device.model ?? "");

  const fileInput = useRef<HTMLInputElement>(null);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);

  // Close the password dialog once decryption has succeeded (or otherwise moved past it)
  const ui = state.ui;
  useEffect(() => {
    if (
      pwDialogOpen &&
      ui !== "password_required" &&
      ui !== "password_incorrect" &&
      ui !== "reading"
    ) {
      setPwDialogOpen(false);
    }
  }, [ui, pwDialogOpen]);

  // Open the password dialog automatically when the envelope is parsed
  useEffect(() => {
    if (ui === "password_required" && !pwDialogOpen) {
      setPwDialogOpen(true);
    }
  }, [ui, pwDialogOpen]);

  const openFilePicker = () => fileInput.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      await readFile(f);
    }
    e.target.value = ""; // allow re-picking the same file
  };

  const handlePasswordSubmit = async (pw: string) => {
    await tryPassword(pw);
  };

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Restore Configuration Backup</CardTitle>
        <CardDescription>
          Restore your modem configuration from a previously downloaded backup
          file. This will overwrite your current settings for the sections in
          the backup.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInput}
          type="file"
          accept=".qmbackup,application/octet-stream"
          className="hidden"
          onChange={onFileChange}
        />

        {ui === "idle" && (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ArchiveRestoreIcon />
              </EmptyMedia>
              <EmptyTitle>No backup file selected</EmptyTitle>
              <EmptyDescription>
                Upload a .qmbackup file to restore your modem configuration.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={openFilePicker}>
                Upload Backup File
              </Button>
            </EmptyContent>
          </Empty>
        )}

        {ui === "reading" && (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Loader2Icon className="animate-spin" />
              </EmptyMedia>
              <EmptyTitle>Reading file…</EmptyTitle>
              <EmptyDescription>Parsing backup envelope.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {(ui === "password_required" || ui === "password_incorrect") && (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className={
                  ui === "password_incorrect"
                    ? "text-destructive"
                    : "text-info"
                }
              >
                <LockIcon />
              </EmptyMedia>
              <EmptyTitle>
                {ui === "password_incorrect"
                  ? "Incorrect password"
                  : "Password required"}
              </EmptyTitle>
              <EmptyDescription>
                {ui === "password_incorrect"
                  ? "Decryption failed. Check the passphrase and try again."
                  : "This backup is encrypted. Enter the passphrase that was used to create it."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPwDialogOpen(true)}
              >
                {ui === "password_incorrect" ? "Try Again" : "Enter Password"}
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                Cancel
              </Button>
            </EmptyContent>
          </Empty>
        )}

        {ui === "model_warning" && state.envelope && (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="text-warning">
                <TriangleAlertIcon />
              </EmptyMedia>
              <EmptyTitle>Different modem model</EmptyTitle>
              <EmptyDescription>
                This backup was created on{" "}
                <span className="font-medium">
                  {state.envelope.device.model}
                </span>
                {" — you're restoring on "}
                <span className="font-medium">
                  {modem.data?.device.model ?? "unknown"}
                </span>
                {". Some settings may not apply."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={confirmModelWarning}>
                Continue Anyway
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                Cancel
              </Button>
            </EmptyContent>
          </Empty>
        )}

        {ui === "ready" && state.envelope && state.payload && (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="text-success">
                <CheckCircle2Icon />
              </EmptyMedia>
              <EmptyTitle>Backup ready to apply</EmptyTitle>
              <EmptyDescription>
                From{" "}
                <span className="font-medium">
                  {state.envelope.device.model}
                </span>
                {" • "}
                {new Date(state.envelope.created_at).toLocaleString()}
                {" • "}
                {Object.keys(state.payload.sections).length} sections
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" onClick={startApply}>
                Apply Backup
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                Cancel
              </Button>
            </EmptyContent>
          </Empty>
        )}

        {ui === "applying" && (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="text-info">
                <Loader2Icon className="animate-spin" />
              </EmptyMedia>
              <EmptyTitle>Applying configuration…</EmptyTitle>
              <EmptyDescription>
                {state.progress ? (
                  <RestoreProgressList sections={state.progress.sections} />
                ) : (
                  "Starting worker…"
                )}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={cancel}>
                Cancel
              </Button>
            </EmptyContent>
          </Empty>
        )}

        {(ui === "success" || ui === "partial_success") && state.progress && (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className={
                  ui === "success" ? "text-success" : "text-warning"
                }
              >
                {ui === "success" ? (
                  <CheckCircle2Icon />
                ) : (
                  <TriangleAlertIcon />
                )}
              </EmptyMedia>
              <EmptyTitle>
                {ui === "success"
                  ? "Restore complete"
                  : "Restore completed with issues"}
              </EmptyTitle>
              <EmptyDescription>
                <RestoreProgressList sections={state.progress.sections} />
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" onClick={reset}>
                Done
              </Button>
            </EmptyContent>
          </Empty>
        )}

        {ui === "failed" && (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="text-destructive">
                <XCircleIcon />
              </EmptyMedia>
              <EmptyTitle>Restore failed</EmptyTitle>
              <EmptyDescription>
                {state.error ?? "Unknown error"}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={reset}>
                Try Again
              </Button>
            </EmptyContent>
          </Empty>
        )}

        <RestorePasswordDialog
          open={
            pwDialogOpen &&
            (ui === "password_required" || ui === "password_incorrect")
          }
          onOpenChange={setPwDialogOpen}
          onSubmit={handlePasswordSubmit}
          incorrect={ui === "password_incorrect"}
        />
      </CardContent>
    </Card>
  );
};

export default RestoreConfigBackupCard;
