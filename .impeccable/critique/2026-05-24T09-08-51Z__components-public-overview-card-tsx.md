---
target: Live modem status card
total_score: 34
p0_count: 0
p1_count: 2
timestamp: 2026-05-24T09-08-51Z
slug: components-public-overview-card-tsx
---
# Critique: Live Modem Status card

Target: components/public/overview-card.tsx

## Design Health Score

| # | Heuristic | Score |
|---|-----------|------:|
| 1 | Visibility of System Status | 4 |
| 2 | Match System / Real World | 3 |
| 3 | User Control and Freedom | 3 |
| 4 | Consistency and Standards | 3 |
| 5 | Error Prevention | 4 |
| 6 | Recognition Rather Than Recall | 4 |
| 7 | Flexibility and Efficiency | 3 |
| 8 | Aesthetic and Minimalist Design | 3 |
| 9 | Error Recovery | 4 |
| 10 | Help and Documentation | 3 |
| Total | | 34/40 |

## Anti-Patterns Verdict
LLM: No AI-generated tells. Outline-badge discipline, no gradient text, no glassmorphism, no hero-metric template, container queries used thoughtfully.
Deterministic: npx impeccable detect → [] (zero findings).

## What's Working
1. Error-recovery discipline (AbortController, retain-prior-data, visibility-pause, stale threshold).
2. Badge density is on-system (outline + bg/15 + text/role + border/30 + size-3 icon).
3. SkeletonBody mirrors live layout — no first-paint shift.

## Priority Issues
- [P1] The hero is text-shaped where the system promises a Circular Signal Meter (Nokia FastMile signature unused on the most visible surface).
- [P1] Live numeric readouts (signal line) missing tabular-nums; mid-poll jitter violates Tabular-Number Rule.
- [P2] Stale badge uses info/blue; should be warning/amber per Functional-Color Promise.
- [P2] Empty-state icon (MinusCircleIcon) implies "deliberately inactive" on a fetch failure; should be TriangleAlertIcon.
- [P2] Temperature warning still renders at full strength when isStale — cross-contract failure.

## Minor
- Entrance motion uses generic easeOut, not project's cubic-bezier(0.16, 1, 0.3, 1).
- Copyright copy is generic boilerplate.
- "Searching · LTE" structurally possible — single-meaning pill better.
- Field-grid uppercase tracking edges toward SaaS-tiny-label convention.
- CardFooter w-full button conjures consumer-router-app flavor.

## Persona Red Flags
- Field Tech (outdoor sun): hero text-2xl + 14px values low for glare; no manual refresh.
- Hobbyist Power User: up to 20s blind window (5s poll + 15s stale).
- First-Time-After-Flash: "Log in for diagnostic details" assumes known credentials.
