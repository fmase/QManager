# 🚀 QManager BETA v0.1.16 _(Draft)_

**New Configuration Backup feature lets you download an encrypted `.qmbackup` of your modem config and restore it later — full WebCrypto AES-256-GCM, mandatory passphrase, async apply worker with retries, and a deferred-reboot dialog so the modem never reboots out from under you mid-restore. Plus UI polish and quality-of-life improvements: QManager version now shows live on the dashboard, device icon migrated to PNG, Device Information card decluttered, login footer updated, quick modem reconnect added to the user menu, and minor layout fixes across several cards.**

---

## ✨ Improvements

### Configuration Backup and Restore — New Feature

A new System Settings page at **System Settings → Configuration Backup** lets you snapshot your modem configuration into an encrypted `.qmbackup` file and restore it onto the same device or another device later. Useful for migrating a working setup to a fresh device, recovering after a factory reset, or shipping a vetted configuration to a field tech.

**Eight backup sections, pick any subset:**

- Network Mode and APN settings
- Preferred LTE and 5G bands
- Tower Locking settings
- TTL/HL settings
- IMEI Settings
- Custom SIM Profiles (the entire profile library plus the active marker)
- SMS Alerts configuration
- Watchdog/Watchcat configuration

**Custom SIM Profiles overlap rule** — Checking "Custom SIM Profiles" automatically disables APN, TTL/HL, and IMEI in the checklist (and vice versa) since profile activation already owns those settings. The UI explains the disable with inline helper text so it's obvious what's happening and why.

**Mandatory passphrase, real crypto** — Backups are encrypted in the browser via WebCrypto with PBKDF2-SHA256 (200,000 iterations) → AES-256-GCM. The passphrase never leaves the browser. The envelope's plaintext header (`magic`, `version`, `created_at`, `device`, `sections_included`) is bound into the AES-GCM tag as Associated Data, so the visible header is preview-able but tamper-detectable. Wrong passphrase → clean "Incorrect password" UI state, retry without re-uploading.

- **Live "Passphrases match" / "Passphrases don't match" feedback** under the confirm field, mirroring the onboarding password step pattern.
- **Eye / Eye-off toggle** on both passphrase fields so users can verify what they typed.
- **Loud "store this passphrase somewhere safe" warning** above the Download button — there is no recovery option.

**Restore is async, with retries and skip-on-incompatibility** — The restore worker (`qmanager_config_restore`) is modeled on the existing `qmanager_profile_apply` pattern: detached double-fork, PID-file singleton, JSON progress polled at 500ms by the frontend. Each section gets up to **3 retries with 1s/2s/4s exponential backoff**. Sections that can't run on the target modem (e.g., a 5G band the modem doesn't support) silently downgrade to `skipped:incompatible` instead of failing the whole restore. Profile activation skips on SIM ICCID mismatch and surfaces a clear reason.

**Cross-device warning, not a hard block** — The envelope records `device.model` / `firmware` / `imei` at backup time. Restoring a backup from `RM520N-GL` onto `RM551E-GL` shows a warning dialog with both model names and lets the user proceed; per-section appliers handle the differences gracefully.

**Restore card is a state machine, not a static empty** — The restore card now swaps icon + title + description + action across **10 distinct UI states**: idle → reading → password_required → password_incorrect → model_warning → ready → applying → success / partial_success / failed. The progress list inside the `applying` and final states uses an identical-width status badge for every section so the layout doesn't shift as states transition (`min-w-[7.5rem] justify-center` shared base, sized for the longest "Retrying (3/3)" label).

**Network events for everything** — 6 new event types in the Data Connection tab: `Backup Collected`, `Restore Started`, `Section Restored`, `Section Failed`, `Section Skipped`, `Restore Completed`. Each restore run leaves a clear audit trail.

### Configuration Backup — Deferred-Reboot Pattern (QManager runs ON the modem)

A critical wrinkle: QManager runs on the modem itself. So if `apply_imei` ran `AT+CFUN=1,1` mid-restore (or if `apply_profiles` spawned `qmanager_profile_apply` which does the same in its IMEI step), the modem reboot would kill the very CGI serving the restore status, tear down the user's session, and freeze the web UI for 30-60 seconds with no warning. This release ships the deferred-reboot fix:

