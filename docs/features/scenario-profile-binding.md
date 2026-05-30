# Scenario-to-Profile Binding

Each Custom SIM Profile carries a `.scenario` binding: a `default` scenario applied when the profile activates, and an optional time-of-day `schedule` that swaps scenarios automatically at configured boundaries via cron. This lets a single profile own both connectivity settings (APN, IMEI, TTL) and network-mode/band-lock preferences — all in one activate click.

## Quick Reference

| Item | Value |
|---|---|
| Profile storage | `/etc/qmanager/profiles/<id>.json` |
| Scenario configs | `/etc/qmanager/scenarios/<id>.json` |
| Active scenario marker | `/etc/qmanager/active_scenario` |
| Cron marker | `qmanager_profile_scenario` |
| Cron worker | `/usr/bin/qmanager_scenario_schedule` |
| Scenario library | `/usr/lib/qmanager/scenario_mgr.sh` |
| Activate CGI | `POST /cgi-bin/quecmanager/scenarios/activate.sh` |
| Guard error code | `scenario_locked_by_schedule` |
| Reboot on scenario apply | Never |

## Schema

The `.scenario` object stored inside a profile JSON:

```json
{
  "scenario": {
    "default": "balanced",
    "schedule": {
      "enabled": false,
      "blocks": [
        {
          "start": "08:00",
          "end":   "21:00",
          "days":  [1, 2, 3, 4, 5],
          "scenario": "gaming"
        }
      ]
    }
  }
}
```

- `default` — scenario id applied on profile activation and used as the "all other times" fallback when the schedule is enabled.
- `schedule.enabled` — boolean; when `false` the block array is ignored.
- `blocks[].start` / `blocks[].end` — `"HH:MM"` 24-hour, zero-padded. Start is **inclusive**, end is **exclusive**.
- `blocks[].days` — array of integers 0–6 where 0 = Sunday, 6 = Saturday. Matches `JS Date.getDay()` and the cron day-of-week field.
- `blocks[].scenario` — any valid scenario id (`balanced`, `gaming`, `streaming`, or `custom-<n>` pointing to an existing file under `SCENARIOS_DIR`).

**Read-time migration default.** Legacy profiles with no `.scenario` key return `{"default":"balanced","schedule":{"enabled":false,"blocks":[]}}` at read time. The backend never rewrites the file on read; the default is injected by `profile_get`, `profile_list`, and `scenario_profile_block`. Saving a profile via `profile_save` always writes the normalized block, so once a legacy profile is edited and saved the field is persisted.

## Canonical Resolution Rule

Both the backend (`scenario_mgr.sh::scenario_block_for_now`) and the frontend (`lib/scenario-schedule.ts::resolveScheduledScenario`) implement the same rule. **The shell jq filter and the TypeScript port must stay in sync** — this contract is called out explicitly in the source comments.

For weekday `dow` (0=Sun..6=Sat) and minute-of-day `m` (0..1439):

1. Consider only blocks whose `days` array includes `dow`.
2. Compute `s = start minutes`, `e = end minutes`.
   - If `e > s`: block matches when `m >= s && m < e` (normal window).
   - If `e <= s`: overnight wrap; block matches when `m >= s || m < e`.
   - If `e === s`: zero-length; never matches.
3. **First matching block in array order wins.** When multiple blocks overlap, the one at the lowest index takes priority.
4. No block matches → `default`.

> ⚠️ WARNING: Minute arithmetic in `scenario_block_for_now` runs entirely inside `jq` using `tonumber`. Do **not** move it into shell `$(( ))` arithmetic — BusyBox shell treats octal-leading-zero strings like `"08"` and `"09"` as parse errors in `$(( ))`.

## DISK is the Single Source of Truth for Scenario Config

`scenario_resolve_config` reads `AT_MODE`, `lte_bands`, `nsa_nr_bands`, and `sa_nr_bands` from `/etc/qmanager/scenarios/<id>.json` — not from any POST body. The activate CGI only receives `{"id":"..."}`.

