# 🚀 QManager BETA v0.1.25

This release adds LAN address configuration to the Local Network page and polishes the login screen.

## ✨ New Features

- **Set your LAN gateway address and subnet from the Local Network page.** You can now change the modem's LAN IP address and subnet prefix (/16–/30) directly in QManager — no SSH required. A confirmation dialog reminds you that the LAN briefly drops on apply, and a persistent banner shows the new address to browse to (reconnect your LAN/Ethernet cable after a few seconds so your device picks up the new IP).
- **One-tap Bypass Hotspot in the Traffic Engine.** A new switch under each engine mode pins TTL and hop-limit to 64 so tethered devices aren't flagged as a hotspot — no need to open the TTL/HL page. If TTL/HL is already set elsewhere (the TTL page or a SIM profile), the switch shows on and stays locked so it never fights your existing setup.

## ✅ Improvements

- **The login screen's "Can't sign in?" help is clearer and better aligned.** The recovery link now sits with comfortable spacing below the password field, and tapping it expands the recovery steps directly beneath the link — right where you asked — instead of above the field. The device-name line and its loading placeholder now share the same baseline, so the screen settles into place without a flicker, and all of its motion runs on one unified timing.
- **The login device-name line now reads "Sign in as <your device name>" in every supported language.**
- **The Traffic Engine page loads in one clean pass.** With the new Bypass Hotspot switch in place, the page no longer flashes a loading spinner inside the card, and switching between Video Optimizer and Masquerade stays smooth — the bypass control settles with the rest of the page instead of catching up a beat later.
- **Wake-on-LAN removed.** The WoL toggle has been removed. Upgrading devices will have the stale WoL configuration cleaned up automatically.

## 📥 Installation

### Fresh Install

```sh
curl -fsSL -o /tmp/qmanager-installer.sh https://raw.githubusercontent.com/dr-dolomite/QManager/development-home/qmanager-installer.sh && sh /tmp/qmanager-installer.sh
```

### Upgrading from v0.1.24

**System Settings → Software Update.** No migration steps needed. All settings preserved.

## 💙 Thank You

Bug reports and feature requests welcome on [GitHub Issues](https://github.com/dr-dolomite/QManager/issues).

Like what's new? QManager is built and maintained for free — if these updates have made your setup a little better, you can show your support via [Wise](https://wise.com/pay/business/blackcatdev?currency=USD) or [PayPal](https://paypal.me/iamrusss). Every bit helps keep this project alive. [GitHub Sponsors](https://github.com/sponsors/dr-dolomite) works too.

**License:** MIT + Commons Clause — **Happy connecting!**

---