- **`apply_imei` writes the IMEI to NVM via `AT+EGMR=1,7,"<imei>"` but does NOT call `AT+CFUN=1,1`.** The new IMEI is queued and takes effect on the next reboot.
- **`apply_profiles` writes the active profile marker to `/etc/qmanager/active_profile` but does NOT spawn `qmanager_profile_apply` mid-restore.** The boot-time `auto_apply_profile` in the poller (which already runs on every boot) picks up the active marker and runs the full APN → TTL/HL → IMEI pipeline naturally on the next user-initiated reboot.
- **One reboot total instead of two** — because `apply_imei` already pre-wrote the IMEI to NVM, the IMEI step inside the boot-time profile activation finds `current_imei == p_imei` and skips, so there is no second reboot from the profile pipeline.
- **Both appliers leave a hint** at `/tmp/qmanager_config_restore.reboot_required`. The worker reads this in `state_write` and surfaces `reboot_required: true` in the progress JSON.
- **Frontend pops a "Modem reboot required" AlertDialog** the moment the restore completes (success or partial_success) when the worker reports `reboot_required: true`. Two buttons: **Reboot Now** (POSTs to `/system/reboot.sh`) or **Reboot Later** (closes the dialog without rebooting).
- **Persistent warning Alert banner** at the top of the Configuration Backup page, backed by a `qmanager_pending_reboot` localStorage key. The banner survives navigation and page reloads until the user clicks Reboot Now or Dismiss. Same-tab updates propagate via a custom `qmanager:pending-reboot-changed` event, cross-tab updates via the native `storage` event — the banner reflects state changes immediately without polling.
- **Failed reboot is recoverable** — Both `handleRebootNow` handlers check `res.ok` after the `system/reboot.sh` POST and re-set the pending flag if the request failed. `authFetch` only throws on network errors, so the explicit `res.ok` check is what catches a 500 from the reboot CGI and unfreezes the UI instead of leaving the user stranded with a stuck "Rebooting…" dialog.
- **Dialog fires on every restore that needs a reboot**, even back-to-back ones, since each restore is a discrete user action.

Path: System Settings → Configuration Backup

### Device Icon — Migrated from SVG to PNG

- **Replaced `device-icon.svg` with `device-icon.png`** across all three components that referenced it (`device-status.tsx`, `device-information-card.tsx`, `ethernet-card.tsx`). The PNG variant is the authoritative asset going forward.
- **`ethernet-card.tsx` simplified** — the old implementation used Next.js `<Image>` with a static import (`import deviceIcon from "@/public/device-icon.svg"`) and `priority`. The new implementation uses a plain `<img>` tag with `src="/device-icon.png"` and `loading="lazy"`, removing an unnecessary priority hint for an icon that is never above the fold in the Ethernet card layout.
- **Removed the redundant `next/image` static import** from `ethernet-card.tsx` — the `Image` component is no longer used in that file, trimming the import block.

Paths: Dashboard, About Device, Local Network → Ethernet card

### Device Information Card — Removed "Manufacturer" Row, Added "QManager Version"

- **"Manufacturer" row removed from the dashboard Device Information card** — the model name (e.g., `RM551E-GL`) already unambiguously identifies the vendor; the separate manufacturer field (`Quectel`) was redundant visual noise on the dashboard. The `manufacturer` field is still present in `DeviceStatus` and continues to be displayed on the **About Device** page.
- **"QManager Version" row added in its place**, now populated live from the backend (see above).
- **Skeleton loader count stays consistent** — the loading skeleton renders `Array.from({ length: 9 })` rows, matching the updated 9-row table.

Path: Dashboard → Device Information card

### Scheduled Operations Card — Low-Power Days Row Spacing

- **Added `mt-2` top margin** to the Low Power Mode "days of the week" checkbox group, bringing its spacing in line with the Reboot days group above it.

Path: System Settings → Scheduled Operations

### User Menu — Quick Modem Reconnect Action

