# Design Brief: Connection Scenarios rebuild

> Status: CONFIRMED 2026-05-31. Ready for build pass.
> Origin: `/impeccable critique` of Custom SIM Profile (P1 finding) → `/impeccable shape connection scenarios`.
> Target files: `components/cellular/custom-profiles/connection-scenarios/*`, `types/connection-scenario.ts`, `DESIGN.md`.

## 1. Feature Summary
Connection Scenarios control the modem's radio/RF layer (network mode + LTE/NR band locks) and sit one tier above SIM Profiles. The surface lets an operator pick a scenario (3 built-in: Balanced / Gaming / Streaming, plus custom), preview its exact config, and activate it, with manual selection locked out when a profile's schedule is driving scenarios. The rebuild keeps every behavior and moves the visuals from a consumer-router gradient aesthetic into QManager's grouped-card system.

## 2. Primary User Action
Select a scenario and read what it will do to the radio before committing to Activate. The two-step "preview, then activate" is the safety beat: changing bands/mode can drop the connection.

## 3. Design Direction
- **Color strategy:** Restrained. Per-scenario identity is one accent at <=10% of the card (icon chip + 1px accent hairline + selection ring), never a fill, never behind text.
- **Scene sentence:** A field technician on a laptop at a desk, occasionally a tablet roadside in daylight, choosing which radio profile to switch to before a deliberate, connection-affecting change. Calm, legible both themes, no white-on-saturated.
- **Anchors:** macOS System Settings, the sibling SIM `ProfileCard`, the `ProfileConfigPills` readout.
- **Probes:** skipped (no native image generation).

### Accent system (the key decision) — CONFIRMED to add tokens
Dedicated, documented "scenario accent" ramp, distinct from the functional palette:
- 6 OKLCH hues at deliberately low chroma (~0.09-0.13) so they read as category tags, not status. The chroma gap from functional colors (0.18-0.245) is what keeps them inside the Functional-Color Promise.
- Hue-separated from functional hues (green 149 / amber 75 / red 27 / info-blue 255 / indigo 264) and Stream Violet (303).
- Each ships as a tint (bg ~12%) + text/icon shade verified >=4.5:1 in BOTH themes.
- New documented token group `--scenario-accent-1..6` in DESIGN.md, explicitly non-functional.
- Default scenarios get fixed assignments; custom scenarios pick from the 6 via the curated picker.

## 4. Scope
Production-ready. Whole sub-surface: scenario grid (`scenario-item`, `add-scenario-item`), config readout (`active-config-card`), orchestrator (`connection-scenario-card`), add/edit dialogs, and delete `abstract-pattern` entirely.

## 5. Layout Strategy
Keep the two-row composition (CONFIRMED: grid + readout, restyle):
- **Row 1 grid:** selectable mini grouped-cards (2 -> 4 cols). Accent icon chip, name (Title token), one-line mode summary, thin accent hairline. Selected = `ring-muted-foreground/40`; active = accent ring. Add tile = calm dashed-to-solid grouped card, no hover:scale.
- **Row 2 readout (`ActiveConfigCard`):** same structure (mode, optimization, LTE/NSA/SA band rows), accent icon chip instead of gradient, `ServiceStatusBadge` for active/locked/applying/idle, real label<->value weight contrast in `ConfigRow`.

## 6. Key States
default / selected / active (ring + icon-badge, never color-only) · schedule-locked (info badge + next-change line) · activating (info badge + spinner, Activate disabled) · loading (skeletons matching new heights) · empty custom set (3 defaults always show; Add tile teaches) · delete-confirm / add / edit dialogs (theme picker -> curated accent picker) · error toasts (keep copy).

## 7. Interaction Model
Click tile -> select/preview. Click Activate -> apply (no confirm; RF change is reversible, unlike IMEI). Motion rewrite: remove `type:"spring"`, `whileHover/whileTap` scale, `hover:scale-105`. Selection ring + entrance use EXPO `cubic-bezier(0.16,1,0.3,1)` ~200ms; stagger may stay on the EXPO curve. No scale transforms. Reduced-motion respected.

## 8. Content Requirements
No new copy. Reuse `scenarios.*` keys. Repurpose `theme_label` -> accent label (or add `accent_label`). Migration shim `gradientToAccent(gradient): ScenarioAccentId` maps legacy persisted `gradient` strings to the nearest new accent. New optional `accent` field on the type; `gradient` kept deprecated/ignored for back-compat read. Backend stores `gradient` but never reads it, so this is frontend-only.

## 9. Recommended References (build pass)
colorize.md (accent token group + contrast pairings) · quieter.md (de-loud execution) · harden.md (badge a11y, contrast both themes, i18n + migration edges) · polish.md (consistency sweep vs sibling SIM ProfileCard).

## 10. Decided
Token group: ADD. Two-step model: KEEP. Picker: curated 6-chip. Motion: EXPO, no scale. Badges: `ServiceStatusBadge`. `abstract-pattern`: DELETE.
