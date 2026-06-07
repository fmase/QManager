# Antenna Alignment

- Route: `/cellular/antenna-alignment`. No CGI — reads `useModemStatus` (`signal_per_antenna`).
- Structure: `antenna-alignment.tsx` (coordinator) + `antenna-card.tsx` + `alignment-meter.tsx` + `utils.ts`.
- Shared constant: `ANTENNA_PORTS` from `types/modem-status.ts` (re-exported via local `utils.ts`).
- **Signal quality gotcha**: `getSignalQuality()` returns **lowercase** (`excellent`/`good`/`fair`/`poor`/`none`). All switch/map consumers must use lowercase.
- Alignment Meter: 3-slot recorder, averages 3 samples per slot. Composite score = 60% RSRP + 40% SINR (primary antenna, NR preferred in EN-DC). Recommendation appears after 2+ slots.
- Two antenna types (user-selectable toggle): Directional (0°/45°/90°) + Omni (A/B/C), labels editable.
- Recording progress uses `Loader2Icon` + dots (not fill bars). `detectRadioMode()` returns `lte`/`nr`/`endc`.