- **Added a new "Reconnect Modem" action under "Toggle Theme"** in the user dropdown, giving users a fast one-click recovery path without navigating to AT Terminal.
- **Confirmation-first flow with AlertDialog** — pressing Reconnect opens a warning dialog explaining that the modem will briefly disconnect before reconnecting.
- **Two-step AT sequence implemented exactly as requested**:
  - send `AT+COPS=2` (manual detach) and show **"Disconnecting..."** toast
  - wait 3 seconds
  - send `AT+COPS=0` (automatic operator reattach) and show **"Reconnecting..."** toast
- **Safe async UX behavior** — confirm/cancel controls are disabled while the operation is running, with spinner states to prevent duplicate clicks.
- **Failure handling includes recovery attempt** — if step 1 succeeds but a later step fails, the flow still attempts `AT+COPS=0` to avoid leaving the modem detached.

Path: User menu (`NavUser`) → Reconnect Modem

---

## 📥 Installation

### Fresh Install

```sh
curl -fsSL -o /tmp/qmanager-installer.sh https://raw.githubusercontent.com/dr-dolomite/QManager/development-home/qmanager-installer.sh && sh /tmp/qmanager-installer.sh
```

### Upgrading from v0.1.15

Head to **System Settings → Software Update** and hit "Check for Updates". The OTA flow handles the upgrade transparently.

---

## Thank You

