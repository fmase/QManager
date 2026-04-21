# 🚀 QManager BETA v0.1.19

A **critical** bug-fix release. APN changes made through Custom SIM Profiles, the APN Settings page, and Configuration Restore now actually take effect on your live data session instead of silently leaving the old APN in place until your next reboot.

## 🛠️ Critical Fix — APN changes finally take effect without a reboot

- **The bug.** Every APN write in QManager up through v0.1.18 only issued `AT+CGDCONT`, which updates the modem's stored APN for next time but leaves the live PDP session on whatever APN it originally negotiated. Cellular Information (reading the live session) and APN Settings (reading stored config) would disagree, and real traffic stayed on the old APN until a reboot.
- **The fix.** After a successful APN write, QManager briefly detaches and reattaches (`AT+COPS=2 → AT+COPS=0`) so the session renegotiates with the new APN. Within a few seconds of saving, both pages agree and your data is actually on the APN you set.
- **All three APN paths now cycle the attach:** Custom SIM Profile activation, APN Settings save, and Configuration Restore's APN section. IMEI and Custom Profile sections of a restore still defer to a reboot (those genuinely need a modem reset).

### What you will notice

- **Saving an APN takes ~5–8 seconds** instead of sub-second. Your data connection briefly drops during the reattach (typically under 4 s) and comes back on the new APN. This extra time is the change that makes the save actually work.
- **No more "reboot to make my APN stick."** Reboots are still required for IMEI changes, but not for APN-only changes.

## ✅ Improvements

- **Custom SIM Profiles — CID field is back, smarter.** The **Connection Profile (CID)** number input returned. Clicking **Load Current Settings** auto-fills the CID with the one your SIM is actively using for data, so the common case is one click. Power users can still type a different CID; profile activation respects whatever is saved.
- **Empty-APN safeguard.** A Custom Profile with a blank APN now skips the APN step cleanly instead of writing an empty value and dropping your connection.
- **Info-tooltip icon consistency.** The info (`i`) tooltip icon on the Video Optimizer **DPI Desync Repeats** field now uses the filled `TbInfoCircleFilled` with `text-info` styling — matching the info tooltip pattern used elsewhere in the UI. Purely visual; no behavior change.
- **Cleaner AT channel behavior during APN changes.** `AT+COPS=2` / `AT+COPS=0` are now classified as long-running commands in the internal AT dispatcher, so the poller politely backs off during the reattach instead of racing and failing silently. Makes the fix above reliable under load.

## 📥 Installation

### Fresh Install

```sh
curl -fsSL -o /tmp/qmanager-installer.sh https://raw.githubusercontent.com/dr-dolomite/QManager/development-home/qmanager-installer.sh && sh /tmp/qmanager-installer.sh
```

### Upgrading from v0.1.18

Head to **System Settings → Software Update** and run the update. **No migration steps required.**

Your Custom SIM Profiles, tower locks, Signal Failover settings, VPN config, watchdog preferences, SMS alerts, and language packs are all preserved. If you had a profile that previously needed a reboot to make its APN stick, re-activate it after the upgrade — the reboot should no longer be necessary.

## 💙 Thank You

Thanks to everyone who pushed on the "APN doesn't stick" reports in the field. Bug reports and feature requests are always welcome on [GitHub Issues](https://github.com/dr-dolomite/QManager/issues).

If you find QManager useful, consider [sponsoring on GitHub](https://github.com/sponsors/dr-dolomite) or sending GCash via Remitly to **Russel Yasol** (+639544817486).

**License:** MIT + Commons Clause

**Happy connecting!**
