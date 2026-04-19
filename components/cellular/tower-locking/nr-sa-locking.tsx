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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  NrSaLockCell,
} from "@/types/tower-locking";
import type { ModemStatus, NetworkType } from "@/types/modem-status";
import { SCS_OPTIONS } from "@/types/tower-locking";

interface NRSALockingProps {
  config: TowerLockConfig | null;
  modemState: TowerModemState | null;
  modemData: ModemStatus | null;
  networkType: NetworkType | string;
  isLoading: boolean;
  isLocking: boolean;
  isWatcherRunning: boolean;
  onLock: (cell: NrSaLockCell) => Promise<boolean>;
  onUnlock: () => Promise<boolean>;
}

/**
 * Extract numeric band from 3GPP band string.
 * e.g., "N41" → 41, "N78" → 78
 */
function extractBandNumber(band: string | null | undefined): number | null {
  if (!band) return null;
  const match = band.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

const NRSALockingComponent = ({
  config,
  modemState,
  modemData,
  networkType,
  isLoading,
  isLocking,
  isWatcherRunning,
  onLock,
  onUnlock,
}: NRSALockingProps) => {
  const { t } = useTranslation("cellular");

  // Local form state
  const [arfcn, setArfcn] = useState("");
  const [pci, setPci] = useState("");
  const [band, setBand] = useState("");
  const [scs, setScs] = useState("");

  // Confirmation dialog state
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [pendingCell, setPendingCell] = useState<NrSaLockCell | null>(null);

  // Sync form from config when data loads
  useEffect(() => {
    if (config?.nr_sa) {
      if (config.nr_sa.arfcn !== null) setArfcn(String(config.nr_sa.arfcn));
      if (config.nr_sa.pci !== null) setPci(String(config.nr_sa.pci));
      if (config.nr_sa.band !== null) setBand(String(config.nr_sa.band));
      if (config.nr_sa.scs !== null) setScs(String(config.nr_sa.scs));
    }
  }, [config?.nr_sa]);

  // Derive enabled state from modem state or config
  const isEnabled = modemState?.nr_locked ?? config?.nr_sa?.enabled ?? false;

  // NSA mode gating — NR-SA locking not available in NSA or LTE-only mode
  const isNsaMode = networkType === "5G-NSA";
  const isLteOnly = networkType === "LTE";
  const isCardDisabled = isNsaMode || isLteOnly;
  const isDisabled = isCardDisabled || isLocking;

  const handleToggle = (checked: boolean) => {
    if (checked && isWatcherRunning) {
      toast.warning(t("cell_locking.tower_locking.nr_sa.toast.failover_in_progress_title"), {
        description: t("cell_locking.tower_locking.nr_sa.toast.failover_in_progress_description"),
      });
      return;
    }
    if (checked) {
      const parsedArfcn = parseInt(arfcn, 10);
      const parsedPci = parseInt(pci, 10);
      const parsedBand = parseInt(band, 10);
      const parsedScs = parseInt(scs, 10);

      if (
        isNaN(parsedArfcn) ||
        isNaN(parsedPci) ||
        isNaN(parsedBand) ||
        isNaN(parsedScs)
      ) {
        toast.warning(t("cell_locking.tower_locking.nr_sa.toast.incomplete_title"), {
          description: t("cell_locking.tower_locking.nr_sa.toast.incomplete_description"),
        });
        return;
      }

      const cell: NrSaLockCell = {
        arfcn: parsedArfcn,
        pci: parsedPci,
        band: parsedBand,
        scs: parsedScs,
      };
      setPendingCell(cell);
      setShowLockDialog(true);
    } else {
      setShowUnlockDialog(true);
    }
  };

  const confirmLock = async () => {
    setShowLockDialog(false);
    if (pendingCell) {
      const success = await onLock(pendingCell);
      if (success) {
        toast.success(t("cell_locking.tower_locking.nr_sa.toast.lock_success"));
      } else {
        toast.error(t("cell_locking.tower_locking.nr_sa.toast.lock_error"));
      }
    }
  };

  const confirmUnlock = async () => {
    setShowUnlockDialog(false);
    const success = await onUnlock();
    if (success) {
      toast.success(t("cell_locking.tower_locking.nr_sa.toast.unlock_success"));
    } else {
      toast.error(t("cell_locking.tower_locking.nr_sa.toast.unlock_error"));
    }
  };

  // "Use Current" — copy active NR PCell into form fields
  const handleUseCurrent = () => {
    const nrArfcn = modemData?.nr?.arfcn;
    const nrPci = modemData?.nr?.pci;
    const nrBandNum = extractBandNumber(modemData?.nr?.band);
    const nrScs = modemData?.nr?.scs;

    if (nrArfcn != null && nrPci != null) {
      setArfcn(String(nrArfcn));
      setPci(String(nrPci));
      if (nrBandNum != null) setBand(String(nrBandNum));
      if (nrScs != null) setScs(String(nrScs));
      toast.info(t("cell_locking.tower_locking.nr_sa.toast.filled_current"));
    } else {
      toast.warning(t("cell_locking.tower_locking.nr_sa.toast.no_active_connection"));
    }
  };

  const hasActiveNrCell =
    modemData?.nr?.arfcn != null && modemData?.nr?.pci != null;

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("cell_locking.tower_locking.nr_sa.title")}</CardTitle>
          <CardDescription>
            {t("cell_locking.tower_locking.nr_sa.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Separator />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-48" />
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
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </div>
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
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={`@container/card ${isCardDisabled ? "opacity-60" : ""}`}>
        <CardHeader>
          <CardTitle>{t("cell_locking.tower_locking.nr_sa.title")}</CardTitle>
          <CardDescription>
            {t("cell_locking.tower_locking.nr_sa.description")}
            {isNsaMode && t("cell_locking.tower_locking.nr_sa.description_suffix_nsa_mode")}
            {isLteOnly && t("cell_locking.tower_locking.nr_sa.description_suffix_lte_only")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TbInfoCircleFilled className="size-5 text-info" />
                <p className="font-semibold text-muted-foreground text-sm">
                  {t("cell_locking.tower_locking.nr_sa.enabled_label")}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {isLocking ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : null}
                <Switch
                  id="nr-sa-tower-locking"
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                  disabled={isDisabled}
                />
                <Label htmlFor="nr-sa-tower-locking">
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
                          <FieldLabel htmlFor="nrarfcn1">{t("cell_locking.tower_locking.nr_sa.arfcn_label")}</FieldLabel>
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={handleUseCurrent}
                            disabled={isDisabled || !hasActiveNrCell}
                          >
                            {t("cell_locking.tower_locking.nr_sa.use_current")}
                          </Button>
                        </div>
                        <Input
                          id="nrarfcn1"
                          type="text"
                          placeholder={t("cell_locking.tower_locking.nr_sa.arfcn_placeholder")}
                          value={arfcn}
                          onChange={(e) => setArfcn(e.target.value)}
                          disabled={isDisabled}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="nrpci">{t("cell_locking.tower_locking.nr_sa.pci_label")}</FieldLabel>
                        <Input
                          id="nrpci"
                          type="text"
                          placeholder={t("cell_locking.tower_locking.nr_sa.pci_placeholder")}
                          value={pci}
                          onChange={(e) => setPci(e.target.value)}
                          disabled={isDisabled}
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="nr-band">{t("cell_locking.tower_locking.nr_sa.band_label")}</FieldLabel>
                        <Input
                          id="nr-band"
                          type="text"
                          placeholder={t("cell_locking.tower_locking.nr_sa.band_placeholder")}
                          value={band}
                          onChange={(e) => setBand(e.target.value)}
                          disabled={isDisabled}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="scs">{t("cell_locking.tower_locking.nr_sa.scs_label")}</FieldLabel>
                        <Select
                          value={scs}
                          onValueChange={setScs}
                          disabled={isDisabled}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("cell_locking.tower_locking.nr_sa.scs_placeholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            {SCS_OPTIONS.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={String(opt.value)}
                              >
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
            <AlertDialogTitle>{t("cell_locking.tower_locking.nr_sa.lock_dialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cell_locking.tower_locking.nr_sa.lock_dialog.description", {
                arfcn: pendingCell?.arfcn,
                pci: pendingCell?.pci,
                band: pendingCell?.band,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel", { ns: "common" })}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLock}>
              {t("cell_locking.tower_locking.nr_sa.lock_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlock confirmation dialog */}
      <AlertDialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cell_locking.tower_locking.nr_sa.unlock_dialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cell_locking.tower_locking.nr_sa.unlock_dialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel", { ns: "common" })}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlock}>
              {t("cell_locking.tower_locking.nr_sa.unlock_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default NRSALockingComponent;