Thanks for using QManager! If you find it useful, consider [supporting the project](https://paypal.me/iamrusss). Bug reports and feature requests are always welcome on [GitHub Issues](https://github.com/dr-dolomite/QManager/issues).

**License:** MIT + Commons Clause

**Happy connecting!**

---

# 🚀 QManager BETA v0.1.15

**Full rewrite of the install/update/uninstall pipeline — now filesystem-driven, crash-resilient, and curl-only. New password complexity rules with a live requirements checklist. Critical install-stability fixes: binary corruption, SSH drops on LAN installs, and spontaneous device reboots. Plus a security fix for the password reset tool and a correction to the About page's LAN info.**

---

## ✨ Improvements

### Typography — Switched to Manrope

- **Euclid Circular B replaced with Manrope** across the entire frontend. The app now ships a single Google Fonts–sourced typeface (self-hosted at build time by `next/font/google`, so the device still needs zero internet at runtime) instead of six local `.woff2` weights for Euclid.
- **~200 KB smaller frontend tarball** — the `qmanager-build` output dropped from **~6.5 MB → ~6.3 MB**. Manrope's variable-font pipeline is more aggressively subsetted and compressed than the fixed Euclid weights we were shipping, and we're no longer bundling the italic cut we barely used.
- **Visual parity** — Manrope is still a clean geometric sans in the same family as the previous design language (Vercel/Linear-adjacent), so no UI component needed tuning. Line heights, weights, and tracking all carry over.
- **Reversible** — the Euclid local-font block is left commented out in `app/layout.tsx` so we can flip back without re-adding the imports if we decide to revisit the decision.

### About Device — Correct LAN Info

- **"LAN Gateway" replaced with "LAN Subnet"** — The About page previously read LAN info from the modem via `AT+QMAP="LANIP"`, which reports the modem's internal USB/RNDIS pass-through subnet (default 192.168.224.x), not your actual OpenWRT LAN. Changing your LuCI LAN IP never updated the About page because those are two completely different networks.
- **Now sourced from OpenWRT UCI** — `Device IP` comes from `uci get network.lan.ipaddr`, and `LAN Subnet` is computed as `<network_address>/<prefix>` from the LAN netmask. Change your LAN to `192.168.228.1/24` and the About page immediately reflects `192.168.228.1` and `192.168.228.0/24`.
- **One fewer AT call per About page load** — Dropping `AT+QMAP="LANIP"` from the compound AT query reduces modem round-trips and removes a failure mode on pages that were previously gated on modem responsiveness.

Path: About Device (`/about-device`)

### Password Validation — Complexity Rules and Live Requirements Checklist

- **Minimum length reduced to 5** (from 6), but passwords must now include **at least one uppercase letter, one lowercase letter, and one number**. A 5-character `Abc12` is demonstrably stronger than a 6-character `abcdef` — the rule change trades raw length for character-class coverage.
- **Live requirements checklist under the password field** — both the onboarding password step and the change-password dialog now render a 4-item checklist that greys out (unmet) or turns success-green (met) in real time as the user types. No more guessing what "strong enough" means; the user sees every rule transition green before they can submit.
- **Single source of truth** — new `components/auth/password-requirements.tsx` exports both the `PasswordRequirements` component and an `isPasswordValid()` helper. Both frontend call sites use `isPasswordValid()` for their submit validators instead of duplicating regex checks inline. Future rule tweaks (e.g., adding a symbol requirement) change one file.
- **Backend parity** — `auth/login.sh` and `auth/password.sh` enforce the same rules server-side using POSIX `grep` character classes as defense-in-depth. Error code renamed from `password_too_short` to `password_weak` with the consolidated message `"Password must be at least 5 characters and include uppercase, lowercase, and a number"`.
- **Existing passwords still work** — the new rules only gate password _creation_ (setup + change). Users with longer but weaker existing passwords (e.g., all lowercase) can still log in; they just can't pick one like that going forward.
- **Onboarding Continue button is now gated on validity** — during first-time setup, the "Continue" button on the password step stays disabled until every requirement in the live checklist is green _and_ the confirmation field matches. No more clicking Continue only to hit a toast error; the button itself tells you you're not ready yet. The step reports its validity up to the wizard via an `onValidityChange` callback, which flows into the shell's existing `continueDisabled` prop.

Paths: Onboarding (first-time setup), System Settings → Change Password dialog

## 🔧 Backend / Infrastructure

### Install / Update / Uninstall Pipeline — Full Rewrite (v2)

All three scripts have been redesigned from the ground up to be filesystem-driven and crash-resilient.

- **Filesystem-driven service management** — `stop_services()`, `enable_services()`, and the daemon kill loop now iterate `$INITD_DIR/qmanager*` and `$BIN_DIR/qmanager_*` instead of hardcoded service lists. Adding a new init.d service no longer requires updating install.sh in multiple places. The only remaining hardcoded list is `UCI_GATED_SERVICES` (4 user-controlled services: `qmanager_watchcat`, `qmanager_tower_failover`, `qmanager_bandwidth`, `qmanager_dpi`).
- **Two-phase VERSION write** — `/etc/qmanager/VERSION.pending` is written at the start of install; `/etc/qmanager/VERSION` is only updated after every step succeeds. If an install crashes mid-way, the old VERSION stays intact and VERSION.pending is a clear debugging breadcrumb.
- **build.sh auto-stamps VERSION from `package.json`** — The build now reads the version once and `sed`-patches it into both `install.sh` and `uninstall.sh` in the staged tarball. This fixes the v0.1.13 → v0.1.14 bug where the Updates page kept showing the old version after a successful OTA upgrade because `install.sh` had a stale hardcoded `VERSION="v0.1.13"` constant.
- **Atomic file installs** — New `install_file()` helper copies to a temp path, strips CRLF, chmods, and atomically renames into place. Eliminates "text file busy" half-writes when replacing running daemons and folds the old separate `fix_line_endings` / `fix_permissions` passes into a single operation.
- **Interactive modem-detection prompt** — If `detect_modem_firmware()` cannot reach the modem on a fresh install, the script now prompts `Continue installation anyway? [y/N]` in interactive mode instead of dying outright. Non-interactive mode still fails fast unless `--force` is passed.
- **Mandatory conflict removal** — `remove_conflicts()` (which opkg-removes `sms-tool`, `socat-at-bridge`, and `socat` — packages that clobber `/dev/smd11` and collide with our bundled `sms_tool`) now runs on every install regardless of `--skip-packages`. Previously `--skip-packages` also skipped conflict removal, which could leave a broken AT stack even on a "successful" install.
- **`ethtool` is now required** (was optional) — install hard-fails if ethtool can't be installed. `qmanager_eth_link` (ethernet link speed control) and several ethernet-touching paths depend on it; keeping it optional created a class of "works until you touch the ethernet card" bugs.
- **Post-install health check** — After `start_services()`, the installer now waits up to 10 seconds for `/tmp/qmanager_status.json` to be produced by the poller. A stronger signal than just checking `pidof qmanager_poller` — verifies the poller is actually producing data, not just running.
- **AT stack verification** — New `at_stack_check()` step runs `qcmd ATI` up to 3 times at the very end of install (after services are up) to confirm the full AT pipeline (`qcmd → atcli_smd11 → /dev/smd11`) is working. On success, logs the modem model line (`Quectel`, `RM551E-GL`). On failure, prints a numbered troubleshooting list pointing at `/dev/smd11` permissions, direct `atcli_smd11 'AT'` testing, package conflict checks, and the install log. Warn-only with retries so fresh hardware has a few seconds to settle before the check fires.
- **Structured install logging** — Everything visible on screen is also mirrored to `/tmp/qmanager_install.log` and `/tmp/qmanager_uninstall.log` with timestamps and severity levels (`INFO`/`WARN`/`ERROR`). Log files are truncated at the start of each run, so they always reflect the most recent attempt.
- **New install.sh lint in build.sh** — Build-time validation that the filesystem-iteration pattern is present, the main `qmanager` init.d service exists, and every `UCI_GATED_SERVICES` entry has a real file in `scripts/etc/init.d/`. Catches design regressions before the tarball is built.
- **Cleaner update.sh CGI contract** — No frontend changes required. The Software Update page still talks to `update.sh` the same way; the status JSON schema (`{status, message, version, size}`) is identical. OTA upgrades from v0.1.14 will work transparently.

### curl-only HTTP Everywhere

- **Dropped `wget` and `uclient-fetch` fallbacks** across the entire backend. Previously, every script that fetched anything had a 3-way cascade (`uclient-fetch` → `wget` → `curl`) to support minimal OpenWRT installs. Since `curl` is now a required package (installed by `install.sh` alongside `jq` and `coreutils-timeout`), the fallbacks were dead weight.
- **Affected scripts:**
  - `qmanager-installer.sh` (bootstrap)
  - `scripts/usr/bin/qmanager_update` (OTA daemon)
  - `scripts/usr/bin/qmanager_auto_update` (cron-triggered updater)
  - `scripts/www/cgi-bin/quecmanager/system/update.sh` (Updates page CGI)
  - `scripts/www/cgi-bin/quecmanager/device/about.sh` (public IP fetch)
- **Early failure with clear hint** — Scripts that need curl now check for it up-front and print `Install it first: opkg update && opkg install curl ca-bundle` if it's missing, instead of silently falling through to a dead fallback path.

### Bootstrap Installer — Stable + Pre-release Channels

- **New `--channel` flag** — `qmanager-installer.sh` now accepts `--channel stable | prerelease | any` (default `any`). Previously the bootstrap only fetched pre-releases, so a release marked stable would make the one-liner fail with "Failed to resolve latest pre-release tag".
- **Better error messages** — If `--channel stable` finds no stable releases yet, the error says so explicitly and suggests `--channel prerelease` or `--channel any`.
- **Environment-variable control** — `QMANAGER_CHANNEL` environment variable is respected as a default, matching the existing `QMANAGER_TAG` and `QMANAGER_REPO` overrides.

## 🐛 Bug Fixes

### `install.sh` Silently Exited After Removing Conflicts (Critical)

- **Root cause** — `remove_conflicts()` ended with `[ "$any" = "0" ] && info "No conflicting packages found"`. When a conflict _was_ removed (`any=1`), that trailing expression evaluated to false, making the function return 1. Combined with `set -e` at the top of `install.sh`, the installer exited silently the moment any conflict was successfully removed — right after printing "Removed: socat". No error, no hang, no log line. Upgrades from v0.1.13 (which had `sms-tool`/`socat-at-bridge`/`socat` installed) hit this every single time.
- **Symptom** — Terminal installs died at step 2 with no error. OTA installs failed the same way but the UI could only say "check update.log" — and update.log just contained the same truncated output pointing back at itself.
- **Fix** — Added an explicit `return 0` at the end of `remove_conflicts()`. Audited every other function in `install.sh` for the same `&&`-at-end pattern; none found.

### Summary Screen Falsely Reported `coreutils-timeout` as Missing

- **`pkg_binary()` didn't map `coreutils-timeout` → `timeout`** — the post-install summary runs `command -v "$(pkg_binary "$pkg")"` to verify every package is installed. For `coreutils-timeout`, `pkg_binary` returned the literal string `coreutils-timeout`, so `command -v coreutils-timeout` always failed even when the package was installed. The actual binary is `/usr/bin/timeout`; only the summary check was lying, not the package install itself.
- **Fix** — Added `coreutils-timeout) echo "timeout" ;;` to the `pkg_binary` mapping. Closes the bug class: any future package whose binary name differs from its package name can be handled the same way.

### Password Reset Did Not Invalidate Active Sessions (Security)

- **`qmanager_reset_password` was leaving active browser sessions valid** — The SSH recovery tool was trying to remove `/tmp/qmanager_session.json`, which is the pre-2026-03-17 single-file session format. The current cookie-based auth uses `/tmp/qmanager_sessions/<token>` — a directory of per-session files. Resetting the password would remove the password hash but leave every active login untouched; attackers with a stolen session cookie could continue acting as the user.
- **Fix** — `qmanager_reset_password` now wipes the entire `/tmp/qmanager_sessions/` directory after removing `/etc/qmanager/auth.json`. All active sessions are invalidated immediately; every browser is forced back to the login screen.

### install.sh Was Backing Up a Non-Existent Password File

- **`backup_originals()` referenced the wrong path** — install.sh was trying to back up `/etc/qmanager/shadow`, but the real password file has always been `/etc/qmanager/auth.json`. The backup silently did nothing (`[ -f ]` check always false), and the "First-time setup: you will be prompted to create a password" hint was shown after every install regardless of whether a password already existed.
- **Fix** — Install.sh now backs up `auth.json` and checks `auth.json` for the first-time-setup detection. Upgrades that preserve an existing password will no longer show the misleading "first-time setup" hint.

### Updates Page Showed Old Version After OTA Upgrade

- **Root cause** — The v0.1.14 tarball's `install.sh` had a hardcoded `VERSION="v0.1.13"` constant at line 37 that nobody bumped during the release. After OTA, the About page correctly showed v0.1.14 (baked into the frontend JS from `package.json`), but the Updates page read `/etc/qmanager/VERSION` which `install.sh` had just stamped back to `v0.1.13`.
- **Fix** — `build.sh` now automatically stamps the version from `package.json` into both `install.sh` and `uninstall.sh` before packaging, with a hard-fail if the stamp doesn't land. Drift between `package.json` and the shell scripts is now impossible.
- **Recovery for users on broken v0.1.14** — Upgrading to v0.1.15 via the Updates page will automatically fix the VERSION file as a side-effect of the install. No manual intervention required.

---

## 📥 Installation

### Fresh Install

```sh
curl -fsSL -o /tmp/qmanager-installer.sh https://raw.githubusercontent.com/dr-dolomite/QManager/development-home/qmanager-installer.sh && sh /tmp/qmanager-installer.sh
```

Pick a specific channel:

```sh
# Stable releases only
sh /tmp/qmanager-installer.sh --channel stable

# Pre-releases only (current default behavior)
sh /tmp/qmanager-installer.sh --channel prerelease

# Newest regardless of flag (default)
sh /tmp/qmanager-installer.sh --channel any
```

### Upgrading from v0.1.14

Head to **System Settings → Software Update** and hit "Check for Updates". The two-step download + install flow will handle the OTA upgrade transparently — no frontend or CGI contract changes.

> **Note:** If your v0.1.14 install is showing as "v0.1.13" on the Updates page due to the stamp bug, upgrading to v0.1.15 will automatically reconcile `/etc/qmanager/VERSION` during install.

---

## Thank You

Thanks for using QManager! If you find it useful, consider [supporting the project](https://paypal.me/iamrusss). Bug reports and feature requests are always welcome on [GitHub Issues](https://github.com/dr-dolomite/QManager/issues).

**License:** MIT + Commons Clause

**Happy connecting!**
