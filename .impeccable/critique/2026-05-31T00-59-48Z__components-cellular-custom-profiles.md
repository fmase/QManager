---
target: the entirety of Custom SIM Profile
total_score: 32
p0_count: 0
p1_count: 1
timestamp: 2026-05-31T00-59-48Z
slug: components-cellular-custom-profiles
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Pipeline hero + live status dot + save flash + active-now readout. Reference-grade. |
| 2 | Match System / Real World | 4 | Speaks the operator's language (APN, CID, TTL/HL, MPDN, ICCID) with real consequences in plain words. |
| 3 | User Control and Freedom | 3 | Cancel everywhere; deactivate-≠-revert is spelled out; apply dialog correctly non-dismissible until terminal. No undo on delete. |
| 4 | Consistency and Standards | 2 | Two design languages. The core is impeccable; Connection Scenarios is a different product (rainbow gradients, text-white, springy motion, hand-rolled badges). |
| 5 | Error Prevention | 4 | Verizon confirm, IMEI reboot warning, CID lock, range validation, schedule validation with focus-first-error, SIM mismatch detection. |
| 6 | Recognition Rather Than Recall | 3 | Config pills + live summary preview show what a profile does without opening it. Edit/Delete behind a kebab. |
| 7 | Flexibility and Efficiency | 3 | Load-current-SIM prefill, MNO presets, scheduling. No keyboard accelerators (not strictly needed). |
| 8 | Aesthetic and Minimalist Design | 3 | Core is beautifully minimal; scenario gradient cards + abstract patterns + 12-swatch theme picker are decorative clutter. |
| 9 | Error Recovery | 3 | resolveErrorMessage inline in the pipeline, partial/failed summaries, not-found empty state, toast errors. |
| 10 | Help and Documentation | 3 | Strong contextual hints (cid_locked_verizon, sim_iccid_hint, schedule hints, IMEI danger note) + Verizon explainer dialog. |
| **Total** | | **32/40** | **Good — the core is excellent, dragged down by one inconsistent sub-feature** |

## Anti-Patterns Verdict

**LLM assessment:** The *core* Custom SIM Profile surface (registry page, active-profile spine, profile cards, the whole editor, the apply-progress pipeline, config pills, status badge) is some of the most on-brand, design-system-faithful work in the codebase. It would never read as AI-generated. The **Connection Scenarios** sub-feature is the opposite: 12 hardcoded rainbow gradients (`from-violet-600 via-purple-600 to-indigo-700`), `text-white` overlays, `bg-white/20` glass chips, decorative "abstract pattern" SVGs, a 12-swatch theme picker, and springy `type: "spring"` + `whileTap: scale 0.97` motion. That is the consumer-router-app aesthetic (Netgear Nighthawk) named as an anti-reference, and it reads as AI slop on sight.

**Deterministic scan:** detect.mjs returned 2 `ai-color-palette` warnings, both in `connection-scenarios/connection-scenario-card.tsx` (lines 46, 94) — "Purple/violet gradients … the most recognizable tells of AI-generated UIs." The detector caught exactly the half a human reviewer flags. The rest of the surface scanned clean.

## Overall Impression

This is a tale of two surfaces sharing one folder. The core profile experience is reference-quality QManager: grouped cards, the signature sequenced-pipeline dialog, dense outline pills, deferred-reboot discipline, tabular-nums, OKLCH tokens, reduced-motion handling, focus-first-error validation. The single biggest opportunity is to delete the second design language: Connection Scenarios was built to a different (older, flashier) spec and now visually contradicts everything around it. Bring it into the grouped-card vocabulary and this surface goes from "Good" to "Excellent."

## What's Working

1. **The apply-progress pipeline dialog.** Status hero + determinate scaleX fill + supporting ledger, deferred reboot, non-dismissible until terminal, reduced-motion collapse. Textbook execution of the documented signature component.
2. **The editor's two-column "what it is / when it applies" split** with a live SummaryCard that reuses the registry's exact pill vocabulary, so preview can never drift from result. Validation focuses the first offending field and reveals the first bad schedule rule.
3. **Consequence-first safety copy.** The deactivate dialog ("will not be reverted — only the badge removed"), the Verizon MPDN explainer, and the IMEI reboot warning all state the real consequence in plain language. This is the safety principle landing.

## Priority Issues

