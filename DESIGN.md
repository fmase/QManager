---
name: QManager
description: Modern web GUI for managing Quectel cellular modems on OpenWRT. The Operator's Console.
colors:
  signal-indigo: "oklch(0.488 0.243 264.376)"
  signal-indigo-soft: "oklch(0.546 0.245 262.881)"
  uplink-green: "oklch(0.59 0.18 149)"
  uplink-green-dark: "oklch(0.65 0.17 149)"
  caution-amber: "oklch(0.75 0.18 75)"
  caution-amber-dark: "oklch(0.80 0.16 75)"
  telemetry-blue: "oklch(0.62 0.19 255)"
  telemetry-blue-dark: "oklch(0.68 0.17 255)"
  fault-red: "oklch(0.577 0.245 27.325)"
  fault-red-dark: "oklch(0.704 0.191 22.216)"
  neutral-bg-light: "oklch(1 0 0)"
  neutral-bg-dark: "oklch(0.141 0.005 285.823)"
  neutral-fg-light: "oklch(0.141 0.005 285.823)"
  neutral-fg-dark: "oklch(0.985 0 0)"
  surface-card-light: "oklch(1 0 0)"
  surface-card-dark: "oklch(0.21 0.006 285.885)"
  surface-sidebar-light: "oklch(0.985 0 0)"
  surface-sidebar-dark: "oklch(0.21 0.006 285.885)"
  surface-muted-light: "oklch(0.967 0.001 286.375)"
  surface-muted-dark: "oklch(0.274 0.006 286.033)"
  muted-fg-light: "oklch(0.552 0.016 285.938)"
  muted-fg-dark: "oklch(0.705 0.015 286.067)"
  border-light: "oklch(0.92 0.004 286.32)"
  border-dark: "oklch(1 0 0 / 0.10)"
  chart-1: "oklch(0.809 0.105 251.813)"
  chart-2: "oklch(0.623 0.214 259.815)"
  chart-3: "oklch(0.546 0.245 262.881)"
  chart-4: "oklch(0.488 0.243 264.376)"
  chart-5: "oklch(0.424 0.199 265.638)"
  chart-6: "oklch(0.705 0.213 47.604)"
typography:
  display:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: "1.15"
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.25"
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "1"
    letterSpacing: "normal"
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.5"
    letterSpacing: "normal"
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1"
    letterSpacing: "0.01em"
  numeric:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: "1"
    letterSpacing: "-0.02em"
    fontFeature: "'tnum' 1, 'ss01' 1"
rounded:
  sm: "calc(0.65rem - 4px)"
  md: "calc(0.65rem - 2px)"
  lg: "0.65rem"
  xl: "calc(0.65rem + 4px)"
  pill: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.signal-indigo}"
    textColor: "{colors.neutral-fg-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-primary-hover:
    backgroundColor: "{colors.signal-indigo-soft}"
    textColor: "{colors.neutral-fg-dark}"
  button-destructive:
    backgroundColor: "{colors.fault-red}"
    textColor: "{colors.neutral-fg-dark}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-outline:
    backgroundColor: "{colors.neutral-bg-light}"
    textColor: "{colors.neutral-fg-light}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-ghost:
    textColor: "{colors.neutral-fg-light}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  badge-success:
    backgroundColor: "{colors.uplink-green}"
    textColor: "{colors.uplink-green}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.5rem"
    typography: "{typography.label}"
  badge-warning:
    backgroundColor: "{colors.caution-amber}"
    textColor: "{colors.caution-amber}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.5rem"
    typography: "{typography.label}"
  badge-destructive:
    backgroundColor: "{colors.fault-red}"
    textColor: "{colors.fault-red}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.5rem"
    typography: "{typography.label}"
  badge-info:
    backgroundColor: "{colors.telemetry-blue}"
    textColor: "{colors.telemetry-blue}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.5rem"
    typography: "{typography.label}"
  badge-muted:
    backgroundColor: "{colors.surface-muted-light}"
    textColor: "{colors.muted-fg-light}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.5rem"
    typography: "{typography.label}"
  card:
    backgroundColor: "{colors.surface-card-light}"
    textColor: "{colors.neutral-fg-light}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
  input:
    backgroundColor: "{colors.neutral-bg-light}"
    textColor: "{colors.neutral-fg-light}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.75rem"
    height: "2.25rem"
---

# Design System: QManager

## 1. Overview

**Creative North Star: "The Operator's Console"**

QManager is the calm, expert console an operator trusts when something matters. It runs on the modem it manages, so it earns its restraint twice: once as a stylistic principle (Linear and Vercel polish, no flash), and again as a safety principle (the routine 90% should feel effortless, the risky 10% should feel deliberate). The system rejects the engineer-default ugliness of classic LuCI, the marketing-slick oversimplification of consumer router apps, and the AI-slop hero-metric template that has flattened every SaaS dashboard into the same product.

