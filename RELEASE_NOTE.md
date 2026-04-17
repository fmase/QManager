# QManager <next version>

VPN setup is simpler and more resilient on OpenWRT builds that include mwan3.

## ✅ Improvements

- VPN firewall setup simplified. Removed a redundant workaround that duplicated mwan3's own route tracking. Tailscale and Netbird connections now rely on a single persistent firewall zone per VPN, reducing install-time noise and avoiding three firewall restarts per connect action.
- Added a boot-time self-heal for the VPN firewall zone. If Tailscale or Netbird is installed via LuCI → Software (bypassing QManager's install flow) or the zone was removed manually, the next reboot restores it automatically — no reinstall required.

## 📥 Installation

Fresh install:

```sh
curl -sL https://raw.githubusercontent.com/dr-dolomite/QManager/main/qmanager-installer.sh | sh
```

Upgrade: use Software Update in the QManager UI.

## 💙 Thank You

Thanks to everyone who tested the Tailscale/Netbird workarounds on mwan3 builds and confirmed the simplification works end-to-end.
