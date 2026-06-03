"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircleIcon,
  ArrowLeftRightIcon,
  EyeIcon,
  LockIcon,
  LockOpenIcon,
  RotateCcwIcon,
  ShieldIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatBandName, type BandCategory } from "@/types/band-locking";

// =============================================================================
// BandCardsComponent — Per-Category Band Checkbox Grid + Lock/Unlock Actions
// =============================================================================
// One instance per band category (LTE, NSA NR5G, SA NR5G).
// All data flows in via props from BandLockingComponent (coordinator).
//
// Local state: checkbox selection (initialized from currentLockedBands).
// Parent owns the CGI communication — this component only calls onLock/onUnlockAll.
// =============================================================================

interface BandCardsProps {
  title: string;
  description: string;
  /** Which band category this card manages */
  bandCategory: BandCategory;
  /** All hardware-supported bands for this category (from policy_band, sorted) */
  supportedBands: number[];
  /** Currently locked/configured bands (from ue_capability_band, sorted) */
  currentLockedBands: number[];
  /** Lock selected bands — returns success boolean */
  onLock: (bands: number[]) => Promise<boolean>;
  /** Unlock all bands (reset to full supported list) — returns success boolean */
  onUnlockAll: () => Promise<boolean>;
  /** True while any lock/unlock operation is in flight (shared across all cards) */
  isLocking: boolean;
  /** True while initial data is loading */
  isLoading: boolean;
  /** Error from the hook (shared) */
  error: string | null;
  /** True when a Connection Scenario controls bands — disables all interactions */
  disabled?: boolean;
  /**
   * When provided, renders a swap control in the header that flips this slot
   * between SA NR5G and NR-DC. Only the shared SA/NR-DC slot passes this.
   */
  onSwapView?: () => void;
  /** Short label of the mode the swap switches TO (e.g. "NR-DC"). */
  swapLabel?: string;
  /** Tooltip + accessible name for the swap control (e.g. "Switch to NR-DC bands"). */
  swapTitle?: string;
  /**
   * Read-only mode: the band set is reported by the modem but cannot be locked
   * manually (NR-DC). Hides all action controls and shows the current active
   * bands as a disabled grid with a "view only" badge.
   */
  readOnly?: boolean;
}