The aesthetic is **restrained at rest, tactile in interaction, silky in motion, dense in data**. Surfaces are quiet until a user reaches for them. Buttons, tiles, and panels respond with a buttery confidence borrowed from **Apple's instrument-class motion** — the same easing curves and timing discipline you feel scrubbing the iOS lock screen, dragging a window in macOS, or watching a Control Center toggle settle. Never bouncy, never springy, never Material-pop, never the snappy-corporate flick that betrays a SaaS dashboard. Charts and signal readouts are allowed to be dense (this is a modem GUI; density is the job) but the density is earned with hierarchy, not dumped on the page. The interface is a peer to the technically literate user it serves: never patronizing, never showing off.

The dominant visual reference is **Apple's professional UI/UX** (macOS System Settings, the Pro-app inspectors in Logic / Final Cut / Xcode, iOS Settings). QManager adopts Apple's grouped-card, consistent-shape page (every feature page is a page header plus a uniform card layout, never a bespoke per-screen composition), its restraint at rest, and its instrument-class motion. **Ubiquiti UniFi** contributes one thing only, and it is load-bearing: data density. Its dense pill-driven data tables and inline status tags are the heritage behind QManager's outline-badge pattern and its data tables. UniFi is a density reference, not a layout reference; its varied-size hero-mosaic dashboard composition was tried (the Traffic Engine redesign) and rejected as inconsistent with the grouped-card layout. **Nokia FastMile 5G Gateway 7** contributes the big circular signal-quality meter as an optional readout on signal/antenna pages, and the friendly-but-technical card treatment there. **Askey's iF Design Award-winning CPE Management Utility** lends editorial whitespace and a confident typographic hierarchy inside grouped cards — the aspirational reminder that a CPE interface can win design awards, not just function correctly.

**Key Characteristics:**
- Quiet by default, expressive in the moments that matter (destructive actions, recovery feedback, signal events).
- OKLCH-only color system. `#000` and `#fff` are forbidden; every neutral is tinted toward the brand hue.
- Single typeface (Manrope) carries the whole system; hierarchy comes from weight + scale, not from font-family mixing.
- Hybrid elevation: depth from tonal surfaces at rest, ambient shadow only as an interaction response.
- **Apple-class silky motion** (200-400ms, exponential ease-out, never bouncy) on every state change. Reduced-motion users see instant transitions, not broken layouts.
- **Dense pill-and-tag patterns** carry status throughout (UniFi heritage), never solid badge fills.
- **Feature pages compose as a page header plus a uniform card grid** — the established, consistent shape (see `ttl-settings`). Every page is built the same way, the way macOS System Settings panes are. A hero/mosaic composition is a rare, deliberate exception for a genuine glance surface, never the default.
- **Topology and network visualizations are optional surfaces** used where the relationship itself is the insight (cell-tower constellations, antenna geometry, neighbor cells), never forced onto a routine feature page.
- **Build on shadcn/ui first.** When a surface needs a primitive (tabs, accordion, dialog, popover, tooltip, select, dropdown), use the shadcn component. Only build a custom component when shadcn genuinely does not provide one.
- **Live-updating tiles tick smoothly** via tabular numbers + short color transitions; never via layout shifts or fade-flashes.
- Dark and light themes are first-class equals. Neither is "the default."

## 2. Colors

A muted neutral foundation tinted toward the brand indigo, with five named functional colors that each own a specific operational meaning. The palette is **Restrained** in impeccable terms: tinted neutrals plus one true accent (Signal Indigo) that carries less than 10% of any given screen.

### Primary
- **Signal Indigo** (`oklch(0.488 0.243 264.376)`): the one true brand color. Used on primary buttons, focused inputs (via ring), the active sidebar selection, primary action affordances, and brand surfaces. Never decorative. If a screen has more than two patches of Signal Indigo, one of them is wrong.
- **Signal Indigo Soft** (`oklch(0.546 0.245 262.881)`): hover state for primary, and the active sidebar primary in dark mode. Slightly higher lightness, same hue, same chroma.

### Secondary (Functional / Operational)
QManager has no "secondary brand color" in the marketing sense. The five colors below are **functional**: each one signals a specific operational state. They never appear decoratively.

