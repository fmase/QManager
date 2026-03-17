# QManager Design System

This document defines the visual language, component library, theming system, and UI conventions used throughout QManager.

---

## Design Philosophy

QManager targets **hobbyist power users** and **field technicians** managing cellular modems. The interface must balance information density (signal metrics, carrier data) with clarity and approachability.

### Principles

1. **Data clarity first** — Signal metrics, latency, and network status are the core experience. Use color, spacing, and hierarchy for scannable numbers.
2. **Progressive disclosure** — Essential info upfront, advanced controls accessible but not overwhelming.
3. **Confidence through feedback** — Every action has clear visual feedback: loading states, success toasts, error messages.
4. **Consistent and systematic** — shadcn/ui components and design tokens used uniformly.
5. **Responsive and resilient** — Works on desktop monitors and tablets. Handles loading, empty, and error states.

### Aesthetic Direction

- **Visual tone:** Clean and modern with purposeful density where data matters
- **References:** Apple System Preferences (clarity), Vercel/Linear (typography, whitespace), Grafana (data density), UniFi (network UX)
- **Anti-references:** Avoid raw terminal aesthetics, cluttered legacy tools, or overly playful styling

---

## Color System (OKLCH)

QManager uses OKLCH (Oklab Lightness, Chroma, Hue) for perceptually uniform colors. Both light and dark modes are first-class citizens.

### Light Mode

| Token | OKLCH Value | Usage |
|-------|-------------|-------|
| `--background` | `oklch(1 0 0)` | Page background (white) |
| `--foreground` | `oklch(0.141 0.005 285.823)` | Primary text (near black) |
| `--card` | `oklch(1 0 0)` | Card backgrounds |
| `--primary` | `oklch(0.488 0.243 264.376)` | Primary actions, links (blue) |
| `--primary-foreground` | `oklch(0.97 0.014 254.604)` | Text on primary bg |
| `--secondary` | `oklch(0.967 0.001 286.375)` | Secondary backgrounds |
| `--muted` | `oklch(0.967 0.001 286.375)` | Muted backgrounds |
| `--muted-foreground` | `oklch(0.552 0.016 285.938)` | Secondary text |
| `--accent` | `oklch(0.967 0.001 286.375)` | Accent backgrounds |
| `--destructive` | `oklch(0.577 0.245 27.325)` | Destructive actions (red) |
| `--success` | `oklch(0.59 0.18 149)` | Success indicators (green) |
| `--warning` | `oklch(0.75 0.18 75)` | Warning indicators (amber) |
| `--info` | `oklch(0.62 0.19 255)` | Info indicators (blue) |
| `--border` | `oklch(0.92 0.004 286.32)` | Borders and dividers |
| `--input` | `oklch(0.92 0.004 286.32)` | Input borders |
| `--ring` | `oklch(0.708 0 0)` | Focus rings |

### Dark Mode

| Token | OKLCH Value | Change from Light |
|-------|-------------|-------------------|
| `--background` | `oklch(0.141 0.005 285.823)` | Charcoal |
| `--foreground` | `oklch(0.985 0 0)` | Near white |
| `--card` | `oklch(0.21 0.006 285.885)` | Elevated dark |
| `--secondary` | `oklch(0.274 0.006 286.033)` | Darker neutral |
| `--muted-foreground` | `oklch(0.705 0.015 286.067)` | Lighter secondary text |
| `--destructive` | `oklch(0.704 0.191 22.216)` | Brighter red for contrast |
| `--success` | `oklch(0.65 0.17 149)` | Brighter green |
| `--warning` | `oklch(0.80 0.16 75)` | Brighter amber |
| `--info` | `oklch(0.68 0.17 255)` | Brighter blue |
| `--border` | `oklch(1 0 0 / 10%)` | Subtle white border |
| `--input` | `oklch(1 0 0 / 15%)` | Slightly more visible |

### Semantic Color Usage

| Purpose | Class | Token |
|---------|-------|-------|
| Primary buttons/links | `bg-primary text-primary-foreground` | `--primary` |
| Destructive actions | `bg-destructive text-destructive-foreground` | `--destructive` |
| Success indicators | `bg-success text-success-foreground` | `--success` |
| Warning indicators | `bg-warning text-warning-foreground` | `--warning` |
| Info indicators | `bg-info text-info-foreground` | `--info` |
| Muted/secondary text | `text-muted-foreground` | `--muted-foreground` |
| Card surfaces | `bg-card text-card-foreground` | `--card` |

**Important:** Use semantic tokens (`text-info`, `bg-success`) instead of raw Tailwind colors (`text-blue-500`, `bg-green-500`).

