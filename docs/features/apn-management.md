# APN Management

APN Management (`/cellular/settings/apn-management`) lets users create, edit, and switch between up to five named data-profile slots. It is AT-only — every live modem value comes directly via `qcmd`. Profile metadata is persisted to a JSON sidecar on the device. The page uses a **radio-select model**: exactly one slot is active at a time and switching to another slot runs a full COPS detach/attach cycle so the carrier negotiates the new APN on reattach. Carrier-managed IMS and SOS contexts are tagged (not hidden) in the CID picker so the editor can badge them and require confirmation before you target one.

## Quick Reference

| Item | Value |
|---|---|
| CGI endpoint | `GET/POST /cgi-bin/quecmanager/cellular/apn.sh` |
| CGI script | `scripts/www/cgi-bin/quecmanager/cellular/apn.sh` |
| Config file | `/usrdata/qmanager/apn_profiles.json` (v2: `{version,active,profiles[5]}`) |
| Legacy configs | `/usrdata/qmanager/apn_profiles.json` (old cid-keyed shape), `/usrdata/qmanager/apn_names.json` (migrated on first read) |
| Hook | `hooks/use-wan-profiles.ts` |
| Types | `types/wan-profiles.ts` |
| Coordinator | `components/cellular/settings/apn-management/apn-settings.tsx` |
| List card | `components/cellular/settings/apn-management/wan-profile-list.tsx` |
| Edit card | `components/cellular/settings/apn-management/wan-profile-edit.tsx` |
| Shared AT libs | `run_at` from `scripts/usr/lib/qmanager/cgi_at.sh` |
| i18n namespace | `public/locales/{en,id,it,zh-CN}/cellular.json` — `core_settings.apn.*` |
| Reboot? | No |
| Lock files? | No |

## Config File Shape (v2)

`/usrdata/qmanager/apn_profiles.json` stores exactly 5 slots with a single `active` pointer:

```json
{
  "version": 2,
  "active": 1,
  "profiles": [
    { "id": 1, "name": "GOMO",   "apn": "gomo.ph",  "pdp_type": "ipv4v6", "cid": 1 },
    { "id": 2, "name": "",       "apn": "",          "pdp_type": "ipv4v6", "cid": 1 },
    { "id": 3, "name": "",       "apn": "",          "pdp_type": "ipv4v6", "cid": 1 },
    { "id": 4, "name": "",       "apn": "",          "pdp_type": "ipv4v6", "cid": 1 },
    { "id": 5, "name": "",       "apn": "",          "pdp_type": "ipv4v6", "cid": 1 }
  ]
}
```

`active` is the `id` of the live slot, or `0` if none. A slot with an empty `apn` can never be `active` — `normalize_v2()` enforces this on every read and write path. Writes are atomic: a per-PID temp file is written, `chmod 644`-ed, then `mv`-ed over the target.

## GET Contract

**Request:** `GET /cgi-bin/quecmanager/cellular/apn.sh`

**Success response:**

```json
{
  "success": true,
  "max_profiles": 5,
  "active_profile": 1,
  "active_cid": 1,
  "internet_cid": 1,
  "profiles": [
    { "id": 1, "name": "GOMO", "apn": "gomo.ph", "pdp_type": "ipv4v6", "cid": 1, "is_active": true },
    { "id": 2, "name": "",     "apn": "",         "pdp_type": "ipv4v6", "cid": 1, "is_active": false }
  ],
  "cids": [
    { "cid": 1, "apn": "gomo.ph", "apn_type": "",          "is_internet": true  },
    { "cid": 2, "apn": "ims",     "apn_type": "ims",       "is_internet": false },
    { "cid": 3, "apn": "sos",     "apn_type": "emergency", "is_internet": false },
    { "cid": 4, "apn": "",        "apn_type": "",          "is_internet": false }
  ]
}
```

- `profiles` — the five stored slots from config. `is_active` = (`id === active_profile`). Array always has 5 entries.
- `cids` — the modem's live PDP contexts 1–6, each tagged via `apn_type_of()`. IMS and SOS contexts are **included and tagged**, not hidden. `is_internet` = (`cid === active_cid`).
- `active_cid` and `internet_cid` are always equal — both identify the live WAN-bearing PDP context.

**Error response:**

```json
{ "success": false, "error": "<code>", "detail": "<human detail>" }
```

Error codes: `parse_failed`.

## POST Contracts

### action: save

Persists a slot's configuration. Re-applies to the modem (COPS cycle) **only if the slot is the currently active one**. Saving an inactive slot is JSON-only — no WAN drop.

**Request body:**

```json
{ "action": "save", "id": 1, "name": "GOMO", "apn": "gomo.ph", "pdp_type": "ipv4v6", "cid": 1 }
```

`id` must be 1–5. `cid` must be 1–6. `pdp_type` must be `ipv4`, `ipv6`, or `ipv4v6`. `apn` is required (non-empty). `name` is optional.

**Success response:** `{ "success": true }`

