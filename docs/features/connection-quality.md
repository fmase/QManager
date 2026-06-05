# Connection Quality Settings

The Connection Quality settings page (System Settings → Connection Quality) lets the user control two independent but related things: how aggressively the ping daemon probes for internet reachability (ping profile), and at what latency/loss levels QManager fires an event notification (quality thresholds). Both settings live in `/etc/config/quecmanager` and take effect without a reboot.

## Quick Reference

| Item | Value |
|---|---|
| Page route | `/system-settings/connection-quality` |
| Ping profile CGI | `GET/POST /cgi-bin/quecmanager/system/ping_profile.sh` |
| Quality thresholds CGI | `GET/POST /cgi-bin/quecmanager/system/quality_thresholds.sh` |
| UCI package | `quecmanager` (not `qmanager`) |
| UCI section — ping | `quecmanager.ping_profile.{profile,target_1,target_2}` |
| UCI section — thresholds | `quecmanager.quality_thresholds.{latency_preset,loss_preset}` |
| Ping daemon reload flag | `/tmp/qmanager_ping_reload` |
| Poller reload flag | `/tmp/qmanager_quality_reload` |
| Ping daemon output | `/tmp/qmanager_ping.json` |
| Reboot required | No |

---

## Probe Mechanics

`qmanager_ping` is an HTTP probe daemon — not ICMP. It issues a `curl` request against the active target and considers the probe successful when curl exits 0 **and** the HTTP status is 2xx or 3xx. The reported latency is curl's `time_total * 1000`, which includes TCP connect, TLS handshake, and time-to-first-byte. This is meaningfully higher than a raw ICMP RTT — factor that in when reading numbers on the dashboard.

> ⚠️ WARNING: `curl` (full build, 8.7.1+) is a hard runtime dependency of `qmanager_ping`. The daemon does not fall back to ICMP — without curl the daemon will emit no probe results and all connectivity data on the dashboard will remain null.

The daemon alternates between `target_1` and `target_2` on successive probes. A target with no URL scheme gets `https://` prepended at both the CGI and the daemon, so scheme-less values in hand-edited UCI are safe.

---

## Ping Profiles

The daemon holds the profile→parameters table. UCI stores only the **profile name** and two probe targets. Changing the profile name in UCI (or via the CGI) is sufficient — the daemon re-derives interval, fail threshold, and recover threshold from the name, so those values are never stored in config.

### Profile Table

| Profile | Interval | Fail (secs → samples) | Recover (secs → samples) |
|---|---|---|---|
| sensitive | 1 s | 6 s → 6 | 3 s → 3 |
| regular | 2 s | 10 s → 5 | 6 s → 3 |
| relaxed | 5 s | 15 s → 3 | 10 s → 2 |
| quiet | 10 s | 30 s → 3 | 20 s → 2 |

**Why ceil division:** The daemon converts seconds to sample counts via `ceil(secs/interval)`. This keeps the real-world time-to-fail and time-to-recover stable when the interval changes — a 6-second fail window at 1 s interval and the same 6 s at 2 s interval still declare failure after roughly the same wall-clock time.

**Why the daemon owns this table:** The UI uses the profile name as an opaque key. Only the daemon needs to know what the numbers mean. Storing interval in UCI would create a second source of truth that could drift from the daemon's internal logic.

### UCI defaults (seeded by installer)

`install.sh`'s `seed_uci_defaults()` writes:

```
quecmanager.ping_profile=ping_profile
quecmanager.ping_profile.profile=relaxed
quecmanager.ping_profile.target_1=https://cloudflare.com
quecmanager.ping_profile.target_2=https://google.com
```

The `ping_profile.sh` CGI also seeds these defaults on-read (via `ensure_ping_profile_config`) if the section is absent — so the section always exists after the first GET.

---

## Quality Thresholds

Quality thresholds control when `events.sh` fires `high_latency`, `latency_recovered`, `high_packet_loss`, and `packet_loss_recovered` events into the Recent Activities log.

### Preset Table

**Latency**

| Preset | Threshold | Debounce (consecutive readings) |
|---|---|---|
| standard | 150 ms | 3 |
| tolerant | 250 ms | 3 |
| very-tolerant | 500 ms | 2 |

**Packet Loss**

| Preset | Threshold | Debounce (consecutive readings) |
|---|---|---|
| standard | 15 % | 3 |
| tolerant | 30 % | 3 |
| very-tolerant | 50 % | 2 |

### Why absence == default (never seeded)

The `quecmanager.quality_thresholds` UCI section is **never seeded by the installer** and is **never created by `ensure_*` on read**. Its absence is the "user has not changed this" signal. The GET endpoint reports `isDefault: true` when the section is absent and returns `tolerant/tolerant` in the response body — the frontend displays a "Using defaults" notice instead of a "saved" state. The poller also falls back to `tolerant/tolerant` when the section is absent (see `resolve_quality_thresholds()` in `qmanager_poller`).

When the user saves thresholds for the first time, `quality_thresholds.sh` creates the section then. From that point on, `isDefault` is always `false` even if the user picks the same tolerant/tolerant values.

> ℹ️ NOTE: If you need to reset a device back to "default" state (isDefault=true), remove the UCI section: `uci delete quecmanager.quality_thresholds && uci commit quecmanager`.

---

## Apply / Reload Pipeline