Consequence for the UI: if a user edits a custom scenario while that scenario is scheduled, the next cron fire picks up the updated file automatically. The cron line bakes in the scenario **id**, not its config.

Built-in scenarios (`balanced`, `gaming`, `streaming`) send mode only and leave band locks unchanged (matching historic activate.sh behavior). Custom scenarios apply whatever `config.atModeValue`, `config.lte_bands`, `config.nsa_nr_bands`, and `config.sa_nr_bands` are set in their file.

## Apply: AT Commands, No Reboot

`scenario_apply` issues:

1. `AT+QNWPREFCFG="mode_pref",<MODE>` — always sent; if this fails, returns rc 1 and no marker is written.
2. `AT+QNWPREFCFG="lte_band",<bands>` — only when `lte_bands` is non-empty (200ms gap before each band lock).
3. `AT+QNWPREFCFG="nsa_nr5g_band",<bands>` — only when `nsa_nr_bands` is non-empty.
4. `AT+QNWPREFCFG="nr5g_band",<bands>` — only when `sa_nr_bands` is non-empty.

Return codes: `0` = full success, `2` = mode ok but at least one band lock failed (partial), `1` = unknown id or mode_pref failed. The active scenario marker (`/etc/qmanager/active_scenario`) is written on rc 0 or rc 2 (mode set counts as the primary action).

Scenario apply is **never** followed by `AT+CFUN=1,1`. It is safe to call from a CGI because it will not kill the HTTP session.

## Cron Install / Teardown

### `scenario_install_cron <profile_id>`

Called as a side-effect inside `qmanager_profile_apply` after the main apply steps succeed. Also called by `qmanager_scenario_schedule` is not the install path — install runs from the profile apply worker.

Steps:

1. If `schedule.enabled = false`: tear down any stale cron lines, apply the profile's `default` scenario, return.
2. Generate transition lines via `_scenario_generate_cron_lines`.
3. Strip existing `qmanager_profile_scenario` lines from the crontab.
4. Append the new marked lines, then issue `( /etc/init.d/cron reload </dev/null >/dev/null 2>&1 & )`.
5. Snap to the current block by calling `scenario_block_for_now` and `scenario_apply`.

> ℹ️ NOTE: **BusyBox crond dormant-crond gap.** On OpenWRT, `procd` only spawns `crond` once a non-empty crontab exists. Writing via `crontab -` does not wake a dormant crond — `( /etc/init.d/cron reload & )` is required after the first write. Without this, the schedule would be installed but never fire. Teardown does not need the reload; a running crond rescans every minute.

### Transition Line Generation Algorithm

`_scenario_generate_cron_lines` produces the minimal set of cron lines that implement the weekly schedule with no redundant fires:

1. For each weekday 0–6, collect block-start transitions (`rank 1`) and block-end default-restore transitions (`rank 0`). For an overnight block (`end <= start`), the end transition lands on the **next weekday** (modulo 7).
2. Within each weekday, sort transitions by minute; at equal minutes the higher-rank event (start, rank 1) overrides the lower-rank event (restore, rank 0). This prevents a flap when a block starts at exactly the same minute another block ends.
3. Walk each weekday with a running scenario seeded to the effective scenario at **23:59 of the previous weekday** (computed via the same `eff()` helper that mirrors `scenario_block_for_now`). This seeds overnight blocks correctly — a block that started yesterday and ends at 03:00 today still has its 03:00 restore emitted.
4. Emit a transition only when the target scenario differs from the running value.
5. Group surviving `(minute, scenario)` pairs across weekdays into comma-separated day lists.
6. Render: `<min> <hour> * * <days> /usr/bin/qmanager_scenario_schedule <scenario>  # qmanager_profile_scenario`

### `scenario_teardown_cron`