- **Uplink Green** (`oklch(0.59 0.18 149)` light / `oklch(0.65 0.17 149)` dark): healthy state. Active services, successful saves, watchdog-healthy, profile-applied. Paired with `CheckCircle2Icon`.
- **Caution Amber** (`oklch(0.75 0.18 75)` light / `oklch(0.80 0.16 75)` dark): warning state. Pending reboot banners, partial-success, SIM mismatch, degraded signal. Paired with `TriangleAlertIcon`.
- **Telemetry Blue** (`oklch(0.62 0.19 255)` light / `oklch(0.68 0.17 255)` dark): informational state. Connection events, neutral notices, banners that report rather than alarm.
- **Fault Red** (`oklch(0.577 0.245 27.325)` light / `oklch(0.704 0.191 22.216)` dark): destructive or failed state. Reboot dialogs, factory restore, profile-failed, watchdog-tripped. Paired with `XCircleIcon` or `AlertCircleIcon`.
- **Stream Violet** (`oklch(0.627 0.265 303.9)`, Tailwind `purple-500`): the egress half of the **throughput-direction pair** (see Named Rules). Used *only* on the upload-direction arrow of live-traffic readouts, never as a generic accent and never as a status color. Its job is to be ~45° of hue away from Telemetry Blue so download and upload read apart at a glance.

### Neutral
- **Pearl White** (`oklch(1 0 0)`): light-theme background and card surface. The only place pure white appears.
- **Graphite** (`oklch(0.141 0.005 285.823)`): dark-theme background and light-theme foreground text. Tinted toward indigo (chroma 0.005) so it never reads as dead `#000`.
- **Slate** (`oklch(0.21 0.006 285.885)`): dark-theme card and popover surface, light-theme strong text.
- **Mist** (`oklch(0.967 0.001 286.375)` light / `oklch(0.274 0.006 286.033)` dark): muted surfaces (badges, secondary buttons, disabled inputs).
- **Hairline** (`oklch(0.92 0.004 286.32)` light / `oklch(1 0 0 / 0.10)` dark): borders, dividers, input strokes.

### Data Visualization (Chart Ramp)
- Five steps of indigo (`chart-1` through `chart-5`, lightness 0.81 → 0.42, all near 260° hue) for monochromatic series.
- One contrast accent (`chart-6` = `oklch(0.705 0.213 47.604)`, warm orange) for highlighting the "current" or "active" data point in a series.
- The chart palette must remain readable under deuteranopia and protanopia simulation. Any added chart color must be verified before merge.

### Named Rules

**The Signal-Indigo Reserve.** Signal Indigo is rationed. Reserve it for the single most-important action affordance on a screen. If a Save button, a primary CTA, and a brand badge all appear on the same page, two of them must use a quieter variant. Rarity is what makes it read as the "primary".

**The Functional-Color Promise.** A user who learns that Uplink Green means "healthy" on the dashboard must find the same green meaning the same thing in Watchdog, in Profile Apply, and in SMS Alerts. Functional colors are a contract; never decorate with them.

**The Throughput-Direction Pair.** Live traffic encodes *direction* with a fixed two-color pair: **download/ingress is Telemetry Blue** (`text-info`), **upload/egress is Stream Violet** (`text-purple-500`). They are deliberately ~45° apart in hue so the two arrows never collapse into "two shades of blue" — using `text-primary` (Signal Indigo, only 9° off Telemetry Blue) for upload is the specific mistake this rule exists to prevent. The pair is reserved for throughput readouts (the dashboard Live Traffic row, the bandwidth monitor); it is not a general status convention and Stream Violet appears nowhere else.

**The OKLCH-Only Rule.** No hex literals. No `#000`, no `#fff`. Every neutral is tinted toward the indigo brand hue (chroma 0.005-0.01 minimum). New colors enter the system in OKLCH form; conversion is the author's job, not the consumer's.

## 3. Typography

**Display / Body / Label / Numeric Font:** Manrope (with `system-ui, sans-serif` as fallback). Loaded via `next/font/google` with a `--font-manrope` variable; the body element applies it directly.

**Character:** Manrope is geometric without being severe, technical without being cold. It has tabular-numbers and stylistic alternates that handle dense modem-data readouts (RSRP values, EARFCN numbers, ICCIDs, IMEIs) without needing a separate mono. The single-family choice is deliberate: visual coherence beats type-pairing cleverness, and the system is denser than the average dashboard, so reducing variables earns clarity.

### Hierarchy