- **[P1] Connection Scenarios is a second design language.** `scenario-item.tsx`, `connection-scenario-card.tsx`, and `active-config-card.tsx` use raw Tailwind rainbow gradients, `text-white`/`text-white/80`, `bg-white/20` glass, abstract-pattern decoration, a decorative theme picker, and spring/scale motion.
  - **Why it matters:** Violates OKLCH-only, the `#fff` ban, the Apple-instrument motion contract (no springy, no scale transforms), the Functional-Color Promise, and the consumer-router anti-reference. A user who learns the calm grouped-card language everywhere else lands here and feels they switched apps. The detector flags it as the #1 AI tell.
  - **Fix:** Rebuild scenario cards in the grouped-card vocabulary — icon in a tinted token chip (`bg-muted` / `bg-primary/10`), `ServiceStatusBadge` for state, no gradients, no abstract patterns, drop the theme picker entirely (a network-band preset doesn't need a decorative skin). Replace spring/scale motion with the system EXPO ease.
  - **Suggested command:** `/impeccable quieter` (then `/impeccable polish`)

- **[P2] Signal Indigo is over-spent in the registry grid.** Every inactive `ProfileCard` renders a solid Signal-Indigo "Activate" button. Five saved profiles = five indigo patches on one screen.
  - **Why it matters:** Breaks the Signal-Indigo Reserve ("more than two patches and one is wrong"). The accent stops reading as "the one important action."
  - **Fix:** Make grid Activate buttons `variant="outline"` or `secondary`; reserve the solid indigo for a single primary affordance (or none, since activation is per-card).
  - **Suggested command:** `/impeccable colorize`

- **[P2] Scenario status is carried by color alone.** `active-config-card.tsx` renders active/not-active as a bare colored `<div className="w-2 h-2 rounded-full">` dot inside a hand-rolled badge, instead of the mandated `variant="outline"` + `size-3` lucide icon.
  - **Why it matters:** Fails "color is never the sole carrier of meaning" (a deuteranope can't distinguish active from inactive) and re-implements the badge instead of using `ServiceStatusBadge`.
  - **Fix:** Swap to `ServiceStatusBadge` / the documented outline-badge-with-icon pattern.
  - **Suggested command:** `/impeccable harden`

- **[P3] Display heading weight drift.** Page `h1`s (`page.tsx`, `new`, `edit`) use `font-bold` (700); the DESIGN.md Display token is weight 600 (`font-semibold`).
  - **Why it matters:** Small, but it's the page title on every screen; 700 reads slightly heavier/softer than the tuned tight-600 the system specifies.
  - **Fix:** `font-bold` → `font-semibold` on the page titles.
  - **Suggested command:** `/impeccable typeset`

- **[P3] Flat hierarchy in ConfigRow.** `active-config-card.tsx` renders both label and value as `font-semibold`, so the row has no weight contrast.
  - **Why it matters:** The label should recede; equal weight makes the readout harder to scan.
  - **Fix:** Label `font-normal text-muted-foreground`, value `font-medium`/`font-semibold`.
  - **Suggested command:** `/impeccable typeset`

## Persona Red Flags

**Alex (Power User):** Smooth — load-current-SIM prefill, presets, dense pills let him read a profile without opening it. Friction: no keyboard accelerator to activate, and Edit/Delete hide behind a per-card kebab (one extra click on every profile).

**Sam (Accessibility-Dependent):** The core is strong (aria-describedby on every field, aria-invalid, focus-first-error, reduced-motion paths). Breaks in Connection Scenarios: the active/inactive state is a color-only dot, `text-white/70` and `text-white/80` on bright rainbow gradients are contrast gambles that aren't verified against the 4.5:1 outdoor-readable bar, and `whileTap: scale 0.97` isn't gated behind reduced-motion.

**Riley (Field Technician, project persona — outdoor tablet in sun):** The calm core cards stay legible in glare. The rainbow scenario cards with translucent white text are the worst-case for direct-sunlight reading — low-contrast white-on-saturated is exactly what the outdoor-readable extension exists to prevent.

## Minor Observations

- `active-profile-card.tsx` uses Tailwind's default `animate-ping` for the live dot; the system's documented pulse is the `animate-pulse-ring` keyframe in `globals.css`. Cosmetic, but `animate-ping`'s scale-to-2x is slightly more "notification" than "instrument."
- `ActiveConfigCard` uses `CardContent className="px-6"` and drops the vertical padding, diverging from the `py-6 px-6` card contract.
- Scenario cards animate entrance with `staggerChildren` — legitimate, but paired with spring physics it reads bouncier than the rest of the app.
- `connection-scenarios` heading uses `h3`/`h4` with ad-hoc `font-semibold` rather than the Headline/Title type tokens.

## Questions to Consider

- Does a network-band preset (gaming/streaming/balanced) actually need a *decorative skin*, or is that borrowed from a consumer-app mental model the rest of QManager rejects?
- If Connection Scenarios were rebuilt today against DESIGN.md, would anything about the rainbow treatment survive, or is it purely legacy?
- The core proves the team can make dense modem config feel calm and premium. Why does the scenario picker get to be loud?
