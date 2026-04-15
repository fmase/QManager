# 🚀 QManager BETA v0.1.17 (Draft)

This draft release improves DNS visibility and parsing reliability for both single-stack and dual-stack cellular connections.

## ✨ New Features

- Cellular Information displays Primary DNS and Secondary DNS rows that adapt to your carrier: single-stack carriers see clean "Primary DNS" / "Secondary DNS" rows, and dual-stack carriers see separate IPv4 and IPv6 rows side-by-side.

## ✅ Improvements

- Fixed CGCONTRDP DNS parsing for dual-stack responses that return adjacent IPv4/IPv6 DNS tuples.
- Fixed single-stack (IPv4-only) carriers where every DNS row was incorrectly showing "-".
- DNS parser now identifies the active carrier profile by WAN mux ID instead of guessing from APN strings — avoids picking the wrong profile when multiple data contexts are active.
- IPv6 DNS formatting remains compressed in the UI while preserving the full value in tooltip details.

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