- **Display** (Manrope 600, 1.875rem / 30px, line-height 1.15, letter-spacing -0.015em): page titles, hero metrics on the signal dashboard.
- **Headline** (Manrope 600, 1.25rem / 20px, line-height 1.25, letter-spacing -0.01em): section headings, large card titles.
- **Title** (Manrope 600, 1rem / 16px, line-height 1, letter-spacing normal): `CardTitle` default. Tight `leading-none` so titles align cleanly with adjacent metadata.
- **Body** (Manrope 400, 0.875rem / 14px, line-height 1.5): default UI text, descriptions, paragraph copy. Line length capped at 65-75ch in long-form content.
- **Label** (Manrope 500, 0.75rem / 12px, line-height 1, letter-spacing 0.01em): badges, table headers, button text, form labels.
- **Numeric** (Manrope 600, 1.875rem / 30px, line-height 1, letter-spacing -0.02em, `font-feature-settings: "tnum"`): the big numbers on the signal dashboard, antenna alignment meter, bandwidth panel. **Always tabular-numbers** so values don't jitter as they update.

### Named Rules

**The Single-Voice Rule.** Manrope is the only typeface in the system. Hierarchy comes from weight contrast (400 / 500 / 600) and scale (≥1.25 ratio between steps). Pairing Manrope with another sans is forbidden; pairing it with a mono is forbidden; the discipline is the point.

**The Tabular-Number Rule.** Any number that updates live (signal values, throughput, bytes counters, watchdog timers) must use `font-variant-numeric: tabular-nums`. Non-tabular updates cause perceptible jitter in dense readouts. Tabular is mandatory for numeric content; optional everywhere else.

**The Tight-Heading Rule.** Headings carry negative letter-spacing (`-0.01em` to `-0.02em`). Body and small text stay at default tracking. The tightening is what gives Manrope its premium feel at display sizes; without it, large weights look soft.

## 4. Elevation

QManager uses **hybrid elevation**: tonal layering carries depth at rest, and a soft ambient shadow appears only as an interaction response (hover, focus, drag, active state). The system never relies on shadows to establish layout hierarchy. If the shadow disappears (reduced-motion, low-spec render), nothing about the layout breaks.

Surface tonality is the load-bearing depth signal:

- **Light theme:** Background (`Pearl White`) → Card (`Pearl White`) is intentionally flat; depth comes from a `1px` Hairline border + barely-there `shadow-sm`. Sidebar is `oklch(0.985 0 0)` (one step darker than background). Popovers and dropdowns lift via increased radius + stronger shadow.
- **Dark theme:** Background (`Graphite`) → Card (`Slate`) is a tonal step lighter, so cards lift without needing a shadow at all. Sidebar matches card tonality. Borders thin to `oklch(1 0 0 / 0.10)`.

### Shadow Vocabulary

- **Whisper** (`shadow-xs`, roughly `0 1px 2px rgba(0,0,0,0.05)`): input fields at rest, secondary buttons. So subtle it's almost subliminal.
- **Resting** (`shadow-sm`, roughly `0 1px 3px rgba(0,0,0,0.10)`): card surfaces at rest. The only persistent shadow in the system.
- **Hover Lift** (`shadow-md` with `cubic-bezier(0.16, 1, 0.3, 1)` ease-out over 200ms): interactive cards, list rows, and buttons on hover. The ambient lift that makes the interface feel tactile.
- **Active Press** (`shadow-xs` + `translateY(1px)`, 100ms): the buttery "press" feedback on buttons and cards. Compresses the lift; matches the Apple-class motion target.
- **Popover Float** (`shadow-lg`, roughly `0 10px 15px rgba(0,0,0,0.10)`): dialogs, dropdowns, command palette, tooltips. The "this is not part of the page flow" signal.

### Named Rules

**The Tonal-First Rule.** Depth is communicated by surface tone before any shadow is considered. If two surfaces are at different conceptual elevations, their colors differ by at least one tonal step (≈4% lightness in OKLCH). Shadows are the seasoning, not the substrate.

**The Interaction-Only Shadow Rule.** Persistent ambient shadows on every card produce 2014-Material soup. Cards rest flat (or with `shadow-sm` only). The visible lift is reserved for interaction states (hover, focus, drag). If a card looks "popped out" without the user touching it, the shadow is too strong.

**The Reduced-Motion Floor.** Every shadow transition must be wrapped or short-circuited by `prefers-reduced-motion: reduce`. The hover lift instantly snaps to its end state; the layout never depends on the transition completing.

## 5. Components

Every component follows the **tactile and confident** philosophy: surfaces respond to touch with a buttery, instrument-class motion. Hover, focus, and active states are first-class design surfaces, not afterthoughts.

### Buttons

