---
target: scenario binding + scheduler (custom profile form)
total_score: 29
p0_count: 0
p1_count: 3
timestamp: 2026-05-30T05-08-04Z
slug: iles-scenario-binding-scenario-binding-section-tsx
---
# Critique: Scenario Binding + Scheduler (Custom Profile form)

Target: `components/cellular/custom-profiles/scenario-binding/` hosted in `custom-profile-form.tsx`.
Register: product. Assessments: LLM design review + deterministic detector (isolated).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No live "active now / next change at HH:MM" readout though the lib exposes `nextChangeAt()` |
| 2 | Match System / Real World | 3 | "Block N" is engineer jargon, not a schedule mental model |
| 3 | User Control and Freedom | 3 | No per-block disable; must delete to silence a rule |
| 4 | Consistency and Standards | 4 | Reuses ScenarioPicker / Field / Switch / ToggleGroup; brand-correct |
| 5 | Error Prevention | 3 | Overlap is warn-only; "first-in-array wins" invisible, no reorder |
| 6 | Recognition Rather Than Recall | 2 | Expanded blocks show raw controls, no human summary per block |
| 7 | Flexibility and Efficiency | 3 | No duplicate-block, no day presets (Weekdays/Weekends) |
| 8 | Aesthetic and Minimalist Design | 2 | Expanded = long stack of identical bordered boxes; chrome drowns signal |
| 9 | Error Recovery | 3 | Form-level "schedule invalid" lands at bottom, no scroll-to-block |
| 10 | Help and Documentation | 3 | Good inline hints; overlap rule unexplained |
| **Total** | | **29/40** | **Good foundation, dragged down by #6 and #8 in the expanded multi-block state** |

## Anti-Patterns Verdict

Deterministic scan: CLEAN (0 of 27 patterns) on the scenario-binding directory.

LLM assessment: Not AI slop. No side-stripe borders, no gradient text, no glassmorphism, no hero-metric template. The real smell is structural: outer profile Card -> bordered enable-toggle row -> N bordered "Block" cards -> bordered controls = three nested levels of `rounded-lg border`. Not technically a `<Card>` nesting violation, but to the eye it reads as nested-box repetition. With 2-3 blocks stacked it is the single biggest contributor to "big and overwhelming."

## Cognitive Load (expanded state: open + toggle ON + 3 blocks)

~26 simultaneous decision points on one screen under ONE submit button (9 identity/APN fields + default picker + toggle + ~4x3 block controls + add/submit/cancel).

FAIL: single focus, chunking, visual hierarchy, one-thing-at-a-time, working memory (5 fails -> CRITICAL).
PASS: grouping, minimal-choices-per-control, progressive disclosure.

Critical caveat: the COLLAPSED default state is fine (one chevron row). Progressive disclosure at the top level is what saves this design. Overwhelm is localized to the fully-expanded multi-block state.

## The Multi-Step Question (central)

Recommendation: do NOT build a wizard/stepper.

For: enforces one-thing-at-a-time, fixes single-focus and working-memory.
Against (stronger here): PRODUCT.md anti-references explicitly name "consumer-router apps that hide power behind wizards." Alex (power user) creates profiles repeatedly and wants one fast surface. Touchstones (Linear, Raycast, UniFi) are single-surface and dense. A wizard adds click-depth to the 90% no-schedule case and undercuts "Competence, fast."

Right fixes (targeted, not structural), priority order:
1. P1 - Collapse each block to a human summary row ("Weekdays 22:00-06:00 -> Balanced"), expand only the active block. Kills the nested-box stack, fixes #6 and working memory. `formatHhmm` + day grouping already in the lib.
2. P1 - Fix `key={i}` on the block list (scenario-binding-section.tsx:179): index keys + mid-list removal = wrong focus, mismatched useId labels, mis-targeted aria-live. Use a stable per-block id.
3. P1 - Make overlap precedence resolvable: reorder affordance or copy that states which block wins.
4. P2 - Rename "Block", explain overlap consequence, anchor the form-level error to the bad block.
5. P3 - Strategic: lift scheduling out of the create flow ("Manage schedule" on an existing profile).

## Persona Red Flags

Alex (power user): cannot reorder blocks yet "first-in-array wins" decides conflicts; no duplicate/day-presets; bottom-anchored generic "schedule invalid" forces hunting the bad block.

Jordan (first-timer): "Block 1/2" reads like dev output; overlap warning never states the consequence; overnight wrap (22:00-06:00 crossing midnight) is unsignalled.

Sam (a11y): `key={i}` reindex breaks focus/label/announcement on delete (P1); day-chip FieldLabel not tied to ToggleGroup via aria-labelledby; overlap `<p>` has no role="alert" (note: it IS inside the aria-live region, contrary to first read, but polite in-place text changes announce unreliably). Native time inputs and Radix aria-pressed chips are genuinely good.

## What's Working

1. Top-level progressive disclosure: collapsed-by-default + schedule gated behind the toggle means the 90% case never sees any of this.
2. Real resilience states: picker skeleton, dashed empty state with default name interpolated, deleted-scenario fallback item.
3. Brand-correct primitives: tabular-nums time inputs, Separator not a nested Card, no solid badges, no header icons.
