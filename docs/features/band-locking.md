# Band Locking

Band Locking lets users restrict which LTE, NSA NR5G, and SA NR5G bands the modem is allowed to use. Constraining the band set can improve stability, latency, or throughput when one or two bands are dominant at a given site. It is independent of Connection Scenarios (which control network mode); the two features compose — a scenario can also carry a band lock via the Custom SIM Profiles integration.

NR-DC bands are **view-only**: the modem manages NR-DC band selection internally, and the UI surfaces the current active NR-DC bands as a read-only display with no action controls.

## Quick Reference

| Item | Value |
|---|---|
| Current bands | `GET /cgi-bin/quecmanager/bands/current.sh` |
| Apply lock | `POST /cgi-bin/quecmanager/bands/lock.sh` |
| Failover state | `GET /cgi-bin/quecmanager/bands/failover_status.sh` |
| Failover toggle | `POST /cgi-bin/quecmanager/bands/failover_toggle.sh` |
| Supported bands (poller) | `data.device.supported_{lte,nsa_nr5g,sa_nr5g,nrdc_nr5g}_bands` |
| AT command (read current) | `AT+QNWPREFCFG="ue_capability_band"` |
| AT command (read supported) | `AT+QNWPREFCFG="policy_band"` |
| AT command (unlock / restore) | `AT+QNWPREFCFG="restore_band"` |
| Env cache | `/tmp/qmanager_supported_bands.env` |
| Failover PID | `/tmp/qmanager_band_failover.pid` |
| Failover activated flag | `/tmp/qmanager_band_failover` |
| Failover enabled flag | `/etc/qmanager/band_failover_enabled` |
| Reboot on lock? | No |
| Types | `types/band-locking.ts` |
| Hook | `hooks/use-band-locking.ts` |
| Component | `components/cellular/band-locking/band-locking.tsx` |
| Backend scripts | `scripts/www/cgi-bin/quecmanager/bands/` |
| Parse lib | `scripts/usr/lib/qmanager/parse_at.sh` — `parse_policy_band` |
| Failover daemon | `scripts/usr/bin/qmanager_band_failover` |

---

## Band Types and AT Parameter Mapping

Three band categories are lockable, each mapping to a distinct `AT+QNWPREFCFG` parameter name. NR-DC is read-only and has no write path. This mapping is the authoritative source; get it wrong and you write to the wrong radio capability.

| `BandCategory` (frontend) | `band_type` (POST body) | AT parameter (`QNWPREFCFG`) | Band prefix (UI) | Writable? |
|---|---|---|---|---|
| `"lte"` | `"lte"` | `lte_band` | `B` | Yes |
| `"nsa_nr5g"` | `"nsa_nr5g"` | `nsa_nr5g_band` | `N` | Yes |
| `"sa_nr5g"` | `"sa_nr5g"` | `nr5g_band` | `N` | Yes |
| `"nrdc_nr5g"` | — (no write path) | `nrdc_nr5g_band` (read-only) | `N` | **No** |

Note the asymmetry on the SA row: the frontend key is `sa_nr5g` but the AT parameter is `nr5g_band` (no `sa_` prefix). NR-DC read extraction uses `nrdc_nr5g_band`, which is a unique substring and does not collide with the SA guard.

> ℹ️ NOTE: `lock.sh` rejects `band_type=nrdc_nr5g` with `invalid_band_type`. The NR-DC category is intentionally excluded from the lockable set.

---

## Critical Invariant: The SA grep Substring-Match Hazard

`AT+QNWPREFCFG="policy_band"` and `AT+QNWPREFCFG="ue_capability_band"` both return lines containing the string `nr5g_band`. Naively grepping for `"nr5g_band"` would match three lines:

```
+QNWPREFCFG: "nsa_nr5g_band",41:78
+QNWPREFCFG: "nrdc_nr5g_band",1:3:5:...
+QNWPREFCFG: "nr5g_band",41:78
```

**Both `parse_at.sh` (`parse_policy_band`) and `current.sh` guard the SA extraction with a double negative-grep:**

```sh
line=$(printf '%s\n' "$raw" | grep '"nr5g_band"' | grep -v 'nsa_' | grep -v 'nrdc_' | head -1)
```

Removing either `grep -v` would silently assign the NSA or NR-DC band list to SA. This has no error at runtime — the wrong data simply replaces the right data. NR-DC extraction is safe by contrast because `"nrdc_nr5g_band"` is a unique substring; it only matches its own line.

> ⚠️ WARNING: If you add a new band type that contains the substring `nr5g_band`, update the SA extraction guards in both `parse_at.sh` and `current.sh` to exclude the new key.

