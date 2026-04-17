# 🚀 QManager BETA v0.1.18

A targeted reliability release that simplifies VPN setup on multi-WAN modems and adds an automatic boot-time fix for the most common Tailscale/Netbird connectivity issue.

## ✅ Improvements

- **VPN firewall setup simplified.** Removed a redundant workaround that duplicated mwan3's own route tracking. Tailscale and Netbird connections now rely on a single persistent firewall zone per VPN, reducing install-time noise and avoiding three firewall restarts per connect action.
- **Boot-time VPN self-heal.** A new lightweight init service (`qmanager_vpn_zone`) verifies the VPN firewall zone on every boot and recreates it automatically if missing. If you installed Tailscale or Netbird via LuCI → Software (bypassing QManager's install flow), or the zone got removed manually, the next reboot now restores it without a reinstall.
- Faster connect actions. The previous flow restarted the firewall once on every connect/start/install — even when the zone was already in place. The connect path is now a clean no-op for the firewall in the steady state.

## 📥 Installation

### Fresh Install

```sh
curl -fsSL -o /tmp/qmanager-installer.sh https://raw.githubusercontent.com/dr-dolomite/QManager/development-home/qmanager-installer.sh && sh /tmp/qmanager-installer.sh
```

### Upgrading from v0.1.17

Head to System Settings → Software Update and run the update. **No migration steps required.**

If your Tailscale or Netbird connection was already working before the upgrade, you will see no change — the new firewall zone for your VPN was already in place from the previous install. The cleanup of the redundant mwan3 ipset entry happens silently on the next reboot; mwan3 keeps the equivalent `100.0.0.0/8` entry on its own, so reachability is uninterrupted.

If your Tailscale or Netbird was previously installed through LuCI → Software (and was unreachable from tailnet/netbird peers), reboot the modem after the upgrade. The new boot-time self-heal will create the missing firewall zone on the first boot, and your VPN peers will be able to reach the modem afterwards — no reinstall needed.

## 💙 Thank You

Thanks to everyone who tested the Tailscale/Netbird workarounds on mwan3 builds and confirmed the simplification works end-to-end on real hardware. Bug reports and feature requests are always welcome on [GitHub Issues](https://github.com/dr-dolomite/QManager/issues).

If you find QManager useful, consider [supporting the project](https://paypal.me/iamrusss).

**License:** MIT + Commons Clause

**Happy connecting!**