const BandCardsComponent = ({
  title,
  description,
  bandCategory,
  supportedBands,
  currentLockedBands,
  onLock,
  onUnlockAll,
  isLocking,
  isLoading,
  error,
  disabled = false,
  onSwapView,
  swapLabel,
  swapTitle,
  readOnly = false,
}: BandCardsProps) => {
  const { t } = useTranslation("cellular");
  const { saved, markSaved } = useSaveFlash();

  // --- Local checkbox state (number set for O(1) lookup) --------------------
  const [checkedBands, setCheckedBands] = useState<Set<number>>(
    () => new Set(currentLockedBands),
  );

  // Sync local state when currentLockedBands prop changes (initial load or after lock).
  // "Store previous value in state" pattern per React docs — no refs, no effects.
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevLockedKey, setPrevLockedKey] = useState("");
  const lockedKey = currentLockedBands.join(":");
  if (prevLockedKey !== lockedKey && currentLockedBands.length > 0) {
    setPrevLockedKey(lockedKey);
    setCheckedBands(new Set(currentLockedBands));
  }

  // --- Derived state --------------------------------------------------------
  const isAllUnlocked = useMemo(() => {
    if (supportedBands.length === 0 || currentLockedBands.length === 0)
      return false;
    return (
      currentLockedBands.length === supportedBands.length &&
      currentLockedBands.every((b) => supportedBands.includes(b))
    );
  }, [supportedBands, currentLockedBands]);

  // Whether the user's selection differs from what's currently on the modem
  const hasChanges = useMemo(() => {
    if (currentLockedBands.length !== checkedBands.size) return true;
    return currentLockedBands.some((b) => !checkedBands.has(b));
  }, [currentLockedBands, checkedBands]);

  const noneSelected = checkedBands.size === 0;

  // --- Handlers -------------------------------------------------------------
  const handleCheckboxChange = (band: number) => {
    setCheckedBands((prev) => {
      const next = new Set(prev);
      if (next.has(band)) {
        next.delete(band);
      } else {
        next.add(band);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setCheckedBands(new Set(supportedBands));
  };

  const handleSelectNone = () => {
    setCheckedBands(new Set());
  };

  const handleLock = async () => {
    const bands = [...checkedBands].sort((a, b) => a - b);
    if (bands.length === 0) {
      toast.error(t("cell_locking.band_locking.toast.select_one_band"));
      return;
    }

    const categoryLabel = t(`cell_locking.band_locking.card_category_label.${bandCategory}`);
    const success = await onLock(bands);
    if (success) {
      markSaved();
      toast.success(
        t("cell_locking.band_locking.toast.locked_success", { category_label: categoryLabel }),
      );
    } else {
      toast.error(error || t("cell_locking.band_locking.toast.lock_error"));
    }
  };

  const handleUnlockAll = async () => {
    const categoryLabel = t(`cell_locking.band_locking.card_category_label.${bandCategory}`);
    const success = await onUnlockAll();
    if (success) {
      toast.success(t("cell_locking.band_locking.toast.unlocked_success", { category_label: categoryLabel }));
    } else {
      toast.error(error || t("cell_locking.band_locking.toast.unlock_error"));
    }
  };

  // --- Loading skeleton -----------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="grid @lg/card:grid-cols-8 @md/card:grid-cols-6 @sm/card:grid-cols-4 grid-cols-3 grid-flow-row gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div className="flex items-center space-x-2" key={i}>
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Skeleton className="h-9 w-40" />
        </CardFooter>
      </Card>
    );
  }

  // --- Empty state (no supported bands for this category) -------------------
  if (supportedBands.length === 0) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("cell_locking.band_locking.card_empty")}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Combined disable flag: scenario-controlled OR mid-lock
  const isDisabled = disabled || isLocking;

  return (
    <Card className="@container/card" aria-disabled={disabled || undefined}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className={disabled ? "text-muted-foreground" : undefined}>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
          {onSwapView && (
            <Button
              size="xs"
              variant="secondary"
              onClick={onSwapView}
              disabled={isDisabled}
              aria-label={swapTitle}
              title={swapTitle}
              className="gap-1.5"
            >
              <ArrowLeftRightIcon className="size-3.5" />
              {swapLabel}
            </Button>
          )}
          {disabled ? (
            <Badge
              variant="outline"
              className="bg-info/15 text-info hover:bg-info/20 border-info/30"
            >
              <ShieldIcon className="h-3 w-3" />
              {t("cell_locking.band_locking.card_badges.scenario_controlled")}
            </Badge>
          ) : readOnly ? (
            <Badge
              variant="outline"
              className="bg-info/15 text-info hover:bg-info/20 border-info/30"
            >
              <EyeIcon className="h-3 w-3" />
              {t("cell_locking.band_locking.card_badges.view_only")}
            </Badge>
          ) : isAllUnlocked ? (
            <Badge
              variant="outline"
              className="bg-success/15 text-success hover:bg-success/20 border-success/30"
            >
              <LockOpenIcon className="h-3 w-3" />
              {t("cell_locking.band_locking.card_badges.all_unlocked")}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30"
            >
              <LockIcon className="h-3 w-3" />
              {t("cell_locking.band_locking.card_badges.bands_locked", { locked: currentLockedBands.length, total: supportedBands.length })}
            </Badge>
          )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Band checkbox grid */}
        <motion.div
          className="grid @lg/card:grid-cols-8 @md/card:grid-cols-6 @sm/card:grid-cols-4 grid-cols-3 grid-flow-row gap-4 mt-2"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.025 } } }}
        >
          {supportedBands.map((band) => (
            <motion.div
              key={band}
              className="flex items-center space-x-2"
              variants={{ hidden: { opacity: 0, scale: 0.88 }, visible: { opacity: 1, scale: 1 } }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <Checkbox
                id={`${bandCategory}-${band}`}
                checked={readOnly ? currentLockedBands.includes(band) : checkedBands.has(band)}
                onCheckedChange={readOnly ? undefined : () => handleCheckboxChange(band)}
                disabled={isDisabled || readOnly}
              />
              <Label
                htmlFor={`${bandCategory}-${band}`}
                className={disabled || readOnly ? "cursor-default" : "cursor-pointer"}
              >
                {formatBandName(bandCategory, band)}
              </Label>
            </motion.div>
          ))}
        </motion.div>
      </CardContent>

      {/* Inline error — persistent until next operation */}
      {error && !isLocking && (
        <div className="px-6 pb-2">
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircleIcon className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Screen reader live region for operation results */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isLocking ? t("cell_locking.band_locking.card_live_region", {
          category_label: t(`cell_locking.band_locking.card_category_label.${bandCategory}`),
        }) : ""}
      </div>

      {!readOnly && (
        <CardFooter className="flex flex-wrap items-center justify-between gap-2 mt-4">
          <div className="flex items-center gap-2">
            <SaveButton
              onClick={handleLock}
              isSaving={isLocking}
              saved={saved}
              label={t("cell_locking.band_locking.card_buttons.lock_selected")}
              disabled={isDisabled || noneSelected || !hasChanges}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleUnlockAll}
              disabled={isDisabled || isAllUnlocked}
              aria-label={t("cell_locking.band_locking.card_buttons.unlock_all_aria")}
              title={t("cell_locking.band_locking.card_buttons.unlock_all_title")}
            >
              <RotateCcwIcon />
            </Button>
          </div>
          {/* Quick actions row */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSelectAll}
              disabled={isDisabled}
            >
              {t("cell_locking.band_locking.card_buttons.select_all")}
            </Button>
            <Button
              variant="outline"
              onClick={handleSelectNone}
              disabled={isDisabled}
            >
              {t("cell_locking.band_locking.card_buttons.deselect_all")}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default BandCardsComponent;
