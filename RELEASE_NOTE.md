# 🚀 QManager BETA v0.1.24-draft

## ✨ New Features

- **Video Optimizer and Traffic Masquerade are now one page: Traffic Engine.** They were always two modes of the same engine that can never run at once, so they now live together at Local Network → Traffic Engine, with a single switch to flip between them. A live hero shows packets flowing through, the current rate, and how long the engine has been protecting your traffic, with the verification and injection tests right alongside. Switching modes asks for a quick confirm (it briefly restarts the engine) instead of showing a confusing "the other one is active" warning. Your old bookmarks still work and land on the right mode. Available in all supported languages.
- **Custom SIM Profiles now carry a Connection Scenario — and an optional daily schedule that switches scenarios automatically.** Each profile can be bound to a scenario (Balanced, Gaming, Streaming, or a custom one) that activates the moment you switch to that profile. Enable the schedule to go further: configure time blocks for each day of the week and QManager will swap scenarios automatically at the boundaries — e.g. Gaming from 8 AM to 9 PM, Balanced overnight. The device handles transitions entirely on its own, even if the app is closed. While a schedule is running, manual scenario changes are blocked with a clear "Scheduled" indicator showing the next switch time.
- **Redesigned APN Management with multiple connection profiles.** Manage all six of your modem's APN profiles from a single page — name each one, edit its APN, IP type, and authentication, and switch profiles on or off independently. Carrier-provisioned IMS (VoLTE) and emergency (SOS) profiles are clearly tagged and locked, so you can't accidentally break voice or 911 service. Available in all supported languages.
- **Modem temperature now shown on the login page.** The pre-login "Live Modem Status" card displays the current modem temperature. A warning badge appears automatically when the modem is running hot (≥ 60 °C) or overheating (≥ 75 °C).

## ✅ Improvements

- **The scenario scheduler in SIM Profile editing is easier to use.** Each scheduled time window is now a collapsible row that shows a one-line summary when closed (days, time range, and target scenario), so you can scan your whole schedule at a glance without scrolling through open editors. Drag priority with the up/down arrows on each row: the topmost matching rule wins. Quick preset buttons let you pick Every day, Weekdays, or Weekends in one tap. While the schedule is turned on, a live line at the bottom of the list shows which scenario is active right now and when the next switch happens. An "Ends next day" note appears under the End time whenever a rule wraps past midnight.
- **The installer now verifies every file is fully written and aborts loudly if a transfer was truncated.** A partial install (caused by ENOSPC, an interrupted download, or an aborted copy) can leave a shell script on disk that appears valid but does nothing — which once silently broke SIM profile activation with no visible error. The installer now catches this before it touches any running service.
- **SMS handling is more reliable.** The bundled SMS tool now targets the modem's message port by default, no longer prints harmless terminal warnings during normal use, and fails cleanly instead of crashing when a port is unavailable.
- **Dashboard Live Traffic now shows a clear "Off · Turn on" prompt instead of a stuck zero.** Live network speeds on the dashboard are powered by the Bandwidth Monitor (System Settings → Bandwidth Monitor). When it's off, the row tells you so with a direct link to the settings page. Turn it on to see real-time rx/tx speeds.
- **Modem temperature updates every 10 seconds instead of every 30.** The temperature read was moved to a faster poll tier and no longer competes with AT commands, so the displayed value is more current and more stable on RM551E hardware.
- **Modem temperature is now read directly from the device's built-in thermal sensors.** The reading comes from the SoC's on-chip sensors rather than an AT command, which is more reliable and avoids disturbing the modem on RM551E (SDX75) firmware. The displayed value now also blends in the processor cores alongside the radio and board sensors, for a temperature that better reflects the whole device.
- **Dashboard now recovers on its own after a reboot.** Previously, when the modem restarted — whether you triggered it or it rebooted on its own — the dashboard could get stuck on a "Data shown may be outdated" warning, forcing you to log out by hand. QManager now detects the device going unreachable, shows a reconnecting notice, and returns you to the login screen within about ten seconds so you can sign back in to live data.
- **Cell Scanner & Neighbour Cells: loading state is now responsive on phones.** The previous skeleton overflowed the card on screens narrower than ~375px. Both scanners now share one scanning view with an elapsed-time counter, and result tables scroll horizontally on narrow viewports instead of breaking the page layout.
- **Cell scan result tables: pagination footer stacks on narrow screens and meets mobile touch-target sizes.** Previous/Next buttons grow to a thumb-friendly 44px when stacked, and the row count moves above them so nothing gets clipped.
- **Neighbour Cells: column-visibility menu now shows translated column names** instead of raw IDs like `networkType` or `signalStrength`.
- **Scan loading state now announces to screen readers** via an ARIA live region while a scan is in progress.
- **Tower Locking carrier picker now shows EARFCN/ARFCN values.** Each option in the LTE and NR-SA Simple Mode dropdowns now displays a PCC/SCC tag, the band, the channel number in parentheses, and RSRP in dBm — making it easier to identify the right carrier at a glance.
- **Watchdog: spurious "New SIM card detected" notification after recovery is fixed.** When the watchdog switched to your backup SIM and you later rebooted, you'd see a misleading "physical SIM swap" banner. The active SIM is now remembered properly across reboots.
- **Watchdog: settings now require picking a backup slot when "Switch to Backup SIM" is enabled.** Previously you could turn the option on without choosing a slot — the watchdog would silently skip that recovery step. The form now blocks Save until a slot is selected.
- **Watchdog: status page reflects auto-disabled state within 30 seconds without needing a refresh.** If the watchdog disabled itself after too many reboots, the warning banner now appears automatically while you're on the page.
- **Watchdog: brief gaps in connectivity-check data no longer trigger spurious recovery escalation.** A momentary hiccup in the ping daemon used to push the watchdog one step closer to a reboot. It now waits briefly for fresh data before deciding.
- **Watchdog: Network Events log now records "SIM failover confirmed" once a swap is verified to have restored connectivity** — complementing the existing "switching SIM" notice so you can see at a glance whether the failover actually worked.
- **Watchdog: SIM revert now logs and surfaces a clear error if the modem fails to come back, instead of silently chasing a dead modem.**
- **Watchdog: at startup, the watchdog now verifies the modem is on the recorded SIM slot before resuming SIM failover state** — preventing a stale state if anything else changed slots while the watchdog was down.

