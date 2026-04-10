# 🚀 QManager BETA v0.1.14

**SMS Alerts launch — get downtime notifications even when the data path is offline.**

---

## ✨ New Features

### SMS Alerts

- **Downtime SMS notifications** — Receive an SMS when internet downtime exceeds your configured threshold.
- **Outage-proof delivery path** — Alerts are sent via `sms_tool` over the modem control channel, so delivery still works while data connectivity is down.
- **Configurable behavior** — Set recipient phone and threshold (1-60 minutes), then trigger a test SMS directly from the dashboard.
- **SMS alert history** — Sent and failed alert attempts are logged and displayed in the SMS Alerts log card.

Path: Monitoring -> SMS Alerts (`/monitoring/sms-alerts`)

### IMEI Toolkit

For educational purposes only. Use at your own risk.

- **Built-in IMEI generator** — Generate valid 15-digit IMEI values from device TAC presets or a custom 8-12 digit prefix.
- **Automatic Luhn validation** — Validate typed or pasted IMEI values in real time once 15 digits are entered.
- **Structure breakdown** — Inspect TAC, SNR, and check digit fields directly in the toolkit for quick verification.
- **Utility actions** — Copy generated IMEI values and open external IMEI info lookup in one click.

Path: Cellular -> Settings -> IMEI Settings (`/cellular/settings/imei-settings`)

## 🐛 Bug Fixes

### SMS Test Send Error Visibility

- **Generic test-send failures in UI** — Test SMS failures previously surfaced as a generic toast even when backend details were available.
- **Fix** — The frontend now propagates backend `detail`/`error` from `send_test` responses so the toast shows actionable failure reasons.

---

## 📥 Installation

### Fresh Install

```sh
wget -O /tmp/qmanager-installer.sh \
  https://github.com/dr-dolomite/QManager/raw/refs/heads/development-home/qmanager-installer.sh && \
  sh /tmp/qmanager-installer.sh
```

### Upgrading from v0.1.13

Head to **System Settings → Software Update** and hit "Check for Updates" — download, verify, then install with the two-step flow.

---

# 🚀 QManager BETA v0.1.13

**Custom SIM Profile reliability improvements — SIM mismatch detection, profile lifecycle events, and DPI boot persistence.**

---

## 🐛 Bug Fixes

### Custom SIM Profiles — IMEI Apply Persistence

- **Profile showed "Inactive" after IMEI change + reboot** — When a profile applied a new IMEI, the modem reboot (`AT+CFUN=1,1`) could trigger a full system reboot on some USB configurations, killing the apply script before it could mark the profile as active.
- **Fix** — The active profile marker is now written to flash immediately after a successful IMEI write (`AT+EGMR`), before the modem reboot command is issued. If the system reboots during the modem reset, the profile is already marked active. Finalization still re-sets on success or clears on total failure.

### DPI Services Not Surviving Reboot

- **Video Optimizer and Traffic Masquerade settings didn't persist across reboots** — The CGI save handlers set UCI config and restarted the service, but never called `/etc/init.d/qmanager_dpi enable` to register for boot startup.
- **Fix** — Enabling either DPI feature now also enables the init.d service for boot. Disabling only removes boot persistence when both features are off. Uninstall always cleans up the boot symlink.

---

## ✨ New Features

### Custom Profile SIM Mismatch Detection

- **Auto-deactivation on SIM swap** — When the device boots with a different SIM card, the poller now checks if the active profile's ICCID matches the current SIM. If there's a mismatch, the profile is automatically deactivated and a warning event is emitted. Profiles without a stored ICCID are left alone.
- **SIM Mismatch badge** — The profile table now shows a warning badge ("SIM Mismatch") instead of the blue "Active" badge when the active profile was created for a different SIM than the one currently inserted.

### Custom Profile Network Events

- **Profile lifecycle events** — Profile apply, failure, and deactivation are now tracked in the Network Events system:
  - `Profile Applied` (info / warning for partial) — when a profile is successfully applied
  - `Profile Failed` (error) — when all apply steps fail
  - `Profile Deactivated` (info / warning for SIM mismatch) — when a profile is manually or automatically deactivated
- Events appear in the **Data Connection** tab of the Network Events card

## 📥 Installation

### Fresh Install

```sh
wget -O /tmp/qmanager-installer.sh \
  https://github.com/dr-dolomite/QManager/raw/refs/heads/development-home/qmanager-installer.sh && \
  sh /tmp/qmanager-installer.sh
```

### Upgrading from v0.1.12

Head to **System Settings → Software Update** and hit "Check for Updates" — download, verify, then install with the two-step flow.

---

## Thank You

Thanks for using QManager! If you find it useful, consider [supporting the project](https://paypal.me/iamrusss). Bug reports and feature requests are always welcome on [GitHub Issues](https://github.com/dr-dolomite/QManager/issues).

**License:** MIT + Commons Clause

**Happy connecting!**
