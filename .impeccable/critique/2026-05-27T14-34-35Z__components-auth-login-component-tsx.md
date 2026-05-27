---
target: the login page
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-05-27T14-34-35Z
slug: components-auth-login-component-tsx
---
# Critique: /login

**Target:** components/auth/login-component.tsx (rendered by app/login/page.tsx)
**Register:** product
**Color strategy:** restrained (tinted neutrals + warning/destructive accents only)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Loading + countdown + skeleton are solid. No signal for why you arrived (logout vs expired vs deferred reboot) except the offline banner. |
| 2 | Match System / Real World | 4 | "Sign in to <hostname>" is the strongest decision on the page. |
| 3 | User Control and Freedom | 2 | No forgot-password path, no link back to the unauthenticated Overview from inside the card. |
| 4 | Consistency and Standards | 3 | Banner pattern, motion curve, button sizing all match DESIGN.md. Heading hierarchy is semantically inverted. |
| 5 | Error Prevention | 3 | One field; little to prevent. Show/hide password helps. |
| 6 | Recognition Rather Than Recall | 3 | Hostname recall is good. Current language/theme aren't surfaced beyond the trigger glyph. |
| 7 | Flexibility and Efficiency | 2 | Show-password has tabIndex={-1} (click only). No keyboard shortcut beyond Enter. No autofocus. |
| 8 | Aesthetic and Minimalist Design | 2 | Card chrome wrapping a single password field is the heaviest decision on the page. |
| 9 | Error Recovery | 2 | Destructive banner names the failure but doesn't route to recovery (physical reset / restore backup). |
| 10 | Help and Documentation | 1 | No help link. Recovery path isn't discoverable here. |
| **Total** | | **25/40** | **Mid-range. Well-crafted within a template silhouette.** |

## Anti-Patterns Verdict

First-order AI slop check: yes, "modem login page" -> centered card with logo + title, password field, theme toggle, copyright reads as Vercel-template. Second-order: no, the content inside (device-first IA, banner pattern, motion contract, code comments documenting decisions) is genuinely considered. The chrome decision pulls it back toward the template.

No explicit ban violations: no side-stripe borders, no gradient text, no glassmorphism, no hero-metric, no identical card grid, no modal-as-first-thought.

## Priority Issues

### [P1] Card wraps a single password field
DESIGN.md treats Cards as the lazy answer for one-region surfaces. The Card chrome competes with the content; the eye lands on the rectangle, not the device name. Fix: render the gate as a centered column on the page background, no Card. Keep all internals.

### [P1] Heading hierarchy is semantically inverted
CardTitle as h1 is "QManager" (small). Body h2 is the hostname (large). Screen readers traverse product -> device, opposite of visual hierarchy. Fix: demote QManager to a non-heading wordmark, promote hostname to h1.

### [P2] "Sign in to" + hostname layout is fragile
items-baseline + justify-center + truncate centers an ellipsis on long hostnames, eliding the distinguishing suffix. Fix: stack the eyebrow above the hostname, prefer head-truncation or 2-line balanced wrap.

### [P2] No recovery path is discoverable
PRODUCT.md goal of "no terminal fallback required" silently breaks here. Fix: text link to a recovery help section explaining physical reset + .qmbackup restore.

### [P3] Action cluster competes with the body
Lang + theme icon buttons top-right of header are the only interactive chrome in the upper half; eye lands there before the hostname. Fix: move to viewport corner, or render as text links below the form.

## Persona Red Flags

**Hobbyist quick-checker (phone, outdoors):** icon-sm at 32px is below 44px touch target; deliberate but a tradeoff worth re-confirming.

**Focused configurator (laptop):** show-password tabIndex={-1} blocks keyboard reveal; friction for users pasting from password managers.

**Jordan (first-timer):** opaque forgot-password dead end; "QManager" as page title when the device is labelled RM520N.

**Alex (power user):** no autofocus on the password input; no keyboard shortcut beyond Enter.

## Minor Observations

- tabular-nums on hostname is cargo (not a numeric table).
- Mount motion plays on every visit including post-logout return; consider gating to first mount per session.
- role="alert" copy mutating in place may not re-announce reliably; brief unmount on error change is safer.
- Logo img alt="" depends on CardTitle naming the product; if heading inverts (P1), give the logo a real alt.
- wasOffline reads window.location.search directly rather than useSearchParams.