---

## Supported vs. Locked Bands: Two Different AT Queries

| Purpose | AT command | When queried | Where stored |
|---|---|---|---|
| Hardware-supported (all bands the modem can physically use) | `AT+QNWPREFCFG="policy_band"` | Boot-only | `/tmp/qmanager_supported_bands.env` (4 lines), then emitted in `status.json` as `device.supported_*_bands` |
| Currently locked (what the modem is actually restricted to) | `AT+QNWPREFCFG="ue_capability_band"` | On demand (`current.sh`) | Not cached — always live |

**Why:** `policy_band` reflects modem radio hardware capabilities and never changes at runtime; it is safe to cache across the poller's lifetime. `ue_capability_band` reflects the current locked configuration; it must be read live so the UI shows what's actually in effect.

The env cache file has exactly four shell variable assignments, in this order:

```sh
boot_supported_lte_bands="..."
boot_supported_nsa_nr5g_bands="..."
boot_supported_sa_nr5g_bands="..."
boot_supported_nrdc_nr5g_bands="..."
```

**Stale-cache tolerance:** A pre-upgrade cache from before NR-DC support was added will lack the fourth line. That line feeds only the NR-DC view-only display — nothing writes NR-DC — so its absence just means the NR-DC card shows no bands until the poller rewrites the full four-line cache on the next cold boot (once `/tmp` is cleared). Stale caches are self-healing.

---

## Env Cache and `status.json` Emission

After `parse_policy_band` runs during the poller's boot sequence, the poller writes the cache and later emits the four values into `status.json` under `device.*`:

```json
{
  "device": {
    "supported_lte_bands": "1:2:3:4:5:7:8:12:...",
    "supported_nsa_nr5g_bands": "41:66:71:77:78:...",
    "supported_sa_nr5g_bands": "41:66:71:77:78:...",
    "supported_nrdc_nr5g_bands": "1:2:3:5:7:8:12:14:25:26:28:30:40:41:48:66:71:77:78:79:257:258:259:260:261"
  }
}
```

The frontend reads these via `useModemStatus()` and passes them as `supportedBands` props to the band cards.

---

## SA ⇄ NR-DC Swap UX

The Band Locking page uses three cards. LTE and NSA NR5G are fixed. The third slot is shared between SA NR5G and NR-DC; only one is visible at a time.

**How it works:**

- `BandLockingComponent` holds a `saSlotView` state (`"sa_nr5g" | "nrdc_nr5g"`), initialized to `"sa_nr5g"`.
- The third `BandCardsComponent` receives `key={saSlotView}`. Changing `saSlotView` remounts the card completely.
- An `ArrowLeftRight` button in the card header calls `onSwapView()` which toggles `saSlotView` to the other value.
- The swap button label and tooltip show the *target* mode (what you will switch to), not the current mode.

**Why remount rather than re-render:** Remounting resets checkbox state from the new mode's locked band list, rather than showing the previous mode's checked bands in the new category's checkbox grid. It also replays the card's entrance animation, giving a clear "mode changed" cue without any additional animation logic.

**Behavioral note:** Swapping does not send any AT command. It only changes which category is displayed and which band set is loaded. For SA, the user presses Save to apply changes. **For NR-DC, the card is rendered read-only** (`readOnly` prop on `BandCardsComponent`): a disabled band grid reflecting the modem's current active NR-DC bands, a "View only" badge, and no Save/Unlock/Select/Deselect controls.

---

## Lock Operation (POST `lock.sh`)

Each band card sends an independent lock request. The lock is per-category; the other three categories are untouched.

**Request:**

```json
{ "band_type": "sa_nr5g", "bands": "41:78" }
```

- `band_type`: one of `lte`, `nsa_nr5g`, `sa_nr5g` (NR-DC is read-only and rejected with `invalid_band_type`)
- `bands`: colon-delimited non-empty list of band numbers. Must match `^[0-9:]+$`. There is no "lock zero bands" state.

**AT command sent:**

```
AT+QNWPREFCFG="nr5g_band",41:78
```

**Response:**

```json
{
  "success": true,
  "band_type": "sa_nr5g",
  "bands": "41:78",
  "failover_armed": true
}
```

`failover_armed` is `true` when failover is enabled and a one-shot watcher was spawned.

**Error codes:**

| `error` | Cause |
|---|---|
| `no_band_type` | Missing `band_type` field |
| `no_bands` | Missing or empty `bands` field |
| `invalid_band_type` | `band_type` not in the three allowed values (includes `nrdc_nr5g`, which is read-only) |
| `invalid_bands` | `bands` contains characters other than digits and colons |
| `modem_error` | `qcmd` returned non-zero or empty |
| `at_error` | Modem responded with `ERROR` |

