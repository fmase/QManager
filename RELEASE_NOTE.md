# 🚀 QManager BETA v0.1.17

A maintenance release focused on fixes and small quality-of-life improvements across DNS reporting, software updates, authentication, and the sidebar.

## ✅ Improvements

- Cellular Information now shows correct DNS values for single-stack (IPv4-only) carriers — previously every DNS row displayed "-". Dual-stack carriers continue to see separate IPv4 and IPv6 rows side-by-side.
- DNS parser now identifies the active carrier profile by WAN mux ID instead of guessing from APN strings, so the right profile is picked even when multiple data contexts are active.
- Fixed CGCONTRDP parsing for dual-stack responses that return adjacent IPv4/IPv6 DNS tuples.
- IPv6 DNS addresses are displayed in compressed form with the full value available in a tooltip.
- Software Update card now shows a clear alert when an install stalls and offers a reboot option while an update is in progress, so you can recover without SSH.
- Fixed password strength enforcement toggle — disabling strict rules during login or password change is now honored instead of silently falling back to strict mode.
- Sidebar: Tailscale entry now uses the Waypoints icon for a clearer visual match with its mesh networking role.

## 📥 Installation

### Fresh Install

```sh
curl -fsSL -o /tmp/qmanager-installer.sh https://raw.githubusercontent.com/dr-dolomite/QManager/development-home/qmanager-installer.sh && sh /tmp/qmanager-installer.sh
```

### Upgrading from v0.1.16

Head to System Settings -> Software Update and run the update.

## 💙 Thank You

Thanks for using QManager! If you find it useful, consider [supporting the project](https://paypal.me/iamrusss). Bug reports and feature requests are always welcome on [GitHub Issues](https://github.com/dr-dolomite/QManager/issues).

**License:** MIT + Commons Clause

**Happy connecting!**
