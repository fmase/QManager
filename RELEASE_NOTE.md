# 🚀 QManager BETA v0.1.22

A focused **Tower Locking** release. Locking to a specific LTE or 5G NR cell no longer requires copying EARFCN / PCI values by hand — a new **Simple Mode** lets you pick straight from the carriers your modem is currently using. Plus Verizon SIM support, a pre-login overview card, and translation-string additions for community language packs.

## ✨ New Features

- **Verizon support in Custom Profiles.** Selecting **Verizon** as the carrier automatically configures modem data routing so both Data and SMS work on Verizon SIMs. A warning dialog explains the special routing rule before saving, and the Profile Slot (CID) is locked to the Verizon-required value. **IP Passthrough is locked** while a Verizon profile is active — deactivate it first to change Passthrough settings. Switching away cleanly restores default routing and shows a reboot reminder. Requires USB mode **ECM** or **RNDIS** — the app blocks activation with a clear message otherwise.
- **Public overview card** — the QManager root page now shows a glanceable modem status card before login. Carrier, network type, signal quality, bands, model, and uptime are visible without authenticating; sensitive fields (IMEI, ICCID, IP, traffic) remain login-gated.
- **Tower Lock Simple Mode.** A **Simple Mode** toggle on both the LTE and NR-SA Tower Locking cards lets you pick from your modem's currently active carriers via dropdown instead of typing EARFCN / ARFCN and PCI manually. Carriers are color-coded by live RSRP; slots already used elsewhere on the card are flagged and blocked from being selected twice. On the NR-SA card, ARFCN, PCI, Band, and SCS are filled in automatically — with a warning icon when SCS is inferred from the band default rather than read from the modem. If no carriers are detected, the dropdown explains why and you can switch back to Custom mode in one click.
- **2.5 Gbps Ethernet.** The Ethernet Status card's **Set Link Speed** dropdown now offers **2500 Mbps** on hardware that supports it (e.g. rework.network's 5G2PHY carrier boards). The option only appears when the modem reports 2.5 G as a supported mode — 1 G devices see the same choices as before.

## ✅ Improvements

- **Tower Lock info tooltips.** The **LTE** and **NR Tower Locking Enabled** toggles now show an info hint explaining what locking does, and their helper text updates with a clear **On** / **Off** state label.
- **Cleaner Tower Lock UI hints.** Hover/focus hints on the Tower Lock cards now use the shared `HintIcon` component for consistency with the rest of the app.
- **Better band parsing.** Fixed a bug in the band-list parser that would accept malformed composite values with empty halves; FR2 NR (mmWave) bands are now covered by parser tests.
- **Language-pack toasts.** Install / remove / switch messages now include both the language name and code (e.g. *Language Italian (it) removed*), and a new generic **Failed to install language pack** fallback covers cases where the pack name isn't yet known.
- **Wake-on-LAN card copy.** The WoL card description and toast messages now focus on what the toggle actually does (wake via magic packet) rather than the older Ethernet-LED framing.
- **Wake-on-LAN now disabled by default.** Fresh installs seed Wake-on-LAN to **disabled**, restoring correct RJ45 LED behaviour out of the box on QCA8081-PHY carrier boards. If you previously set this toggle, your choice is preserved — only users who never touched it see the new default.
- **Tailscale routing simplified** — On RM551E firmware with `sdxpinn-patch`, Tailscale's `100.x.x.x` routing is handled at the firmware level, so QManager no longer adds workaround firewall zones or mwan3 ipset entries for Tailscale. Existing devices automatically clean up the legacy zone on the next install or update.
- **Updated Discord link and QR code** — the Support page now points to the current Discord server with a refreshed QR code.

## 🌐 Translations

This release adds a significant number of new UI strings across Tower Lock, Verizon support, the public overview card, IP Passthrough, and Ethernet. New strings fall back to English until community translators publish updated packs — everything already translated continues to render in your selected language.

