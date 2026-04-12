# 🚀 QManager BETA v0.1.15

**Full rewrite of the install/update/uninstall pipeline — now filesystem-driven, crash-resilient, and curl-only. New password complexity rules with a live requirements checklist. Critical install-stability fixes: binary corruption, SSH drops on LAN installs, and spontaneous device reboots. Plus a security fix for the password reset tool and a correction to the About page's LAN info.**

---

## ✨ Improvements

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
- **Existing passwords still work** — the new rules only gate password *creation* (setup + change). Users with longer but weaker existing passwords (e.g., all lowercase) can still log in; they just can't pick one like that going forward.

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

### Install Corrupted `atcli_smd11` / `sms_tool` Binaries (Critical)

- **Root cause** — The new `install_file()` helper's CRLF safety net was running `tr -d '\r'` on every file that contained a `0x0D` byte, regardless of whether the file was a shell script or a compiled binary. ELF binaries have `0x0D` bytes scattered throughout their machine code (it's just one of 256 possible byte values in compiled instructions). Stripping those bytes rewrites random opcodes — the corrupted binary segfaults on first execution.
- **Symptom** — On a v0.1.15-test1 install, `atcli_smd11 'AT'` printed `Segmentation fault`. The poller couldn't collect modem data, `qcmd` returned errors on every command, and the entire AT-command surface (signal, APN, profiles, SMS, firmware info) was broken until the binaries were manually restored via SCP/WinSCP.
- **Affected binaries** — `atcli_smd11`, `sms_tool`, and `bridge_traffic_monitor_rm551`. All three are ELF executables installed via the same helper.
- **Fix** — `install_file()` now detects ELF files via the `\x7fELF` magic bytes at offset 0 and skips CRLF stripping on them entirely. Shell scripts still get the strip (the original safety net is preserved). Logged as `install_file: <name> is ELF — skipping CRLF strip` so you can verify the protection fired in the install log.
- **Recovery for users on v0.1.15-test1** — Upgrading to v0.1.15 via the Updates page reinstalls the binaries cleanly; no manual intervention needed.

### SSH Session Died at "Stopping QManager Services" (LAN Users)

- **Root cause** — `qmanager_eth_link`'s `stop()` handler called `ethtool -s eth0 advertise ... autoneg on` followed by `ethtool -r eth0` ("renegotiate"), which drops the eth0 link for 2–5 seconds to force a fresh autonegotiation. Every TCP connection routed through eth0 died mid-install — including the SSH session the installer itself was running over. Wi-Fi and Tailscale users never noticed; anyone SSH'd in over the LAN cable always lost their session right at "Stopping QManager services".
- **Secondary flap** — `start()` *also* unconditionally called `ethtool -r eth0`, so even a fix to `stop()` would have flapped the link a second time when services came back up at the end of install.
- **Fix** — `stop()` is now a no-op (hardware state shouldn't change just because a service stops). `start()` is now idempotent: reads the current link speed from `ethtool eth0` and skips the apply entirely when already at the desired speed. The link now flaps only when a user explicitly changes the speed limit from the UI, which is the expected behavior. Idempotent reinstalls cause zero link flapping.

### Device Spontaneously Rebooted ~1–2 Minutes Into Install

- **Two compounding failures** — `stop_services` called `"$svc" stop` on all 11 qmanager init.d scripts in series. Procd-managed services wait for their daemon to die before returning; if a daemon was mid-AT-command on `/dev/smd11`, the trap handler couldn't fire until the foreground command returned. Stacking 11 of those serially could starve the kernel hardware watchdog, which then rebooted the device after 60–120 s. Meanwhile, `qmanager_watchcat` (alphabetically *last* in the stop loop) was still alive while the poller, DPI, and other services were being torn down — it could observe "internet lost", race through Tiers 1–3, and reach Tier 4 (`( sleep 1 && reboot ) &`). The Tier 4 subshell is *detached*, so killing watchcat afterwards doesn't stop the reboot.
- **Fix — `stop_services` restructured into 4 ordered phases** with two safety nets:
    1. Touch `/tmp/qmanager_watchcat.lock` first — watchcat enters `LOCKED` state at the top of its next main-loop iteration and skips every escalation tier.
    2. `killall -9 qmanager_watchcat` — defense in depth. SIGKILL bypasses the trap handler so the Tier 4 reboot subshell can't be spawned even if watchcat is mid-execution.
    3. SIGTERM all `qmanager_*` daemons, 1-second drain, then SIGKILL stragglers — procd's `stop_service` now sees every daemon already dead and returns instantly, no watchdog starvation.
    4. Call init.d `stop` on every `qmanager*` script for state-file cleanup (now fast, since every daemon is already gone).
- **Two lock-file safety nets** — `trap 'rm -f "$WATCHCAT_LOCK"' EXIT INT TERM` at the top of `main()` ensures failed installs don't leave watchcat permanently locked, and an explicit `rm -f "$WATCHCAT_LOCK"` after `at_stack_check` handles the OTA happy path (where `qmanager_update` passes `--no-reboot` and releases watchcat from maintenance mode before its own post-install steps).

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

### Documentation Referenced the Wrong Auth File

- **`docs/ARCHITECTURE.md` and `docs/DEPLOYMENT.md` said `/etc/qmanager/shadow`** — Both referenced a legacy placeholder that was never actually created by any script. Anyone following the "Check shadow file" troubleshooting step in the deployment guide would see "No such file or directory".
- **Fix** — Updated both docs to reference `/etc/qmanager/auth.json`, matching what `cgi_auth.sh` actually uses.

### build.sh Lint Was Fighting the New Design

- **Previous lint expected hardcoded service lists** — The v0.1.14 lint walked every `scripts/etc/init.d/qmanager*` file and grep'd `install.sh` for each by name. The v0.1.15 filesystem-driven rewrite intentionally removes those hardcoded lists, which broke the lint and blocked builds.
- **Fix** — Lint rewritten to validate the new design: checks that the filesystem-iteration pattern is present, that the main service exists, and that every `UCI_GATED_SERVICES` entry has a real file. Catches design regressions instead of fighting the intended architecture.

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
