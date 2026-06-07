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
| Shared APN lib | `scripts/usr/lib/qmanager/apn_mgr.sh` — v2 config I/O (`read_config_v2`, `write_config_v2`, `normalize_v2`), COPS apply primitives (`cops_recover`, `apply_apn_to_modem`), slot constants (`MAX_SLOTS`, `MAX_CID`, `PROFILE_FILE`), and `reapply_active_apn_slot`. Sourced by `apn.sh` and `profiles/deactivate.sh`. |
| i18n namespace | `public/locales/{en,id,it,zh-CN}/cellular.json` — `core_settings.apn.*` |
| Reboot? | No (boot-time reconcile in `qmanager_poller` replays the active APN but does not reboot) |
| Lock files? | No |
| Boot reconcile | `reconcile_active_apn_slot_at_boot()` in `apn_mgr.sh`, invoked from `qmanager_poller`'s `collect_boot_data()` — no separate daemon |

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

### action: deactivate

Reverts the modem to a carrier-assigned APN and sets `active = 0` in config (slots are untouched). This is the "let the carrier choose" state — the modem reconnects and the SIM's carrier negotiates its own default APN on reattach.

**Request body:**

```json
{ "action": "deactivate" }
```

**Success response:** `{ "success": true, "active": 0 }`

**Idempotent:** if `active` is already `0`, the modem is not touched and the response is returned immediately.

**Error codes:** `cops_detach_failed`, `cgdcont_failed`, `cops_attach_failed` (reused from activate — same COPS cycle, blank APN string forces the carrier to assign its default). The config write is best-effort: if it fails after a successful modem apply, the action still returns `success: true` and emits a `qlog_warn`. The 1500 ms reconcile will resync config state.

The final `die "invalid_action"` detail string is: `"action must be save, activate, deactivate, or clear"`.

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
| save (active slot) / activate / deactivate — deregister | `AT+COPS=2` |
| save (active slot) / activate — write APN | `AT+CGDCONT=<cid>,"<PDP_AT>","<apn>"` |
| deactivate — write blank APN (forces carrier default) | `AT+CGDCONT=<cid>,"<PDP_AT>",""` |
| save (active slot) / activate / deactivate — reattach | `AT+COPS=0` |
| boot reconcile — read live contexts | `AT+CGDCONT?` |
| boot reconcile — deregister (mismatch only) | `AT+COPS=2` |
| boot reconcile — write APN (mismatch only) | `AT+CGDCONT=<cid>,"<PDP_AT>","<apn>"` |
| boot reconcile — reattach (mismatch only) | `AT+COPS=0` |

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

### Boot-time APN reconcile (poller-hosted)

The user PDP context APN does NOT survive a modem power cycle in NVRAM. Carrier-provisioned contexts (IMS, SOS on CIDs 2/3) persist, but the user data context (typically CID 1) comes back empty. Without intervention, an active APN slot stored in `apn_profiles.json` would be silently un-applied after every reboot.

`reconcile_active_apn_slot_at_boot()` in `scripts/usr/lib/qmanager/apn_mgr.sh` closes this gap. It is invoked from `qmanager_poller`'s `collect_boot_data()` immediately after the boot profile auto-apply step, and follows this sequence:

1. **Defer to Custom SIM Profiles.** If `/etc/qmanager/active_profile` is non-empty, the profile system owns the APN at boot via `auto_apply_profile`. The reconciler returns immediately. **Authority order: Custom SIM Profile APN > APN-slot APN.** The call-site in `qmanager_poller` additionally gates on `[ ! -s /etc/qmanager/active_profile ]` before calling the function.
2. Read `apn_profiles.json`. If `active == 0` or the active slot's `apn` is empty, nothing to do. (`active == 0` means the user deliberately chose the carrier-default state — it is preserved unconditionally.)
3. Compare the stored APN against the live `AT+CGDCONT?` value for the slot's CID.
4. **Match:** return without touching the modem (idempotent — no WAN drop on a clean boot where the APN is already correct).
5. **Mismatch:** run the mandatory COPS detach/attach cycle (`AT+COPS=2` → `AT+CGDCONT=<cid>,"<PDP>","<apn>"` → `AT+COPS=0`).

**COPS-recovery pattern:** every AT-command failure inside a COPS=2 session issues a best-effort `AT+COPS=0` before returning, so the modem is never left in manual-deregistered state after a partial operation. No `AT+CFUN`, no reboot — every error path logs and returns.

**Why the poller hosts this, not a separate daemon:** the poller (`S99qmanager`) is reliably enabled at boot on all QManager installations, runs after network init, and already sequences the profile auto-apply in `collect_boot_data()`. Co-locating the APN reconcile here keeps authority ordering (profile auto-apply runs first, reconcile runs only when no profile is active) deterministic without an additional init.d service.

### Radio activate (mutually exclusive) and carrier-default state

`active` is a single integer pointer, not a per-slot boolean array. Activating slot N sets `active = N`; all other slots are implicitly inactive. `active = 0` is a first-class durable state meaning "let the carrier choose the APN."

**To switch profiles:** toggle an idle slot's switch ON — this calls the `activate` action and sets `active = N`.

**To disable all profiles:** toggle the active slot's switch OFF — this opens an AlertDialog ("Disable APN profile? Your carrier will choose the APN; the cellular connection drops briefly while the modem reconnects"), and on confirm calls the `deactivate` action. The modem runs a COPS detach/attach cycle with a blank APN so the carrier assigns its default, and `active` is written to `0`.

**Why the confirm dialog:** the COPS cycle briefly drops the WAN. The dialog text makes this explicit so the user does not click accidentally.

