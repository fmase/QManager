---
target: app/login/page.tsx
total_score: 24
p0_count: 1
p1_count: 2
timestamp: 2026-05-24T11-37-01Z
slug: app-login-page-tsx
---
# Critique - Pre-auth login surface

## Anti-Patterns Verdict
LLM: 70% clean, 30% slop-adjacent. No banned moves; composition is the canonical centered-card shadcn login-04 block. Detector: clean (0 findings). The hostname pill is the one on-brand element; it is buried under a generic "Welcome to QManager" h1.

## Design Health Score: 24/40

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Pill loading state excellent; status=loading spinner unlabeled. |
| 2 | Match system / real world | 3 | "Password for hostname" real-world; h1 template. |
| 3 | User control and freedom | 2 | No recovery affordance during lockout. |
| 4 | Consistency and standards | 2 | text-xl font-bold ignores Headline token; ease easeOut ignores cubic-bezier(0.16,1,0.3,1). |
| 5 | Error prevention | 3 | No caps-lock detection. |
| 6 | Recognition rather than recall | 3 | Pill is right pattern, wrong size. |
| 7 | Flexibility and efficiency | 2 | No keyboard shortcut for language picker. |
| 8 | Aesthetic and minimalist design | 3 | Generic-shadcn restraint, not Operator's Console restraint. |
| 9 | Error recovery | 2 | Auth error chrome weaker than offline banner; inconsistent i18n. |
| 10 | Help and documentation | 1 | Zero help affordances. |

## Priority Issues

### [P0] Information hierarchy inverted - disambiguator buried under template
Pill is text-xs muted under text-xl font-bold "Welcome to QManager". For 5-modem user, hostname IS the disambiguator. Promote hostname to headline slot OR drop h1 entirely. Suggested: /shape.

### [P1] Motion easing diverges from codified curve
ease: "easeOut" instead of cubic-bezier(0.16, 1, 0.3, 1). No prefers-reduced-motion short-circuit. Suggested: /animate.

### [P1] Auth error chrome weaker than offline banner
Auth error is bare <p>; offline banner has full border + bg + tint. Backwards. Also non-i18n rate-limit string at line 64. Suggested: /harden.

### [P2] Three near-duplicate framing strings
h1 + FieldDescription + FieldLabel all say roughly the same thing. Drop FieldDescription. Suggested: /distill.

### [P3] Hardcoded English makes language picker a placebo
All login strings are literal English; toggling the picker changes nothing on its own screen. Suggested: /clarify.

## Persona Red Flags

Power user (5+ modems): disambiguator buried; no keyboard shortcut for picker; no recovery hint.

Field tech in sunlight: pill text-muted-foreground on bg-muted/50 likely fails 4.5:1 outdoor floor; picker icon-sm under 44px touch target; lockout timer has zero recovery affordance.

## Minor Observations
- window.location.search read during render (not reactive)
- bare spinner with no label during loading/setup_required
- skeleton w-20 may reflow on long hostnames; use min-w-20
- text-xl font-bold violates Headline token (should be font-semibold + tracking-[-0.01em])
- copyright FieldDescription is template sediment on a device console
- verify short-landscape mobile picker overlap