- **Shape:** `rounded-md` (calculated as `0.65rem - 2px` ≈ 8.4px). Tight enough to read as crisp, generous enough to never read as utilitarian.
- **Default (Primary):** `Signal Indigo` background, white text, height `2.25rem` (36px), padding `0.5rem 1rem`. Hover: `Signal Indigo Soft` (200ms ease-out-quart). Active: compresses with `translateY(1px)` over 100ms. Focus: 3px `Signal Indigo` ring with reduced opacity.
- **Destructive:** `Fault Red` background, white text. Same dimensions as primary. Used only for irreversible actions (reset, delete, factory restore).
- **Outline:** Transparent background, `Hairline` border, `Whisper` shadow at rest, lifts to `Hover Lift` shadow on hover. Used for tertiary actions.
- **Secondary:** `Mist` background, `Slate` text. No shadow. Used for low-priority but still meaningful actions.
- **Ghost:** No background, no border at rest. Background tints to `Mist` on hover. Used for icon buttons, nav items, table-row actions.
- **Link:** `Signal Indigo` text, underline on hover. Used inline within text only.
- **Sizes:** `xs` (h-6, 24px), `sm` (h-8, 32px), `default` (h-9, 36px), `lg` (h-10, 40px). Icon variants square at the same height. **Always use `SaveButton` for save actions** (custom wrapper that handles loading/success/error feedback).

### Status Badges

The signature pattern of QManager. **All status badges use `variant="outline"`** plus semantic color classes and a `size-3` lucide icon. Solid `success`/`warning`/`destructive`/`info` variants exist in the badge component but are forbidden in feature surfaces; the outline-plus-tint pattern is the rule.

| State | Background | Text | Border | Icon |
| ----- | ---------- | ---- | ------ | ---- |
| **Success / Active** | `bg-success/15` | `text-success` | `border-success/30` | `CheckCircle2Icon` |
| **Warning / Pending** | `bg-warning/15` | `text-warning` | `border-warning/30` | `TriangleAlertIcon` |
| **Destructive / Failed** | `bg-destructive/15` | `text-destructive` | `border-destructive/30` | `XCircleIcon` |
| **Info / Notice** | `bg-info/15` | `text-info` | `border-info/30` | context-specific |
| **Muted / Inactive** | `bg-muted/50` | `text-muted-foreground` | `border-muted-foreground/30` | `MinusCircleIcon` |

Reusable wrapper: `ServiceStatusBadge` at `components/local-network/service-status-badge.tsx`. **Use Muted for deliberately inactive states** (not-installed, disabled-by-config); reserve Destructive for actual failure or error.

### Cards / Containers

- **Shape:** `rounded-xl` (`0.65rem + 4px` ≈ 14px). Cards are the largest radius in the system.
- **Background:** `Pearl White` (light) / `Slate` (dark).
- **Border:** `1px` Hairline always present. Borders carry the depth here, not shadows.
- **Shadow:** `shadow-sm` (Resting) at rest. `shadow-md` (Hover Lift) only on cards that are themselves interactive (clickable list items, draggable panels).
- **Padding:** `py-6` (24px vertical), `px-6` (24px horizontal) on header / content / footer. Internal `gap-6` between sections.
- **CardHeader contract:** plain `CardTitle` + `CardDescription`. **No icons in headers.** Icons belong in badges or action areas (`CardAction` slot).

### Inputs / Fields

- **Shape:** `rounded-md` (≈8.4px), height `2.25rem` (36px).
- **Background:** transparent in light, `bg-input/30` (subtle tint) in dark. Hairline border in both themes.
- **Shadow:** `Whisper` at rest. No shadow on focus (the ring carries it).
- **Focus:** 3px Signal Indigo ring (`ring-ring/50`) + border shifts to `border-ring`. 200ms transition on `color, box-shadow`.
- **Error:** `border-destructive` + `ring-destructive/20` (40% in dark).
- **Disabled:** `opacity-50`, `pointer-events-none`, cursor not-allowed.

### Sidebar Navigation

- **Background:** `surface-sidebar` token (lighter than canvas in light theme, equal-to-card in dark theme).
- **Item style:** rounded ghost-button at rest; on hover, `Mist` background tint. The active item uses `Signal Indigo` on a `Signal Indigo / 10%` background tint (light) or `Signal Indigo Soft` (dark).
- **Typography:** Label size (12px, weight 500), letter-spacing `0.01em`.
- **Collapsibles:** chevron rotates 90° → 0° on open over 200ms ease-out-quart.

### Dialog / Confirmation

- **Shape:** `rounded-xl` (matches Cards).
- **Background:** Card surface (`Pearl White` / `Slate`).
- **Shadow:** Popover Float (`shadow-lg`).
- **Overlay:** `bg-black/50` with `backdrop-blur-sm` (the one place glassmorphism is allowed; it serves the function of dimming everything behind the dialog).
- **Destructive dialogs:** title in `Fault Red`, primary action button is `destructive` variant.
- **The Verizon-MPDN / IMEI-write / Reboot dialog pattern:** explicit consequences spelled out in the description, destructive variant CTA, optional persistent banner after dismissal (`usePendingReboot`).

