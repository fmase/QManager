# Custom SIM Profiles

Route: `/cellular/custom-profiles`. IMEI is optional (empty = don't change).

## Apply Pipeline

- **Async 4-step apply** (APN → TTL/HL → IMEI → MPDN rule, least → most disruptive). Each step skips when unchanged. Worker: `qmanager_profile_apply`, polled via `profiles/apply_status.sh` at 500ms.
- Active marker: `/etc/qmanager/active_profile` (plain text, profile ID). Written BEFORE `AT+CFUN=1,1` (USB reset can kill the script). Finalization re-writes on success/partial; clears on total failure.
- Activate = runs full pipeline. Deactivate = clears marker only, zero modem changes.
- **SIM mismatch**: poller `collect_boot_data()` auto-clears marker + emits `profile_deactivated` when active profile's `sim_iccid` ≠ current SIM. Empty `sim_iccid` = SIM-agnostic, left alone. Frontend shows "SIM Mismatch" warning badge.
- TTL override: `ttl-settings-card.tsx` disables form when active profile has TTL/HL > 0.
- **ICCID auto-apply**: `profile_mgr.sh::auto_apply_profile <iccid> <caller>` spawns worker detached. Called via `( . /usr/lib/qmanager/profile_mgr.sh && auto_apply_profile "$iccid" "<tag>" )` from: poller boot (`boot`), `cellular/settings.sh` post-SIM-switch (`sim_switch`, 3×1s ICCID retry), watchcat Tier 3 success (`watchdog`), watchcat SIM failover fallback (`watchdog_revert`, 3×1s retry).
- Auto-apply guards: `profile_check_lock` (no race with manual Activate) + `profile_count > 0`. Worker's per-step skip logic is the single source of truth for "only apply what differs" — `auto_apply_profile` does NOT pre-compare.
- Events: `profile_applied`/`profile_failed`/`profile_deactivated` in `dataConnection` tab.

## Lock Layering — DO NOT collapse onto one file

Two distinct concerns, two files.

- `/tmp/qmanager_profile_spawn.lock` — owned by `apply.sh` CGI. Atomic-create via `set -C` noclobber. Rejects concurrent POSTs while the worker is coming up. Released after the CGI's poll loop confirms the worker is alive.
- `/tmp/qmanager_profile_apply.pid` — owned by the worker (`qmanager_profile_apply`). Singleton enforcement via `profile_acquire_lock`. Cleared by the worker's EXIT trap.
- Why two: the worker's `profile_acquire_lock` does `kill -0` on whatever PID it finds. If the CGI pre-wrote `$$` into the worker's PID file, the worker would see its own (still-sleeping) parent CGI as a foreign holder and abort. v0.1.22 hit this bug — manual Activate failed with `start_failed` while boot auto-apply still worked (boot path only `profile_check_lock`s, never acquires). Helpers: `profile_acquire_spawn_lock` / `profile_release_spawn_lock` / `profile_check_lock` / `profile_acquire_lock` in `profile_mgr.sh`.
- CGI must NEVER touch `$PROFILE_APPLY_PID_FILE`; worker must NEVER touch `$PROFILE_SPAWN_LOCK_FILE`.

## `start_failed` — Deployment-Integrity Cause

The UI error "Failed to start operation" (CGI error code `start_failed`) has two distinct root causes — the v0.1.22 lock-sharing bug above, and a **deployment-integrity failure**: `/usr/bin/qmanager_profile_apply` deployed as a 0-byte or truncated file (e.g. an interrupted install or OTA transfer). An empty shell file passes `sh -n`, execs, and exits 0 immediately without writing its PID file or state file; `apply.sh`'s 2-second start-detection poll times out and falls through to `cgi_error "start_failed"`. Boot auto-apply also silently does nothing, so neither manual nor automatic activation works.

**Diagnostic:** `md5sum /usr/bin/qmanager_profile_apply` — an empty file returns `d41d8cd98f00b204e9800998ecf8427e`; `wc -c /usr/bin/qmanager_profile_apply` — should be non-zero (repo source is ~6 KB). Fix: redeploy via the installer.

The installer now guards against this: `install_file()` compares `wc -c` of source vs copied file before finalizing, and aborts if they differ. See `docs/BACKEND.md` — Installer section for details.

## Verizon MPDN Handling (mno = "Verizon")

- **Why**: RM551E + Verizon SIM only delivers Data + SMS via PDP context 3, not the default 1. Backend forces APN onto CID 3 and writes a QMAP MPDN rule (`AT+QMAP="mpdn_rule",0,3,0,0,1`) routing the WAN data session through PDP3.
- **Form-level UX**: Selecting "Verizon" in the profile editor triggers an explicit `AlertDialog` warning the user not to manually release the rule (firmware quirk: bare release + reboot can brick the modem until firmware reflash). On confirm, CID is locked to 3 (the CID input in `apn-card.tsx` is disabled with helper text) until the user switches MNO.
- **MNO comparator**: backend AND frontend compare the literal label `"Verizon"` (NOT the preset id `"vzw"`) — that's what `MNO_PRESETS` stores into `profile.mno`. If you rename the preset label, you must update every `[ "$_x_mno" = "Verizon" ]` shell check in scripts (worker, apply.sh, deactivate.sh, ip_passthrough.sh, profile_mgr.sh).
- **USB-mode pre-flight**: Verizon profiles require ECM (1) or RNDIS (3). `apply.sh` blocks pre-spawn with the `usb_mode_incompatible_for_verizon` error code if `AT+QCFG="usbnet"` returns 0 (RMNet) or 2 (MBIM). The worker has a defense-in-depth check too — fails all 4 steps with the same code if reached. Frontend resolves the code via `errors.json`. Note: `cgi_error` returns HTTP 200 with a JSON envelope (`{success:false, error:"...", detail:"..."}`), not a 4xx status — the frontend dispatches on the `error` field.
- **Switching AWAY from Verizon**: any non-Verizon profile that activates while PDP3 is the active context runs the documented release-then-immediately-reset pair (`AT+QMAP="mpdn_rule",0` → `AT+QMAP="mpdn_rule",0,1,0,0,1`, NO sleep between, NO reboot before re-pin). NEVER issue a bare release. The two `qcmd` calls are intentionally back-to-back in `mpdn_revert_to_default` (`profile_mgr.sh`); future maintainers must not insert anything between them.
- **Deferred reboot pattern**: revert step sets `apply_requires_reboot: true`. `deactivate.sh` returns `{ success, requires_reboot }`; frontend writes `setPendingReboot("verizon_revert")` (extends `lib/config-backup/pending-reboot.ts` source union). Persistent banner via `usePendingReboot` picks it up.
- **Boot-path auto-revert**: `auto_apply_profile` in poller boot context — when SIM mismatch clears an active Verizon profile, it runs `mpdn_revert_to_default`, touches `/tmp/qmanager_pending_reboot_verizon`, emits `verizon_mpdn_reverted` warning event, then proceeds with the existing `profile_deactivated` warning event and marker clear.
- **IP Passthrough lock**: when active profile is Verizon, `ip_passthrough.sh` POST blocks with `ip_passthrough_locked_by_verizon_profile` (via `cgi_error` — HTTP 200 envelope, not a 4xx). Frontend `ip-passthrough-card.tsx` uses `useActiveProfile()` (lightweight read-only hook in `hooks/use-active-profile.ts`, polls `/profiles/list.sh` every 30s) and renders an info `Alert` + disables the entire form via outer `<fieldset disabled>`. GET endpoint stays open so the disabled form still shows current values.
- **New events** (both `dataConnection` tab): `verizon_mpdn_applied` (info), `verizon_mpdn_reverted` (info from CGI deactivate / warning from boot path).
- **New error codes** (in `errors.json` × 4 locales): `usb_mode_incompatible_for_verizon`, `mpdn_rule_failed`, `mpdn_rule_revert_failed`, `ip_passthrough_locked_by_verizon_profile`, `partial_apply`, `all_steps_failed`.

## Routing — Single Page, In-Dialog Editor

The feature lives entirely at `/cellular/custom-profiles/` (`app/cellular/custom-profiles/page.tsx`). There are no sub-routes, no URL parameters, and no `useSearchParams` calls in this feature. Create and Edit open an in-page Dialog — the URL never changes.

The sub-route pages that previously existed (`app/cellular/custom-profiles/new/page.tsx`, `app/cellular/custom-profiles/edit/page.tsx`) have been deleted. There are no redirect shims.

The coordinator (`components/cellular/custom-profiles/custom-profile.tsx`) holds three `useState` booleans that drive the dialog: `isEditorOpen`, `editorMode` (`"create"` | `"edit"`), and `editingProfileId`. Callbacks `onNew()` and `onEdit(id)` are threaded down as props to every registry entry point (`profiles-grid.tsx`, `profile-card.tsx`, `active-profile-card.tsx`, `empty-profile.tsx`). None of those components use `<Link>` for create/edit navigation.

## Registry Surface

The registry view (`custom-profile.tsx`) follows a three-section layout:

1. **Page header** — `h1` title + muted description paragraph. Owned by the coordinator, always visible.
2. **Active profile banner** (`active-profile-card.tsx`) — a full-width horizontal banner using an `@container/active-banner` container query. Left column: identity block (profile name + carrier). Middle: config pills (`ProfileConfigPills`) + scenario binding line (CalendarClock icon when scheduled, Route icon when fixed). Right: Deactivate (outline) + Edit (ghost, calls `onEdit(id)` — not a `<Link>`). On narrow containers the banner collapses to a stacked layout with actions in a `CardFooter`. All prior states are preserved: rest/no-profile, SIM-mismatch warning, Verizon data-routing note, loading skeleton.
3. **Saved profiles grid** (`profiles-grid.tsx`) — section header with count + New Profile button, then a strict 2-column grid (`grid grid-cols-1 @3xl/main:grid-cols-2 gap-4 items-stretch`) matching the canonical `ttl-settings.tsx` / `traffic-engine.tsx` shape. When the only profile is the active one, a dashed-border "only active" hint stands in instead of the grid.

**Teaching empty state** (`empty-profile.tsx`): shown when no profiles exist at all. One card with a centered size-14 icon chip, a plain-language paragraph, and a primary New Profile CTA (calls `onNew()`) with a secondary Refresh. Mirrors the engine-onboarding pattern.

**Loading skeleton** suppresses flash on fast loads via `useDelayedFlag` (160ms delay before showing): one banner-shaped active-profile skeleton + a two-card grid skeleton, sized to match the populated layout so there is no reflow on load.

### `fact-row.tsx` — Shared Fact Line

`components/cellular/custom-profiles/fact-row.tsx` renders a label + value pair used by both the saved profile cards and the editor's Summary preview. Label uses the QManager uppercase/muted label typography (`text-[11px] font-medium uppercase tracking-wide`). Value renders `"—"` when empty so a list of rows keeps a stable shape regardless of optional fields. The `mono` prop opts the value into `tabular-nums` (for ICCID, IMEI, numeric readouts).

## Create/Edit Editor

Create and Edit open `ProfileEditorDialog` (`profile-form/profile-editor-dialog.tsx`), a shadcn `Dialog` that owns the full lifecycle: open/close state, edit-mode async profile load (`getProfile` + skeleton body), create-mode current-settings prefill (`useCurrentSettings(false)` lives inside the dialog), the dirty-discard guard, and success/error toasts. The dialog suppresses the default × close button so the dirty guard always fires. It key-remounts the inner editor (`ProfileEditor`) per open session so mount-time state (snapshot, tab position) is always fresh.

**Prop contract** (`ProfileEditorDialog`): `{ open, onOpenChange, mode: "create"|"edit", profileId?, getProfile, onSave, onSaved }`. The coordinator binds `onSave` to `createProfile` (create mode) or `updateProfile(id)` (edit mode); `onSaved` simply closes the dialog (the CRUD hook already refetches).

`ProfileEditor` (`profile-form/profile-editor.tsx`) is the **stepped body** hosted inside the dialog — 5 steps via shadcn `Tabs`, one per section:

| Step | Tab key | Fields |
|---|---|---|
| Identity | `identity` | Profile name, MNO/carrier, ICCID |
| APN | `apn` | APN name, CID, PDP type, auth |
| Advanced | `advanced` | IMEI rewrite, TTL, Hop Limit |
| Scenario | `scenario` | Scenario binding + optional daily schedule |
| Review | `review` | Read-only preview (`SummaryCard`) |

The `TabsList` is the step indicator (all steps freely clickable, never gated). A dialog footer has Back/Next buttons on steps 1–4 and the `SaveButton` on the Review step. The `SummaryCard` is the Review step body — there is no sticky right rail.

**Props** (`ProfileEditor`): `{ mode, initialFormState, onSave, onCancel, onDirtyChange, currentSettings?, onLoadCurrentSettings?, isLoadingCurrent? }`.

### Tab-dot indicators

Tab triggers show a dot only after the user has attempted a save (`errors` object is non-empty). A red `XCircleIcon` marks a tab with at least one error; a green `CheckCircle2Icon` marks a tab where all fields pass. The Review tab never shows either dot (`TAB_ERROR_KEYS.review = []`).

### Validation and error-tab routing

`doSave()` calls `validate()` then routes to the tab owning the first error. Reading order: Name → CID → IMEI → TTL → HL. `ERROR_TAB_MAP` maps each field key to its owning tab. If the first error's tab differs from the active tab, the tab switches, then `window.setTimeout` defers DOM focus/scroll by one tick so the panel has time to mount (hidden tabs are unmounted).

**Why defer focus via `window.setTimeout`:** shadcn `Tabs` unmounts inactive panels. The target DOM element doesn't exist at the moment `setActiveTab` is called; deferring by one tick lets the panel mount before `getElementById` + `scrollIntoView` run.

If the only error is `scenario`, the editor switches to the Scenario tab and calls `scenarioRef.current?.revealFirstError()` — the same `ScenarioCardHandle` imperative API used previously.

### Advanced Card

`profile-form/advanced-card.tsx` is rendered as-is inside the tabbed editor — no `forceOpen` prop is passed. The `forceOpen` prop was removed in an earlier revert and is not present in the current codebase. The collapsed-by-default behavior applies: the `CardHeader` row is the toggle; the collapsed `CardDescription` shows a dot-separated deviation summary when any value differs from defaults; a blocking validation error auto-expands the card via an adjust-during-render pattern (React-Compiler safe, no `useEffect`).

### Dirty-discard guard

The dirty-discard guard lives inside `ProfileEditorDialog`, not the page. The dialog captures a JSON snapshot of the initial form state at mount. On every render, `isDirty = JSON.stringify(form) !== initialSnapshot`. When the user closes via X, overlay click, Escape, or Cancel, and `isDirty` is true, a nested `AlertDialog` (i18n key: `custom_profiles.form.discard_dialog`) intercepts. Confirming the inner dialog calls `onCancel()` / `onOpenChange(false)`; "Keep editing" dismisses it. After a successful save, the dialog closes directly — the guard is bypassed.

### Backend Contract Unchanged

`stripScenarioKeys(form.scenario)` is called before every save. The POST body sent to `profiles/save.sh` never contains `_key`. See [scenario-profile-binding.md](scenario-profile-binding.md) for the full `_key` client-only invariant.

## i18n Keys

All four locale catalogs (`public/locales/{en,id,it,zh-CN}/cellular.json`) carry these keys under `custom_profiles.form`:

### `form.steps`

| Key | Purpose |
|---|---|
| `steps.identity_short` | Tab trigger label for Identity tab |
| `steps.advanced_short` | Tab trigger label for Advanced tab |
| `steps.scenario_short` | Tab trigger label for Scenario tab |
| `steps.apn_short` | Tab trigger label for APN tab |
| `steps.apn_label` | Full label (aria / future stepper use) |
| `steps.review_short` | Tab trigger label for Review tab |
| `steps.review_label` | Full label |
| `steps.review_desc` | Muted description shown inside the Review panel |

### `form.discard_dialog`

| Key | Purpose |
|---|---|
| `discard_dialog.title` | AlertDialog title |
| `discard_dialog.description` | Explains what will be lost |
| `discard_dialog.confirm` | Destructive action button ("Discard changes") |
| `discard_dialog.keep` | Cancel-side button ("Keep editing") |
