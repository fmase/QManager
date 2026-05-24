# Product

## Register

product

## Users

**Hobbyist power users and field technicians managing Quectel modems on OpenWRT.** Technically literate without being developers: comfortable with concepts like APN, PCI, RSRP, and bands, but not expected to read shell scripts or write AT commands by hand.

Two session shapes share the same UI:

- **The quick check.** Mid-day glance at signal, watchdog state, recent events. Seconds, not minutes. Often on a phone or tablet beside the modem.
- **The focused configuration.** Activating a custom SIM profile, locking to a tower, tuning DPI for a specific carrier, restoring a backup. Minutes of deliberate work, usually at a desk on a laptop, occasionally roadside on a tablet in direct sun.

QManager runs **on the modem it manages**. A wrong click can sever the user's own connection. That single fact shapes every confirmation, every deferred reboot, every persistent banner in the product.

## Product Purpose

QManager is the modern web GUI for Quectel cellular modems running OpenWRT (RM520N-GL, RM551E-GL, RM500Q, and similar). It replaces the engineer-flavored defaults (classic LuCI, raw AT consoles, vendor utilities) with an interface that respects the user's intelligence without requiring modem-engineering background.

Success looks like:

- A first-time user reaches signal-and-network clarity within thirty seconds of loading the dashboard.
- A returning user activates a saved SIM profile, locks a tower, or restores a backup in one focused session, with no terminal fallback required.
- A power user can still see every underlying value (EARFCN, PCI, CFUN state, NFQUEUE rules) when they want to, without having to be confronted with all of it by default.
- The modem never gets bricked, stranded, or silently reconfigured by the UI it serves.

## Brand Personality

**Modern, Approachable, Smart.** A premium engineering tool that talks to you like a peer, not a novice and not a sysadmin.

- **Voice.** Direct, specific, never apologetic. "Lock to cell 412" beats "Are you sure you want to proceed?". Real units, real values, real consequences in plain language.
- **Tone.** Calm by default. Risk surfaces visibly (destructive variant, warning copy, explicit dialog) but the routine 90% feels quiet and confident.
- **Feel.** Silky and buttery in motion: every transition, panel slide, badge state change, and chart update should feel Apple-class smooth, not snappy-corporate, not springy-playful, not Material-pop. Restraint with refinement.
- **Emotional goals.** Two we want users to feel often, in this order:
  1. **Trust** that the modem will still be up tomorrow morning and that nothing the UI does behind the scenes will surprise them.
  2. **Competence**, fast. The interface should make a new user feel like they already know what they're doing within a few clicks, not after reading docs.

### Reference touchstones

**Primary reference (heavy, load-bearing):**

- **Ubiquiti UniFi** (Network Controller, UniFi OS, Protect). The dominant aesthetic and structural reference. Four specific facets are adopted, not just borrowed in spirit:
  1. **Dense pill-and-tag data tables and metric tiles.** UniFi packs high data density via tightly-styled outline pills, status tags, and inline mini-stats. QManager's existing outline-badge pattern (`bg-{role}/15 + text-{role} + border-{role}/30`) is the same idea; UniFi raises it from "a rule" to "a signature aesthetic."
  2. **Dashboard as a varied-size widget mosaic.** UniFi dashboards mix big hero widgets (topology, throughput, hero metric) with smaller stat tiles in deliberate asymmetric composition. Never a uniform card grid. This is the anti-template against generic SaaS dashboard slop.
  3. **Topology maps and network visualizations as first-class UI.** UniFi treats the network map as a primary surface, not an afterthought. QManager applies this to cell-tower constellations, antenna geometry, MIMO stream layouts, neighbor-cell relationships.
  4. **Live-updating tiles that tick smoothly.** Numbers update via tabular-numbers and short color transitions, sparkline tails grow live, chart series breathe. Alive without distracting. Pairs perfectly with the silky Apple-class motion direction.

**Supporting references (one facet each):**

- **Linear** — voice and microcopy. Restraint, precision, expert-tool register in every confirmation, error, and label.
- **Vercel dashboard** — light-and-dark parity, OKLCH-era color restraint, modern polish without corporate stiffness.
- **Grafana** — when data viz earns dense readouts. Specifically informs the signal panel, latency monitor, bandwidth chart, antenna alignment meter.
- **Raycast** — power-user UX without intimidation. Informs the AT terminal, command-palette interactions, instant feedback patterns.