> **Signature components are optional, never mandated.** The four components below (numeric cards, circular meter, topology map, live tile) are available where they are genuinely the best affordance — the signal/antenna surfaces, the network visualizations. None of them is required on a feature page, and none of them justifies abandoning the uniform grouped-card layout. Reach for the consistent card grid first; introduce a signature component only when one reading or one relationship truly dominates the screen.

### Signal Dashboard Numeric Cards (Signature Component)

A focal numeric readout, used where a single value genuinely dominates (the signal dashboard, the antenna meter). Large tabular numeric (Manrope 600, 30px), tight `leading-none`, small Label below it for unit and context. Updates animate the digit transition only (`transition: color 200ms cubic-bezier(0.16, 1, 0.3, 1)`, no layout shifts via tabular numbers). Color tint of the number reflects signal quality (`Uplink Green` excellent → `Caution Amber` fair → `Fault Red` poor) per the `getSignalQuality()` ramp. Never wrapped in a nested card; this is one of the few places a card-less hero metric is allowed because the surrounding page already provides the container.

### Circular Signal Meter (Signature Component, Nokia FastMile influence)

The circular signal-quality meter, an optional signature component on the dashboard, the antenna alignment page, and the cellular overview. A large circular arc (240° sweep, opens at the bottom) renders signal strength as a stroked path that grows from the left endpoint. The center holds the primary numeric value (Manrope 600, 30-44px depending on slot, tabular-nums); a small Label sits below with the unit. Arc color tracks the same `getSignalQuality()` ramp as numeric cards (Uplink Green → Caution Amber → Fault Red).

