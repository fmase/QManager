# Custom SIM Profile — Architecture & Approach (v2)

**QManager Feature Spec | February 2026**
**Updated with hardware-verified corrections**

---

## 1. Problem Statement

Users with multiple SIMs (or a single SIM used across different carriers/scenarios) need to quickly swap between bundles of modem settings. Today, changing from "SIM A on Carrier X" to "SIM B on Carrier Y" means manually reconfiguring APN, IMEI, TTL, HL, band locks, and network mode — six separate operations through different pages. Custom SIM Profiles collapse this into a one-click apply.

---

## 2. Feature Scope (What a "Profile" Contains)

A Custom SIM Profile is a **named bundle** of modem and system settings tied to a specific SIM card:

| Setting | AT Command / Mechanism | Persistence | Restart Required? |
|---------|------------------------|-------------|-------------------|
| **APN** | `AT+CGDCONT=<cid>,"<pdp_type>","<apn>"` | Modem NVM | No — takes effect on next attach |
| **IMEI** | `AT+EGMR=1,7,"<imei>"` | Modem NVM (flash) | **Yes** — `AT+CFUN=1,1` reboot |
| **TTL** | `iptables -t mangle` rules via existing TTL CGI infrastructure | `/etc/firewall.user.ttl` + init.d | No — immediate |
| **HL (IPv6 Hop Limit)** | `ip6tables -t mangle` rules via existing TTL CGI infrastructure | `/etc/firewall.user.ttl` + init.d | No — immediate |
| **Network Mode** | `AT+QNWPREFCFG="mode_pref",<mode>` | Modem NVM | No — triggers rescan |
| **LTE Band Lock** | `AT+QNWPREFCFG="lte_band",<band_list>` | Modem NVM | No — triggers rescan |
| **NR5G Band Lock (NSA)** | `AT+QNWPREFCFG="nsa_nr5g_band",<band_list>` | Modem NVM | No — triggers rescan |
| **NR5G Band Lock (SA)** | `AT+QNWPREFCFG="nr5g_band",<band_list>` | Modem NVM | No — triggers rescan |

### Out of Scope (v1)

- FPLMN management (per-profile forbidden network lists)
- MBN profile switching (carrier-specific modem firmware)
- Scheduled profile switching (time-of-day automation)
- Connection Scenarios (`/cellular/custom-profiles/connection-scenarios`) — higher-level abstraction, tackled separately

---

## 3. Architecture Principles

### 3.1 Respect the Single Pipe

Every AT command goes through `qcmd`. Profile application sends commands **one at a time** with sleep gaps between, following the existing "sip, don't gulp" pattern. No batching, no custom lock bypass.

### 3.2 Separate Storage from Runtime

- **Profile definitions** → Flash (`/etc/qmanager/profiles/`) — infrequent writes, acceptable for flash
- **Application state** → RAM (`/tmp/qmanager_profile_state.json`) — ephemeral progress tracking
- **Active profile ID** → Flash (`/etc/qmanager/active_profile`) — single tiny file, written once per apply

### 3.3 Async Apply, Not Blocking CGI

Profile application takes 3–15+ seconds (more if IMEI change triggers modem reboot). The CGI endpoint **spawns a detached process** and returns immediately — exactly like the existing speedtest pattern:

```
Frontend POST /apply → CGI spawns qmanager_profile_apply → returns {status: "applying"}
Frontend polls GET /status → reads /tmp/qmanager_profile_state.json → shows progress
```

### 3.4 Graceful Degradation on Partial Failure