**Atmospheric hints:**

- **Nokia FastMile 5G Gateway 7 web interface** — borrowed for the **big circular signal-quality meter** as the hero readout, the friendly-but-technical balance, and the soft Bell-Labs-flavored card treatment on signal pages. Applied selectively, not system-wide; the hint lands on signal/antenna surfaces and recedes elsewhere.
- **Askey CPE Management Utility (iF Design Award winner)** — the proof a CPE interface can be design-award-worthy. Contributes editorial whitespace, bolder typographic hierarchy on dashboard hero sections, and the premium-consumer feel that softens density without diluting it. The aspirational standard: when in doubt, raise the craft.

## Anti-references

What QManager explicitly should not look or feel like:

- **Classic LuCI and OpenWRT defaults.** Bare tables, browser-default form widgets, dense data with no hierarchy, no progressive disclosure. The "engineer UI" QManager exists to replace.
- **Terminal and putty-style modem utilities (QNavigator, QCOM, raw AT consoles, Quectel's own QNavigator-class tools).** Monospace-everything, command-shaped, assumes you already know which AT command to send. QManager respects expertise without requiring it.
- **Consumer router and "smart home" apps (Netgear Nighthawk, TP-Link Tether, AT&T Smart Home Manager, Linksys Smart Wi-Fi).** Oversimplified, marketing-flavored, hides what power users need behind cartoon icons and gradient hero metrics. Wizards that block direct access.
- **Generic AI/SaaS dashboard slop.** Hero-metric template (big number, small label, gradient accent), identical icon-and-heading card grids, gradient text headlines, glassmorphism heroes. If the page could be reskinned for a CRM or a project tracker without changing anything, it has failed.

## Design Principles

1. **Data clarity first.** Metrics are scannable at a glance. Real units, sensible precision, no decoration that hurts legibility. The signal dashboard is the test case: someone glancing for half a second should know whether things are healthy.
2. **Progressive disclosure.** Essentials surface immediately, advanced controls stay one click away. A field tech does not need to see NFQUEUE rule syntax to understand that Video Optimizer is on.
3. **Confidence through feedback.** Every action shows loading, success, or error. Async pipelines (profile apply, config restore, language install) show per-step state. The user is never left wondering "did that work?".
4. **Consistent.** shadcn/ui components and design tokens used uniformly, no one-off styles. A status badge looks the same on the cellular page as it does on the watchdog page.
5. **Responsive and resilient.** Graceful loading, empty, and error states everywhere. Never a blank panel. Field-tech sessions on flaky signal cannot be allowed to leave the UI in an indeterminate state.
6. **Make the dangerous obvious, the safe effortless.** QManager runs on the modem it manages. Routine reads and saves feel quiet. Anything that can disrupt the connection (reboot, profile activation, MPDN release, band lock, IMEI write, factory restore) wears its risk visibly: destructive variant, warning copy, explicit dialog, deferred reboot with a persistent banner. The routine 90% should feel instant. The risky 10% should feel deliberate.

## Accessibility & Inclusion

- **WCAG 2.1 AA baseline**, with one project-specific extension below.
- **Outdoor-readable contrast.** Field technicians use this in direct sunlight on tablets and phones. All text and meaningful icons hit 4.5:1 minimum in both light and dark themes, including dense Grafana-style cards where small labels are most at risk. Validate with both themes against bright ambient assumption, not just dark-room AA.
- **Reduced motion respected.** `prefers-reduced-motion: reduce` disables the silky transitions called out in Brand Personality. The UI must remain perfectly usable (and feel intentional) when motion is off, not just functional.
- **Color is never the sole carrier of meaning.** Status badges always pair semantic color with an icon (`CheckCircle2Icon`, `TriangleAlertIcon`, `XCircleIcon`, `MinusCircleIcon`). Charts and signal-quality indicators must remain readable in deuteranopia and protanopia simulation; the current chart palette (5 blues + 1 orange) is acceptable today but any addition must be re-verified.
- **Keyboard-first.** Every primary action reachable without a mouse, focus rings visible against both themes, no keyboard traps in modals or the AT terminal.
- **Internationalization is a first-class concern.** EN and zh-CN are bundled; additional language packs are user-installable. Strings live in i18n catalogs, never inline. RTL support flagged per pack.
