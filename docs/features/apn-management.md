# APN Management

APN Management (`/cellular/settings/apn-management`) lets users name, edit, enable, and disable the modem's data APN profiles. It is AT-only — every live value comes directly from the modem via `qcmd`, with user-typed profile metadata persisted to a JSON sidecar. Carrier-managed IMS and SOS contexts are classified and hidden; every other CID slot appears, including unconfigured ones (shown as empty, editable rows with a disabled toggle until an APN is set).

## Quick Reference

| Item | Value |
|---|---|
| CGI endpoint | `GET/POST /cgi-bin/quecmanager/cellular/apn.sh` |
| CGI script | `scripts/www/cgi-bin/quecmanager/cellular/apn.sh` |
| Config file | `/usrdata/qmanager/apn_profiles.json` |
| Legacy config | `/usrdata/qmanager/apn_names.json` (migrated on first read) |
| Hook | `hooks/use-wan-profiles.ts` |
| Types | `types/wan-profiles.ts` |
| Coordinator | `components/cellular/settings/apn-management/apn-settings.tsx` |
| List card | `components/cellular/settings/apn-management/wan-profile-list.tsx` |
| Edit card | `components/cellular/settings/apn-management/wan-profile-edit.tsx` |
| Shared AT libs | `parse_cgdcont`, `run_at` from `scripts/usr/lib/qmanager/cgi_at.sh` |
| i18n namespace | `public/locales/{en,id,it,zh-CN}/cellular.json` — `core_settings.apn.*` |
| Reboot? | No |
| Lock files? | No |

## GET Contract

**Request:** `GET /cgi-bin/quecmanager/cellular/apn.sh`

**Success response:**

```json
{
  "success": true,
  "max_profiles": 6,
  "active_cid": 1,
  "internet_cid": 1,
  "profiles": [
    {
      "index": 1,
      "cid": 1,
      "name": "GOMO",
      "apn": "SMARTLTE",
      "pdp_type": "ipv4v6",
      "enabled": true,
      "is_active": true,
      "apn_type": ""
    }
  ]
}
```

`active_cid` and `internet_cid` are always equal — both identify the live WAN-bearing PDP context. `apn_type` is always `""` on returned profiles (non-empty types are excluded from the list entirely, never returned with a tag).

**Error response:**

```json
{ "success": false, "error": "<code>", "detail": "<human detail>" }
```

Error codes: `parse_failed`.

## POST Contracts

### action: save

Writes a new APN and PDP type to a CID and forces a network detach/re-attach so the modem negotiates the new APN with the carrier at attach time.

**Request body:**

```json
{ "action": "save", "index": 1, "name": "My Profile", "apn": "SMARTLTE", "pdp_type": "ipv4v6" }
```

`name` is optional (persisted to config only; not sent to the modem). `pdp_type` must be one of `ipv4`, `ipv6`, `ipv4v6`.

**Success response:** `{ "success": true }`

Error codes: `missing_fields`, `invalid_pdp_type`, `invalid_value`, `invalid_index`, `cops_detach_failed`, `cgdcont_failed`, `cops_attach_failed`.

### action: toggle

Activates or deactivates a PDP context.

**Request body:**

```json
{ "action": "toggle", "index": 1, "enabled": true }
```

**Success response:** `{ "success": true }`

Error codes: `missing_fields`, `invalid_index`, `cgact_failed`.

## AT Commands

| Operation | AT sequence |
|---|---|
| GET (one round-trip) | `AT+CGDCONT?;+CGACT?;+CGPADDR;+QMAP="WWAN"` |
| save — detach | `AT+COPS=2` |
| save — write APN | `AT+CGDCONT=<cid>,"<PDP_AT>","<apn>"` |
| save — re-attach | `AT+COPS=0` |
| toggle | `AT+CGACT=<0\|1>,<cid>` |

PDP type translation: `ipv4` → `IP`, `ipv6` → `IPV6`, `ipv4v6` → `IPV4V6`.

## Key Invariants

### Single compound GET round-trip

The GET handler issues one `run_at` call: `AT+CGDCONT?;+CGACT?;+CGPADDR;+QMAP="WWAN"`. All four sections parse from the single `blob`.

> ⚠️ WARNING: Do NOT call `detect_active_cid()` from `cgi_at.sh` inside the GET path. That function issues its own `qcmd 'AT+CGPADDR;+QMAP="WWAN"'`, negating the single-round-trip optimization and adding an extra modem channel handshake for no benefit.

The active-CID detection logic is instead inlined verbatim from `profiles/current_settings.sh`: QMAP is authoritative (first non-zero IP wins); CGPADDR (first octet > 0, valid 4-octet IPv4) is the fallback; default `"1"`.

### COPS detach/attach cycle on save (required, not legacy)

On LTE/5G (EPS), the default EPS bearer for CID 1 is negotiated at *attach time* — the APN is a contract field with the MME/PGW. Issuing `AT+CGACT=0,<cid>` / `AT+CGACT=1,<cid>` cycles only the user-plane of an already-established bearer; the MME retains the original APN. The new `CGDCONT` value never reaches the network.

`AT+COPS=2` forces a full detach. The subsequent `AT+COPS=0` (automatic operator selection) triggers a fresh Attach Request that carries the newly written APN, causing the PGW to build a new default bearer.

The CGI path is LAN/Wi-Fi → lighttpd → modem; the cellular WAN drops briefly during the cycle, but the HTTP path to the modem does not. No sleep is needed between steps — `run_at` goes through `qcmd`'s `flock` and is synchronous on `OK`/`ERROR`.