```
UI card  ──POST──▶  CGI  ──uci commit──▶  /etc/config/quecmanager
                     │
                     └──touch /tmp/qmanager_ping_reload      (ping_profile)
                     └──touch /tmp/qmanager_quality_reload   (quality_thresholds)
                                │
              (within ≤1 probe cycle)
                                │
         qmanager_ping reads flag ──▶ load_config() ──▶ rm flag
         qmanager_poller reads flag ──▶ resolve_quality_thresholds() ──▶ rm flag
```

Both daemons check for their respective flag at the **top of their main loop**, before the next probe/cycle. A saved change therefore takes effect in at most one cycle — at most 10 seconds on `quiet`, at most 1 second on `sensitive`. No daemon restart, no procd touch.

---

## CGI Envelopes

### `ping_profile.sh`

**GET response**

```json
{
  "success": true,
  "profile": "relaxed",
  "target1": "https://cloudflare.com",
  "target2": "https://google.com"
}
```

> ℹ️ NOTE: GET response keys are `target1`/`target2` (no underscore). POST body keys are `target_1`/`target_2` (matching the UCI keys). This asymmetry is intentional — the GET was shaped for easy front-end destructuring; the POST mirrors the UCI field names to keep the CGI simple.

**POST request**

```json
{
  "action": "save",
  "profile": "sensitive",
  "target_1": "https://cloudflare.com",
  "target_2": "https://google.com"
}
```

**POST success**

```json
{ "success": true }
```

**Error codes**

| Code | Meaning |
|---|---|
| `invalid_profile` | `profile` not one of: `sensitive`, `regular`, `relaxed`, `quiet` |
| `invalid_target` | `target_1` or `target_2` failed validation (empty, >256 chars, interior whitespace, or contains shell/HTML metacharacters) |
| `missing_action` | `action` field absent |
| `unknown_action` | `action` not `save` |

---

### `quality_thresholds.sh`

**GET response (section present)**

```json
{
  "success": true,
  "thresholds": {
    "latency": { "preset": "tolerant" },
    "loss": { "preset": "tolerant" }
  },
  "isDefault": false
}
```

**GET response (section absent — factory state)**

```json
{
  "success": true,
  "thresholds": {
    "latency": { "preset": "tolerant" },
    "loss": { "preset": "tolerant" }
  },
  "isDefault": true
}
```

**POST request**

```json
{
  "action": "save",
  "latency_preset": "standard",
  "loss_preset": "tolerant"
}
```

> ℹ️ NOTE: The POST body uses flat keys (`latency_preset`, `loss_preset`) even though the GET response uses a nested shape (`thresholds.latency.preset`). The hook `useQualityThresholds` flattens the nested client type to flat wire keys before posting.

**POST success**

```json
{ "success": true }
```

**Error codes**

| Code | Meaning |
|---|---|
| `invalid_preset` | `latency_preset` or `loss_preset` not one of: `standard`, `tolerant`, `very-tolerant` |
| `missing_action` | `action` field absent |
| `unknown_action` | `action` not `save` |

---

## status.json / Poller Surface

The poller merges `connectivity.profile` into `status.json` from `/tmp/qmanager_ping.json`. Consumers should treat it as optional — it is absent on older poller output and on the first write before the ping daemon has run. The `connectivity` object in the response holds both the live profile name and all latency/loss stats.

---

## Frontend

| File | Purpose |
|---|---|
| `app/system-settings/connection-quality/page.tsx` | Route entry point |
| `components/system-settings/connection-quality/connection-quality.tsx` | Page shell: heading + 2-col card grid |
| `components/system-settings/connection-quality/connectivity-sensitivity-card.tsx` | Ping profile selector + target inputs |
| `components/system-settings/connection-quality/quality-thresholds-card.tsx` | Latency/loss preset selectors |
| `hooks/use-ping-profile.ts` | Fetch + save ping profile |
| `hooks/use-quality-thresholds.ts` | Fetch + save quality thresholds |
| `components/ui/meta-panel.tsx` | `MetaPanel` / `MetaPair` — info grid used for preset preview |
| `lib/motion-presets.ts` | Re-exports `containerVariants`/`itemVariants` from `lib/motion.ts` |

Types are in `types/modem-status.ts`: `PING_PROFILES`, `PingProfile`, `QUALITY_PRESETS`, `QualityPreset`, `QualityThresholdsSettings`. The `QualityThresholdsSettings` type mirrors the nested GET envelope shape; the save hook flattens it before posting.

---

## Known Gotchas

- **HTTP latency is not ICMP RTT.** The curl probe includes TCP+TLS overhead. Readings of 150–300 ms on a healthy connection are normal. Don't tune `standard` latency (150 ms threshold) on a high-latency cellular link — it will fire constantly. `tolerant` (250 ms) is the shipping default.
- **The `quality_thresholds` section must not be pre-seeded in new installs.** If it is, the frontend will never show `isDefault: true` and users won't know they haven't customised it. The installer intentionally skips seeding it.
- **Reload is flag-file per loop, not a signal.** If the daemon is in the middle of a long curl probe (up to `PROBE_MAX_TIME=3 s`) when the flag is written, the reload happens at the start of the *next* cycle. The effective delay after save is `0 → PROBE_MAX_TIME + PING_INTERVAL`.
- **Scheme-less targets in hand-edited UCI are safe.** Both the CGI and the daemon call `normalize_target()` which prepends `https://` when no scheme is present.
- **Unknown profile names fall back to `relaxed`.** If you hand-edit UCI to an unrecognised profile name, the daemon silently resets to `relaxed` and continues. No error is logged.
