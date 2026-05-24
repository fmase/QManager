# 🚀 QManager BETA v0.1.24

## ✨ New Features

- **Modem temperature now shown on the login page.** The pre-login "Live Modem Status" card displays the current modem temperature. A warning badge appears automatically when the modem is running hot (≥ 60 °C) or overheating (≥ 75 °C).

## ✅ Improvements

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