## 📥 Installation

### Fresh Install

```sh
curl -fsSL -o /tmp/qmanager-installer.sh https://raw.githubusercontent.com/dr-dolomite/QManager/development-home/qmanager-installer.sh && sh /tmp/qmanager-installer.sh
```

### Upgrading from v0.1.23

**System Settings → Software Update.** No migration steps needed. All settings preserved.

## 💙 Thank You

Bug reports and feature requests welcome on [GitHub Issues](https://github.com/dr-dolomite/QManager/issues).

If QManager saves you time, consider [donating via Wise](https://wise.com/pay/business/blackcatdev?currency=USD) or [PayPal](https://paypal.me/iamrusss). You can also [sponsor on GitHub](https://github.com/sponsors/dr-dolomite).

**License:** MIT + Commons Clause — **Happy connecting!**

---

# 🚀 QManager BETA v0.1.23

A reliability and polish release.

## ⚠️ Heads Up Before Updating

**Tailscale users:** This update swaps Tailscale to a smaller, firmware-upgrade-friendly package (`tailscale-tiny`). Your node stays authorized — no re-login needed. Expect a ~5–15 second tunnel drop during the swap. **If you're managing this device remotely over Tailscale, update from a local connection instead.**

## ✨ New Features

- **Force Tailscale Fixes toggle.** New opt-in switch in System Settings re-applies QManager's own firewall zone and mwan3 routing fixes for `tailscale0` on top of any firmware. Recommended for R02 firmware users where outbound reply packets get marked for WAN egress and never traverse the tunnel. Off by default; survives reboots once enabled.

## ✅ Improvements

- **Fixed Video Optimizer / Traffic Masquerade going silent after firewall changes.** Any firewall reload — VPN install, port forward save, mwan3 refresh — would silently wipe the DPI rules, leaving the feature appearing active but doing nothing. Rules now survive all firewall reloads and reboots. *(Deployed as a permanent fw4 nftables fragment.)*
- **Fixed Custom SIM Profile activation failing with "start_failed".** Manual activation from the UI consistently failed while boot auto-activation worked fine. The backend's two concurrency locks were sharing one file, causing the apply worker to treat its own launcher as a conflict and abort. Locks are now separate.
- **Fixed Cancel / Close buttons showing English in translated UIs.** Buttons in Custom Profiles, Connection Scenarios, SMS, and AT Terminal dialogs now respect the active language instead of falling back to `cancel` / `close`.
- **Tailscale migrated to `tailscale-tiny`.** Smaller install, survives firmware upgrades without reinstall.

## 🌐 Translations

- Italian (it) and Indonesian (id) language packs updated to v2026.05.03.

### Changes in v0.1.23 (for contributors)

**Added** — `system-settings.json` → `system.*`:

| Key | English source string |
|---|---|
| `force_tailscale_fixes_label` | `Force Tailscale Fixes` |
| `force_tailscale_fixes_info_aria` | `Force Tailscale Fixes info` |
| `force_tailscale_fixes_tooltip` | `Applies QManager's own Tailscale firewall and routing fixes on top of your firmware. Recommended for R02 firmware.` |
| `force_tailscale_fixes_toast_enabled` | `Force Tailscale Fixes enabled — applying firewall zone and mwan3 exception` |
| `force_tailscale_fixes_toast_disabled` | `Force Tailscale Fixes disabled — removing firewall zone` |
| `force_tailscale_fixes_toast_failed` | `Failed to update Force Tailscale Fixes` |

**Modified:** none.
**Removed:** none.

Want to contribute? No coding needed — see [`docs/i18n/CONTRIBUTING.md`](https://github.com/dr-dolomite/QManager/blob/development-home/docs/i18n/CONTRIBUTING.md).

## 📥 Installation

### Fresh Install

```sh
curl -fsSL -o /tmp/qmanager-installer.sh https://raw.githubusercontent.com/dr-dolomite/QManager/development-home/qmanager-installer.sh && sh /tmp/qmanager-installer.sh
```

### Upgrading from v0.1.22

**System Settings → Software Update.** No migration steps needed. All settings preserved.

## 💙 Thank You

Bug reports and feature requests welcome on [GitHub Issues](https://github.com/dr-dolomite/QManager/issues).

If QManager saves you time, consider [donating via Wise](https://wise.com/pay/business/blackcatdev?currency=USD) or [PayPal](https://paypal.me/iamrusss). You can also [sponsor on GitHub](https://github.com/sponsors/dr-dolomite).

**License:** MIT + Commons Clause — **Happy connecting!**
