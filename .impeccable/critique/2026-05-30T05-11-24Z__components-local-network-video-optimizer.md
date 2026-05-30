---
target: Video Optimizer + Traffic Masquerade
total_score: 25
p0_count: 0
p1_count: 1
timestamp: 2026-05-30T05-11-24Z
slug: components-local-network-video-optimizer
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Strong badges/stats/step-indicators; but enabling one mode silently disables the other with no live confirmation |
| 2 | Match System / Real World | 2 | Heavy unexplained jargon at point of action (SNI, ClientHello, desync, nfqws); only one term tooltip'd |
| 3 | User Control and Freedom | 3 | Good discard/cancel/toggle-off; no undo on save, no "switch back" when one mode kills the other |
| 4 | Consistency and Standards | 2 | Twin-file drift: 6 vs 4 separators, tooltip vs FieldDescription, i18n vs hardcoded validation |
| 5 | Error Prevention | 3 | Solid validation + mutex; uninstall dialog doesn't surface whether the other mode is active |
| 6 | Recognition Rather Than Recall | 2 | Mutual exclusivity discoverable only AFTER conflict; no cross-link at rest |
| 7 | Flexibility and Efficiency | 3 | Hostlist import/export, sort, keyboard add, one-click verify/test — genuinely efficient |
| 8 | Aesthetic and Minimalist Design | 2 | Permanent full-width amber warning Alert dulls its own signal and pollutes the color system |
| 9 | Error Recovery | 3 | Good error states; hardcoded English errors won't recover for non-EN users |
| 10 | Help and Documentation | 2 | One tooltip carries all explanation; verify vs test naming split across twins |
| **Total** | | **25/40** | **Functional with clear structural fixes** |

## Anti-Patterns Verdict

**Deterministic scan:** CLEAN. `npx impeccable detect --json` returned `[]` across both component directories. No side-stripe borders, no gradient text, no glassmorphism, no hero-metric template, no modal-first.

**LLM assessment:** Human-authored, domain-grounded, token-compliant. The two-card grid is justified sibling consistency, NOT identical-card-grid slop (these are config surfaces, not dashboards — Mosaic Rule does not apply). The real risk is twin-file drift, not template slop: VO and Masquerade are near-byte-identical hand-maintained files that have already diverged.

## What's Working
1. The TestInjectionCard step indicator (read counter -> send -> read again) turns an invisible packet-injection claim into visible sequenced proof. Emotional peak; "confidence through feedback" done right.
2. Domain-specific vocabulary and the desync-repeats tooltip (explains the reliability/CPU tradeoff + gives a default). This could not be reskinned for a CRM.
3. State coverage: skeleton, error+retry, not-installed empty state, install progress, running stats, aria-live. Few surfaces ship all of these.

## Priority Issues

### [P1] Permanent warning Alert dulls its own signal and pollutes the color system
A full-width `bg-warning/10 text-warning` Alert renders on EVERY visit (VO 416-430, Masq 224-238). When no conflict exists it degrades to a permanent "Experimental" amber banner that never changes. A warning that's always on stops being a warning; it permanently tints the card amber against the green/muted status badge and blue info icon. Amber-as-decoration is explicitly forbidden (amber = caution/pending). Fix: demote permanent "experimental" to an outline badge in CardAction; reserve the full-width Alert only for the live "other mode active" conflict.

### [P2] Mutual exclusivity discoverable only after the conflict; no cross-navigation at rest
Neither page reveals that VO and Masquerade share one nfqws process until you enable one and try the other. Only cross-link is buried in the not-installed empty state. Users build a config then learn too late it's mutually exclusive. Fix: persistent quiet cross-reference ("Shares one engine with [Traffic Masquerade] — only one runs at a time") with the sibling as a Link; inline "go disable it" link in the conflict Alert.

### [P2] Uninstall: high blast radius, low-friction placement, no cross-feature awareness
"Remove nfqws" footer appears only when stopped, as size=sm destructive, and its dialog never says whether the OTHER mode is configured before removing the shared binary that kills both. Inverted disclosure: the destructive surface expands at the page's calmest moment. Fix: tuck behind an Advanced disclosure; in the dialog surface "Traffic Masquerade is configured and will also be removed."

### [P3] Masquerade SNI validation bypasses i18n while translations already exist
traffic-masquerade-settings-card.tsx 179-184 hardcodes 4 English strings; identical translated keys already exist under video_optimizer.validation_* (en JSON 254-258). Non-EN users get English errors on this one field. Fix: extract the duplicated domain-validation helper into one shared i18n'd utility.

### [P3] Separator soup flattens hierarchy
6 separators in VO form (453,480,483,494,533,548), 4 in Masq. Line 453 separates the top edge from nothing; 480+483 double-fence ServiceStats. Equal-weight hairlines every ~40px destroy hierarchy and contradict tonal-first grouping. The enable toggle (hero control) reads at the same weight as everything else. Fix: at most one separator; group via spacing + existing muted tiles.

### [P3] Enable toggle states the risk but withholds the reassurance
The description warns carriers may de-prioritize, but the toggle moment offers no safety reassurance. The safety principle is two-sided: dangerous obvious AND safe effortless. A reversible config toggle is framed as scarily as a reboot. Fix: one-line "Applies instantly without rebooting; toggle off anytime to revert."

## Persona Red Flags

**Alex (Power User):** Wants the engine model up front. Builds a Masquerade config, switches to VO, only then learns they're exclusive — wasted effort. No keyboard path to the sibling feature. Twin verify-vs-test naming breaks model transfer.

**Marisol (field tech, roadside, tablet in direct sun — project persona):** `text-warning` on `bg-warning/10` is low-chroma-on-low-chroma, the most at-risk text for outdoor AA. Permanent amber + green badge + blue icon = four competing colors to parse in glare. Jargon (SNI, ClientHello) with no inline help.

**Devin (returning power user doing a quick status check — project persona):** Just wants to see if VO is active. Gets a full CdnHostlistCard (renders whenever binary installed, even when VO disabled) plus a permanent experimental warning. Calm status check is louder than it needs to be.

## Minor Observations
- `font-mono` on inline opkg code spans (VO 442, Masq 248) violates the Single-Voice Rule's explicit don't.
- Page padding `p-2` is tight vs the editorial-whitespace direction; `h1` uses raw text-3xl rather than the Display token.
- Desync info button reuses an unrelated aria key (core_settings.info.cell_data.info_aria, VO 503) instead of the purpose-built video_optimizer.aria_desync_repeats_info that exists.
- TestInjectionCard step durations are hardcoded client timers (500/5000/1500ms) decoupled from real backend timing — can show "complete" while still waiting.
- VO uses Tooltip info-button; Masquerade uses FieldDescription for the parallel field. Pick one convention.

## Questions to Consider
1. Why are these two screens two files instead of one? Same engine, mutually exclusive, already drifting. Would a single "DPI Evasion" surface with a mode selector make the exclusivity structural instead of a reactive amber Alert?
2. If "Experimental" is permanent and unchanging, is it information or decoration?
3. Should the UI that destroys cross-feature state (uninstall) live on a single-feature page at all?