The `active = 0` state persists across boots. The poller's boot reconciler sees `active == 0` and makes no modem change — the carrier default set at the prior deactivate is left intact.

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

`wan-profile-list.tsx` renders slot states off each `WanProfile`, plus the `overridden` prop from `apn-settings.tsx` and live CID data from `cids[]`. The honest-badge comparison trims and lowercases both sides before comparing.

| Condition | Badge | Switch |
|---|---|---|
| `overridden && is_active && apn` | **Overridden** (muted + CircleSlashIcon) — i18n key `core_settings.apn.list.status.overridden` | disabled; the slot-number circle is also neutralized |
| `is_active && apn` — stored APN matches live CID APN | **Active** (success/green + GlobeIcon) | enabled — toggling OFF opens the deactivate AlertDialog |
| `is_active && apn` — stored APN does not match live CID APN | **Not live** (warning/amber + TriangleAlertIcon) + subtext "Network is using: `<live-apn>`" (or "Network is using the carrier default" when the live APN is blank) — suppressed while `isSaving` to avoid flicker during COPS cycle | enabled — toggling OFF opens the deactivate AlertDialog |
| `apn` non-empty, not active | **Idle** (muted) | enabled (activates on click) |
| `apn == ""` | **Empty** (faint + minus icon) | disabled until an APN is saved |
| `active == 0` (no active slot) — rendered as a banner, not a slot row | muted "No profile active — your carrier is choosing the APN automatically" banner | — |

**Why "Not live" exists:** if for any reason the boot reconcile does not run or cannot match the APN (e.g. a carrier that overrides the APN string on attach), the stored `active` pointer still points to a slot but the live CID APN no longer matches. The "Not live" badge makes this visible without requiring any manual intervention. The badge also appears when the carrier genuinely rejects or replaces the configured APN string.

**Optimistic badge suppression during COPS cycle:** `patchCidApn` in `use-wan-profiles.ts` optimistically updates the matching `cids[]` entry immediately after a successful activate or active-slot save, so the badge does not briefly flash "Not live" against a stale snapshot. The 1500 ms reconcile then overwrites this with the live server value.

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

After a successful save, activate, deactivate, or clear the hook applies an optimistic local patch immediately, then schedules a silent background re-fetch after 1500 ms (`RECONCILE_DELAY_MS`). This is necessary because `AT+COPS=0` returns `OK` before the attach fully completes — the fresh `active_cid` / `cids` state is not readable immediately after the POST returns.

On activate and on saving the active slot, `patchCidApn` also optimistically updates the matching entry in `cids[]` with the stored APN, so the honest-badge comparison does not flash "Not live" against a stale CID snapshot during the COPS settle window. The 1500 ms reconcile is the authoritative update and overwrites this with the live server value.

### Custom SIM Profile override gate

`apn-settings.tsx` checks whether an active Custom SIM Profile has a non-empty `settings.apn.name`. If it does, the page is locked read-only with a `ProfileOverrideAlert` banner showing the controlling profile name, and `overridden={true}` is passed to `WanProfileListCard`. The formerly-active APN slot then renders the **Overridden** badge (muted, CircleSlashIcon) in place of the green **Active** badge.

The verdict arrives over **two sequential fetches** — `useSimProfiles` first learns `activeProfileId` (`list.sh`), then `apn-settings.tsx`'s effect fetches that profile's APN (`get.sh`). Until both settle, the page holds the WAN list card in its loading skeleton and keeps the fieldset disabled (`overrideUndetermined`), so no Activate/Edit/Save control is ever live during the window before the gate engages. The "still determining" status is **derived during render** from `simLoading` + a `checkedId` state (the profile id whose APN fetch has completed) — there is no synchronous `setState` in the effect, satisfying the React-Compiler `set-state-in-effect` rule.

> ℹ️ NOTE: `apn_profiles.json`'s `active` pointer is intentionally NOT cleared when a Custom SIM Profile takes over. The stored pointer represents the user's intent for when the profile deactivates — resetting it would silently discard which slot the user had configured. The badge change is purely presentational.

When the Custom SIM Profile is **deactivated** (non-Verizon path), `deactivate.sh` calls `reapply_active_apn_slot` (defined in `apn_mgr.sh`) to restore the live APN. The current slot-resolution contract:

- `active != 0` and that slot has a non-empty APN → reapply it (COPS detach/attach cycle).
- `active == 0` → **no-op, return immediately.** The modem is already on the carrier's default APN (the user deliberately deactivated all slots). The old behavior — auto-picking the lowest-id non-empty slot, persisting it as `active`, and applying it — has been **removed**. A deliberate carrier-default choice now survives a Custom SIM Profile deactivation without being silently overridden.
- All slots empty → no modem change; `active` stays 0.

Reapply is best-effort — a failure does NOT fail the deactivation; the response stays `{success:true, requires_reboot:false}`. The Verizon path skips this step (a reboot is already pending); the poller's boot APN reconcile restores the active slot after the user reboots.

**Why this matters (durability guarantee):** If the user previously chose "Disable APN profile" (setting `active = 0`) and then activated a Custom SIM Profile, deactivating that profile used to silently auto-resurrect slot 1. The preserved `active = 0` pointer is now respected unconditionally.

Two new events emitted to the `dataConnection` event tab: `apn_reapplied` (info, on success) and `apn_reapply_failed` (warning, on failure). No new CGI error codes; the deactivate response shape is unchanged.

Custom SIM Profiles remain the absolute authority for APN configuration when a profile is active.

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
