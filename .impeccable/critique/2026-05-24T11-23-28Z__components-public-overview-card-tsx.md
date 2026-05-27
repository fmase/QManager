---
target: Live modem status card (post-redesign)
total_score: 35
p0_count: 0
p1_count: 0
p2_count: 2
p3_count: 2
timestamp: 2026-05-24T11-23-28Z
slug: components-public-overview-card-tsx
---
# Critique: Live Modem Status card (post-redesign)

Target: components/public/overview-card.tsx

## Design Health Score

| # | Heuristic | Score | Δ |
|---|-----------|------:|----|
| 1 | Visibility of System Status | 4 | = |
| 2 | Match System / Real World | 4 | +1 |
| 3 | User Control and Freedom | 3 | = |
| 4 | Consistency and Standards | 3 | = |
| 5 | Error Prevention | 4 | = |
| 6 | Recognition Rather Than Recall | 4 | = |
| 7 | Flexibility and Efficiency | 3 | = |
| 8 | Aesthetic and Minimalist Design | 3 | = |
| 9 | Error Recovery | 4 | = |
| 10 | Help and Documentation | 3 | = |
| Total | | 35/40 | +1 |

## Anti-Patterns Verdict
LLM: No AI-generated tells. Grafana-lane chosen over Nokia-lane for this surface — honest density. Per-bar quality coloring exposes weak dimension at a glance.
Deterministic: [] zero pattern matches.

## What's Working
1. Per-bar quality colors expose the weak dimension at a glance.
2. CA vocabulary is on-register for the audience.
3. Per-band RSRP in the disclosure is the right power-user payload.
4. Bar-fill motion is contract-compliant (cubic-bezier(0.16, 1, 0.3, 1), 400ms, reduced-motion honored).

## Priority Issues
- [P2] Verdict ("Poor") at text-xl is small + uses RSRP-only — disconnect from per-bar colors.
- [P2] Bars at h-1.5 (6px) feel like sub-components, not the hero.
- [P3] "CA Disabled" for single-carrier is technically misleading.
- [P3] RSRP-per-band uses ml-auto — narrow-viewport wrap risk.

## Minor
- Status word at text-xl is between label and verdict registers.
- Skeleton bars are flat-gray, don't telegraph bar shape.
- qualityTextClass and qualityBarClass nearly identical — could merge.
- Temp warning badge still full-strength when stale (bars dim).
- Header logo still violates No-Header-Icon Rule (carried over).

## Persona Red Flags
- Field Tech (sun): 6px bars hard to read; per-bar color is a win.
- Hobbyist Power User: 3 metrics + per-band RSRP in one click — quick-check upgrade.
- First-Time-After-Flash: Empty state already improved; no new regression.
