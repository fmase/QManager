---
target: Traffic Engine redesign
total_score: 32
p0_count: 0
p1_count: 2
timestamp: 2026-05-30T07-05-50Z
slug: app-local-network-traffic-engine-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Live halo dot, packet ledger, rate, sparkline, status badge, aria-live throughout. Exemplary. |
| 2 | Match System / Real World | 3 | "Masquerade", "SNI", "desync repeats" are deep jargon; only desync has a tooltip. |
| 3 | User Control and Freedom | 3 | Takeover confirm + URL-synced mode are strong; no cancel on in-flight install/test. |
| 4 | Consistency and Standards | 3 | Badge/mosaic/SaveButton contracts honored; result-alert tints drift between the two modes. |
| 5 | Error Prevention | 4 | Takeover dialog, destructive uninstall hidden while running, numeric + domain guards. |
| 6 | Recognition Rather Than Recall | 3 | Custom-domain marker + counts help; desync value choice unexplained inline. |
| 7 | Flexibility and Efficiency | 3 | Import/export/sort/Enter-to-add for power users; no shortcut to toggle the engine. |
| 8 | Aesthetic and Minimalist Design | 3 | Hero is beautiful; twin confidence surfaces make the video view a long vertical stack. |
| 9 | Error Recovery | 3 | Retry, install-error detail, save-fail toasts; errors rarely say what to do next. |
| 10 | Help and Documentation | 2 | One tooltip in the whole surface; SNI / masquerade / packets metric unexplained. |
| **Total** | | **32/40** | **Strong. Gaps cluster in jargon/help and twin-surface length.** |

## Anti-Patterns Verdict

**Not AI slop.** Hand-rolled SVG sparkline with dash-draw, layoutId sliding toggle, breathing halo dot keyed to live state, genuine 55/45 asymmetric hero. The "mutex made legible" IA is a real product insight.

**Deterministic scan: 0 findings (clean).** `impeccable detect` flagged nothing across all 11 components. No side-stripe borders, no gradient text, no glassmorphism, no identical card grids, Manrope-only, tabular-nums consistent.

**One borderline:** the hero silhouette (5xl/6xl number + tiny uppercase caption + supporting rate/uptime/sparkline) sits close to the banned hero-metric template; rescued by asymmetric layout and no gradient accent, but the central composition is still "one giant number with a caption."

## Priority Issues

**[P1] Jargon with almost no inline help.** "Masquerade", "SNI", "desync repeats", "domains protected", "packets processed" carry exactly one tooltip total. Field techs on a roadside tablet won't read docs. Fix: extend the InfoIcon tooltip pattern to SNI, the masquerade concept, and "domains protected"; give onboarding a one-line plain-language "what each mode does."

**[P1] Hero reports an undirected engine counter as "throughput," and the app's signature traffic-direction visual goes unused on the one screen named after traffic.** The hero shows cumulative `packetsProcessed` + pkt/s, never ingress/egress, never the Telemetry-Blue-down / Stream-Violet-up pair. Either show direction in the contract colors, or reframe the hero so it doesn't promise throughput it can't show.

**[P2] Twin confidence surfaces lengthen the surface and dilute the mosaic.** Video's Verify card and Masquerade's Test card are structural twins stacked below an already-tall hero + tiles (+ hostlist in video). A mid-day glance scrolls past a lot. Fix: collapse into a compact inline result chip on the hero, expand to stepped detail on demand.

**[P3] Result-alert tints drift between modes.** `bg-success/5` vs `bg-success/10` vs `bg-destructive/10` hand-rolled per alert, bypassing any shared token. Extract one `<ResultAlert tone>` wrapper so the twins can't drift.

## Persona Red Flags

**Field tech on a roadside tablet (quick check):** lands on "packets processed" and a pkt/s rate, neither of which answers "is my video unblocked / is my upload disguised." Must decode "Masquerade" with no inline help.

**Power user (focused config):** well served (import/export, sort, Enter-to-add, URL-synced mode), but cannot toggle the engine or bulk-remove pills from the keyboard; no safe preview of a mode before flipping it on a live link.
