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
| HW universe (poller) | `data.device.hw_{lte,nsa_nr5g,sa_nr5g}_bands` (static hardware spec) |
| Policy marker (poller) | `data.device.supported_{lte,nsa_nr5g,sa_nr5g,nrdc_nr5g}_bands` (policy_band) |
| AT command (read current) | `AT+QNWPREFCFG="lte_band";+QNWPREFCFG="nsa_nr5g_band";+QNWPREFCFG="nr5g_band";+QNWPREFCFG="nrdc_nr5g_band"` (single appended command) |
| AT command (read supported) | `AT+QNWPREFCFG="policy_band"` |
| AT command (unlock / restore) | `AT+QNWPREFCFG="restore_band"` |
| Static HW spec file | `/etc/qmanager/supported_bands_hw.env` (force-copied on every install/upgrade) |
| Env cache | `/tmp/qmanager_supported_bands.env` |
| SIM-swap policy refresh flag | `/tmp/qmanager_refresh_policy_band` |
| Failover PID | `/tmp/qmanager_band_failover.pid` |
| Failover activated flag | `/tmp/qmanager_band_failover` |
| Failover enabled flag | `/etc/qmanager/band_failover_enabled` |
| Reboot on lock? | No |
| Types | `types/band-locking.ts`, `types/modem-status.ts` |
| Hook | `hooks/use-band-locking.ts` |
| Component | `components/cellular/band-locking/band-locking.tsx` + `band-cards.tsx` |
| Backend scripts | `scripts/www/cgi-bin/quecmanager/bands/` |
| Parse lib | `scripts/usr/lib/qmanager/parse_at.sh` — `parse_policy_band` |
| Failover daemon | `scripts/usr/bin/qmanager_band_failover` |
| HW spec repo source | `scripts/etc/qmanager/supported_bands_hw.env` |

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

`AT+QNWPREFCFG="policy_band"` and the per-category registers queried by `current.sh` all return lines containing the string `nr5g_band`. Naively grepping for `"nr5g_band"` would match three lines:

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

## Critical Invariant: grep Anchoring in Multi-Sub-Command `qcmd` Output

When `qcmd` executes a semicolon-appended multi-statement AT command (e.g. `AT+QNWPREFCFG="lte_band";+QNWPREFCFG="nsa_nr5g_band";...`), its output **line 1 is the echoed AT command itself** — a single line containing every key string in the command. Response lines that follow start with `+QNWPREFCFG:`.

A bare `grep '"lte_band"'` matches the echo line first and extracts garbage. The fix is to anchor the grep to the response-line prefix:

```sh
# WRONG — matches the echo line (contains all key strings)
line=$(printf '%s\n' "$result" | grep '"lte_band"' | head -1)

# CORRECT — +QNWPREFCFG: appears only on response lines; the echo starts with AT+
line=$(printf '%s\n' "$result" | grep '+QNWPREFCFG:.*"lte_band"' | head -1)
```

**Why:** The `AT+` echo prefix and the `+QNWPREFCFG:` response prefix are distinct strings — anchoring to the latter is a reliable discriminator even when the command string itself contains all the keys you are searching for. This pattern bit `current.sh` and was fixed; all four band-register greps in that file now use the `+QNWPREFCFG:.*"<key>"` anchor form.

> ⚠️ WARNING: Any future CGI that issues a multi-sub-command `qcmd` call MUST anchor its response-line greps to the `+<PREFIX>:` response prefix, not to the bare key string. A bare grep will silently match the echo line and return the entire AT command string as the "value."

---

## Universe vs. Marker vs. Locked: Three Band Layers

The Band Locking page works with three distinct band sets. Confusing any two of them causes subtle bugs (failover resets to the wrong set, or the UI shows an incorrect checkbox universe).

| Layer | Source | AT command / file | When queried | `status.json` fields | UI role |
|---|---|---|---|---|---|
| **HW universe** | `/etc/qmanager/supported_bands_hw.env` (spec sheet) | — (no AT command; static file) | Sourced at poller boot | `device.hw_lte_bands`, `device.hw_nsa_nr5g_bands`, `device.hw_sa_nr5g_bands` | Checkbox universe — all bands the modem hardware can use |
| **Policy marker** | `AT+QNWPREFCFG="policy_band"` | On boot + SIM swap | `/tmp/qmanager_supported_bands.env` cache → `device.supported_*_bands` | `device.supported_{lte,nsa_nr5g,sa_nr5g,nrdc_nr5g}_bands` | Subset of the HW universe the current SIM/network actually uses — coloring only |
| **Currently locked** | per-category registers via `current.sh` | On demand (`current.sh`) | Not cached — always live | (not emitted in status.json) | What the modem is restricted to right now |