Removes only lines containing the `qmanager_profile_scenario` marker. Other scheduler markers (`qmanager_tower_schedule`, `qmanager_scheduled_reboot`, `qmanager_low_power`) share the same root crontab; teardown greps only its own marker and leaves theirs intact. If removing the lines leaves an empty crontab, an empty crontab is written (`echo "" | crontab -`) so crond does not see a stale view.

### Cron Marker

```
  # qmanager_profile_scenario
```

The marker is appended by `scenario_install_cron` via `sed "s|\$|  # ${SCENARIO_CRON_MARKER}|"`. Teardown uses `grep -v "$SCENARIO_CRON_MARKER"`.

## Teardown at Every Clear Site

Scenario cron must be removed whenever the profile it belongs to stops being active. The helper `_profile_teardown_scenario_cron` in `profile_mgr.sh` lazy-sources `scenario_mgr.sh` and calls `scenario_teardown_cron`. It is called from every active-profile clear site:

| Site | File | Notes |
|---|---|---|
| Manual deactivate | `profiles/deactivate.sh` | After `clear_active_profile` |
| Profile delete (was active) | `profile_mgr.sh::profile_delete` | Active id captured **before** `rm -f` — see ordering note below |
| SIM mismatch auto-clear | `profile_mgr.sh::auto_apply_profile` | After `clear_active_profile` |
| Worker total failure | `qmanager_profile_apply` | After `clear_active_profile` in the `failed` branch |

> ⚠️ WARNING: **`profile_delete` ordering invariant.** `get_active_profile` validates the marker by checking whether the profile file exists. In `profile_delete`, the active profile id is captured into `active_id` **before** `rm -f "$file"` — if the rm runs first, `get_active_profile` returns empty and the teardown branch never executes, leaving orphaned cron lines. This was a deliberate ordering fix; do not reorder.

The cron worker has a **self-heal guard** as a backstop (not the primary teardown path): on each fire it checks whether a schedule-enabled profile is active. If not, it tears down the stale lines and exits without applying.

## Manual Scenario Activation Guard

`scenarios/activate.sh` checks whether the active profile has `schedule.enabled = true`. If it does, the endpoint returns HTTP 200 with:

```json
{"success": false, "error": "scenario_locked_by_schedule"}
```

The UI resolves this via `errors.json`. Scenario tiles remain visible and browsable; only the Activate button is disabled while a schedule is running. The locked state is surfaced via `useActiveProfile`'s `scheduleLocked` field and a `variant="outline"` "Scheduled" badge on the active tile.

## Frontend Display Contract

`useActiveProfile` (`hooks/use-active-profile.ts`) exposes four schedule-derived fields, all display-only — the device cron is authoritative for what actually runs:

| Field | Type | Meaning |
|---|---|---|
| `scheduleLocked` | `boolean` | Active profile has `schedule.enabled = true` |
| `scheduledScenarioId` | `string \| null` | Scenario resolved for right now |
| `nextChangeAt` | `string \| null` | `"HH:MM"` of next block boundary |
| `lockProfileName` | `string \| null` | Active profile name (for hint copy) |

The hook runs a 60-second tick (`TICK_INTERVAL_MS = 60_000`) to advance `scheduledScenarioId` and `nextChangeAt` at block edges without a network round-trip. The 30-second network poll (`POLL_INTERVAL_MS = 30_000`) re-reads the profile list from `profiles/list.sh`.

`lib/scenario-schedule.ts` contains `resolveScheduledScenario`, `nextChangeAt`, and `validateSchedule` — pure functions with no side effects. The schedule validation rejects malformed times, zero-length blocks, and blocks with no days selected. Overlapping blocks produce a warning (the first-in-array wins) but do not block save.

## Schedule Editor UI

The schedule editor inside the Create/Edit Profile form was redesigned to reduce cognitive load. The CGI endpoints, UCI, persisted profile JSON contract, device cron, and canonical resolution rule are unchanged.

### Summary-Row Accordion