---

## "No Zero-Band Lock" — Why `bands,0` Is Invalid

Early in the NR-DC feature development, a "Deselect All → Save sends `,0`" behavior was considered. Investigation found that `AT+QNWPREFCFG="<param>",0` is not a valid radio capability command — band parameters require a non-empty colon-delimited allow-list. The real "remove the lock and return to all supported bands" verb is a separate AT sub-command:

```
AT+QNWPREFCFG="restore_band"
```

The existing guards are intentional:
- The UI Save button is disabled when no bands are selected.
- `useBandLocking` hook rejects an empty `[]` band array.
- `lock.sh` returns `no_bands` error on an empty field.

Do not change any of these guards to permit sending an empty or `,0` band list.

---

## Band Failover

When failover is enabled, `lock.sh` spawns `qmanager_band_failover` (double-forked, detached) after each successful lock. The watcher:

1. Sleeps 5 seconds to let the modem settle after the band change.
2. Queries `AT+QCAINFO`. If any `+QCAINFO:` line is present, signal is OK and the watcher exits.
3. If no carrier data is returned, it reads the LTE/NSA/SA supported band sets from `status.json` (falling back to the env cache) and resets each category to its full supported set. **NR-DC is not reset** — it is modem-managed and never written.
4. Writes the `/tmp/qmanager_band_failover` flag: `"activated"` on full success, `"partial"` if any category's reset AT command failed.

The UI reads `failover_status.sh` to surface the `activated` flag as a banner.

**Lock supersedes failover:** On a new lock, `lock.sh` removes the `/tmp/qmanager_band_failover` activation flag and kills any running watcher before spawning a fresh one. The most recent lock is always the one being monitored.

---

## i18n

NR-DC added keys in all four locales (`public/locales/{en,id,it,zh-CN}/cellular.json`):

| Key path | Purpose |
|---|---|
| `cell_locking.band_locking.cards.nrdc_nr5g.title` | Card title ("NR-DC Bands") |
| `cell_locking.band_locking.cards.nrdc_nr5g.description` | Card description (explains NR-DC is modem-managed / view-only) |
| `cell_locking.band_locking.card_category_label.nrdc_nr5g` | Swap button label (shows target mode) |
| `cell_locking.band_locking.card_buttons.swap_view` | Swap button tooltip template (`"Switch to {{target}}"`) |
| `cell_locking.band_locking.card_badges.view_only` | "View only" badge shown on the read-only NR-DC card |

---

## Force-Tier-2 Refresh After Band Lock

After a successful band lock, `lock.sh` sleeps 2 seconds (modem re-registration settle) and then touches `/tmp/qmanager_force_tier2`. The CGI is a write-only producer — it never reads or parses the file.

The poller's `poll_cycle` checks for the flag after the `LONG_FLAG` early-return block. When present it consumes the flag (`rm -f`) and immediately runs `poll_tier2` + `read_sim_state` + `refresh_sim_identity`. This refreshes operator name, APN, DNS, WAN-IP, ICCID, and IMSI within ~4 seconds of the lock, rather than waiting up to ~30 seconds for the next Tier-2 boundary.

**Why:** A band change forces the modem to re-register on a different carrier cell. The new cell can advertise a different operator name, APN, and network addressing. Without the flag, the UI shows stale data for the full Tier-2 cadence (`TIER2_EVERY=15` × `POLL_INTERVAL=2s` ≈ 30s).

**Invariants to preserve:**
- `lock.sh` MUST NOT write `/tmp/qmanager_status.json`. The poller is the sole atomic writer of that file (via `write_cache`). The CGI only touches the flag.
- The flag check is placed AFTER the `LONG_FLAG` early-return in `poll_cycle` on purpose. A long-running cell scan returns early before the Tier-2 block — the flag survives until the next normal cycle.
- `refresh_sim_identity` re-reads `AT+CIMI;+QCCID` only; it has no band-lock or profile side effects.

See also [`docs/features/custom-sim-profiles.md`](custom-sim-profiles.md) — `cellular/settings.sh` is the other producer of the same flag, triggered on SIM slot switch.

## Related Docs

- [`docs/features/custom-sim-profiles.md`](custom-sim-profiles.md) — band lock per profile via Connection Scenario binding; also uses the force-Tier-2 flag
- [`docs/features/scenario-profile-binding.md`](scenario-profile-binding.md) — how scenario band locks are applied at profile activation
