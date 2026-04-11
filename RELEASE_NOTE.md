# 🚀 QManager BETA v0.1.14

**SMS Alerts are here, so you can receive downtime notifications even when the data path is offline. Plus, Custom SIM Profiles now auto-apply when a matching SIM is inserted.**

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

## 🔧 Backend / Infrastructure

### AT Command Backend — Migrated to `atcli_smd11`

- **New AT backend** — All AT command execution now goes through `atcli_smd11` instead of `sms_tool`. The new binary talks directly to `/dev/smd11`, is self-aware of long-command timeouts (e.g. `AT+QSCAN=3,1`, `AT+QFOTADL`), and produces clean output without the `tcgetattr(...)`/`tcsetattr(...)` diagnostics that `sms_tool` emits on char devices.
- **Simpler `qcmd`** — The gatekeeper script no longer needs dual timeout wrappers, the `-t 240` native-timeout flag, or per-command warm-up gymnastics. A single outer safety cap (`timeout 300`) guards against a wedged process; `atcli_smd11` handles the real timing.
- **`sms_tool` is now SMS-only** — The `sms_tool` binary still ships, but is reserved for SMS Center (recv/send/delete/status) and SMS Alerts. Every invocation now passes `-d /dev/smd11` explicitly and strips the tcgetattr/tcsetattr noise from its output before parsing, so the SMS inbox JSON, storage status, and test-SMS error messages are always clean.
- **Retired `sms_tool_device` setting** — The System Settings toggle to switch between `/dev/smd11` and `/dev/smd7` has been removed (both binaries are now device-locked).
- **Installer improvements** — `install.sh` now removes conflicting opkg packages (`sms-tool`, `socat-at-bridge`, `socat`) before installing, then copies both `atcli_smd11` and `sms_tool` from the bundled `dependencies/` folder with 755 permissions. The `sms-tool` opkg package is no longer a required dependency.
- **Shared `/dev/smd11` lock** — SMS Alerts and SMS Center now take the same `/var/lock/qmanager.lock` that `qcmd`/`atcli_smd11` use, so `sms_tool send`/`recv`/`delete`/`status` no longer race concurrent AT commands from the poller or watchdog on the char device.

### Phone Number Normalization — Simplified

- **One rule everywhere: omit the `+`** — SMS Alerts and SMS Center now share a single normalization rule: strip a leading `+` before handing the number to `sms_tool`. Nothing else. Inputs with or without `+` are accepted in the UI; storage in `sms_alerts.json` is always raw digits.
- **Removed MCC-based local-number rewriting** — `cellular/sms.sh` previously read the SIM's IMSI via `AT+CIMI` and rewrote numbers starting with `0` to an international form using a 270-line MCC-to-country-code lookup table. That lookup, the IMSI read, and the auto-prefixing are all gone — users are responsible for providing the full international number. This cuts `cellular/sms.sh` from 478 lines to 266 and removes a per-send AT round-trip.
- **Migration-safe for existing installs** — Legacy `sms_alerts.json` files containing `"recipient_phone": "+14155551234"` still work. `sms_alerts_init` does an in-memory `+` strip at boot; the file is rewritten the next time you save settings.

### Installation / Update Pipeline (So Far)

- **Build staging auto-cleanup** — `bun run package` now removes `qmanager-build/qmanager_install` after both `qmanager.tar.gz` and `sha256sum.txt` are successfully generated, leaving only release artifacts.
- **Safer conflict removal order** — Conflict package removal now prioritizes `sms-tool` before `socat-at-bridge` and `socat`, reducing opkg dependency-chain removal failures.
- **SSH-drop mitigation during upgrades** — The install stop phase no longer stops `qmanager_eth_link`, preventing an early `ethtool` renegotiation that could briefly drop the management link/SSH session.
- **Direct release workflow adopted** — Fresh install/uninstall docs now use direct latest pre-release tarball download + checksum verification + `install.sh`/`uninstall.sh` execution.
- **One-liner wrapper restored** — `qmanager-installer.sh` is now a thin bootstrap helper that runs the same direct tarball + checksum flow, but in a single command.

## 🐛 Bug Fixes

### Custom SIM Profiles — Auto-Apply on Matching SIM

- **Profiles did not auto-apply on matching ICCID in key flows** — A matching profile could be detected, but auto-apply was not consistently triggered across boot and SIM transition paths.
- **Fix** — Auto-apply now runs on boot, manual SIM slot switch, watchdog Tier 3 SIM failover, and watchdog SIM revert.
- **Idempotent behavior** — Existing per-step skip logic (APN/TTL/IMEI) ensures repeated triggers only apply differences and complete quickly when nothing changed.
- **Concurrency-safe** — Auto-apply respects the existing apply lock to avoid races with manual activation.

### Sidebar Active-State in Cellular Navigation

- **Cellular Information was highlighted on unrelated pages** — The parent item stayed active across other Cellular routes, which also kept its sub-items expanded even when viewing a different section.
- **Fix** — Sidebar route matching now activates Cellular Information only for its own route and declared sub-routes, preventing false highlighting and incorrect submenu expansion.

### APN Management Override with Active Custom Profile

- **APN fields could override active profile settings** — Users could still edit APN values while a Custom SIM Profile was active, creating conflicts with profile-managed APN behavior.
- **Fix** — APN form controls are now disabled whenever an active Custom SIM Profile is present, with an in-card notice showing profile ownership.
- **Carrier Profile remains configurable** — The Carrier Profile card stays editable so MBN selection and related carrier firmware controls are unchanged.

### Device Metrics + Onboarding Band Source Hardening

- **TA=0 showed misleading distance estimates** — LTE/NR Cell Distance in Device Metrics could display very small estimated values (e.g. `< 10 m`) when Timing Advance was `0`, even when that radio wasn't actively serving.
- **Fix** — Device Metrics now treats LTE/NR TA value `0` as unavailable and displays `-` instead of an estimated distance.
- **Temperature averaging included zero sensors** — In edge cases, `AT+QTEMP` sensor readings of `0` were included in the average, lowering the displayed modem temperature.
- **Fix** — Temperature parsing now excludes all non-positive sensor values (`<= 0`) before averaging.
- **Onboarding used hardcoded band catalogs** — Band preference options in onboarding were based on static LTE/NR lists rather than modem capabilities.
- **Fix** — Onboarding now reads supported LTE/NSA/SA bands from the poller status JSON (`device.supported_*_bands`) and uses those as the available selection set.

---

## 📥 Installation

### Fresh Install

```sh
curl -fsSL -o /tmp/qmanager-installer.sh https://raw.githubusercontent.com/dr-dolomite/QManager/development-home/qmanager-installer.sh && sh /tmp/qmanager-installer.sh
```

### Upgrading from v0.1.13

Head to **System Settings → Software Update** and hit "Check for Updates" — download, verify, then install with the two-step flow.

---

## Thank You

Thanks for using QManager! If you find it useful, consider [supporting the project](https://paypal.me/iamrusss). Bug reports and feature requests are always welcome on [GitHub Issues](https://github.com/dr-dolomite/QManager/issues).

**License:** MIT + Commons Clause

**Happy connecting!**
