"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { TbInfoCircleFilled } from "react-icons/tb";
import { Input } from "@/components/ui/input";
import { Loader2, Crosshair } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";

import type {
  TowerLockConfig,
  TowerModemState,
  LteLockCell,
} from "@/types/tower-locking";
import type { ModemStatus } from "@/types/modem-status";

interface LTELockingProps {
  config: TowerLockConfig | null;
  modemState: TowerModemState | null;
  modemData: ModemStatus | null;
  isLoading: boolean;
  isLocking: boolean;
  isWatcherRunning: boolean;
  onLock: (cells: LteLockCell[]) => Promise<boolean>;
  onUnlock: () => Promise<boolean>;
}

const LTELockingComponent = ({
  config,
  modemState,
  modemData,
  isLoading,
  isLocking,
  isWatcherRunning,
  onLock,
  onUnlock,
}: LTELockingProps) => {
  const { t } = useTranslation("cellular");

  // Local form state for the 3 input pairs
  const [earfcn1, setEarfcn1] = useState("");
  const [pci1, setPci1] = useState("");
  const [earfcn2, setEarfcn2] = useState("");
  const [pci2, setPci2] = useState("");
  const [earfcn3, setEarfcn3] = useState("");
  const [pci3, setPci3] = useState("");

  // Confirmation dialog state
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [pendingCells, setPendingCells] = useState<LteLockCell[]>([]);

  // Sync form from config when data loads
  useEffect(() => {
    if (config?.lte?.cells) {
      const cells = config.lte.cells;
      if (cells[0]) {
        setEarfcn1(String(cells[0].earfcn));
        setPci1(String(cells[0].pci));
      }
      if (cells[1]) {
        setEarfcn2(String(cells[1].earfcn));
        setPci2(String(cells[1].pci));
      }
      if (cells[2]) {
        setEarfcn3(String(cells[2].earfcn));
        setPci3(String(cells[2].pci));
      }
    }
  }, [config?.lte?.cells]);

  // Derive enabled state from modem state (actual lock) or config
  const isEnabled = modemState?.lte_locked ?? config?.lte?.enabled ?? false;

  // Build cells array from form inputs
  const buildCells = (): LteLockCell[] => {
    const cells: LteLockCell[] = [];
    const e1 = parseInt(earfcn1, 10);
    const p1 = parseInt(pci1, 10);
    if (!isNaN(e1) && !isNaN(p1)) cells.push({ earfcn: e1, pci: p1 });

    const e2 = parseInt(earfcn2, 10);
    const p2 = parseInt(pci2, 10);
    if (!isNaN(e2) && !isNaN(p2)) cells.push({ earfcn: e2, pci: p2 });

    const e3 = parseInt(earfcn3, 10);
    const p3 = parseInt(pci3, 10);
    if (!isNaN(e3) && !isNaN(p3)) cells.push({ earfcn: e3, pci: p3 });

    return cells;
  };

  const handleToggle = (checked: boolean) => {
    if (checked && isWatcherRunning) {
      toast.warning(t("cell_locking.tower_locking.lte.toast.failover_in_progress_title"), {
        description: t("cell_locking.tower_locking.lte.toast.failover_in_progress_description"),
      });
      return;
    }
    if (checked) {
      const cells = buildCells();
      if (cells.length === 0) {
        toast.warning(t("cell_locking.tower_locking.lte.toast.no_targets_title"), {
          description: t("cell_locking.tower_locking.lte.toast.no_targets_description"),
        });
        return;
      }
      // Show confirmation dialog
      setPendingCells(cells);
      setShowLockDialog(true);
    } else {
      setShowUnlockDialog(true);
    }
  };

  const confirmLock = async () => {
    setShowLockDialog(false);
    const success = await onLock(pendingCells);
    if (success) {
      toast.success(t("cell_locking.tower_locking.lte.toast.lock_success"));
    } else {
      toast.error(t("cell_locking.tower_locking.lte.toast.lock_error"));
    }
  };

  const confirmUnlock = async () => {
    setShowUnlockDialog(false);
    const success = await onUnlock();
    if (success) {
      toast.success(t("cell_locking.tower_locking.lte.toast.unlock_success"));
    } else {
      toast.error(t("cell_locking.tower_locking.lte.toast.unlock_error"));
    }
  };

  // "Use Current" — copy active PCell into slot 1
  const handleUseCurrent = () => {
    const earfcn = modemData?.lte?.earfcn;
    const pci = modemData?.lte?.pci;
    if (earfcn != null && pci != null) {
      setEarfcn1(String(earfcn));
      setPci1(String(pci));
      toast.info(t("cell_locking.tower_locking.lte.toast.filled_current"));
    } else {
      toast.warning(t("cell_locking.tower_locking.lte.toast.no_active_connection"));
    }
  };

  const hasActiveLteCell =
    modemData?.lte?.earfcn != null && modemData?.lte?.pci != null;

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("cell_locking.tower_locking.lte.title")}</CardTitle>
          <CardDescription>
            {t("cell_locking.tower_locking.lte.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Separator />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Separator />
            <div className="grid gap-4 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("cell_locking.tower_locking.lte.title")}</CardTitle>
          <CardDescription>
            {t("cell_locking.tower_locking.lte.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TbInfoCircleFilled className="size-5 text-info" />
                <p className="font-semibold text-muted-foreground text-sm">
                  {t("cell_locking.tower_locking.lte.enabled_label")}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {isLocking ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : null}
                <Switch
                  id="lte-tower-locking"
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                  disabled={isLocking}
                />
                <Label htmlFor="lte-tower-locking">
                  {isEnabled ? t("state.enabled", { ns: "common" }) : t("state.disabled", { ns: "common" })}
                </Label>
              </div>
            </div>
            <Separator />
            <form
              className="grid gap-4 mt-6"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="w-full">
                <FieldSet>
                  <FieldGroup>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <div className="flex items-center justify-between">
                          <FieldLabel htmlFor="earfcn1">{t("cell_locking.tower_locking.lte.channel_label")}</FieldLabel>
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={handleUseCurrent}
                            disabled={isLocking || !hasActiveLteCell}
                          >
                            {t("cell_locking.tower_locking.lte.use_current")}
                          </Button>
                        </div>
                        <Input
                          id="earfcn1"
                          type="text"
                          placeholder={t("cell_locking.tower_locking.lte.channel_placeholder")}
                          value={earfcn1}
                          onChange={(e) => setEarfcn1(e.target.value)}
                          disabled={isLocking}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="pci1">{t("cell_locking.tower_locking.lte.pci_label")}</FieldLabel>
                        <Input
                          id="pci1"
                          type="text"
                          placeholder={t("cell_locking.tower_locking.lte.pci_placeholder")}
                          value={pci1}
                          onChange={(e) => setPci1(e.target.value)}
                          disabled={isLocking}
                        />
                      </Field>
                    </div>
                    {/* Optional locking entry 2 */}
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="earfcn2">{t("cell_locking.tower_locking.lte.channel_label_n", { n: 2 })}</FieldLabel>
                        <Input
                          id="earfcn2"
                          type="text"
                          placeholder={t("cell_locking.tower_locking.lte.channel_placeholder_n", { n: 2 })}
                          value={earfcn2}
                          onChange={(e) => setEarfcn2(e.target.value)}
                          disabled={isLocking}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="pci2">{t("cell_locking.tower_locking.lte.pci_label_n", { n: 2 })}</FieldLabel>
                        <Input
                          id="pci2"
                          type="text"
                          placeholder={t("cell_locking.tower_locking.lte.pci_placeholder_n", { n: 2 })}
                          value={pci2}
                          onChange={(e) => setPci2(e.target.value)}
                          disabled={isLocking}
                        />
                      </Field>
                    </div>
                    {/* Optional locking entry 3 */}
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="earfcn3">{t("cell_locking.tower_locking.lte.channel_label_n", { n: 3 })}</FieldLabel>
                        <Input
                          id="earfcn3"
                          type="text"
                          placeholder={t("cell_locking.tower_locking.lte.channel_placeholder_n", { n: 3 })}
                          value={earfcn3}
                          onChange={(e) => setEarfcn3(e.target.value)}
                          disabled={isLocking}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="pci3">{t("cell_locking.tower_locking.lte.pci_label_n", { n: 3 })}</FieldLabel>
                        <Input
                          id="pci3"
                          type="text"
                          placeholder={t("cell_locking.tower_locking.lte.pci_placeholder_n", { n: 3 })}
                          value={pci3}
                          onChange={(e) => setPci3(e.target.value)}
                          disabled={isLocking}
                        />
                      </Field>
                    </div>
                  </FieldGroup>
                </FieldSet>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Lock confirmation dialog */}
      <AlertDialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cell_locking.tower_locking.lte.lock_dialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCells.length === 1
                ? t("cell_locking.tower_locking.lte.lock_dialog.description_single", {
                    earfcn: pendingCells[0]?.earfcn,
                    pci: pendingCells[0]?.pci,
                  })
                : t("cell_locking.tower_locking.lte.lock_dialog.description_multi", {
                    count: pendingCells.length,
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel", { ns: "common" })}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLock}>
              {t("cell_locking.tower_locking.lte.lock_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlock confirmation dialog */}
      <AlertDialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cell_locking.tower_locking.lte.unlock_dialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cell_locking.tower_locking.lte.unlock_dialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel", { ns: "common" })}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlock}>
              {t("cell_locking.tower_locking.lte.unlock_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LTELockingComponent;