### Chart Colors

Six chart colors are defined for Recharts visualizations:

| Token | OKLCH | Visual |
|-------|-------|--------|
| `--chart-1` | `oklch(0.809 0.105 251.813)` | Light blue |
| `--chart-2` | `oklch(0.623 0.214 259.815)` | Medium blue |
| `--chart-3` | `oklch(0.546 0.245 262.881)` | Deep blue |
| `--chart-4` | `oklch(0.488 0.243 264.376)` | Primary blue |
| `--chart-5` | `oklch(0.424 0.199 265.638)` | Dark blue |
| `--chart-6` | `oklch(0.705 0.213 47.604)` | Orange (contrast) |

---

## Typography

### Primary: Euclid Circular B

Clean, geometric, professional typeface loaded locally as WOFF2 files.

| Weight | File | Usage |
|--------|------|-------|
| 300 (Light) | `EuclidCircularB-Light.woff2` | Decorative headings |
| 400 (Regular) | `EuclidCircularB-Regular.woff2` | Body text, inputs |
| 400 (Italic) | `EuclidCircularB-Italic.woff2` | Emphasis |
| 500 (Medium) | `EuclidCircularB-Medium.woff2` | Subheadings, labels |
| 600 (SemiBold) | `EuclidCircularB-SemiBold.woff2` | Card titles |
| 700 (Bold) | `EuclidCircularB-Bold.woff2` | Page titles |

CSS Variable: `--font-euclid`
Tailwind: `font-sans` (mapped via `@theme inline`)

### Secondary: Manrope

Google Font, used as fallback. Clean geometric style that pairs well with Euclid.

### Monospace: Geist Mono

System monospace, used for code, AT commands, and technical values.

CSS Variable: `--font-geist-mono`
Tailwind: `font-mono`

---

## Spacing & Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.65rem` | Base border radius |
| `--radius-sm` | `calc(0.65rem - 4px)` | Small elements, badges |
| `--radius-md` | `calc(0.65rem - 2px)` | Inputs, buttons |
| `--radius-lg` | `0.65rem` | Cards, dialogs |
| `--radius-xl` | `calc(0.65rem + 4px)` | Large containers |

The radius is softly rounded — not pill-shaped, not sharp-cornered.

---

## Component Library

### shadcn/ui Configuration

```json
{
  "style": "new-york",
  "rsc": true,
  "tailwind": {
    "baseColor": "zinc",
    "cssVariables": true
  },
  "iconLibrary": "lucide"
}
```

### Available Components (42)

**Layout:** `card`, `separator`, `aspect-ratio`, `sidebar`, `scroll-area`, `resizable`

**Navigation:** `breadcrumb`, `navigation-menu`, `menubar`, `tabs`

**Forms:** `button`, `input`, `label`, `select`, `checkbox`, `radio-group`, `switch`, `toggle`, `toggle-group`, `slider`, `input-otp`, `form` (React Hook Form integration)

**Data Display:** `table`, `badge`, `avatar`, `progress`, `chart` (Recharts wrapper)

**Feedback:** `alert`, `alert-dialog`, `dialog`, `popover`, `tooltip`, `hover-card`, `sonner` (toasts)

**Menus:** `dropdown-menu`, `context-menu`, `command` (cmdk search)

**Content:** `accordion`, `collapsible`, `carousel`, `drawer` (vaul)

**Custom:**
- `animated-beam` — Signal beam animation
- `animated-list` — Animated list transitions
- `empty.tsx` — Empty state with icon and message
- `field.tsx` — Labeled field display (label + value)
- `input-group.tsx` — Input with prefix/suffix
- `kbd.tsx` — Keyboard shortcut display

### MagicUI Registry

Additional components available from MagicUI (`@magicui` registry in `components.json`).

---

## UI Patterns

### Card Layout

The standard settings card:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Feature Name</CardTitle>
    <CardDescription>What this does in plain language</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Form fields or data display */}
  </CardContent>
  <CardFooter className="flex justify-end gap-2">
    <Button variant="outline" onClick={reset}>Reset</Button>
    <Button onClick={save} disabled={isSaving}>
      {isSaving ? "Saving..." : "Save Changes"}
    </Button>
  </CardFooter>
</Card>
```

### Three-State Pattern

Every data component must handle loading, error, and empty states:

```tsx
// Loading
<Card>
  <CardContent className="p-6">
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4 mt-2" />
  </CardContent>
</Card>

// Error
<Alert variant="destructive">
  <AlertDescription>{error.message}</AlertDescription>
</Alert>

// Empty
<Empty
  icon={InboxIcon}
  title="No data available"
  description="Data will appear once the modem is connected"