Critical animation discipline: the arc *grows* smoothly to its new value over 400ms with `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-quart). This is the Apple-class motion the system promises — the arc settles into place the way a Control Center slider settles, never overshooting, never bouncing. Reduced-motion users see the arc jump to its end value instantly with no transition. Color transitions between quality bands cross-fade over 200ms (never a hard swap that creates a visible flicker).

### Topology / Network Map (Signature Component, UniFi influence)

First-class visualization surface for cell-tower constellations, antenna geometry, MIMO stream layouts, and neighbor-cell relationships. Renders as an SVG canvas with a dark grid background (light theme: `Mist` tint; dark theme: `Slate` deeper than card surface), nodes as small circular badges colored by role (serving cell, neighbor, locked tower, locked band), and edges as 1-2px Hairline curves with subtle motion (a soft dashed-offset animation when a connection is "active").

UniFi's pattern is the model: pannable / zoomable canvas, nodes carry inline pill stats (PCI, RSRP, band) that surface on hover, the active/serving cell pulses faintly with the `animate-pulse-ring` keyframe defined in `globals.css`. Selection drops a small detail overlay anchored to the node, not a full modal — keeps the spatial context intact. Never a static screenshot or a flat decorative diagram; the topology map is a living surface that responds to the modem's actual state.

### Live Data Tile (Signature Component, UniFi influence)

The atom of the dashboard mosaic. A small card (`rounded-lg`, padding `1rem`, height auto) containing a Label at the top, a numeric or short-text value in the middle (Manrope 600, tabular-nums, sized to slot), and an optional inline sparkline or trend pill at the bottom. Tiles live in a mosaic layout (CSS Grid with named template areas or a Bento-style packing), with hero tiles spanning multiple columns/rows and stat tiles filling the remainder.

Motion contract — this is where the Apple-silky direction lives most loudly:

- **Value updates** transition `color` over 200ms with `cubic-bezier(0.16, 1, 0.3, 1)`. Tabular-nums means the digits never shift width; the number swaps cleanly under the eye.
- **Trend pills** (the ▲ +2.3% / ▼ -0.4% badges) cross-fade their text over 200ms when the trend flips; the pill color tints over 300ms.
- **Sparklines** redraw via `pathLength` animation when a new tail point lands, ease-out-quart over 400ms. Never a hard redraw.
- **Hover** lifts the tile by ambient `shadow-md` over 200ms (per the Hybrid Elevation system) and brightens its border by one tonal step. No scale transform; the lift is purely shadow + border, the way a macOS window edge highlights when you mouse near it.
- **Tile-level state changes** (a tile flips from idle to "watchdog alert" state) cross-fade the entire tile background and border color over 400ms; the value stays in place, the surface character changes around it.

The whole system feels alive because dozens of tiles are doing this at once at low intensity. Never a single tile demanding attention; the system breathes.

### Named Rules

**The Outline-Badge Rule.** All status badges in feature surfaces use `variant="outline"` + semantic color classes + `size-3` icon. Solid badge variants are forbidden outside developer-only contexts (e.g. raw `Badge` demos in storybook). If a badge needs to feel louder, the answer is a banner or an alert, not a solid badge.

**The No-Header-Icon Rule.** `CardHeader` is `CardTitle` + `CardDescription` only. Icons live in badges or in the `CardAction` slot. The discipline keeps card headers scannable; once one card has a header icon, every card grows one.

**The Save-Button Singleton.** All save actions use the project's `SaveButton` component. It carries the loading spinner, success checkmark, and error shake. Recreating save UI inline is forbidden; if the existing `SaveButton` does not fit, extend it rather than fork.

**The Consistent-Layout Rule (Apple heritage).** Feature pages compose as a page header (title + muted description) followed by a uniform grid of self-contained cards. This is the established QManager shape (see `ttl-settings`, `custom-dns`, `apn-management`): a `grid-cols-1 @container:grid-cols-2` (or similar) of equal cards is the **correct default, not a failure of composition**. Consistency across pages is the goal, because a user who learns one page has learned them all, exactly like macOS System Settings. A hero/mosaic composition (a full-width focal widget flanked by asymmetric tiles) is a rare, deliberate exception, reserved for a genuine at-a-glance surface where one reading truly dominates; it must be justified, never reached for by reflex. If you find yourself building a bespoke asymmetric layout unique to a single screen, stop and ask whether the grouped-card layout every other page uses would serve the user better. It almost always does. (Caveat: this blesses *functional* grouped cards, each a distinct settings group; it is not license for a grid of decorative *identical icon-plus-heading-plus-text* cards that carry no real controls, which remains AI-slop per the absolute bans.)

**The Live-Tile Rule (UniFi heritage, Apple-motion enforced).** Every tile that displays live-updating data follows the motion contract in the Live Data Tile section: tabular-nums for value swaps, color transitions over 200-400ms with `cubic-bezier(0.16, 1, 0.3, 1)`, sparklines redrawn via path-length animation, no fade-flashes, no layout shifts, no scale transforms. The Apple-instrument promise (silky, never bouncy, never snappy-corporate) is enforced at the tile level because that's where the user sees it most often. Reduced-motion users get instant value swaps with no transition; the layout never depends on a transition completing.

**The Pill-Dense Table Rule (UniFi heritage).** Data tables (client lists, neighbor cells, profile registry, event log) lean on inline outline pills and tags rather than colored row backgrounds or icon-and-text columns. A row should carry its status, role, and quick-actions as a sequence of dense outline pills — small, monochrome-with-tint, in the same outline-plus-tint style as the status badges. This dense-pill density is the one thing QManager keeps from UniFi: it is the data-density heritage, applied inside the consistent grouped-card layout rather than as a license for a hero-mosaic page.

## 6. Do's and Don'ts

### Do:

- **Do** use `oklch()` for every color. The system is OKLCH-doctrine; never reach for hex.
- **Do** tint every neutral toward the Signal Indigo hue (chroma 0.005-0.01 minimum). Pure achromatic neutrals look dead next to the brand.
- **Do** reserve Signal Indigo for the single most-important affordance on a screen (Save, Confirm, primary CTA, active nav item). Less than 10% of any screen.
- **Do** use the **outline status badge** pattern (`variant="outline"` + `bg-{role}/15` + `text-{role}` + `border-{role}/30` + `size-3` icon) for every status indicator.
- **Do** keep `CardHeader` to `CardTitle` + `CardDescription`. Put icons in badges or in `CardAction`.
- **Do** use Manrope-with-tabular-numbers (`font-variant-numeric: tabular-nums`) for any live-updating numeric readout.
- **Do** animate state transitions with exponential ease-out curves (`cubic-bezier(0.16, 1, 0.3, 1)`, sometimes called ease-out-quart) over 200-400ms. Silky, never bouncy. Think Apple Control Center slider settle, not Material spring.
- **Do** respect `prefers-reduced-motion: reduce` on every animation. The UI must feel intentional when motion is off, not just functional.
- **Do** compose feature pages as a page header plus a uniform grid of self-contained cards (per the Consistent-Layout Rule). The even card grid is the correct default; reserve hero/mosaic composition for the rare genuine glance surface.
- **Do** build on shadcn/ui first. When a surface needs tabs, an accordion, a dialog, a popover, a tooltip, a select, or any other primitive shadcn ships, use the shadcn component. Build a custom component only when shadcn genuinely does not provide one, and when it must be custom, follow the tokens and motion contracts here.
- **Do** use dense inline outline pills in data tables to surface status, role, band, PCI, and quick-actions (per the Pill-Dense Table Rule). UniFi's signature density translated directly.
- **Do** render network relationships visually (topology, antenna geometry, MIMO streams, neighbor cells) when the relationship itself is the insight. Tables are for lookup; topology is for understanding.
- **Do** live-update tile values with smooth color transitions and tabular-nums digit swaps, never with layout shifts or fade-flashes (per the Live-Tile Rule).
- **Do** treat the circular signal meter as a hero pattern on signal-quality surfaces (Nokia FastMile influence). The arc *grows* to its value over 400ms; it does not snap.
- **Do** leave generous editorial whitespace around and inside grouped cards (Askey iF-award influence). Calm spacing is what reads as premium; crowding is what cheapens it.
- **Do** use `Muted` badge styling for deliberately inactive states (not-installed, disabled-by-config). Reserve `Destructive` for actual failures.
- **Do** defer reboots via dialog + persistent banner pattern (`usePendingReboot`). Never `AT+CFUN=1,1` mid-request.

### Don't:

- **Don't** use `#000` or `#fff`. They are forbidden in this codebase.
- **Don't** use solid `success`/`warning`/`destructive`/`info` badge variants in feature surfaces. Outline-and-tint is the only correct status badge.
- **Don't** add icons to `CardHeader`. They drift into hero-metric SaaS template territory.
- **Don't** introduce a second typeface. Manrope is the single voice; Geist Mono, Inter, IBM Plex, Roboto Mono, and every other font are forbidden unless this rule is consciously revised.
- **Don't** use side-stripe borders (`border-left: 3px solid currentColor` on cards or callouts). Banned by impeccable's absolute bans and inconsistent with the Hairline border discipline here.
- **Don't** use `background-clip: text` gradient text. Banned. Solid color only; emphasis through weight or size.
- **Don't** apply `backdrop-blur` decoratively. The dialog overlay is the only sanctioned glassmorphism in the system.
- **Don't** ship the hero-metric SaaS template (big-number-with-gradient-accent-plus-three-supporting-stats), and don't make a giant 5xl/6xl focal number the centerpiece of a feature page (the Traffic Engine `ThroughputHero` is the lesson here). The Signal Dashboard numeric cards are the *anti-template*: tabular, color-coded by quality, no decoration, and contained within the page's normal card layout rather than dominating it.
- **Don't** invent a bespoke, hero-driven layout for a single feature page when the uniform grouped-card grid would serve the user better (violates the Consistent-Layout Rule). A page of consistent, self-contained **functional** cards, each a distinct settings group, is the correct default and the established QManager shape, not a failure. The Traffic Engine redesign (a full-width hero readout plus a 5xl/6xl focal number and an asymmetric mosaic unique to that one screen) is the cautionary example of this mistake. The genuinely repetitive case still belongs in a table or a tighter list, and a grid of *decorative* identical icon-plus-heading-plus-text cards carrying no real controls is still slop; but real, distinct, functional grouped cards on an even grid are exactly right.
- **Don't** hand-roll a component shadcn/ui already provides (tabs, accordion, dialog, popover, tooltip, select, dropdown, etc.). Use the shadcn primitive and style it with the tokens here. Custom components are for the gaps shadcn does not cover, not for re-implementing what it ships.
- **Don't** add bouncy, springy, or elastic motion. No `cubic-bezier` with overshoot. No Material-style decelerate-and-bounce. The Apple-instrument promise is *settled* motion, not *playful* motion. If a transition wobbles at the end, the curve is wrong.
- **Don't** animate value changes via fade-out-then-fade-in or via layout shifts. Tabular-nums plus a 200ms color transition is the only sanctioned pattern for live values. Anything else creates perceptible flicker in dense readouts.
- **Don't** make modals the first thought. Most "confirm an action" flows can use inline disclosure, a destructive button with an `aria-describedby` warning, or a deferred-banner pattern. Modals are for the genuinely irreversible (reboot, factory restore, IMEI write, Verizon MPDN release).
- **Don't** style the AT terminal, system logs, or IMEI strings with a monospace font. Manrope's tabular-nums + the `'ss01'` stylistic set handles fixed-width readouts; reaching for Geist Mono violates the Single-Voice Rule.
- **Don't** copy the aesthetic of any anti-reference named in PRODUCT.md: classic LuCI's bare tables, QNavigator/QCOM's putty-style monospace consoles, Netgear Nighthawk's cartoon-icon consumer simplification, or the generic AI/SaaS dashboard slop with hero-metric + identical-card-grid + gradient-text headings. If the screen could be reskinned for a CRM without changing anything, it has failed.
- **Don't** use em dashes in documentation. Use commas, colons, semicolons, periods, or parentheses. (UI copy follows its own i18n rules; this convention is for docs and code comments.)
