import type { NetworkEventType } from "@/types/modem-status";

/** Human-readable labels for each event type */
export const EVENT_LABELS: Record<NetworkEventType, string> = {
  network_mode: "Mode Change",
  band_change: "Band Change",
  pci_change: "Cell Handoff",
  ca_change: "Carrier Aggregation",
  nr_anchor: "5G Anchor",
  signal_lost: "Signal Lost",
  signal_restored: "Signal Restored",
  internet_lost: "Internet Lost",
  internet_restored: "Internet Restored",
};

/** Tab categories used by the monitoring Network Events card */
export type EventTabCategory = "bandChanges" | "caEvents" | "networkEvents";

/** Maps each NetworkEventType to its tab category */
export const EVENT_TAB_CATEGORIES: Record<NetworkEventType, EventTabCategory> =
  {
    band_change: "bandChanges",
    ca_change: "caEvents",
    network_mode: "networkEvents",
    nr_anchor: "networkEvents",
    pci_change: "networkEvents",
    signal_lost: "networkEvents",
    signal_restored: "networkEvents",
    internet_lost: "networkEvents",
    internet_restored: "networkEvents",
  };