If step 3 of 6 fails, the system:
1. Logs the failure
2. Marks the step as `"failed"` in the state file
3. **Continues** with remaining steps (unless it's a fatal failure like modem unreachable)
4. Reports final status as `"partial"` with details of what succeeded and what failed

### 3.5 No Impact on Poller

Profile application uses `qcmd` just like any other actor. The poller continues its normal cycle — it may experience slightly longer lock waits during apply, but that's by design. No new polling tier, no new state in `status.json`. The poller will naturally pick up changed modem state on its next cycle.

### 3.6 Reuse Existing Infrastructure

TTL/HL rules already have a proven persistence stack (`/etc/firewall.user.ttl`, init.d `quecmanager_ttl`, `lanUtils.sh` integration). The profile apply script reuses this infrastructure rather than reinventing it. Same principle applies to any existing settings CGI endpoints that already work.

---

## 4. Data Model

### 4.1 Profile JSON Schema

Stored at `/etc/qmanager/profiles/<id>.json`:

```json
{
  "id": "p_1707900000_abc",
  "name": "Smart LTE Unlimited",
  "mno": "Smart",
  "sim_iccid": "8963090520001234567",
  "created_at": 1707900000,
  "updated_at": 1707900000,
  "settings": {
    "apn": {
      "cid": 1,
      "name": "internet",
      "pdp_type": "IPV4V6",
      "auth_type": 0,
      "username": "",
      "password": ""
    },
    "imei": "866792052000123",
    "ttl": 64,
    "hl": 64,
    "network_mode": "AUTO",
    "lte_bands": "1:3:7:28:40",
    "nsa_nr_bands": "41:78",
    "sa_nr_bands": "41:78",
    "band_lock_enabled": false
  }
}
```

**Design decisions:**

- **`id` format:** `p_<unix_timestamp>_<3-char-random>` — no UUID dependency on BusyBox, collision-safe enough for ~10 profiles
- **`cid` field:** Configurable CID (1–15) for APN configuration, defaults to 1 for primary data connection. Users may need different CIDs for different carrier setups.
- **Band format:** Colon-delimited band numbers (`"1:3:7:28"`) — this is the **exact format** accepted by `AT+QNWPREFCFG`, so no conversion needed. Pass-through from profile to modem.
- **`network_mode` values:** `"AUTO"`, `"LTE_ONLY"`, `"NR_ONLY"`, `"LTE_NR"` — mapped to `AT+QNWPREFCFG="mode_pref"` values
- **`auth_type`:** 0=None, 1=PAP, 2=CHAP, 3=PAP+CHAP — standard 3GPP CGAUTH values
- **`sim_iccid`:** Optional SIM binding — profile remembers which SIM it was created for (informational, not enforced)
- **Maximum 10 profiles** — keeps flash usage bounded and UI manageable

### 4.2 Application State JSON

Written to `/tmp/qmanager_profile_state.json` during apply:

```json
{
  "status": "applying",
  "profile_id": "p_1707900000_abc",
  "profile_name": "Smart LTE Unlimited",
  "started_at": 1707900120,
  "current_step": 3,
  "total_steps": 6,
  "steps": [
    {"name": "apn", "status": "done", "detail": "Set APN to internet (CID 1)"},
    {"name": "network_mode", "status": "done", "detail": "Set mode to AUTO"},
    {"name": "lte_bands", "status": "running", "detail": "Setting LTE bands..."},
    {"name": "nsa_nr_bands", "status": "pending", "detail": ""},
    {"name": "ttl_hl", "status": "pending", "detail": ""},
    {"name": "imei", "status": "skipped", "detail": "No change needed"}
  ],
  "requires_reboot": false,
  "error": null
}
```

**Terminal states for `status`:** `"idle"`, `"applying"`, `"complete"`, `"partial"`, `"failed"`

### 4.3 Active Profile Tracker

`/etc/qmanager/active_profile`:
```
p_1707900000_abc
```

Single line, profile ID only. Read by the frontend to highlight which profile is active. Written once on successful apply. Deleted on profile deletion if it was the active one.

---

## 5. Backend Components

### 5.1 Profile Manager Library — `/usr/lib/qmanager/profile_mgr.sh`

A **sourceable** library (like `parse_at.sh` and `events.sh`) containing pure functions for profile CRUD and settings conversion:

```
profile_list()           → JSON array of profile summaries
profile_get(id)          → Full profile JSON
profile_save(json)       → Write/update profile file, return id
profile_delete(id)       → Remove profile file + cleanup
profile_validate(json)   → Validate schema before save
profile_count()          → Current profile count (for 10-limit enforcement)
get_active_profile()     → Read /etc/qmanager/active_profile
set_active_profile(id)   → Write active profile ID

# Conversion helpers (simplified — no hex mask needed)
mode_to_at(mode_name)    → Convert "AUTO" to AT command value
                           AUTO    → AUTO
                           LTE_ONLY → LTE
                           NR_ONLY  → NR5G
                           LTE_NR   → LTE:NR5G

get_all_bands(type)      → Query AT+QNWPREFCFG="policy_band" for "unlock all" values
```

This is a **library, not a daemon** — no persistent process, no polling. CGI scripts source it and call functions directly.

**Key simplification:** The original spec included `bands_to_hex()` for converting band lists to hex masks. This is **not needed** — the RM551E-GL accepts colon-delimited band numbers directly in `AT+QNWPREFCFG`. The band string stored in the profile JSON is the exact format the modem expects. Zero conversion required.

### 5.2 Profile Apply Script — `/usr/bin/qmanager_profile_apply`

A **standalone script** (not sourced, executed). Spawned as a detached process by the CGI endpoint:

```
qmanager_profile_apply <profile_id>
```

**Execution flow:**

```
1. Read profile JSON from /etc/qmanager/profiles/<id>.json
2. Read current modem state (current APN, IMEI, bands) via qcmd
3. Diff: determine which settings actually need changing
4. For each setting that differs:
   a. Write step status "running" to state file
   b. Execute AT command (or iptables for TTL/HL) via qcmd
   c. Verify response (check for OK vs ERROR)
   d. Write step status "done" or "failed"
   e. Sleep 0.2s (let poller slip in)
5. If IMEI changed → set requires_reboot=true, execute AT+CFUN=1,1
6. Write active_profile to flash
7. Write final status ("complete" or "partial") to state file
```

**Key design details:**

- Uses `setsid` for detachment (same pattern as `speedtest_start.sh`)
- Singleton enforcement via PID file (`/tmp/qmanager_profile_apply.pid`)
- Sources `qlog.sh` for logging — all steps logged with `[profile_apply]` tag
- Sources `profile_mgr.sh` for conversion helpers
- Exits cleanly on all paths (no orphaned state files)

### 5.3 CGI Endpoints

All endpoints live under `/www/cgi-bin/quecmanager/profiles/`:

| Endpoint | Method | Purpose | Touches Modem? |
|----------|--------|---------|----------------|
| `list.sh` | GET | Return all profiles as JSON array + active profile ID | No |
| `get.sh?id=<id>` | GET | Return single profile JSON | No |
| `save.sh` | POST | Create or update profile (enforces 10-limit on create) | No |
| `delete.sh` | POST | Delete profile by ID | No |
| `apply.sh` | POST | Spawn `qmanager_profile_apply`, return immediately | Yes (async) |
| `apply_status.sh` | GET | Return `/tmp/qmanager_profile_state.json` | No |
| `current_settings.sh` | GET | Read current modem settings for form pre-fill | Yes (via qcmd) |

**`current_settings.sh` queries (sip-don't-gulp pattern):**

```
AT+CGDCONT?                         → parse current CID/APN list
AT+CGSN                             → current IMEI
AT+QNWPREFCFG="mode_pref"          → current network mode
AT+QNWPREFCFG="lte_band"           → current LTE bands (colon-delimited)
AT+QNWPREFCFG="nsa_nr5g_band"      → current NSA NR bands (colon-delimited)
AT+QNWPREFCFG="nr5g_band"          → current SA NR bands (colon-delimited)
AT+QNWPREFCFG="policy_band"        → all supported bands (for "unlock all" reference)
AT+QNWPREFCFG="ue_capability_band" → currently active band configuration
```

Each via `qcmd`, one command at a time, sleep between. Called **once** when the user opens the profile form, not on a timer.

### 5.4 TTL/HL Management — Reusing Existing Infrastructure

The profile apply script does NOT reinvent TTL/HL rule management. Instead, it leverages the existing proven infrastructure from the TTL settings CGI:

**Existing stack (already working on the RM551E-GL):**

| Component | Path | Purpose |
|-----------|------|---------|
| TTL rules file | `/etc/firewall.user.ttl` | Stores iptables/ip6tables commands |
| Init script | `/etc/init.d/quecmanager_ttl` | Boot persistence (procd, START=99) |
| lanUtils integration | `/etc/data/lanUtils.sh` | Secondary persistence mechanism |
| WAN interface | `rmnet+` | Wildcard matching for rmnet interfaces |

**How the apply script interacts with it:**

```sh
apply_ttl_hl() {
    local new_ttl="$1"
    local new_hl="$2"
    local ttl_file="/etc/firewall.user.ttl"
    local init_script="/etc/init.d/quecmanager_ttl"

    # 1. Read current values from the ttl file
    local current_ttl current_hl
    if [ -s "$ttl_file" ]; then
        current_ttl=$(grep 'iptables.*--ttl-set' "$ttl_file" | awk '{for(i=1;i<=NF;i++){if($i=="--ttl-set"){print $(i+1)}}}')
        current_hl=$(grep 'ip6tables.*--hl-set' "$ttl_file" | awk '{for(i=1;i<=NF;i++){if($i=="--hl-set"){print $(i+1)}}}')
    fi

    # 2. Skip if unchanged
    [ "$current_ttl" = "$new_ttl" ] && [ "$current_hl" = "$new_hl" ] && return 0

    # 3. Clear existing rules
    [ -n "$current_ttl" ] && iptables -t mangle -D POSTROUTING -o rmnet+ -j TTL --ttl-set "$current_ttl" 2>/dev/null
    [ -n "$current_hl" ] && ip6tables -t mangle -D POSTROUTING -o rmnet+ -j HL --hl-set "$current_hl" 2>/dev/null

    # 4. Write new rules file
    > "$ttl_file"
    [ "$new_ttl" -gt 0 ] 2>/dev/null && {
        echo "iptables -t mangle -A POSTROUTING -o rmnet+ -j TTL --ttl-set $new_ttl" >> "$ttl_file"
        iptables -t mangle -A POSTROUTING -o rmnet+ -j TTL --ttl-set "$new_ttl"
    }
    [ "$new_hl" -gt 0 ] 2>/dev/null && {
        echo "ip6tables -t mangle -A POSTROUTING -o rmnet+ -j HL --hl-set $new_hl" >> "$ttl_file"
        ip6tables -t mangle -A POSTROUTING -o rmnet+ -j HL --hl-set "$new_hl"
    }

    # 5. Ensure init.d script exists for boot persistence
    if [ "$new_ttl" -gt 0 ] 2>/dev/null || [ "$new_hl" -gt 0 ] 2>/dev/null; then
        setup_init_script  # From profile_mgr.sh — same logic as TTL CGI
    else
        remove_init_script
    fi
}
```

**Why reuse instead of reinvent:**
- The `rmnet+` interface wildcard is already confirmed working
- The init.d persistence with `START=99` ensures rules survive reboots
- The `lanUtils.sh` integration provides a secondary persistence path
- The `-C` (check) / `-D` (delete) / `-A` (add) pattern handles idempotency
- All edge cases (interface not ready at boot, rules already applied) are handled

---

## 6. Band Locking — AT Command Reference

### Reading Bands

```sh
# All bands the modem hardware supports (the "ceiling")
AT+QNWPREFCFG="policy_band"
# Response:
# +QNWPREFCFG: "gw_band",1:2:4:5:8:19
# +QNWPREFCFG: "lte_band",1:2:3:4:5:7:8:12:13:14:17:18:19:20:25:26:28:29:30:32:34:38:39:40:41:42:66:71
# +QNWPREFCFG: "nsa_nr5g_band",41:78
# +QNWPREFCFG: "nr5g_band",41:78

# Currently configured bands (may be a subset of policy_band if band-locked)
AT+QNWPREFCFG="ue_capability_band"
# Same response format as policy_band

# Individual band type queries
AT+QNWPREFCFG="lte_band"
# +QNWPREFCFG: "lte_band",1:2:3:4:5:7:8:12:13:14:17:18:19:20:25:26:28:29:30:32:34:38:39:40:41:42:66:71
```

### Writing Bands

```sh
# Lock to specific bands (colon-delimited, NO hex masks)
AT+QNWPREFCFG="lte_band",1:3:7:28
AT+QNWPREFCFG="nsa_nr5g_band",41:78
AT+QNWPREFCFG="nr5g_band",41:78

# "Unlock all" = set to the full policy_band list
# The apply script queries policy_band first, then sets ue_capability to match
```

### "Unlock All" Logic

When `band_lock_enabled` is `false` in the profile, the apply script:

1. Queries `AT+QNWPREFCFG="policy_band"` to get all supported bands
2. Parses out the `lte_band`, `nsa_nr5g_band`, and `nr5g_band` lines
3. Sets each to the full supported list: `AT+QNWPREFCFG="lte_band",<all_supported_lte_bands>`
4. This effectively "unlocks" all bands without needing to know a magic hex value

**This is the correct behavior** — it restores the modem to its hardware-default band selection, allowing it to use any band the carrier offers.

### Key Simplification

**No hex mask conversion needed.** The modem accepts the exact same colon-delimited format we store in the profile JSON:
- Profile stores: `"lte_bands": "1:3:7:28"`  
- AT command accepts: `AT+QNWPREFCFG="lte_band",1:3:7:28`
- Pass-through. Zero transformation.

This eliminates the `bands_to_hex()` function from the original architecture spec, removing the riskiest piece of shell math (64-bit hex arithmetic on BusyBox).

---

## 7. AT Command Sequence for Apply

Ordered by impact (least disruptive first):

```
Step 1: APN
  Read:  AT+CGDCONT?                    → parse current CID <cid> APN
  Write: AT+CGDCONT=<cid>,"<pdp_type>","<apn>"
  Auth:  AT+QAUTH=<cid>,<auth_type>,"<user>","<pass>"  (if auth_type > 0)
  Note:  CID is configurable per profile (1-15), defaults to 1

Step 2: Network Mode
  Read:  AT+QNWPREFCFG="mode_pref"     → parse current mode
  Write: AT+QNWPREFCFG="mode_pref",<mode>
         Mapping: AUTO→AUTO, LTE_ONLY→LTE, NR_ONLY→NR5G, LTE_NR→LTE:NR5G

Step 3: LTE Band Lock
  If band_lock_enabled:
    Read:  AT+QNWPREFCFG="lte_band"    → current bands (colon-delimited)
    Write: AT+QNWPREFCFG="lte_band",<profile_lte_bands>
  If NOT band_lock_enabled:
    Read:  AT+QNWPREFCFG="policy_band" → parse lte_band line for all supported
    Write: AT+QNWPREFCFG="lte_band",<all_supported_lte_bands>

Step 4: NR Band Locks
  Same pattern as Step 3 for nsa_nr5g_band and nr5g_band
  Read:  AT+QNWPREFCFG="nsa_nr5g_band"
  Write: AT+QNWPREFCFG="nsa_nr5g_band",<bands>
  Read:  AT+QNWPREFCFG="nr5g_band"
  Write: AT+QNWPREFCFG="nr5g_band",<bands>

Step 5: TTL / HL (system-level, no modem lock needed)
  Uses existing /etc/firewall.user.ttl infrastructure
  Writes iptables + ip6tables rules
  Manages /etc/init.d/quecmanager_ttl for boot persistence
  See Section 5.4 for implementation details

Step 6: IMEI (most disruptive — last)
  Read:  AT+CGSN                        → parse current IMEI
  Write: AT+EGMR=1,7,"<new_imei>"      → write new IMEI to modem NVM
  Reboot: AT+CFUN=1,1                  → modem restart required to apply
  Wait:  Poll qcmd "AT" until OK       → modem back online (up to 60s)
  Verify: AT+CGSN                      → confirm new IMEI applied
```

**Why this order?**

- APN first: if the script fails partway through, at minimum the data connection is configured
- Band locks in the middle: they cause a brief rescan but no reboot
- TTL/HL before IMEI: they don't need the modem at all, so they'll succeed even if modem is busy
- IMEI last: it triggers `AT+CFUN=1,1` modem reboot, which kills serial access for ~15-30s — nothing can run after it until reboot completes

**Smart diffing:**

The apply script reads current values first and **skips unchanged settings**. If only TTL changed, the entire apply is one iptables command with zero modem interaction — no lock contention, no rescan, no poller disruption.

---

## 8. Frontend Architecture

### 8.1 New TypeScript Types

```typescript
// types/sim-profile.ts

interface SimProfile {
  id: string;
  name: string;
  mno: string;
  sim_iccid: string;
  created_at: number;
  updated_at: number;
  settings: ProfileSettings;
}

interface ProfileSettings {
  apn: ApnSettings;
  imei: string;
  ttl: number;
  hl: number;
  network_mode: NetworkModePreference;
  lte_bands: string;        // colon-delimited: "1:3:7:28"
  nsa_nr_bands: string;     // colon-delimited: "41:78"
  sa_nr_bands: string;      // colon-delimited: "41:78"
  band_lock_enabled: boolean;
}

interface ApnSettings {
  cid: number;              // Configurable CID (1-15), default 1
  name: string;
  pdp_type: "IP" | "IPV6" | "IPV4V6";
  auth_type: 0 | 1 | 2 | 3;
  username: string;
  password: string;
}

type NetworkModePreference = "AUTO" | "LTE_ONLY" | "NR_ONLY" | "LTE_NR";

interface ProfileApplyState {
  status: "idle" | "applying" | "complete" | "partial" | "failed";
  profile_id: string;
  profile_name: string;
  started_at: number;
  current_step: number;
  total_steps: number;
  steps: ApplyStep[];
  requires_reboot: boolean;
  error: string | null;
}

interface ApplyStep {
  name: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  detail: string;
}

interface CurrentModemSettings {
  apn_profiles: ApnProfile[];     // All CID/APN pairs from AT+CGDCONT?
  imei: string;
  network_mode: string;
  lte_bands: string;              // Colon-delimited current bands
  nsa_nr_bands: string;
  sa_nr_bands: string;
  supported_lte_bands: string;    // From policy_band — for band picker UI
  supported_nsa_nr_bands: string;
  supported_sa_nr_bands: string;
}

interface ApnProfile {
  cid: number;
  pdp_type: string;
  apn: string;
}
```

### 8.2 New Hooks

**`hooks/use-sim-profiles.ts`** — CRUD operations:
```
useSimProfiles() → {
  profiles: SimProfile[]
  activeProfileId: string | null
  isLoading: boolean
  error: string | null
  createProfile(data) → Promise
  updateProfile(id, data) → Promise
  deleteProfile(id) → Promise
  refresh() → void
}
```

**`hooks/use-profile-apply.ts`** — Apply lifecycle (mirrors speedtest pattern):
```
useProfileApply() → {
  applyState: ProfileApplyState | null
  isApplying: boolean
  applyProfile(id) → Promise
  // Internally polls apply_status.sh every 500ms while applying
}
```

**`hooks/use-current-settings.ts`** — One-shot modem query for form pre-fill:
```
useCurrentSettings() → {
  settings: CurrentModemSettings | null
  isLoading: boolean
  error: string | null
  refresh() → void
}
```

### 8.3 Component Wiring

The existing frontend components are already structured correctly:

| Component | File | What Changes |
|-----------|------|-------------|
| `custom-profile-form.tsx` | Create/edit form | Wire to `useCurrentSettings()` for defaults, band picker populated from `supported_*_bands`, CID selector, `useSimProfiles().createProfile()` for save |
| `custom-profile-table.tsx` | Profile list | Wire to `useSimProfiles()` for data, add Apply/Edit/Delete actions, "Active" badge from `activeProfileId` |
| `custom-profile-view.tsx` | Table wrapper | Wire to `useSimProfiles()`, conditionally show `empty-profile.tsx` |
| `custom-profile.tsx` | Page layout | No changes — already composes form + table |
| `empty-profile.tsx` | Empty state | No changes — already exists |

**Apply flow in the UI:**

1. User clicks "Activate" on a profile row → confirmation dialog
2. Dialog shows diff: "These settings will change: APN, Band Lock, TTL"
3. User confirms → `useProfileApply().applyProfile(id)` fires
4. Progress overlay shows step-by-step progress with checkmarks/spinners
5. On complete → success toast, profile row shows "Active" badge
6. On partial → warning toast with details of what failed
7. If reboot required → info banner: "Modem is restarting, dashboard will reconnect in ~30s"

**Form pre-fill behavior:**

When creating a new profile, `useCurrentSettings()` fires once to populate form defaults with the modem's current configuration. The user can then modify any fields before saving. This ensures new profiles start from a known-good state.

The band picker UI receives `supported_lte_bands` / `supported_nsa_nr_bands` / `supported_sa_nr_bands` from `policy_band` to show checkboxes for all hardware-supported bands, with currently-active bands pre-checked.

---

## 9. Risk Analysis & Edge Cases

### 9.1 Modem Reboot Mid-Apply

If `AT+CFUN=1,1` is sent (IMEI change), the modem goes offline for ~15-30 seconds. During this window:
- The poller detects `modem_reachable: false` → dashboard shows degraded state
- The apply script waits in a loop checking `qcmd "AT"` until OK is returned (with 60s timeout)
- Once modem is back, the apply script verifies the new IMEI with `AT+CGSN` and writes "complete"

### 9.2 Profile Apply While Another is Running

Singleton enforcement via PID file. The CGI endpoint checks for an existing apply process before spawning. Returns `{"error": "apply_in_progress"}` if one is already running.

### 9.3 Profile Deleted While Active

If the active profile is deleted:
- The profile file is removed
- `/etc/qmanager/active_profile` is cleared
- The modem settings are **not** reverted (they persist in modem NVM)
- The UI shows "No active profile" — the current settings remain as-is

### 9.4 SIM Swap Detection (v2)

The poller already reads ICCID at boot. If the ICCID changes (SIM swap), the UI could suggest: "New SIM detected. Would you like to apply a matching profile?" Not v1 scope.

### 9.5 Flash Wear

Profile files are small JSON (~500 bytes). Even with frequent edits, flash wear is negligible. The `/etc/qmanager/profiles/` directory sees writes only on explicit user actions (create, edit, delete, apply), not on any timer. Max 10 profiles = ~5KB total.

### 9.6 Concurrent Terminal Usage

If a user sends an AT command via the Terminal page while a profile is being applied, qcmd's flock handles it — the terminal command waits for the current apply step to finish, then executes. No special handling needed.

### 9.7 TTL/HL Persistence Race

The init.d script (`quecmanager_ttl`) has `START=99` and waits 5 seconds before applying rules, ensuring network interfaces are ready. The `-C` (check) flag prevents duplicate rules if `lanUtils.sh` already applied them. Both persistence paths are idempotent.

### 9.8 "Unlock All" During Apply

When `band_lock_enabled` is false, the apply script queries `AT+QNWPREFCFG="policy_band"` to get the full supported band list, then sets each band type to that full list. This is safer than hardcoding a "magic" unlock value because it respects the specific hardware's capabilities.

### 9.9 CID Conflicts

Multiple profiles may target the same CID. When applying a profile, the apply script overwrites whatever APN is configured on that CID. The modem handles only one APN per CID, so this is the correct behavior. The UI should show a warning if two profiles use the same CID to help the user understand the override behavior.

---

## 10. Implementation Build Order

```
Phase 1: Backend Foundation
  1. Create /etc/qmanager/profiles/ directory structure
  2. Build profile_mgr.sh library:
     - CRUD functions (list, get, save, delete, validate)
     - 10-profile limit enforcement
     - mode_to_at() conversion helper
     - get_all_bands() for "unlock all" queries
     - Active profile read/write
     - JSON construction via jq (`jq -n` with `--arg`/`--argjson`)
  3. Build CGI endpoints: list.sh, get.sh, save.sh, delete.sh
  4. Test: curl-based CRUD operations

Phase 2: Apply Pipeline  
  5. Build qmanager_profile_apply script:
     - Multi-step apply logic with state file
     - Smart diffing (skip unchanged settings)
     - TTL/HL via existing /etc/firewall.user.ttl infrastructure
     - Modem reboot handling for IMEI changes
     - Singleton PID file enforcement
     - setsid detachment
  6. Build CGI endpoints: apply.sh, apply_status.sh
  7. Build current_settings.sh (modem query for form pre-fill)
  8. Test: apply a profile via curl, verify modem settings changed

Phase 3: Frontend Types & Hooks
  9.  Create types/sim-profile.ts
  10. Build use-sim-profiles.ts hook (CRUD + active profile)
  11. Build use-profile-apply.ts hook (async apply + polling)
  12. Build use-current-settings.ts hook (one-shot query)

Phase 4: Frontend Wiring
  13. Wire custom-profile-form.tsx to hooks:
      - Pre-fill from current settings
      - Band picker with supported bands from policy_band
      - CID selector
      - Form validation
  14. Wire custom-profile-table.tsx to hooks:
      - Real profile data
      - Activate/Edit/Delete actions  
      - Active badge
  15. Wire custom-profile-view.tsx:
      - Toggle between table and empty state
  16. Add apply progress overlay/dialog
  17. Add confirmation dialog with settings diff
  18. Test end-to-end: create → apply → verify dashboard updates
```

---

## 11. File Manifest

### New Backend Files

| Local Path | Deploys To | Purpose |
|---|---|---|
| `scripts/usr/lib/qmanager/profile_mgr.sh` | `/usr/lib/qmanager/profile_mgr.sh` | Profile CRUD library + mode conversion + band queries |
| `scripts/usr/bin/qmanager_profile_apply` | `/usr/bin/qmanager_profile_apply` | Detached profile application script |
| `scripts/cgi/quecmanager/profiles/list.sh` | `/www/cgi-bin/quecmanager/profiles/list.sh` | List profiles CGI |
| `scripts/cgi/quecmanager/profiles/get.sh` | `/www/cgi-bin/quecmanager/profiles/get.sh` | Get profile CGI |
| `scripts/cgi/quecmanager/profiles/save.sh` | `/www/cgi-bin/quecmanager/profiles/save.sh` | Save profile CGI |
| `scripts/cgi/quecmanager/profiles/delete.sh` | `/www/cgi-bin/quecmanager/profiles/delete.sh` | Delete profile CGI |
| `scripts/cgi/quecmanager/profiles/apply.sh` | `/www/cgi-bin/quecmanager/profiles/apply.sh` | Apply profile CGI (async spawn) |
| `scripts/cgi/quecmanager/profiles/apply_status.sh` | `/www/cgi-bin/quecmanager/profiles/apply_status.sh` | Apply status CGI |
| `scripts/cgi/quecmanager/profiles/current_settings.sh` | `/www/cgi-bin/quecmanager/profiles/current_settings.sh` | Current modem settings CGI |

### New Frontend Files

| Local Path | Purpose |
|---|---|
| `types/sim-profile.ts` | TypeScript interfaces |
| `hooks/use-sim-profiles.ts` | Profile CRUD hook + active profile tracking |
| `hooks/use-profile-apply.ts` | Apply lifecycle hook (speedtest pattern) |
| `hooks/use-current-settings.ts` | One-shot modem settings query hook |

### Modified Frontend Files

| File | Changes |
|---|---|
| `custom-profile-form.tsx` | Wire to hooks, add CID selector, band picker, form validation, pre-fill from current settings |
| `custom-profile-view.tsx` | Wire to profiles hook, toggle table vs empty state |
| `custom-profile-table.tsx` | Wire actions (apply, edit, delete), add active badge, real data, remove drag-to-reorder (profiles have no ordering) |

### No New Backend Daemons

This feature adds **zero** persistent processes. Everything is either:
- Sourceable libraries (profile_mgr.sh)
- On-demand CGI scripts (list, get, save, delete, apply, status)
- One-shot detached scripts (qmanager_profile_apply — runs and exits)

The existing poller, ping, and watchcat daemons are unaffected.

---

## 12. Verified Hardware Facts

These answers have been confirmed against the actual RM551E-GL hardware:

| Question | Answer | Impact |
|----------|--------|--------|
| IMEI write command | `AT+EGMR=1,7,"<imei>"` works. Requires `AT+CFUN=1,1` reboot. | Architecture confirmed. Step 6 sequence is correct. |
| WAN interface | `rmnet+` (wildcard) | Confirmed by working TTL CGI script. Used in iptables rules. |
| CID for APN | Configurable (1-15) | Added `cid` field to `ApnSettings`. |
| Band lock format | Colon-delimited band numbers, not hex masks | **Major simplification.** Eliminated `bands_to_hex()`. Direct pass-through. |
| Band "unlock all" | Set to full `policy_band` list | Apply script queries `AT+QNWPREFCFG="policy_band"` at runtime. |
| Profile limit | 10 maximum | Enforced in `profile_save()` validation. |

---

*End of Architecture Document — v2*