Error codes: `missing_fields`, `invalid_id`, `invalid_cid`, `invalid_pdp_type`, `invalid_value`, `persist_failed`, `cops_detach_failed`, `cgdcont_failed`, `cops_attach_failed`.

### action: activate

Makes a slot the live, mutually-exclusive data profile. Writes the slot's APN to its target CID, runs the COPS cycle, then sets `active = id` in config. Rejects a slot whose `apn` is empty.

**Request body:**

```json
{ "action": "activate", "id": 2 }
```

**Success response:** `{ "success": true, "active": 2 }`

Error codes: `invalid_id`, `empty_profile`, `cops_detach_failed`, `cgdcont_failed`, `cops_attach_failed`.

> ⚠️ WARNING: If the COPS cycle succeeds but the config write fails, the action still returns `success: true`. The modem is already live on the new APN; returning an error would mislead the UI. A `qlog_warn` is emitted. The hook's 1500 ms silent reconcile fetch will resync state.

### action: clear

Empties a slot (resets name, apn, pdp_type, cid to defaults). Refused when the slot is the active one.

**Request body:**

```json
{ "action": "clear", "id": 3 }
```

**Success response:** `{ "success": true }`

Error codes: `invalid_id`, `active_locked`, `persist_failed`.

## AT Commands

| Operation | AT sequence |
|---|---|
| GET (one round-trip) | `AT+CGDCONT?;+CGACT?;+CGPADDR;+QMAP="WWAN"` |
| save (active slot) / activate — deregister | `AT+COPS=2` |
| save (active slot) / activate — write APN | `AT+CGDCONT=<cid>,"<PDP_AT>","<apn>"` |
| save (active slot) / activate — reattach | `AT+COPS=0` |

PDP type translation: `ipv4` → `IP`, `ipv6` → `IPV6`, `ipv4v6` → `IPV4V6`.

## Key Invariants

### Single compound GET round-trip

The GET handler issues one `run_at` call: `AT+CGDCONT?;+CGACT?;+CGPADDR;+QMAP="WWAN"`. All four sections parse from the single `blob`.

> ⚠️ WARNING: Do NOT call `detect_active_cid()` from `cgi_at.sh` inside the GET path. That function issues its own `qcmd 'AT+CGPADDR;+QMAP="WWAN"'`, negating the single-round-trip optimization and adding an extra modem channel handshake for no benefit.

Active-CID detection is inlined from `profiles/current_settings.sh`: QMAP is authoritative (first non-zero IP wins); CGPADDR (first octet > 0, valid 4-octet IPv4) is the fallback; default `"1"`.

### COPS detach/attach cycle (required, not legacy)

On LTE/5G (EPS), the default EPS bearer is negotiated at *attach time* — the APN is a contract field with the MME/PGW. `AT+CGACT=0,<cid>` / `AT+CGACT=1,<cid>` cycles only the user-plane of an already-established bearer; the MME retains the original APN. The new `CGDCONT` value never reaches the network.

`AT+COPS=2` forces a full detach. The subsequent `AT+COPS=0` triggers a fresh Attach Request that carries the newly written APN, causing the PGW to build a new default bearer.

The CGI path is LAN/Wi-Fi → lighttpd → modem. The cellular WAN drops briefly during the cycle but the HTTP path to the modem does not. No sleep is needed between steps — `run_at` goes through `qcmd`'s `flock` and is synchronous on `OK`/`ERROR`. No reboot, no `AT+CFUN`.

`cops_recover()` issues `AT+COPS=0` best-effort on every post-detach error path, so the modem is never left in manual-deregistered state after a partial operation.

### Radio activate (mutually exclusive)

`active` is a single integer pointer, not a per-slot boolean array. Activating slot N sets `active = N`; all other slots are implicitly inactive. There is no "deactivate" action — switching to a different slot is the only way to change the active pointer. The UI enforces this: the active slot's switch is permanently disabled (`disabled={isSaving || !configured || profile.is_active}`), so the only reachable edge is OFF→ON on a different slot.

### Save vs. activate split

A `save` on an **inactive** slot is JSON-only — no WAN disruption. A `save` on the **active** slot re-applies to the modem (COPS cycle) because the live APN must match what is stored. `activate` always runs the COPS cycle regardless of prior state.

**Why:** This split lets users stage up to four profiles without dropping the WAN, and only accept the brief connectivity drop when they deliberately choose to switch.

### IMS/SOS classification — tagging, not exclusion

`apn_type_of()` performs a case-insensitive substring match on the live APN string:

| Pattern match | Classification | Returned in |
|---|---|---|
| `*ims*` | `ims` | `cids[]` only (tagged) |
| `*sos*`, `*emergency*`, `*xcap*`, `*rcs*` | `emergency` | `cids[]` only (tagged) |
| (none) | `""` | `cids[]` (untagged) |

IMS and SOS contexts appear in the `cids` array (the CID picker) with their `apn_type` set. They are **not** dropped. This is the key v1→v2 change from the prior version that excluded them entirely.