`cops_recover()` is defined as a local helper that issues `AT+COPS=0` best-effort on every post-detach error path, so the modem is never left in manual-deregistered state after a partial save.

### Slot list — all non-carrier CIDs, empty ones included

The GET loop emits a row for **every** CID slot `1..MAX_PROFILES` that is not a carrier (IMS/SOS) context — including CIDs that are undefined on the modem and absent from config. Those surface as **empty rows** (`apn:""`, `pdp_type:""`, `enabled:false`) so the UI shows editable placeholder slots the user can populate, rather than collapsing to only the one configured data context. Only carrier CIDs are dropped.

> ⚠️ The carrier-skip branch increments `cid` **before** `continue` — omitting that increment would infinite-loop the `while`. Keep the `cid=$((cid + 1)); continue` ordering intact.

Frontend (`wan-profile-list.tsx`) keys three states off the row:

| Condition | Badge | Switch |
|---|---|---|
| `is_active && apn` | **In Use** (success) | enabled |
| `apn` (configured, not active) | **Idle** (muted) | enabled |
| `apn == ""` (empty slot) | **Empty** (faint) | **disabled** until an APN is saved |

The "In Use" badge requires a non-empty APN, so the `active_cid` default-fallback of `"1"` (when no WAN is detected) can never make an empty CID 1 read as in use.

### "In Use" / active CID detection

The `is_active` flag is set on the CID whose `index == active_cid`. `active_cid` is detected inline from the compound AT response (QMAP authoritative → CGPADDR fallback → default `"1"`). This replaces the old approach that re-anchored on a per-context assigned IP, which caused the IMS context (CID 2) to falsely appear "Connected" because its IMS IPv6-as-octets address polluted the IPv4 field.

### IMS / SOS exclusion

`apn_type_of()` performs a case-insensitive substring match on the APN string:

| Pattern match | Classification | Action |
|---|---|---|
| `*ims*` | `ims` | Skipped (not a slot) |
| `*sos*`, `*emergency*`, `*xcap*`, `*rcs*` | `emergency` | Skipped (not a slot) |
| (none) | `""` | Included as a data APN slot |

A non-empty `apn_type` means the row is `continue`-skipped — carrier contexts never appear in the `profiles` array. Every other CID 1..MAX is returned, defined or not.

### Config persistence

`/usrdata/qmanager/apn_profiles.json` stores a JSON object keyed by CID string:

```json
{
  "1": { "name": "GOMO", "apn": "SMARTLTE", "pdp_type": "ipv4v6" },
  "3": { "name": "Backup", "apn": "internet", "pdp_type": "ipv4" }
}
```

Writes are atomic: a per-PID temp file is written, `chmod 644`-ed, then `mv`-ed over the target. `chmod 644` is applied to both the temp file (before the move) and the final path (after), so the mode does not depend on the CGI process's `umask`.

No lock file protects this write — `/usrdata/qmanager/` is not shared with a daemon in this path (contrast: `qmanager_profile_apply` which does use a lock). The single-writer assumption holds as long as no other CGI writes `apn_profiles.json` concurrently.

### Legacy migration

On first GET after an upgrade, if `apn_profiles.json` is absent but the old `apn_names.json` (`{"1": "GOMO", "3": "Backup"}`) exists, `read_profiles_json()` lifts each name into `{name: <name>}` via `jq map_values({name: .})`. APN and PDP type are not present in the legacy file; they fall back to the live CGDCONT values on first display.

### jq null-guard pattern

All `jq` expressions in `apn.sh` use explicit `if x == null then … else … end` guards. The project-absolute rule — never use `// empty`, `// ""`, or `// {}` on fields that might be boolean — is enforced by `validator`. The `enabled` field is boolean; `jq`'s `// false` would silently drop a real `false` value.

### Custom SIM Profile override gate

`apn-settings.tsx` checks whether an active Custom SIM Profile has a non-empty `settings.apn.name`. If it does, the entire page is wrapped in a disabled `<fieldset>` and a `ProfileOverrideAlert` banner shows the controlling profile name. This is unchanged from prior versions — Custom SIM Profiles remain the absolute authority for APN configuration when a profile is active.

The check is async: `useSimProfiles().getProfile(activeProfileId)` is awaited in a `useEffect`. A cancelled-flag pattern prevents stale-closure state updates if the component unmounts before resolution.

### Optimistic update + reconcile

After a successful save or toggle, the hook applies an optimistic patch to local state immediately, then schedules a silent background re-fetch after 1500 ms. This is necessary because `AT+COPS=0` returns `OK` before the attach fully completes — the fresh `active_cid` / `enabled` state isn't readable immediately after the POST returns.

## Removed from Prior Versions

The following were removed in this rebuild and must not be re-introduced:

- **Auth Type, username, password, `AT+QICSGP`** — authentication machinery that only applied to the Casa RDB path.
- **MTU** — was a Casa RDB field; has no AT equivalent in this path.
- **VLAN mapping, Default Route, IP Passthrough** — Casa RDB/wmmd-specific; never functional on OpenWRT.
- **`dataSource` branching (`rdb`/`at`)** — the hook no longer has a `dataSource` field; the path is always AT-only.

## Related Docs

- [Custom SIM Profiles](custom-sim-profiles.md) — the override gate source of truth; profiles with a non-empty APN lock this page read-only.
- [Error Code Vocabulary](error-codes.md) — how the `{ error, detail }` envelope maps to frontend toast messages.
