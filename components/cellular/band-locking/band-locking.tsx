"use client";

import { useMemo, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import BandCardsComponent from "./band-cards";
import BandSettingsComponent from "./band-settings";
import { useBandLocking } from "@/hooks/use-band-locking";
import { useModemStatus } from "@/hooks/use-modem-status";
import { useConnectionScenarios } from "@/hooks/use-connection-scenarios";
import {
  parseBandString,
  getBandsForCategory,
  type BandCategory,
} from "@/types/band-locking";
import { DEFAULT_SCENARIOS } from "@/types/connection-scenario";
import { InfoIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// =============================================================================
// BandLockingComponent — Page Coordinator
// =============================================================================
// Owns all hooks and distributes data to child components via props.
//
// Data sources:
//   useModemStatus()          → supported_*_bands, carrier_components
//   useBandLocking()          → currentBands, failover, lock/unlock actions
//   useConnectionScenarios()  → activeScenarioId (for scenario override check)
//
// Scenario override:
//   When a non-Balanced scenario is active, band cards are disabled and an
//   info banner is shown. This keeps the mental model clean: the scenario
//   "owns" RF configuration. Switch to Balanced for manual band control.
// =============================================================================

const BandLockingComponent = () => {
  const { t } = useTranslation("cellular");
  const { data, isLoading: statusLoading } = useModemStatus();
  const {
    currentBands,
    failover,
    isLoading: bandsLoading,
    lockingCategory,
    error,
    lockBands,
    unlockAll,
    toggleFailover,
  } = useBandLocking();
  const {
    activeScenarioId,
    customScenarios,
    isLoading: scenariosLoading,
  } = useConnectionScenarios();

  // --- Shared SA / NR-DC slot -----------------------------------------------
  // The third card slot toggles between SA NR5G and NR-DC via a swap control.
  // Both target distinct AT params (nr5g_band vs nrdc_nr5g_band); only one is
  // shown at a time so the page keeps its uniform three-card rhythm.
  const [saSlotView, setSaSlotView] = useState<"sa_nr5g" | "nrdc_nr5g">(
    "sa_nr5g",
  );
  const swapTargetView = saSlotView === "sa_nr5g" ? "nrdc_nr5g" : "sa_nr5g";

  // --- Scenario override check ----------------------------------------------
  const isScenarioControlled = activeScenarioId !== "balanced";

  const activeScenarioName = useMemo(() => {
    if (!isScenarioControlled) return "";
    // Check defaults first
    const defaultMatch = DEFAULT_SCENARIOS.find(
      (s) => s.id === activeScenarioId,
    );
    if (defaultMatch) return defaultMatch.name;
    // Check custom scenarios
    const customMatch = customScenarios.find((s) => s.id === activeScenarioId);
    if (customMatch) return customMatch.name;
    // Fallback — ID without prefix
    return activeScenarioId;
  }, [activeScenarioId, isScenarioControlled, customScenarios]);

  // --- Band card definitions (translated) -----------------------------------
  // LTE + NSA are fixed cards; the third slot (SA / NR-DC) is rendered
  // separately below because it carries the swap control.
  const bandCards = useMemo(() => [
    { category: "lte" as BandCategory, title: t("cell_locking.band_locking.cards.lte.title"), description: t("cell_locking.band_locking.cards.lte.description") },
    { category: "nsa_nr5g" as BandCategory, title: t("cell_locking.band_locking.cards.nsa_nr5g.title"), description: t("cell_locking.band_locking.cards.nsa_nr5g.description") },
  ], [t]);

  // --- Derive supported bands from poller boot data -------------------------
  const supportedBands: Record<BandCategory, number[]> = {
    lte: parseBandString(data?.device.supported_lte_bands),
    nsa_nr5g: parseBandString(data?.device.supported_nsa_nr5g_bands),
    sa_nr5g: parseBandString(data?.device.supported_sa_nr5g_bands),
    nrdc_nr5g: parseBandString(data?.device.supported_nrdc_nr5g_bands),
  };

  // --- Derive active bands from carrier_components (QCAINFO) ----------------
  const carrierComponents = data?.network.carrier_components ?? [];

  // Overall loading: either poller hasn't loaded yet or bands haven't loaded
  const isPageLoading = statusLoading || bandsLoading || scenariosLoading;

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {t("cell_locking.band_locking.page.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("cell_locking.band_locking.page.description")}
        </p>
      </div>

      {/* Scenario override banner */}
      {isScenarioControlled && !isPageLoading && (
        <Alert className="mb-4">
          <InfoIcon className="size-4" />
          <AlertDescription>
            <p>
                <Trans
                  i18nKey="cell_locking.band_locking.scenario_override_banner"
                  ns="cellular"
                  values={{ scenario_name: activeScenarioName }}
                  components={{ strong: <span className="font-semibold" /> }}
                />
              </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <BandSettingsComponent
          failover={failover}
          carrierComponents={carrierComponents}
          onToggleFailover={toggleFailover}
          isLoading={isPageLoading}
          isScenarioControlled={isScenarioControlled}
        />
        {bandCards.map(({ category, title, description }) => (
          <BandCardsComponent
            key={category}
            title={title}
            description={description}
            bandCategory={category}
            supportedBands={supportedBands[category]}
            currentLockedBands={
              currentBands
                ? parseBandString(getBandsForCategory(currentBands, category))
                : []
            }
            onLock={(bands) => lockBands(category, bands)}
            onUnlockAll={() => unlockAll(category, supportedBands[category])}
            isLocking={lockingCategory === category}
            isLoading={isPageLoading}
            error={error}
            disabled={isScenarioControlled}
          />
        ))}

        {/* Shared SA / NR-DC slot — key remounts the card on swap so its
            checkbox state re-initializes from the new mode's locked bands and
            the entrance animation replays as a visible "mode changed" cue. */}
        <BandCardsComponent
          key={saSlotView}
          title={t(`cell_locking.band_locking.cards.${saSlotView}.title`)}
          description={t(
            `cell_locking.band_locking.cards.${saSlotView}.description`,
          )}
          bandCategory={saSlotView}
          supportedBands={supportedBands[saSlotView]}
          currentLockedBands={
            currentBands
              ? parseBandString(getBandsForCategory(currentBands, saSlotView))
              : []
          }
          onLock={(bands) => lockBands(saSlotView, bands)}
          onUnlockAll={() => unlockAll(saSlotView, supportedBands[saSlotView])}
          isLocking={lockingCategory === saSlotView}
          isLoading={isPageLoading}
          error={error}
          disabled={isScenarioControlled}
          readOnly={saSlotView === "nrdc_nr5g"}
          onSwapView={() => setSaSlotView(swapTargetView)}
          swapLabel={t(
            `cell_locking.band_locking.card_category_label.${swapTargetView}`,
          )}
          swapTitle={t("cell_locking.band_locking.card_buttons.swap_view", {
            target: t(
              `cell_locking.band_locking.card_category_label.${swapTargetView}`,
            ),
          })}
        />
      </div>
    </div>
  );
};

export default BandLockingComponent;
