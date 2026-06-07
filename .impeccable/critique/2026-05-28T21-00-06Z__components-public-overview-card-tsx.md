---
target: unauthenticated Overview page
total_score: 35
p0_count: 0
p1_count: 2
timestamp: 2026-05-28T21-00-06Z
slug: components-public-overview-card-tsx
---
# Critique — Unauthenticated Overview page (`components/public/overview-card.tsx`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Skeleton mirrors layout, stale chip, escalating empty state, gated sr-only announcer. Exemplary. |
| 2 | Match System / Real World | 4 | Real units, "3 active" + full list in tooltip. Speaks the audience's vocabulary. |
| 3 | User Control and Freedom | 3 | No manual refresh in normal state; uncancellable hard redirect to /setup/. |
| 4 | Consistency and Standards | 4 | Shared tone map, eyebrow class, No-Header-Icon contract honored. |
| 5 | Error Prevention | 4 | Read-only pre-login surface; nothing destructive. |
| 6 | Recognition Rather Than Recall | 3 | Band rows rely on a distant column eyebrow to label RSRP; aggregate bars self-label inline. |
| 7 | Flexibility and Efficiency | 3 | LuCI passthrough + theme toggle are good shortcuts; no poll control. |
| 8 | Aesthetic and Minimalist Design | 4 | Restrained, dense-but-earned, card-less trios avoid nested chrome. |
| 9 | Error Recovery | 4 | stale chip -> dim -> EmptyState w/ retry after 3 failures. |
| 10 | Help and Documentation | 2 | No threshold hints (what's a "good" RSRP); acceptable for audience but a gap. |
| **Total** | | **35/40** | **Excellent (top of the realistic band)** |

## Anti-Patterns Verdict

**Not AI slop.** Deterministic detector: clean (0 of 27 patterns). LLM review agrees: no hero-metric template, no identical-card grid, no gradient text, no glassmorphism, no solid badges. The bandwidth pill is correctly a muted data pill (`bg-muted/60` + `border-border`), not a misused status badge. Color is never the sole carrier (every tone pairs a lucide icon; `*-on-surface` tokens chosen for 4.5:1 in both themes). Both assessments converge: a UniFi/Linear-fluent user would trust this surface.

## Overall Impression

Genuinely well-built. The degradation state machine and the delta-gated screen-reader announcer are sophistication a generator never produces. The single biggest opportunity is that this is the *first screen of a modem GUI* and it ships as three flat stacked trios with no focal anchor, while DESIGN.md explicitly reserves the FastMile circular signal meter for exactly this overview. The eye has no hero to land on.

## What's Working

1. **The degradation state machine** (renderBody, lines 469-516): skeleton -> setup redirect -> fetch-error empty -> failure-threshold empty -> unavailable -> stale -> live. The `FAILURE_EMPTY_STATE_THRESHOLD = 3` gate stops lying about liveness without flapping on one dropped poll.
2. **The delta-gated sr-only announcer** (lines 320-360): encodes the verdict as `quality|connection|tempBand` and announces only changed segments, so the 5s poll never spams a screen reader.
3. **Color-is-never-alone discipline** carried through correctly: `qualityVisual` always pairs tone + icon; per-band fill is tinted by its own quality so weak SINR under strong RSRP surfaces immediately.

## Priority Issues

**[P1] No hero widget — first screen violates the Mosaic Rule and skips the signature Circular Signal Meter.**
Why it matters: This is the 30-second-clarity test case. A glance should land on one health verdict; instead the eye must read three sections to assemble it, and the surface reads flatter than the product's own aspiration.
Fix: Promote the "Overall" verdict into a hero — the Nokia-FastMile circular meter (center = worst-of-three quality, arc grows 400ms ease-out-quart) or at minimum a larger verdict tile spanning the top, with Carrier/Network/Bands demoted to a supporting strip.

**[P1] Temperature thermal-danger is invisible to sighted users (likely bug).**
The cell computes `TEMP_WARN`/`TEMP_DANGER` -> `tempBand` for the announcer, but the visible Temperature StatusCell (lines 663-668) passes no `tone`, so it renders `text-foreground` at any temperature. A modem at 78C looks identical to one at 40C on screen. Danger is announced to screen readers but not shown visually — an inverted accessibility gap, and a safety concern for a field tech beside a hot device.
Fix: Map `tempBand` to a tone (warn -> warning, danger -> destructive) and pass it to the StatusCell, same as the signal cells.

**[P2] BandRow horizontal rhythm — uniform `gap-3` + left-aligned `w-12` label creates a dead gap and splits the label/pill unit.** (User's explicit nitpick — confirmed real.)
A band label is 2-3 glyphs ("N41"). Left-aligned in fixed `w-12` (48px) it leaves ~22px trailing whitespace *inside its own column*, then `gap-3` (12px) adds on top: ~34px of empty space before the bandwidth pill, while pill->bar and bar->value are a clean 12px. The pill reads as a separate cluster instead of "the channel width of this band." Band identity (label + pill) should read as one unit.
Fix (cheapest, best cost/benefit): right-align the label inside `w-12` (`text-right`) so it butts against the pill while the column edge stays fixed for cross-row alignment. Better: nest label+pill in a tight `gap-2` cluster, keep `gap-3` to the bar and value.

**[P2] Silent hard redirect to `/setup/` (lines 314-318).**
`window.location.href = "/setup/"` is a full-reload navigation the user cannot cancel. On a flaky field link a misclassified `setup_required` bounces them out with no recourse. Conflicts with the "make the dangerous deliberate" principle.
Fix: route via Next client nav (`router.push`) and/or surface a "Go to setup now" affordance rather than an instant forced jump.

**[P3] Band rows lack inline unit/metric hints + no threshold help (heuristic 10 = 2/4).**
The RSRP column is labeled only by a distant eyebrow; first-time hobbyists get no "what's a good number" affordance.
Fix: a tooltip on RSRP/RSRQ/SINR labels giving good/fair/poor cutoffs; keep the column eyebrow visually tied to its value column on wide `@container` widths.

## Persona Red Flags

**Field tech on a tablet in direct sun (project persona):** Temperature danger is invisible (P1 bug) — the one reading that signals "your hardware is cooking" looks calm. No hero verdict means a half-second glance in glare doesn't resolve to a single healthy/unhealthy read; they must parse three trios.

**Jordan (first-timer / hobbyist):** RSRP/RSRQ/SINR have no inline explanation or threshold hint; the right-hand band number is labeled only by a far-off eyebrow. They can read the values but can't judge whether -95 dBm is good.

**Alex (power user):** Well served — LuCI passthrough, theme toggle, dense per-band readout, full band list in tooltip. Minor: no way to pause/force the 5s poll.

## Minor Observations

- `react-icons/si` (`SiOpenwrt`) adds a second icon library alongside lucide for one button — confirm intentional vs. a lucide equivalent.
- Skeleton hardcodes 3 band rows; a 1-band device gets a brief over-tall skeleton that settles shorter — a small reverse-shift on the transition the skeleton exists to prevent.
- `<img>` for the logo rather than `next/image` is likely deliberate for static-export; `alt="" aria-hidden` is correctly done.
- Status-trio gap jumps `gap-4` (base) -> `gap-3` (`@[18rem]`); harmless but the one place a section-internal gap exceeds the inter-section feel at narrow widths.