**Added** (English + Simplified Chinese shipped across all namespaces; Italian + Indonesian updated for cellular / errors / events / local-network but fall back to English for the overview card):

*Tower Lock Simple Mode (`cellular`):*
- `lte_tower_locking.enabled_tooltip` + `enabled_info_aria`
- `lte_tower_locking.simple_mode.*` — `toggle_label`, `switch_aria`, `info_aria`, `info_tooltip`, `empty_tooltip`, `select_placeholder`, `custom_value_label`, `slot_used_suffix`
- `nr_sa_tower_locking.enabled_tooltip` + `enabled_info_aria`
- `nr_sa_tower_locking.simple_mode.*` — `toggle_label`, `switch_aria`, `info_aria`, `info_tooltip`, `empty_tooltip`, `select_placeholder`, `custom_value_label`, `scs_band_default_warning`, `scs_warning_aria`

*Verizon / Custom Profiles (`cellular`):*
- `custom_profiles.form.cid_locked_verizon`
- `custom_profiles.apply_dialog.step_labels.mpdn_rule`
- `custom_profiles.verizon_warning.*` — `title`, `body_intro`, `body_warning_lead`, `body_warning_rest`, `cancel`, `confirm`

*IP Passthrough Verizon lock (`local-network`):*
- `ip_passthrough.locked_by_verizon.*` — `title`, `body`, `cta`

*Ethernet (`local-network`):*
- `ethernet_status.option_speed_2500`

*Events (`events`):*
- `dataConnection.verizon_mpdn_applied` + `verizon_mpdn_reverted`

*Error codes (`errors`):*
- `usb_mode_incompatible_for_verizon`, `ip_passthrough_locked_by_verizon_profile`, `mpdn_rule_revert_failed`, `partial_apply`, `all_steps_failed`

*Public overview card (`common`) — EN + Simplified Chinese only; all other locales fall back to English:*
- `overview.*` — full subtree (`title`, `tagline`, `login_button`, `field.*`, `aggregation.*`, `signal.*`, `quality.*`, `connection.*`, `stale_indicator`, `empty.*`, `uptime.*`, `copyright`)

**Removed:**

- `cellular.lte_tower_locking.use_current` — orphaned after the Simple Mode redesign.
- `cellular.nr_sa_tower_locking.use_current` — same.

If you maintain or contribute to a language pack, the [`docs/i18n/CONTRIBUTING.md`](https://github.com/dr-dolomite/QManager/blob/development-home/docs/i18n/CONTRIBUTING.md) guide walks through repackaging — `bun run i18n:check` will list the exact keys missing in your pack.

## 📥 Installation

### Fresh Install

```sh
curl -fsSL -o /tmp/qmanager-installer.sh https://raw.githubusercontent.com/dr-dolomite/QManager/development-home/qmanager-installer.sh && sh /tmp/qmanager-installer.sh
```

### Upgrading from v0.1.21

Head to **System Settings → Software Update** and run the update. **No migration steps required.**

Your Custom SIM Profiles, tower locks, Signal Failover settings, VPN config, watchdog preferences, SMS alerts, and installed language packs are all preserved.

## 💙 Thank You

Thank you to everyone using, sharing, and supporting QManager — it means a lot. Special thanks to **jooeyw** and **Randomstart27** for their generous sponsorship. If you'd like to contribute a translation, the guide at [`docs/i18n/CONTRIBUTING.md`](https://github.com/dr-dolomite/QManager/blob/development-home/docs/i18n/CONTRIBUTING.md) walks you through it — no coding required.

Bug reports and feature requests are always welcome on [GitHub Issues](https://github.com/dr-dolomite/QManager/issues).

If you find QManager useful, consider [sponsoring on GitHub](https://github.com/sponsors/dr-dolomite) or sending GCash via Remitly to **Russel Yasol** (+639544817486).

**License:** MIT + Commons Clause

**Happy connecting!**
