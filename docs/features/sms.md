# SMS

The SMS feature exposes a read/send/delete inbox and automated downtime alert notifications over the modem's AT channel (`/dev/smd11`). All modem access is serialized through the shared `flock`-based lock so `sms_tool` calls never race against `qcmd` or `atcli_smd11`.

## Quick Reference

| Item | Value |
|---|---|
| Inbox CGI | `GET/POST /cgi-bin/quecmanager/cellular/sms.sh` |
| Alert config CGI | `GET/POST /cgi-bin/quecmanager/monitoring/sms_alerts.sh` |
| Alert log CGI | `GET /cgi-bin/quecmanager/monitoring/sms_alert_log.sh` |
| Alert library | `/usr/lib/qmanager/sms_alerts.sh` |
| AT channel | `/dev/smd11` |
| Shared lock | `/var/lock/qmanager.lock` |
| Alert config | `/etc/qmanager/sms_alerts.json` |
| Alert log | `/tmp/qmanager_sms_log.json` |
| Binary | `/usr/bin/sms_tool` (patched static armhf build) |
| Reboot | Never |

## `sms_tool` Binary

The bundled `/usr/bin/sms_tool` is a patched fork of [`obsy/sms_tool`](https://github.com/obsy/sms_tool) (Apache-2.0), statically linked for ARM EABI5. The four patches and the full rebuild recipe are in [`dependencies/README.md`](../../dependencies/README.md). Summary of what changed and why:

1. **Default device is `/dev/smd11`** — upstream defaulted to `/dev/ttyUSB0`, which does not exist on the RM551E. Bare `sms_tool recv` (no `-d` flag) used to segfault; now it works silently.
2. **`isatty()` guard in `setserial()`** — `/dev/smd11` is a Qualcomm SMD char device, not a serial line. Calling `tcgetattr`/`tcsetattr` on it returns `ENOTTY` ("Inappropriate ioctl for device"). The guard makes `setserial()` a no-op on non-TTY devices, eliminating the noise at its source.
3. **`isatty()` guard in `resetserial()`** — same guard on the exit-time termios restore; removes the `failed tcsetattr: Inappropriate ioctl` line on clean exit.
4. **`exit(1)` on open/reopen/fdopen failures** — upstream fell through to `setvbuf(NULL,…)` and SIGSEGV'd. A missing port (`/dev/ttyUSB0` on RM551E) now exits 1 cleanly; the verbose `open()`/`reopen()` traces are gated behind the `-D` debug flag.

**Why `isatty()` and not a compile-time constant:** The device running this binary may expose both SMD and TTY interfaces in edge cases. The runtime check lets the same binary work on both without a rebuild.

**Binary facts:** statically linked (no INTERP segment), ARM EABI5, ~440 KB stripped. Behavior outside the patched paths is unchanged — `-d` overrides the default, `send`/`recv`/`delete`/`status`/`ussd`/`at`, `-j` JSON, and `-D` debug all work as before.

## Wrappers and Defense-in-Depth Noise Filters

Both CGI wrappers still explicitly pass `-d /dev/smd11` and still strip `tcgetattr`/`tcsetattr` lines from `sms_tool` stderr:

- `scripts/www/cgi-bin/quecmanager/cellular/sms.sh` — `_sms_run()` captures stderr to a temp file and filters `^tcgetattr(`, `^tcsetattr(`, and `Inappropriate ioctl for device$` before returning it on failure.
- `scripts/usr/lib/qmanager/sms_alerts.sh` — `_sa_strip_noise()` applies the same three `grep -v` patterns.

**Why these filters still exist:** With the patched binary these filters are no-ops — the binary no longer emits termios noise. They are kept as defense-in-depth pending a cleanup pass. Do not remove them until the binary's `isatty()` behavior has been stable across a few releases.

**Why stderr is not merged with stdout (`2>&1`):** When a `recv -j` response exceeds the ~4 KB stdout block buffer, partial flushes interleave any stderr line into the middle of the JSON stream. A line-based filter then sees JSON bytes glued onto `...Inappropriate ioctl for device` and drops the whole chunk. The wrappers capture stderr to a temp file instead, returning pure stdout on success and clean stderr on failure.

> ℹ️ NOTE: The decision to keep `sms_tool` and harden the binary reversed an earlier direction (started in PR #22) that had begun migrating the SMS read path to a native shell+awk PDU codec (`sms_pdu.awk`). Those native-codec files are not on the current branch. The binary is the canonical read path.

## Shared Lock (`/var/lock/qmanager.lock`)

All `sms_tool` calls run inside a `flock -x` on `/var/lock/qmanager.lock`, the same lock held by `qcmd` and `atcli_smd11`. This prevents concurrent `recv -j` fetches from colliding with poller or watchcat AT calls on `/dev/smd11`.

Both wrappers use a polling fallback loop (`_sms_flock_wait` / `_sa_flock_wait`) with a 10-second timeout because BusyBox `flock` does not support `-w <timeout>`. The lock file is created as an empty file if absent before the `flock` call — `flock` on a non-existent file returns 0 immediately (no lock held), so the creation step is load-bearing.

## Inbox CGI (`cellular/sms.sh`)

**GET** — fetches `recv -j` and `status`, then merges multi-part messages (same sender + `reference` field) into single entries. `indexes` in the response lists every storage slot for a merged message so a single `delete` call clears them all.

**POST actions:**

| Action | Required fields | Notes |
|---|---|---|
| `send` | `phone`, `message` | Strips a leading `+` from `phone` before calling `sms_tool`; no other normalization |
| `delete` | `indexes` (array) | Deletes each slot individually; returns `partial_failure` if any slot fails |
| `delete_all` | — | Calls `sms_tool delete all` |

On `send` failure the envelope is `{ "success": false, "error": "send_failed", "detail": "<stderr>" }` (HTTP 200 with the error in the JSON body, not a 4xx status).

## Alert Library (`sms_alerts.sh`)

Sourced by `qmanager_poller`. Entry point is `check_sms_alert`, called on every poll cycle.

**Downtime tracking state (in-process, not persisted):**

- `_sa_was_down` — whether the previous poll saw the connection down.
- `_sa_downtime_start` — epoch second when the outage began.
- `_sa_downtime_sms_status` — `none` | `pending` | `sent` | `failed`. Controls whether a recovery SMS is sent and which template it uses.

**Guards:**

- `check_sms_alert` skips entirely while `/tmp/qmanager_recovery_active` is set (mirrors `events.sh` recovery guard); downtime tracking state persists across the guard.
- `_sa_is_registered()` short-circuits on `conn_internet_available=true` so the recovery branch is never blocked by stale `lte_state`/`nr_state`.

**Failure logging:** `qlog_error` receives full context — `modem_reachable`, `lte_state`, `nr_state`, `conn`, and the cleaned `sms_tool` stderr. No breadcrumb file.

## Phone Number Handling

- Inbox CGI (`send` action): strips a leading `+` exactly once; everything else passes verbatim to `sms_tool`. Users must supply the full international number.
- Alert config CGI: strips a leading `+` exactly once before writing to `sms_alerts.json`. Storage and GET responses always return raw digits (no leading `+`). The send path passes the stored value verbatim to `sms_tool`.

## On-Device Smoke Test

```sh
sms_tool status                      # defaults to /dev/smd11, silent, exit 0
sms_tool recv -d /dev/smd11          # no tcgetattr/tcsetattr noise
sms_tool recv -d /dev/ttyUSB0        # "open port failed", exit 1, no segfault
sms_tool -D recv -d /dev/ttyUSB0     # open() trace reappears under -D
```