> ⚠️ WARNING: The classification is a heuristic substring match, NOT an authoritative source. Carriers may use unexpected APN strings. The CID picker's AlertDialog confirmation is the deliberate mitigation — selecting a tagged context requires an explicit "I understand" step.

The `profiles` array (the five stored slots) is unaffected by this classifier. A profile can target any CID 1–6.

### Frontend slot states

`wan-profile-list.tsx` renders three slot states off each `WanProfile`:

| Condition | Badge | Switch |
|---|---|---|
| `is_active && apn` | **Active** (success/green + globe icon) | disabled (can't turn off; switch to another) |
| `apn` non-empty, not active | **Idle** (muted) | enabled (activates on click) |
| `apn == ""` | **Empty** (faint + minus icon) | disabled until an APN is saved |

### CID picker — carrier badges and AlertDialog confirmation

`wan-profile-edit.tsx` renders the CID selector from `cids` (the live modem contexts). Each option carries a `CidBadge`:

| `apn_type` | Badge | Color |
|---|---|---|
| `"ims"` | PhoneCall icon + "IMS" | warning/amber |
| `"emergency"` | Siren icon + "SOS" | destructive/red |
| `""` and `is_internet` | Globe icon + "Internet" | success/green |
| `""` and not internet | (none) | — |

When the user selects a CID whose `apn_type` is `"ims"` or `"emergency"`, `handleCidChange` intercepts it, stashes it in `pendingCid`, and opens an `AlertDialog`. The Select remains controlled by the prior `cid` value, so it visually reverts on cancel. Only after confirming does `setCid` apply the new value.

### jq null-guard pattern

All `jq` expressions in `apn.sh` use explicit `if x == null then … else … end` guards. The project rule — never use `// empty`, `// ""`, or `// {}` on fields that might be boolean — is enforced by `validator`. No `//` null-coalescing operators appear anywhere in the script.

### Optimistic update + reconcile

After a successful save, activate, or clear the hook applies an optimistic local patch immediately, then schedules a silent background re-fetch after 1500 ms (`RECONCILE_DELAY_MS`). This is necessary because `AT+COPS=0` returns `OK` before the attach fully completes — the fresh `active_cid` / `cids` state is not readable immediately after the POST returns.

### Custom SIM Profile override gate

`apn-settings.tsx` checks whether an active Custom SIM Profile has a non-empty `settings.apn.name`. If it does, the page is locked read-only with a `ProfileOverrideAlert` banner showing the controlling profile name. Custom SIM Profiles remain the absolute authority for APN configuration when a profile is active.

## Migration

`read_config_v2()` runs on every GET. It detects the on-disk shape and migrates once, then re-persists so subsequent reads are a straight load.

| Precedence | Shape detected | Migration result |
|---|---|---|
| 1 | Already v2 (`version == 2`, `profiles` is array) | Normalize to 5 slots; re-persist only if bytes changed |
| 2 | Old cid-keyed object `{"<cid>":{name,apn,pdp_type}}` | Lowest cid → slot 1; `active=1` if apn non-empty, else `active=0`; slots 2–5 empty |
| 3 | Legacy `apn_names.json` `{"<cid>":"<name>"}` | Lowest cid name → slot 1; `apn=""`; `active=0`; slots 2–5 empty |
| 4 | Nothing usable | 5 empty slots, `active=0` |

The invariant "a slot with an empty apn is never active" is applied after every migration path via `normalize_v2()`.

## Removed from Prior Versions

The following were removed and must not be re-introduced:

- **Per-CID toggle (`AT+CGACT`)** — the v1 `toggle` action cycled individual contexts. This does not negotiate the APN with the carrier on EPS. Replaced by the `activate` action (COPS cycle).
- **`apn_type` exclusion from `profiles`** — v1 skipped IMS/SOS rows from the profiles list entirely. v2 tags them in `cids` instead and shows them in the CID picker with a badge and confirmation dialog.
- **`index` field** — v1 used `index` as the row key. v2 uses `id` (stable slot identifier 1–5) consistently across config, API, and types.
- **`enabled` field** — v1 per-row boolean. v2 uses `is_active` (derived from `id === active_profile`).
- **`max_profiles: 6`** — v1 returned 6 (the modem's CID count). v2 returns 5 (the stored slot count).
- **Auth type, username, password, `AT+QICSGP`** — authentication machinery for the Casa RDB path only.
- **MTU, VLAN mapping, Default Route, IP Passthrough** — Casa RDB/wmmd-specific; never functional on OpenWRT.
- **`dataSource` branching** — the hook no longer has a `dataSource` field; the path is always AT-only.

## Related Docs

- [Custom SIM Profiles](custom-sim-profiles.md) — the override gate source of truth; profiles with a non-empty APN lock this page read-only.
- [Error Code Vocabulary](error-codes.md) — how the `{ error, detail }` envelope maps to frontend toast messages.
