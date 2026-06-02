---
target: Custom SIM Profiles
total_score: 35
p0_count: 0
p1_count: 0
timestamp: 2026-06-02T06-55-07Z
slug: components-cellular-custom-profiles
---
# Critique — Custom SIM Profiles

Scope: registry + editor (custom-profile.tsx, profile-view.tsx, profile-input.tsx, apply-progress-dialog.tsx, empty-profile.tsx). Focus: skeleton states and Apple-class motion.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Skeletons, busy spinners, determinate apply hero, active pulse dot, toasts. |
| 2 | Match System / Real World | 4 | APN/CID/PDP/ICCID is the audience vocabulary; plain action labels. |
| 3 | User Control and Freedom | 3 | Cancel/Clear/Edit/delete-confirm present; no explicit wizard Back; no delete undo. |
| 4 | Consistency and Standards | 3 | Motion contract applied unevenly — dialog honors EXPO, list+skeleton don't. |
| 5 | Error Prevention | 4 | Duplicate-ICCID guard, required-field gating, Verizon brick dialog, CID-3 lock. |
| 6 | Recognition Rather Than Recall | 4 | Review tab restates profile; config pills; Load-from-SIM. |
| 7 | Flexibility and Efficiency | 3 | Tabs directly clickable; Load-from-SIM accelerator; no keyboard shortcuts. |
| 8 | Aesthetic and Minimalist Design | 4 | Calm, dense-pill, grouped, on-brand. |
| 9 | Error Recovery | 3 | resolveErrorMessage inline; toasts on failure. |
| 10 | Help and Documentation | 3 | Inline FieldDescription hints; no tooltips/links beyond that. |
| **Total** | | **35/40** | **Good — top of band. Polish, not rework.** |

## Anti-Patterns Verdict
Does not look AI-generated. Passes the product slop test. detect.mjs returned 2 warnings, both false positives: from-violet-600 gradient in connection-scenarios/connection-scenario-card.tsx:46,94 — the Connection Scenarios sub-surface, whose gradients are kept on purpose per explicit project decision. The Custom SIM Profiles registry + editor scanned clean. No browser overlay (no dev server running).

## What's Working
1. The apply pipeline dialog is reference-grade motion (scaleX fill, EXPO, fixed text height, calm ellipsis, reduced-motion gated).
2. Skeleton is shaped to the populated row, so no reflow on load.
3. Error prevention is thorough (duplicate ICCID, Verizon guard, CID lock, required-field routing).

## Priority Issues

### [P2] Skeleton uses opacity-blink, not the system's silky motion
components/ui/skeleton.tsx uses stock animate-pulse (fade-flash on cubic-bezier(0.4,0,0.6,1)). DESIGN.md bans value changes via fade. It's the first motion a returning user sees and the only one off-contract. Also not gated under prefers-reduced-motion. Fix: add a shimmer-sweep keyframe (translateX gradient mask, ~1.5s) as an opt-in Skeleton variant="shimmer", keep pulse as default, gate under reduced-motion. Command: /impeccable animate

### [P2] Config pills pop in after the row has animated
profile-view.tsx:408-412 swaps PillsSkeleton -> ConfigPills as an instant DOM replacement after the row already animated in — a second, uncoordinated motion. Fix: crossfade pills on resolve (200ms EXPO fade-in or AnimatePresence, already imported in the apply dialog). Command: /impeccable animate

### [P2] Row entrance is off-curve and stagger totals ~850ms
profile-view.tsx:333-336 uses animationDelay index*70ms + duration-500 on tw-animate-css default easing (not EXPO). 6 profiles => last row at ~850ms, every load. Product register bans orchestrated page-load sequences; this is the quick-check surface. Fix: ~40ms delay capped to first ~4 rows, EXPO curve, first-paint-only. Reduced-motion already handled. Command: /impeccable animate

### [P3] Editor wizard swaps steps with no transition
profile-input.tsx Identity->Network->Scenario->Review tabs hard-cut. Most-used editor interaction, currently most static. Fix: AnimatePresence directional crossfade (few px travel + opacity, EXPO ~200ms, keyed to Next/Back), reduced-motion instant. Command: /impeccable animate

### [P3] Small motion inconsistencies
Schedule windows add/remove with no enter/exit; active dot uses plain animate-pulse blink not animate-halo-breathe/pulse-ring; transition-colors has no duration/curve (default 150ms ease not 200-400ms EXPO). Command: /impeccable polish

## Persona Red Flags
- Alex (Power User): ~850ms cascade on quick-check; no keyboard shortcut to Activate (can click wizard tabs directly = plus).
- Sam (Accessibility): skeleton animate-pulse not in reduced-motion block — blink persists; everything else gated correctly.
- Casey (Mobile/field): staggered entrance replays on every revisit; fixed-height dialog text is a win.

## Minor Observations
- Skeleton uses bg-accent; bg-muted reads better for data skeletons.
- ListSkeleton always renders 2 rows; a skeleton->list crossfade would remove the last swap seam.

## Questions to Consider
- What if first paint were calm (rows present, pills crossfade in) and motion reserved for changes (activation, new profile)?
- Is the wizard's value in the steps or in seeing all four at once?
