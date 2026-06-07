---
target: Traffic Engine page (skeletons & motion)
total_score: 31
p0_count: 1
p1_count: 2
timestamp: 2026-05-30T13-51-42Z
slug: ts-local-network-traffic-engine-traffic-engine-tsx
---
# Traffic Engine — critique (skeletons & motion focus)

Target: `components/local-network/traffic-engine/traffic-engine.tsx` (+ component dir)

## Design health: 31/40 — "Good, ship-worthy with targeted fixes"

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 3 | Column-2 pops in on a separate clock; ~1s idle dead-beat after enable |
| 2 | Match real world | 3 | Masquerade/SNI/desync jargon; only desync has a tooltip |
| 3 | Control & freedom | 3 | Takeover + remove confirm; no undo after takeover |
| 4 | Consistency | 4 | Shared EnableRow/CheckRow/ResultAlert/SaveButton — twin-parity by construction |
| 5 | Error prevention | 3 | Inline validation good; connection-sever only warned, not stated |
| 6 | Recognition | 3 | Active-mode dot tiny; ownership-from-other-tab only in prose |
| 7 | Flexibility | 3 | Import/export/sort; no keyboard mode switch |
| 8 | Aesthetic/minimal | 4 | Calm System-Settings register, anti-hero discipline |
| 9 | Error recovery | 3 | ResultAlert tones clear; backend copy terse |
| 10 | Help & docs | 2 | One tooltip; no explanation of what Verify/Test prove |

## Anti-patterns: PASS (detector 0/27)
No side-stripe borders, gradient text, glassmorphism, hero-metric, identical card grids, or em dashes. Faint tells: `SparklesIcon` as custom-domain marker (LLM cliché); onboarding empty-state is the most template-shaped block.

## Priority issues
- **P0 — Skeleton ignores the 2-column grid.** `StackSkeleton` is a single stack with no grid wrapper and no column-2 placeholder; loaded view is `@3xl:grid-cols-2` with a full-height CDN card on its own loading gate. Guaranteed 1-col→2-col layout jump at width + late column-2 pop-in, every load. Fix: skeleton mirrors the grid, reuse HostlistSkeleton in column 2, fold the hostlist loading into the page gate, add a fast-load flash guard.
- **P1 — SaveButton breaks the motion contract.** Spring stiffness 400 / damping 22 = ζ≈0.55 (underdamped → bounce), and no `useReducedMotion` in the file. Shared primitive used 3× here, app-wide elsewhere. Fix: expo duration ease + reduced-motion gate.
- **P1 — Uncoordinated triple animation on tab switch.** Panel crossfade 0.32s + column `layout` 0.4s + sibling CDN AnimatePresence 0.32s fire independently while the grid collapses 2→1 col. Fix: match durations / keep column 2 mounted and fade content only.
- **P2 — `layout` container re-eases on routine polls/results.** The column `layout` wraps the 1s-poll status card and the verify/test ResultAlert mount, so results slide neighbors 0.4s on every result. Fix: scope `layout` to the panel swap (`layout="position"` or move the flag onto the tab-panel wrapper).
- **P2 — ~1s idle dead-beat after a connection-affecting enable.** Badge stays "Idle"/stats "—" until the refresh confirms `running`. Fix: optimistic "Starting…" state.
- **P3 — Hardcoded English in SaveButton** ("Saving…", "Saved!", "Save Settings") on a fully i18n'd page. Fix: localize via props/namespace.

## What's working
1. Twin-parity by construction (shared EnableRow/CheckRow/ResultAlert/SaveButton).
2. Safety choreography: remove is idle-only + quiet + gated; takeover names both modes; no control in the status card.
3. Anti-hero discipline: three equal quiet tabular readouts, no giant number.

## Persona red flags
- **Field tech, tablet, sunlight:** 6px active-mode dot invisible; 12px sparkle marker invisible; the idle dead-beat reads as failure → double-toggle.
- **Power user, laptop:** 2→1 col reflow wastes half the viewport; uncoordinated animation is noticed by the polish-sensitive user; `layout` re-ease on every Verify result.
- **First-timer:** no tooltip for Masquerade/SNI; takeover dialog explains the mutex, never the function.

## Minor
- `aria-live="polite"` on the 1s-ticking stats → screen reader announces every poll; should live on badge-state change only. Same doubling on CheckRow + CDN content.
- `"speedtest.net"` default hardcoded in 3 places.
- HostlistSkeleton list block `h-40` won't reach the `h-full` real card bottom.
- Sort `null` state shows same glyph as nothing-applied.
