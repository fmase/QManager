---
target: components/public/overview-card.tsx
total_score: 33
p0_count: 0
p1_count: 1
timestamp: 2026-05-24T11-39-47Z
slug: components-public-overview-card-tsx
---
# Critique — components/public/overview-card.tsx

## Anti-Patterns Verdict

Automated detector returned zero findings. No gradient text, side-stripe borders, glassmorphism, hero-metric template, identical card grid, or solid status badges. Manrope-only. Passes the slop test on the rule level.

LLM assessment: passes the slop test, but fails the coherence test relative to the rest of the QManager product. See P1.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Connection badge + stale indicator + per-bar quality colors + aria-live all earn their place. |
| 2 | Match System / Real World | 3 | "Overall", "Single carrier" landed well in clarify. RSRP/RSRQ/SINR remain expert jargon — defensible for the target audience. |
| 3 | User Control and Freedom | 3 | CA disclosure is collapsible. No card-level dismiss (n/a; landing surface). |
| 4 | Consistency and Standards | 2 | Inverted typographic hierarchy. Verdict at text-2xl/3xl equals page <h1> scale across product, while this card's own CardTitle ("Welcome to QManager") sits at default text-base. |
| 5 | Error Prevention | 4 | Read-only surface; no destructive paths. |
| 6 | Recognition Rather Than Recall | 4 | Eyebrow + verdict; field labels above values. |
| 7 | Flexibility and Efficiency | 3 | One CTA. Power-user shortcuts not appropriate here. |
| 8 | Aesthetic and Minimalist Design | 3 | Bolder pass added contrast but lost coherence — louder than its neighbors. |
| 9 | Error Recovery | 4 | Retry on fetch error; stale indicator on degraded data. |
| 10 | Help and Documentation | 3 | No tooltips on metric acronyms. Acceptable. |

Total: 33/40 — Strong.

## Overall Impression

The verdict word lives at page-<h1> scale on a card whose own title is at default text-base. Hierarchy inversion. User's eye correctly read it as "feels large compared to the usual components." Biggest opportunity: right-size the verdict pair back into the product's idiom without losing the bolder pass's hierarchy gains.

## What's Working

- Worst-of-three verdict driven by an eyebrow label. Good information architecture: summary first, per-metric attribution in the bars.
- Connection badge row: outline + tinted bg + lucide size-3 icons. Project's signature badge pattern executed cleanly.
- The new grid layout for the band row. minmax(0,1fr)_auto_auto correctly anchors the dBm column.

## Priority Issues

### [P1] Verdict word at page-headline scale breaks product coherence

Verdict at text-2xl @[20rem]:text-3xl is page-<h1> scale (text-3xl font-bold across 25+ pages) and dashboard-hero-CardTitle scale (text-2xl @[250px]:text-3xl). Card's own CardTitle is default ~text-base. Child element larger than its card's title — hierarchy inversion.

Fix: drop verdict to text-xl @[20rem]/overview:text-2xl. Still bigger than field labels and metric names; stops competing with page title and dashboard CardTitles.

Suggested command: /impeccable quieter

### [P2] Bars at h-2 slightly heavier than landing-surface needs once verdict is reined in

Bumped to h-2 in bolder to balance the bigger verdict. With verdict reined back (P1), h-2 is over-weight. Drop to h-1.5, or accept slightly heavier register if keeping h-2.

Suggested command: bundled into /impeccable quieter

### [P3] CardTitle / CardDescription block slightly underweight for landing surface

"Welcome to QManager" sits at default CardTitle weight on the user's first contact with the product. Every other page in the product gets text-3xl font-bold as its <h1>. Optional alternative to P1: raise CardTitle to text-2xl font-semibold instead of dropping the verdict.

Suggested command: /impeccable typeset

## Persona Red Flags

Sam (hobbyist mid-day glance): current card serves him well; minor risk of confusing verdict for headline on narrow screens. Low priority.

Alex (field tech in direct sun): big verdict actually helps. Dialing down costs Alex a sliver of glance-readability — acceptable tradeoff since Sam is far more common.

## Minor Observations

- CA disclosure trigger tracking-wide vs eyebrow tracking-[0.18em] — could harmonize.
- Verdict pair gap-5 to bars matches bars gap-3 internal rhythm. Consider tightening verdict→bars gap if you want them to read as bound pair.
