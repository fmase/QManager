# 🚀 QManager BETA v0.1.25

This release adds LAN address configuration to the Local Network page and polishes the login screen.

## ✨ New Features

- **Set your LAN gateway address and subnet from the Local Network page.** You can now change the modem's LAN IP address and subnet prefix (/16–/30) directly in QManager — no SSH required. After saving, the device reconnects to the new address automatically. A persistent banner shows you exactly where to navigate once the LAN comes back up.

## ✅ Improvements

- **The login screen's "Can't sign in?" help is clearer and better aligned.** The recovery link now sits with comfortable spacing below the password field, and tapping it expands the recovery steps directly beneath the link — right where you asked — instead of above the field. The device-name line and its loading placeholder now share the same baseline, so the screen settles into place without a flicker, and all of its motion runs on one unified timing.
- **The login device-name line now reads "Sign in as <your device name>" in every supported language.**
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

If QManager saves you time, consider [donating via Wise](https://wise.com/pay/business/blackcatdev?currency=USD) or [PayPal](https://paypal.me/iamrusss). You can also [sponsor on GitHub](https://github.com/sponsors/dr-dolomite).

**License:** MIT + Commons Clause — **Happy connecting!**

---
