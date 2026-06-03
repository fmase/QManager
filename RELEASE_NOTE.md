# 🚀 QManager BETA v0.1.24-draft

## ✨ New Features

- **Video Optimizer and Traffic Masquerade are now one page: Traffic Engine.** They were always two modes of the same engine that can never run at once, so they now live together at Local Network → Traffic Engine, with a single switch to flip between them. A live hero shows packets flowing through, the current rate, and how long the engine has been protecting your traffic, with the verification and injection tests right alongside. Switching modes asks for a quick confirm (it briefly restarts the engine) instead of showing a confusing "the other one is active" warning. Your old bookmarks still work and land on the right mode. Available in all supported languages.
- **Custom SIM Profiles, redesigned — with Connection Scenario band-lock control and scheduled band locking.** Custom Profiles has been rebuilt into one consistent page: a guided Add/Edit form (Identity → Network → Scenario → Review, with a live summary before you save) beside your saved-profiles registry, where each profile shows its APN, CID, IP protocol, and status at a glance. Every profile can now carry a **Connection Scenario** that controls which LTE and 5G bands the modem locks to — bind a scenario to a profile and its band lock is applied the moment you activate that profile. Turn on the optional **daily schedule** for hands-off **scheduled band locking**: add up to two time windows and the modem swaps band-lock scenarios automatically at the boundaries (for example, a quiet band overnight and a faster one by day), entirely on the device even when the app is closed. While a schedule is running, manual scenario changes are blocked with a clear "Scheduled" indicator showing the next switch time. Available in all supported languages.
- **Redesigned APN Profiles — five named data-profile slots you switch between, with one active at a time.** Create up to five named APN profiles, each with its own APN string, PDP type, and target modem context. A single toggle switches the active profile — the previous one is deactivated automatically. Saving a profile that is not currently live is instant and does not touch the connection; switching to it is the step that drops and renegotiates the WAN. Slot badges show Active (green globe), Idle, or Empty at a glance. Available in all supported languages.
- **See your NR-DC bands.** The Band Locking page's SA NR5G card now has a swap toggle in its header (two arrows). Tap it to flip the slot between SA NR5G and NR-DC, then tap again to switch back — no extra page, no extra card. NR-DC is shown read-only: the modem manages these bands itself and they can't be locked manually, so the card simply shows which NR-DC bands are currently in use.
- **Read/Unread tabs in the SMS inbox.** The inbox now tracks which messages you've opened and splits them into All, Unread, and Read tabs. Unread messages are highlighted at a glance. "Mark all read" clears the badge in one tap. Read state is remembered in your browser — it does not require any modem changes and works with messages stored in both modem memory and on your SIM.
- **Modem temperature now shown on the login page.** The pre-login "Live Modem Status" card displays the current modem temperature. A warning badge appears automatically when the modem is running hot (≥ 60 °C) or overheating (≥ 75 °C).

## ✅ Improvements

- **APN Profile editor now clearly flags IMS and SOS contexts in the modem-slot picker.** Carrier-managed VoLTE and emergency contexts show colour-coded badges (amber "IMS", red "SOS") so they are immediately identifiable. Selecting one requires an extra confirmation step — a safety guard against accidentally overwriting a carrier-provisioned context.
- **App-wide motion is now buttery and consistent — one Apple-class feel everywhere.** Every screen, card, and control now shares the same silky, exponential ease (the kind you feel settling a Control Center toggle): pages glide in with a refined rise as you navigate, content settles into place instead of popping, and the sidebar responds to your touch with a subtle press. Nothing bounces or overshoots. If you've turned on Reduce Motion, the whole app honors it automatically with clean cross-fades.
- **Custom SIM Profiles: smoother creation, one clean loading state.** Carrier presets auto-fill APN, TTL, and Hop Limit for common operators, and "Load from SIM" reads the inserted SIM's ICCID, IMEI, and active APN into the form with one click. Required-field and duplicate-SIM checks catch mistakes before you save. The saved-profiles list now loads in a single pass: it waits until every profile's full settings are read, then reveals them complete, instead of showing the rows and then flashing a second time as the details fill in. Apple-class transitions throughout — a single calm loading state, and silky step-to-step motion in the editor.
- **Activating a profile again shows a step-by-step progress dialog.** The signature pipeline dialog — with a live progress bar and a per-step status ledger — is back as the activation surface. It also fixes a bug where activation could appear stuck (the "Activating" button would never resolve) if the status check fired in the brief moment before the background worker was fully started.
- **The installer now verifies every file is fully written and aborts loudly if a transfer was truncated.** A partial install (caused by ENOSPC, an interrupted download, or an aborted copy) can leave a shell script on disk that appears valid but does nothing — which once silently broke SIM profile activation with no visible error. The installer now catches this before it touches any running service.
- **SMS inbox now sorts newest-first correctly.** Messages sent in December and January were previously displayed out of order due to how the modem formats timestamps. The inbox now orders them correctly regardless of when in the year they were received.
- **Incoming texts stored on your SIM card now appear in the inbox.** Some carriers route incoming SMS to the SIM instead of modem memory, where they piled up invisibly until the card was nearly full and new messages were dropped. QManager now reads both locations into one inbox, marks SIM-stored messages with a "SIM" badge, and deletes them cleanly from either place — and it sets the correct routing at boot so future messages land in roomy modem memory automatically.
- **SMS handling is more reliable.** The bundled SMS tool now targets the modem's message port by default, no longer prints harmless terminal warnings during normal use, and fails cleanly instead of crashing when a port is unavailable.
- **The SMS inbox gains search, sort, and adjustable page size.** Find any message instantly by typing part of the sender or the text, flip the list between newest-first and oldest-first, and choose how many messages show per page (5 to 50) with first / previous / next / last controls. The loading placeholder now mirrors the real layout so the inbox settles into place without a flicker. Available in all supported languages.
- **Dashboard Live Traffic is now a live WebSocket stream with honest connection states.** Real-time download and upload speeds on the dashboard are served exclusively by the Bandwidth Monitor (System Settings → Bandwidth Monitor). When it's off, the row shows a clear "Off · Turn on" prompt that links straight to the settings page — instead of the old stuck zero. When it's on, you'll watch it connect and then stream live rx/tx, with a reconnecting indicator if the stream briefly drops. Download and upload now use distinct arrow colors — upload in Stream Violet — so the two directions are easy to tell apart at a glance.
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