/>
```

### Signal Quality Indicators

Use consistent color mapping for signal quality:

| Quality | Color | RSRP | RSRQ | SINR |
|---------|-------|------|------|------|
| Excellent | `text-success` | >= -80 | >= -5 | >= 20 |
| Good | `text-info` | >= -100 | >= -10 | >= 13 |
| Fair | `text-warning` | >= -110 | >= -15 | >= 0 |
| Poor | `text-destructive` | < -110 | < -15 | < 0 |

### Toast Notifications

Use `sonner` for all user feedback:

```tsx
import { toast } from "sonner";

// Success
toast.success("Settings saved successfully");

// Error
toast.error("Failed to save settings", {
  description: error.message
});
```

### Reboot Dialog

For operations requiring a device reboot:

```tsx
<Dialog open={showRebootDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Reboot Required</DialogTitle>
      <DialogDescription>
        Changes have been saved. A reboot is required to apply them.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={dismiss}>Later</Button>
      <Button variant="destructive" onClick={reboot}>Reboot Now</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Badge Variants

Use badges for status indicators:

```tsx
// Connected state
<Badge variant="default" className="bg-success">Connected</Badge>

// Warning state
<Badge variant="default" className="bg-warning">Degraded</Badge>

// Error state
<Badge variant="destructive">Error</Badge>

// Inactive/unknown
<Badge variant="secondary">Unknown</Badge>
```

---

## Sidebar Design

The sidebar uses the `inset` variant with a header, content sections, and user footer:

| Section | Components | Items |
|---------|-----------|-------|
| Header | Logo + "QManager" / "Admin" | QManager logo SVG |
| NavMain | Home | Single link to dashboard |
| NavCellular | Collapsible groups | Cellular Info, SMS, Profiles, Band Locking, Cell Scanner, Settings |
| NavLocalNetwork | Flat list | Ethernet, IP Passthrough, DNS, TTL & MTU |
| NavMonitoring | Collapsible groups | Events, Email Alerts, Tailscale, Watchdog, Logs |
| NavSecondary | Flat list + donate dialog | About Device, Support, Donate |
| Footer | NavUser | User avatar, change password, logout |

---

## Responsive Design

### Container Queries

The main content area uses container queries for responsive layouts:

```tsx
<main className="@container/main">
  <div className="grid gap-4 @lg/main:grid-cols-2 @xl/main:grid-cols-3">
    {/* Cards resize based on container, not viewport */}
  </div>
</main>
```

### Breakpoints

Standard Tailwind breakpoints apply:

| Prefix | Width | Usage |
|--------|-------|-------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet portrait |
| `lg` | 1024px | Tablet landscape / small desktop |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Large desktop |

### Mobile Considerations

- Sidebar collapses to sheet on mobile
- Cards stack vertically
- Tables become horizontally scrollable
- Touch-friendly button sizes (min 44px)

---

## Dark Mode

### Implementation

Dark mode uses `next-themes` with class-based toggling:

```tsx
// app/layout.tsx
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

### CSS

The `.dark` selector is defined as a custom Tailwind variant:

```css
@custom-variant dark (&:is(.dark *));
```

All colors automatically switch between light and dark palettes via CSS variables.

### Guidelines

- Never use hardcoded colors (e.g., `#ffffff`, `rgb(0,0,0)`)
- Always use semantic tokens (`text-foreground`, `bg-card`)
- Test both modes when adding new colors
- Dark mode should have slightly brighter semantic colors for contrast

---

## Animations

### Libraries

- **tw-animate-css** — Tailwind animation utilities (fade, slide, scale)
- **Motion** (Framer Motion) — Complex component animations

### Custom Animations

```css
/* Pulsating ring for status indicators */
.animate-pulse-ring {
  animation: pulse-ring 2s ease-in-out infinite alternate;
}
```

All animations respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  .animate-pulse-ring { animation: none; }
}
```

---

## Icons

### Lucide React

Primary icon library. Consistent stroke width and sizing:

```tsx
import { RadioTowerIcon, SettingsIcon } from "lucide-react";

<RadioTowerIcon className="size-4" />     // 16px (inline text)
<SettingsIcon className="size-5" />       // 20px (buttons)
<RadioTowerIcon className="size-8" />     // 32px (empty states)
```

### Tabler Icons

Secondary icon library (`@tabler/icons-react`) for specialized icons not in Lucide.

### Icon-Only Buttons

Always include `aria-label` for accessibility:

```tsx
<Button variant="ghost" size="icon" aria-label="Refresh data">
  <RefreshCwIcon className="size-4" />
</Button>
```