The schedule block list renders as a single-open accordion. Each collapsed row shows a one-line summary in the format `{days} · {start}–{end} → {scenario}` (e.g. `Weekdays · 22:00-06:00 → Balanced`). Expanding a row reveals the editor: time inputs, day chips, scenario picker. Only one row is open at a time. The parent (`scenario-binding-section.tsx`) holds `openKey` (the `_key` of the currently expanded row) and passes controlled `open`/`onOpenChange` props into each `ScheduleRuleRow`.

Component: `components/cellular/custom-profiles/scenario-binding/schedule-rule-row.tsx`.

**Newly-added rows auto-expand.** When the user clicks "Add rule", the parent calls `setOpenKey(block._key)` before appending, so the fresh row opens immediately.

**Error force-expand.** When a rule carries a blocking validation error, the parent's `useEffect` on `firstErrorIndex` sets `openKey` to that rule's `_key`, keeping the error always visible. If validation is triggered by a blocked form submit, the imperative handle `revealFirstError()` additionally opens the Collapsible section and scrolls the invalid row into view.

**Warning glyph.** A `TriangleAlertIcon` (`size-3`) appears on the collapsed summary trigger of any row that has a blocking error or an overlap warning, so the problem is discoverable without expanding.

### Client-Only `_key` Field

`ScenarioScheduleBlock` carries an optional `_key?: string` field that acts as a stable React list key. This replaces the previous index-based `key={i}`, which mis-targeted focus, labels, and `aria-live` regions on mid-list deletes.

**INVARIANT: `_key` is never persisted.** It exists only in client-side form state. Two pure helpers in `lib/scenario-schedule.ts` enforce this:

- `ensureScenarioKeys(binding)` — called when hydrating form state from a saved profile. Adds a `_key` to any block that lacks one (all blocks from persisted JSON). Uses `clientKey()`, which prefers `crypto.randomUUID()` and falls back to a monotonic counter of the form `blk_<base36-timestamp>_<n>`.
- `stripScenarioKeys(binding)` — called before every save (POST to `profiles/save.sh`). Removes `_key` from every block before serialization. Returns a fresh object; does not mutate the input.

Why: the device JSON must remain byte-clean. The modem shell scripts that read profile JSON have no awareness of `_key` and would ignore it, but carrying extra keys in persisted data creates a silent diff between what was saved and what the modem operates on.

### Reorder Controls

Each rule row shows move-up and move-down buttons when more than one rule exists (`canReorder = blocks.length > 1`). The first rule's move-up button and the last rule's move-down button are disabled. Reordering matters because **first-in-array wins** when multiple rules overlap — moving a rule up raises its precedence. The parent's `swap(a, b)` exchanges elements at indices `a` and `b` and calls `onChange` with the updated array.

### Day Presets

Three quick-select buttons sit above the day chips: `Every day` ([0,1,2,3,4,5,6]), `Weekdays` ([1,2,3,4,5]), `Weekends` ([0,6]). Clicking one overwrites the rule's `days` array in one action. They are defined as module-level constants `PRESET_EVERY_DAY`, `PRESET_WEEKDAYS`, `PRESET_WEEKENDS` in `schedule-block-editor.tsx`.

### Live Readout

A single text line reports the currently-active scenario and the time of the next schedule boundary. It is shown only when `schedule.enabled = true` and at least one rule passes validation (no blocking error). The parent computes `{ scenario, next }` via `resolveScheduledScenario()` and `nextChangeAt()` on mount and then on a 60-second `setInterval`. The displayed text uses the `active_now_line_with_next` i18n key when a next-change time exists, or `active_now_line` when the scenario never changes within the next 7 days.

Why 60 seconds: `nextChangeAt()` scans up to 7 × 1440 minutes to find the next transition. Running it more frequently would waste cycles; the one-minute granularity matches the device cron's minimum resolution.

### `ScenarioBindingSectionHandle` Contract

