# 🚀 QManager BETA v0.1.23

A polish release with UI fixes and quality-of-life improvements.

## ✨ New Features

*(none this release)*

## ✅ Improvements

- **Fixed Custom SIM Profile activation failing immediately.** Activating a profile from the UI returned a "start_failed" error while boot-time auto-activation continued to work. The CGI's spawn-mutex and the apply worker's singleton lock were sharing one PID file, causing the worker to see its parent CGI as a foreign process and abort. The two locks now live in separate files.
- **Fixed Cancel / Close buttons not respecting the active language.** Dialog buttons labelled "Cancel" and "Close" across Custom Profiles, Connection Scenarios, SMS, and the AT Terminal were falling back to lowercase English (`cancel`, `close`) instead of the proper translated label. Affects the Activate, Deactivate, and Delete confirmation dialogs in Custom Profiles; the Add / Edit / Delete dialogs in Connection Scenarios; all three delete confirmations and the Compose dialog in SMS; and the warning banner in the AT Terminal.

## 📥 Installation

### Fresh Install

```sh
curl -fsSL -o /tmp/qmanager-installer.sh https://raw.githubusercontent.com/dr-dolomite/QManager/development-home/qmanager-installer.sh && sh /tmp/qmanager-installer.sh
```

### Upgrading from v0.1.22

Head to **System Settings → Software Update** and run the update. **No migration steps required.**

Your Custom SIM Profiles, tower locks, Signal Failover settings, VPN config, watchdog preferences, SMS alerts, and installed language packs are all preserved.

## 💙 Thank You

Thank you to everyone using, sharing, and supporting QManager — it means a lot. If you'd like to contribute a translation, the guide at [`docs/i18n/CONTRIBUTING.md`](https://github.com/dr-dolomite/QManager/blob/development-home/docs/i18n/CONTRIBUTING.md) walks you through it — no coding required.

Bug reports and feature requests are always welcome on [GitHub Issues](https://github.com/dr-dolomite/QManager/issues).

If you find QManager useful, consider [sponsoring on GitHub](https://github.com/sponsors/dr-dolomite) or sending GCash via Remitly to **Russel Yasol** (+639544817486).

**License:** MIT + Commons Clause

**Happy connecting!**
