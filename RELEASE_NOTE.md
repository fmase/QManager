# 🚀 QManager BETA v0.1.18

A targeted reliability release that hardens VPN setup on multi-WAN modems, adds an automatic boot-time fix for the most common Tailscale/Netbird connectivity issue, and refines how **Signal Failover** arms itself on cell locks.

## ✨ New Features

- **Language Packs** — Install additional translations for the QManager UI from the `/system-settings/languages` page. English and Simplified Chinese ship built-in; other languages download from the community manifest on demand. Includes sha256 verification, cancellable installs, and one-click removal.
- **Change SSH password from the web UI.** A new **System Settings → SSH Password** page lets you rotate the `root` password used for SSH and console access. Requires your current password, offers an optional strong-password policy (uppercase, lowercase, number, 5+ chars), and leaves your QManager web login untouched — the two credentials are fully independent.

## ✅ Improvements

- **Tailscale and Netbird are now reliable across reboots.** A new boot-time self-heal service (`qmanager_vpn_zone`) re-asserts both the VPN firewall zone and the mwan3 routing exception on every boot, so reboots no longer leave your VPN unreachable from peers. If you installed Tailscale or Netbird through LuCI → Software (bypassing QManager's install flow), or the firewall zone was removed manually, the next reboot restores everything without a reinstall.
- **Faster connect actions.** The previous flow restarted the firewall once on every connect, start, and install action — even when the zone was already in place. The connect path is now a clean no-op for the firewall in the steady state, with the firewall restart happening only when the zone is actually being created.
- **Tailscale first-time auth works on the first try.** Fixed a subshell lifecycle bug where the `tailscale up` process was being terminated when the CGI returned the auth URL, leaving the daemon waiting for prefs that never arrived — the admin console showed the device as "registered but disconnected" and you had to stop the service, start it again, and re-authenticate with a new link. Initial authentication now completes cleanly on the first attempt.
- **Signal Failover is now an explicit choice.** Locking to a cell no longer auto-enables the failover watcher. Apply your LTE or NR-SA lock first, then flip the **Signal Failover** switch when you want auto-recovery on poor signal. A hint under the switch points to it whenever a lock is active but failover is off. Unlocking still stops and disables failover automatically.
- **Failover unlock is bulletproof.** The watcher daemon is now guaranteed to stop on unlock — the init script waits up to 2 s for a graceful exit and escalates to `SIGKILL` if needed, so the UI can no longer get stuck in "Monitoring" state.
- **Self-healing failover state.** If the daemon is ever orphaned (config edited by hand, a botched unlock, or a crash), the lightweight status poll detects and reaps it within a few seconds — no reboot needed.
- **Tower locks survive reboots when Signal Failover is on.** Previously, if you locked an LTE or NR-SA cell with Signal Failover enabled and rebooted, the failover watcher could mistake "the modem hasn't finished reporting signal strength yet" for "catastrophic signal loss" and clear the lock during the first 60-90 seconds of boot — even with **Persist** on at the modem level. The watcher now waits for a confirmed signal value from the modem before it starts scoring samples, so the lock you applied is the lock you have after a reboot.
- **Fresh installs start with failover off.** The default for Signal Failover is now Disabled on new installs, matching the new explicit-toggle contract. Existing devices keep whatever you had previously set.
- **Configuration restore is protected from Watchdog reboots.** A poorly-timed connectivity blip during a multi-section restore could previously trip the Watchdog and reboot the modem before every section was applied — leaving IMEI, custom profiles, or other later steps half-written. Restore now pauses Watchdog recovery for the full duration and releases it on completion, so every section lands atomically.
- **Watchdog maintenance mode no longer silences network events.** If the Watchdog entered a maintenance hold while a recovery was in flight (for example, because a custom profile apply started), "internet lost" and "internet restored" events could stay suppressed until the next cooldown completed. Events now resume the moment maintenance mode kicks in, and the Watchdog restarts cleanly from monitoring on release.
- **AT Terminal accepts long commands.** The input was silently truncating at 256 characters, which broke NV-write commands like `AT+QNVFW="/mdb/…",<hex>` whose hex payload alone exceeds that limit. The cap is now 4096 characters — well above any realistic AT command length — so pasted firmware/NV payloads go through intact. The backend (`qcmd` and the CGI) never had a limit; only the UI did.
- **WAN Guard is now opt-in.** Previously, every install and every Software Update silently re-enabled the WAN Guard boot service, so disabling it from System Settings would not survive an upgrade. Fresh installs now ship with WAN Guard disabled — toggle it on from **System Settings** if you want it. Existing devices keep whatever you had previously set, and disabling it from the UI now sticks across future updates.
- **Watchdog settings are now validated on the server, with clear errors.** Out-of-range values posted directly to the API — a cooldown shorter than 10 seconds, a non-numeric failure threshold, a SIM slot other than 1 or 2 — are rejected instead of being silently written to config. When a rejection does happen, the settings page now shows the specific reason (for example, "must be integer 10-300") rather than a generic "invalid_field" code. The settings form itself already prevented out-of-range input; the server now backs it up.
- **System Settings menu is tidier.** Languages and LuCI now live inside the **System Settings** group alongside Configuration Backup, SSH Password, Bandwidth Monitor, and Logs — so everything settings-related is in one place. Software Update and AT Terminal stay at the top level for quick access.
- **Timezone and hostname changes apply instantly — no reboot needed.** Saving a new timezone, zone name, or display name used to write the values to config but leave every running service on the old values until the next reboot, so the dashboard clock, event timestamps, and the **Scheduled Reboot** / **Low Power** schedules all fired at the stale wall-clock time until you restarted the modem. The save now republishes system config and restarts cron right after the write, so the new timezone shows up in the UI, on the terminal, and in your scheduled jobs within seconds. Saves that don't actually change a system-level field (for example, a temperature unit change) no longer disturb logging or cron at all.
- **Video Optimizer — tunable DPI desync repeats.** A new **DPI Desync Repeats** field (1–10, default 1) on the Video Optimizer card lets you have `nfqws` emit the DPI-evading packet multiple times per matched flow. Most users don't need to touch it — the default `1` matches the shipped behavior from prior releases. If you still see occasional throttling, bumping to 2–4 usually helps at a small CPU and upstream-bandwidth cost; the info icon beside the field explains the tradeoff. Traffic Masquerade now uses `repeats=2` as a hardcoded baseline for more robust fake-SNI injection.

## 📥 Installation

### Fresh Install

```sh
curl -fsSL -o /tmp/qmanager-installer.sh https://raw.githubusercontent.com/dr-dolomite/QManager/development-home/qmanager-installer.sh && sh /tmp/qmanager-installer.sh
```

### Upgrading from v0.1.17

Head to System Settings → Software Update and run the update. **No migration steps required.**

If your Tailscale or Netbird connection was already working before the upgrade, you will see no change — the firewall zone and mwan3 routing exception that v0.1.17 set up at install time are still in place, and reachability is uninterrupted across the upgrade.

If your Tailscale or Netbird was previously installed through LuCI → Software (and was unreachable from tailnet/netbird peers), reboot the modem after the upgrade. The new boot-time self-heal will set up both the missing firewall zone and the mwan3 routing exception on the first boot, and your VPN peers will be able to reach the modem afterwards — no reinstall needed.

Your existing tower lock and Signal Failover settings are preserved across the upgrade. Going forward, applying or changing a cell lock will no longer flip failover on automatically — toggle **Signal Failover** yourself on the Tower Locking page when you want it armed.

## 💙 Thank You

Thanks to everyone who tested the Tailscale/Netbird workarounds on mwan3 builds and confirmed the simplification works end-to-end on real hardware. Bug reports and feature requests are always welcome on [GitHub Issues](https://github.com/dr-dolomite/QManager/issues).

If you find QManager useful, consider [sponsoring on GitHub](https://github.com/sponsors/dr-dolomite) or sending GCash via Remitly to **Russel Yasol** (+639544817486).

**License:** MIT + Commons Clause

**Happy connecting!**