The section is exposed via `forwardRef` and `useImperativeHandle`. The parent form holds a ref (`scenarioSectionRef`) and calls `revealFirstError()` when a submit is blocked by schedule errors.

```typescript
export interface ScenarioBindingSectionHandle {
  revealFirstError: () => void;
}
```

`revealFirstError()` does three things in order:

1. Sets `open = true` (expands the Collapsible section if collapsed).
2. Sets `openKey` to the `_key` of the first invalid rule.
3. Defers a `scrollIntoView` call via `requestAnimationFrame` so the section has expanded before the scroll fires. The behavior is `"smooth"` unless `window.matchMedia("(prefers-reduced-motion: reduce)").matches`, in which case `"auto"` is used.

If there are no blocking errors (`firstErrorIndex === -1`), `revealFirstError()` returns immediately without changing any state.

### Overnight Hint

When both start and end are valid times and `end <= start` (the window wraps past midnight), an informational line appears under the End field in the editor to make the overnight behavior explicit. This is a display-only hint; the resolution logic already handles overnight windows correctly via the `e <= s` branch in `blockMatchesAt()`.

### Accessibility

- `DayOfWeekChips` (`day-of-week-chips.tsx`) accepts `id` and `aria-labelledby` props forwarded to the `ToggleGroup` root, associating the chip group to its field label.
- The overlap warning paragraph carries `role="status"` so assistive technology announces it without requiring focus.
- Each `ToggleGroupItem` carries `aria-label` with the full localized day name (the chip itself shows only the abbreviation).
- The reorder buttons carry explicit `aria-label` keys (`move_up_aria`, `move_down_aria`).
- The expand/collapse trigger carries `aria-expanded` (Radix Collapsible) and an explicit `aria-label` (`expand_rule_aria`).

### New i18n Keys

All keys live under `custom_profiles.form.scenario` in the `cellular` namespace. Keys added by this redesign:

| Key | Purpose |
|---|---|
| `summary_line` | Collapsed row summary (`{days} · {time} → {scenario}`) |
| `time_range` | Time portion of the summary (`{start}–{end}`) |
| `every_day` | Day label when all 7 days are selected |
| `weekdays` | Day label for Mon–Fri |
| `weekends` | Day label for Sat + Sun |
| `no_days_short` | Day label when no days are selected |
| `move_up_aria` | Accessible label for move-up button |
| `move_down_aria` | Accessible label for move-down button |
| `expand_rule_aria` | Accessible label for expand trigger |
| `preset_every_day` | "Every day" preset button label |
| `preset_weekdays` | "Weekdays" preset button label |
| `preset_weekends` | "Weekends" preset button label |
| `active_now_line` | Live readout (no next-change time) |
| `active_now_line_with_next` | Live readout with next-change time |
| `overnight_hint` | Hint shown under End when window wraps midnight |

The existing keys (e.g. `schedule_toggle_label`, `block_errors.*`, `overlap_warning`) were not renamed. The word "Block" was replaced with "Rule" in all displayed string values across all four locales (en, zh-CN, id, it); JSON key names are unchanged.

## Timezone Change Caveat

When the user changes the device timezone, the existing `system/settings.sh` handler restarts crond, which re-arms all cron lines at the new local time. The **currently-applied scenario is not re-snapped** — the modem keeps whatever scenario was last applied. The next cron transition at the new local time will snap it correctly. This is by design; a re-snap would require another `scenario_apply` call that may transiently disrupt the connection.

## Known Debt — Shared Crontab Writers Without Crond Reload

The existing scheduler subsystems — `tower/schedule.sh` (`qmanager_tower_schedule`), scheduled-reboot, and low-power (`system/settings.sh`) — write their crontab via `crontab -` **without** issuing `( /etc/init.d/cron reload & )`. They share the same dormant-crond gap that `scenario_install_cron` now handles for the scenario scheduler. This was deliberately not fixed in this change (out of scope for scenario-profile binding). A future pass should unify cron install across all scheduler subsystems with the reload idiom.
