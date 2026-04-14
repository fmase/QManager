# 🚀 QManager BETA v0.1.16

This release improves backup and restore workflows, modem recovery, and installation reliability on OpenWRT devices.

## ✨ New Features

- Added a new Configuration Backup page at System Settings -> Configuration Backup.
- You can now create encrypted backups and choose exactly which settings to include.
- Restore now runs in the background with progress updates and retry handling.
- If restore requires a reboot, QManager now prompts you at the end instead of interrupting the flow.
- Added a Quick Modem Reconnect action in the user menu for faster recovery.

## ✅ Improvements

- Tower Locking is more reliable, including better failover status handling.
- Fixed cases where applying a new tower lock could be blocked even when no lock was active.
- Improved compatibility with older saved tower-lock settings to prevent settings-page errors.
- Fresh install bootstrap is now more reliable: installer release resolution no longer falls back to old tags like v0.1.0.
- Release channel resolution (`--channel stable|prerelease|any`) now uses a BusyBox-safe parser for consistent latest-tag selection.
- Install and update now strictly enforce removal of conflicting packages: sms-tool, socat-at-bridge, and socat.
- Installer now retries conflict removal with forced dependency flags and stops early if conflicts remain.
- Dashboard and settings UI received small polish updates.

## 📥 Installation

### Fresh Install

```sh
curl -fsSL -o /tmp/qmanager-installer.sh https://raw.githubusercontent.com/dr-dolomite/QManager/development-home/qmanager-installer.sh && sh /tmp/qmanager-installer.sh
```

### Upgrading from v0.1.15

Head to System Settings -> Software Update and run the update.

## 💙 Thank You

Thanks for using QManager! If you find it useful, consider [supporting the project](https://paypal.me/iamrusss). Bug reports and feature requests are always welcome on [GitHub Issues](https://github.com/dr-dolomite/QManager/issues).

**License:** MIT + Commons Clause

**Happy connecting!**