**Why three layers exist:** `policy_band` was the original universe source but it can narrow when a SIM or firmware limits the advertised set. The static HW spec file ensures the UI always shows the full physical capability — bands the modem can use even if the current SIM doesn't announce them. The policy set then serves as a visual marker only.

**Why `hw_*` does NOT feed failover.** `qmanager_band_failover` resets to the `supported_*` (policy_band) set — the set the modem has confirmed it can register on with the current SIM. Resetting to the full HW universe could include bands the SIM never activates, leaving the modem unable to re-register. `hw_*` is additive/display-only; it never enters the write path.

**Boot fallback.** If `/etc/qmanager/supported_bands_hw.env` is missing (pre-upgrade device that hasn't re-run install), the poller falls back to the `boot_supported_*` (policy_band) values for all three HW fields. The page degrades to the old single-layer behavior: every band checkbox uses the policy set as its universe, and no yellow bands appear. The fallback is self-healing — it resolves on the next `install.sh` run.

**NR-DC has no HW field.** NR-DC remains view-only with no hardware-universe extension; `device.supported_nrdc_nr5g_bands` is still sourced from `policy_band` only.

### UI Two-Tone Coloring

`band-locking.tsx` derives two props per lockable card:

- `supportedBands` — set to `hwBands` (from `device.hw_*`, falling back to `device.supported_*` when absent). This is the checkbox universe.
- `policyBands` — set to the `device.supported_*` value for that category. Used **only** for coloring.

Inside `band-cards.tsx`, a band checkbox renders in **primary** (Signal Indigo) when it is in `policyBands` ("network/SIM uses this band") and in **warning/yellow** when it is in `supportedBands` but not `policyBands` ("modem supports it, network/SIM doesn't use it"). A two-swatch legend (`cell_locking.band_locking.legend.used` / `cell_locking.band_locking.legend.unused`) is shown only when a card has at least one yellow band.

**Critical:** `onUnlockAll`, the "all unlocked" detection, and the count badge in the card header (`X / Y locked`) all measure against the full `supportedBands` universe — NOT the `policyBands` set. "Unlock all" (the reset button) locks the entire hardware-spec universe for that category, not just the policy-confirmed bands.

> ⚠️ WARNING: The modem may reject locking bands that lie outside its current policy set. A Reset that includes yellow (modem-supported-but-policy-unused) bands can therefore fail at the modem. This is an accepted tradeoff — the user can see every band they chose to lock rather than having policy silently shrink the display.

**NR-DC view-only card:** NR-DC has no dedicated HW band list. `band-locking.tsx` borrows `hwBands.sa_nr5g` as the NR-DC checkbox universe (NR-DC bands are NR bands ⊆ the SA set), falling back to `policyBands.nrdc_nr5g` on pre-upgrade devices. Because the NR-DC card is read-only, its `policyBands` prop is set to its own universe (`supportedBands.nrdc_nr5g`), so every band renders in primary and no yellow appears — the legend is suppressed entirely for this card.

### Static HW Spec File

`/etc/qmanager/supported_bands_hw.env` is a manually-maintained shell env file holding the RM551E-GL band capability for LTE, NSA NR5G, and SA NR5G. Its repo source is `scripts/etc/qmanager/supported_bands_hw.env`.

`install.sh` **force-copies** this file on every install and upgrade — it is carved out of the deploy-if-missing loop that governs all other `/etc/qmanager/*` files. This ensures that spec or firmware corrections in the repo reach existing installs without requiring a factory reset or manual file placement. The OTA worker `qmanager_update` re-runs `install.sh`, so no separate update-script edit is needed.

`uninstall.sh` removes the file along with `/tmp/qmanager_supported_bands.env` and `/tmp/qmanager_refresh_policy_band`.

---

## Policy-Band Re-Read on SIM Swap

`policy_band` was previously queried only at poller boot and cached for the poller's lifetime. A SIM swap can narrow or widen the policy set (different SIMs may expose different band subsets). To keep the yellow/primary UI split accurate after a swap, `cellular/settings.sh` drops the flag `/tmp/qmanager_refresh_policy_band` after a successful SIM swap.

The poller's `poll_cycle` checks for this flag after the `LONG_FLAG` early-return block. When present, it consumes the flag (`rm -f`) and calls the new `refresh_policy_band()` helper, which re-queries `AT+QNWPREFCFG="policy_band"`, re-parses, and rewrites `/tmp/qmanager_supported_bands.env` and the relevant `device.supported_*` fields in the next `status.json` write.

**The HW universe is NOT re-read on SIM swap.** `/etc/qmanager/supported_bands_hw.env` is hardware-spec, not SIM-dependent; sourcing it again would be redundant and waste an AT round-trip.

**Why the re-read is harmless even when redundant.** `policy_band` reflects modem hardware capabilities and is hardware-fixed in most deployments. The re-read typically returns the same set. The invariant noted in the previous version of this doc — "never changes at runtime" — holds for normal use, but the re-read is cheap insurance for edge cases (SIM firmware/carrier provisioning that narrows the advertised set) and ensures the yellow/primary split is always fresh after a swap.

**Flag placement in `poll_cycle`.** The flag is consumed after the `LONG_FLAG` early-return on purpose: a long-running cell scan short-circuits `poll_cycle` before reaching the flag check. The flag survives until the next normal cycle, guaranteeing it is eventually processed without interrupting a scan.

---

## Env Cache and `status.json` Emission

After `parse_policy_band` runs during the poller's boot sequence (or during a SIM-swap refresh), the poller writes the cache and emits values into `status.json` under `device.*`. The full set of band-related fields now emitted:

```json
{
  "device": {
    "hw_lte_bands": "1:2:3:4:5:7:8:12:...",
    "hw_nsa_nr5g_bands": "41:66:71:77:78:...",
    "hw_sa_nr5g_bands": "41:66:71:77:78:...",
    "supported_lte_bands": "1:2:3:4:5:7:8:12:...",
    "supported_nsa_nr5g_bands": "41:66:71:77:78:...",
    "supported_sa_nr5g_bands": "41:66:71:77:78:...",
    "supported_nrdc_nr5g_bands": "1:2:3:5:7:8:12:14:25:26:28:30:40:41:48:66:71:77:78:79:257:258:259:260:261"
  }
}
```

`hw_*` fields are absent on a pre-upgrade device until `install.sh` has placed `supported_bands_hw.env`. The frontend falls back to `supported_*` in that case (see "Boot fallback" above).

The env cache file retains exactly four shell variable assignments for the policy set (unchanged):

```sh
boot_supported_lte_bands="..."
boot_supported_nsa_nr5g_bands="..."
boot_supported_sa_nr5g_bands="..."
boot_supported_nrdc_nr5g_bands="..."
```

**Stale-cache tolerance (pre-NR-DC):** A cache written before NR-DC support was added will lack the fourth line. That line feeds only the NR-DC view-only display; its absence means the NR-DC card shows no bands until the next cold boot clears `/tmp` and the poller rewrites the full cache. Self-healing.

**Cache rewrite on SIM swap:** Since `refresh_policy_band()` rewrites the same cache file, the env cache now reflects the current SIM's policy set rather than only the boot-time set. The `hw_*` binds are emitted from the in-memory variables sourced at boot; they are not re-read from disk on swap.

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

All four locales (`public/locales/{en,id,it,zh-CN}/cellular.json`) carry these band-locking keys:

| Key path | Purpose |
|---|---|
| `cell_locking.band_locking.cards.nrdc_nr5g.title` | Card title ("NR-DC Bands") |
| `cell_locking.band_locking.cards.nrdc_nr5g.description` | Card description (explains NR-DC is modem-managed / view-only) |
| `cell_locking.band_locking.card_category_label.nrdc_nr5g` | Swap button label (shows target mode) |
| `cell_locking.band_locking.card_buttons.swap_view` | Swap button tooltip template (`"Switch to {{target}}"`) |
| `cell_locking.band_locking.card_badges.view_only` | "View only" badge shown on the read-only NR-DC card |
| `cell_locking.band_locking.legend.used` | Legend swatch label — bands the network/SIM uses (primary color) |
| `cell_locking.band_locking.legend.unused` | Legend swatch label — "Supported by modem" (warning/yellow). Previously included "· not used by network"; that clause was removed in all four locales to keep the label concise. |

The legend row renders only when a card has at least one yellow band (i.e., when `hw_*` is populated and differs from the policy set). On a pre-upgrade device where `hw_*` is absent, the legend is hidden and all bands render in the primary color as before.

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
