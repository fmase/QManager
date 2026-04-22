# Configurable DPI Desync Repeats — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose `--dpi-desync-repeats` (1–10, default 1) as a user-tunable setting on the Video Optimizer card, and baseline Traffic Masquerade at `repeats=2`.

**Architecture:** Adds one UCI key (`quecmanager.video_optimizer.desync_repeats`). The init.d launcher reads it, clamps, and appends `--dpi-desync-repeats=N` only when `N > 1`. The Video Optimizer CGI round-trips the value. Frontend adds a number input with an info-icon tooltip beside the existing Enable switch. Missing UCI key is treated as `1` → zero behavior change on upgrade.

**Tech Stack:** POSIX sh (OpenWRT/BusyBox), UCI, nfqws, Next.js/React, TypeScript, shadcn/ui, i18next.

**Spec:** `docs/2026-04-21-configurable-desync-repeats-design.md`

**Testing note:** This repo has no shell-level test harness. Frontend tests exist only for specific lib modules (`lib/config-backup/**.test.ts`). The validated verification path for this feature is:
1. `bun tsc --noEmit` — TypeScript passes
2. `bun run lint` — no new lint errors
3. `bun run i18n:check` — EN/zh-CN parity
4. Bash syntax check: `sh -n <script>` on each touched shell script
5. Manual smoke test on a device (documented in Task 11)

Adding unit tests for a number-in/number-out UCI field would be YAGNI. The design spec already commits us to this.

---

## File Structure

| File | Change | Purpose |
|------|--------|---------|
| `scripts/etc/init.d/qmanager_dpi` | Modify | Append `--dpi-desync-repeats=N` to VO args; hardcode `=2` for Masquerade |
| `scripts/www/cgi-bin/quecmanager/network/video_optimizer.sh` | Modify | Ensure UCI default; return `desync_repeats` in GET; accept/validate in POST `save` |
| `types/video-optimizer.ts` | Modify | Add `desync_repeats: number` to `VideoOptimizerSettings` and `VideoOptimizerResponse` |
| `hooks/use-video-optimizer.ts` | Modify | Thread `desync_repeats` through fetch and save; change `saveSettings` signature to object |
| `components/local-network/video-optimizer/video-optimizer-settings-card.tsx` | Modify | Add number input with info tooltip; include `desync_repeats` in dirty check and form-key remount |
| `public/locales/en/local-network.json` | Modify | Add `video_optimizer.desync_repeats_label` + `_help` + `_tooltip_aria` |
| `public/locales/zh-CN/local-network.json` | Modify | zh-CN counterparts |
| `public/locales/en/errors.json` | Modify | Add `invalid_repeats` |
| `public/locales/zh-CN/errors.json` | Modify | zh-CN counterpart |
| `RELEASE_NOTE.md` | Modify | Append one bullet under `## ✅ Improvements` |

---

## Task 1: Backend — init.d reads `desync_repeats` for VO mode

**Files:**
- Modify: `scripts/etc/init.d/qmanager_dpi:59-79`

- [ ] **Step 1: Read and inspect current VO branch**

Read lines 59–79 of `scripts/etc/init.d/qmanager_dpi`. Current VO branch ends at line 76 with `fi` / line 78 `qlog_info`. The new repeats read must happen inside the `vo_enabled=1` branch (after line 69, before line 78).

- [ ] **Step 2: Insert `desync_repeats` read + clamp + conditional flag**

Replace this block (current lines 66–76):

```sh
        local quic_enabled
        quic_enabled=$(uci -q get quecmanager.video_optimizer.quic_enabled)

        args="$args --hostlist=$DPI_HOSTLIST"
        args="$args --dpi-desync=split2"
        args="$args --dpi-desync-split-seqovl=1"
        args="$args --dpi-desync-split-pos=1"

        if [ "$quic_enabled" != "0" ]; then
            args="$args --dpi-desync-udplen-increment=2"
        fi
```

With:

```sh
        local quic_enabled desync_repeats
        quic_enabled=$(uci -q get quecmanager.video_optimizer.quic_enabled)
        desync_repeats=$(uci -q get quecmanager.video_optimizer.desync_repeats)

        # Clamp desync_repeats to [1,10]; fall back to 1 on non-numeric or out-of-range
        case "$desync_repeats" in
            ''|*[!0-9]*) desync_repeats=1 ;;
            *)
                if [ "$desync_repeats" -lt 1 ] || [ "$desync_repeats" -gt 10 ]; then
                    desync_repeats=1
                fi
                ;;
        esac

        args="$args --hostlist=$DPI_HOSTLIST"
        args="$args --dpi-desync=split2"
        args="$args --dpi-desync-split-seqovl=1"
        args="$args --dpi-desync-split-pos=1"

        if [ "$desync_repeats" -gt 1 ]; then
            args="$args --dpi-desync-repeats=$desync_repeats"
        fi

        if [ "$quic_enabled" != "0" ]; then
            args="$args --dpi-desync-udplen-increment=2"
        fi
```

- [ ] **Step 3: Update VO qlog_info line**

Replace current line 78:
```sh
        qlog_info "Starting video optimizer on $iface"
```

With:
```sh
        qlog_info "Starting video optimizer on $iface (repeats=$desync_repeats)"
```

- [ ] **Step 4: Bash syntax check**

Run: `sh -n scripts/etc/init.d/qmanager_dpi`
Expected: no output (exit 0).

- [ ] **Step 5: CRLF check**

Run: `file scripts/etc/init.d/qmanager_dpi | grep -i crlf`
Expected: no match (file is LF).

- [ ] **Step 6: Commit**

```bash
git add scripts/etc/init.d/qmanager_dpi
git commit -m "feat(dpi): make VO desync_repeats configurable via UCI (1-10, default 1)"
```

---

## Task 2: Backend — hardcode `repeats=2` for Masquerade mode

**Files:**
- Modify: `scripts/etc/init.d/qmanager_dpi:52-55`

- [ ] **Step 1: Append flag to masquerade args block**

In the masquerade branch (currently lines 52–55), add one line after `--dpi-desync-udplen-increment=2`:

```sh
        args="$args --dpi-desync=fake"
        args="$args --dpi-desync-fake-tls-mod=sni=$sni_domain"
        args="$args --dpi-desync-fooling=badseq"
        args="$args --dpi-desync-udplen-increment=2"
        args="$args --dpi-desync-repeats=2"
```

- [ ] **Step 2: Update masquerade qlog_info line**

Current line 57:
```sh
        qlog_info "Starting traffic masquerade on $iface (sni=$sni_domain)"
```

Replace with:
```sh
        qlog_info "Starting traffic masquerade on $iface (sni=$sni_domain, repeats=2)"
```

- [ ] **Step 3: Bash syntax check**

Run: `sh -n scripts/etc/init.d/qmanager_dpi`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add scripts/etc/init.d/qmanager_dpi
git commit -m "feat(dpi): harden traffic masquerade with --dpi-desync-repeats=2 baseline"
```

---

## Task 3: Backend — CGI `ensure_dpi_config` default + GET exposes `desync_repeats`

**Files:**
- Modify: `scripts/www/cgi-bin/quecmanager/network/video_optimizer.sh:15-24` (ensure default)
- Modify: `scripts/www/cgi-bin/quecmanager/network/video_optimizer.sh:127-167` (GET response)

- [ ] **Step 1: Extend `ensure_dpi_config` to default the new key**

Current function:
```sh
ensure_dpi_config() {
    local section
    section=$(uci -q get quecmanager.video_optimizer)
    if [ -z "$section" ]; then
        uci set quecmanager.video_optimizer=video_optimizer
        uci set quecmanager.video_optimizer.enabled='0'
        uci set quecmanager.video_optimizer.quic_enabled='1'
        uci commit quecmanager
    fi
}
```

Replace with:
```sh
ensure_dpi_config() {
    local section existing_repeats
    section=$(uci -q get quecmanager.video_optimizer)
    if [ -z "$section" ]; then
        uci set quecmanager.video_optimizer=video_optimizer
        uci set quecmanager.video_optimizer.enabled='0'
        uci set quecmanager.video_optimizer.quic_enabled='1'
        uci set quecmanager.video_optimizer.desync_repeats='1'
        uci commit quecmanager
        return
    fi

    # Backfill desync_repeats for installs created before this key existed
    existing_repeats=$(uci -q get quecmanager.video_optimizer.desync_repeats)
    if [ -z "$existing_repeats" ]; then
        uci set quecmanager.video_optimizer.desync_repeats='1'
        uci commit quecmanager
    fi
}
```

- [ ] **Step 2: Read + normalize `desync_repeats` in the main GET handler**

Current (starts at line 127):
```sh
    # Read UCI settings
    enabled=$(uci -q get quecmanager.video_optimizer.enabled)
    masq_enabled=$(uci -q get quecmanager.traffic_masquerade.enabled)
```

Replace with:
```sh
    # Read UCI settings
    enabled=$(uci -q get quecmanager.video_optimizer.enabled)
    masq_enabled=$(uci -q get quecmanager.traffic_masquerade.enabled)
    desync_repeats=$(uci -q get quecmanager.video_optimizer.desync_repeats)
    case "$desync_repeats" in
        ''|*[!0-9]*) desync_repeats=1 ;;
        *)
            if [ "$desync_repeats" -lt 1 ] || [ "$desync_repeats" -gt 10 ]; then
                desync_repeats=1
            fi
            ;;
    esac
```

- [ ] **Step 3: Add `desync_repeats` to the jq-built response**

Current response (lines 147–167):
```sh
    jq -n \
        --argjson success true \
        --arg enabled "${enabled:-0}" \
        --arg masq_enabled "${masq_enabled:-0}" \
        --arg status "$status" \
        --arg uptime "$uptime" \
        --argjson packets_processed "${packets:-0}" \
        --argjson domains_loaded "${domains:-0}" \
        --argjson binary_installed "$binary_ok" \
        --argjson kernel_module_loaded "$kmod_ok" \
        '{
            success: $success,
            enabled: ($enabled == "1"),
            other_enabled: ($masq_enabled == "1"),
            status: $status,
            uptime: $uptime,
            packets_processed: $packets_processed,
            domains_loaded: $domains_loaded,
            binary_installed: $binary_installed,
            kernel_module_loaded: $kernel_module_loaded
        }'
```

Replace with:
```sh
    jq -n \
        --argjson success true \
        --arg enabled "${enabled:-0}" \
        --arg masq_enabled "${masq_enabled:-0}" \
        --arg status "$status" \
        --arg uptime "$uptime" \
        --argjson packets_processed "${packets:-0}" \
        --argjson domains_loaded "${domains:-0}" \
        --argjson desync_repeats "$desync_repeats" \
        --argjson binary_installed "$binary_ok" \
        --argjson kernel_module_loaded "$kmod_ok" \
        '{
            success: $success,
            enabled: ($enabled == "1"),
            other_enabled: ($masq_enabled == "1"),
            status: $status,
            uptime: $uptime,
            packets_processed: $packets_processed,
            domains_loaded: $domains_loaded,
            desync_repeats: $desync_repeats,
            binary_installed: $binary_installed,
            kernel_module_loaded: $kernel_module_loaded
        }'
```

- [ ] **Step 4: Bash syntax check**

Run: `sh -n scripts/www/cgi-bin/quecmanager/network/video_optimizer.sh`
Expected: exit 0, no output.

- [ ] **Step 5: Commit**

```bash
git add scripts/www/cgi-bin/quecmanager/network/video_optimizer.sh
git commit -m "feat(video-optimizer): expose desync_repeats in GET response with UCI default backfill"
```

---

## Task 4: Backend — CGI `save` accepts and validates `desync_repeats`

**Files:**
- Modify: `scripts/www/cgi-bin/quecmanager/network/video_optimizer.sh:175-207` (`save` case)

- [ ] **Step 1: Add parse + validation + UCI write in the `save` case**

Current `save` case starts at line 175 with `new_enabled=...` extraction. Add `desync_repeats` handling right after the existing `[ -z "$new_enabled" ]` check (around line 183).

Replace this block:
```sh
    save)
        # Extract enabled field
        new_enabled=$(echo "$POST_DATA" | jq -r '(.enabled) | if . == null then empty else tostring end')

        if [ -z "$new_enabled" ]; then
            cgi_error "missing_field" "enabled field is required"
            exit 0
        fi

        # Map to UCI value — enforce mutual exclusion with masquerade
        if [ "$new_enabled" = "true" ]; then
            uci set quecmanager.traffic_masquerade.enabled='0'
            uci set quecmanager.video_optimizer.enabled='1'
        else
            uci set quecmanager.video_optimizer.enabled='0'
        fi
        uci commit quecmanager
```

With:
```sh
    save)
        # Extract enabled field
        new_enabled=$(echo "$POST_DATA" | jq -r '(.enabled) | if . == null then empty else tostring end')

        if [ -z "$new_enabled" ]; then
            cgi_error "missing_field" "enabled field is required"
            exit 0
        fi

        # Optional: desync_repeats (integer 1-10). Absence = no change.
        new_repeats=$(echo "$POST_DATA" | jq -r '(.desync_repeats) | if . == null then empty else tostring end')
        if [ -n "$new_repeats" ]; then
            case "$new_repeats" in
                ''|*[!0-9]*)
                    cgi_error "invalid_repeats" "desync_repeats must be an integer between 1 and 10"
                    exit 0
                    ;;
                *)
                    if [ "$new_repeats" -lt 1 ] || [ "$new_repeats" -gt 10 ]; then
                        cgi_error "invalid_repeats" "desync_repeats must be an integer between 1 and 10"
                        exit 0
                    fi
                    ;;
            esac
            uci set quecmanager.video_optimizer.desync_repeats="$new_repeats"
        fi

        # Map to UCI value — enforce mutual exclusion with masquerade
        if [ "$new_enabled" = "true" ]; then
            uci set quecmanager.traffic_masquerade.enabled='0'
            uci set quecmanager.video_optimizer.enabled='1'
        else
            uci set quecmanager.video_optimizer.enabled='0'
        fi
        uci commit quecmanager
```

Note: the existing service restart / enable / stop logic below this block is unchanged and already does the right thing — an nfqws restart happens whenever `enabled=true`, which picks up the new flag. If the user changes **only** `desync_repeats` while VO is already enabled, the save flow still restarts nfqws (existing code path) and the new value takes effect.

- [ ] **Step 2: Bash syntax check**

Run: `sh -n scripts/www/cgi-bin/quecmanager/network/video_optimizer.sh`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/www/cgi-bin/quecmanager/network/video_optimizer.sh
git commit -m "feat(video-optimizer): validate and persist desync_repeats on save"
```

---

## Task 5: i18n — `errors.json` adds `invalid_repeats`

**Files:**
- Modify: `public/locales/en/errors.json`
- Modify: `public/locales/zh-CN/errors.json`

- [ ] **Step 1: Add key to EN errors.json**

Insert the following entry into `public/locales/en/errors.json`, alphabetically between `invalid_` neighbors (the file is roughly alphabetical; place it near other `invalid_*` keys):

```json
"invalid_repeats": "DPI desync repeats must be a whole number between 1 and 10.",
```

- [ ] **Step 2: Add key to zh-CN errors.json**

Insert into `public/locales/zh-CN/errors.json` at the matching position:

```json
"invalid_repeats": "DPI 干扰重复次数必须是 1 到 10 之间的整数。",
```

- [ ] **Step 3: JSON validity**

Run:
```bash
bun -e 'JSON.parse(require("fs").readFileSync("public/locales/en/errors.json","utf8"))'
bun -e 'JSON.parse(require("fs").readFileSync("public/locales/zh-CN/errors.json","utf8"))'
```
Expected: both exit 0 with no output.

- [ ] **Step 4: Parity check**

Run: `bun run i18n:check`
Expected: passes (or at minimum, no new parity errors introduced).

- [ ] **Step 5: Commit**

```bash
git add public/locales/en/errors.json public/locales/zh-CN/errors.json
git commit -m "i18n(errors): add invalid_repeats code"
```

---

## Task 6: i18n — `local-network.json` adds repeats label, help, tooltip aria

**Files:**
- Modify: `public/locales/en/local-network.json`
- Modify: `public/locales/zh-CN/local-network.json`

- [ ] **Step 1: Add keys to EN local-network.json**

Inside the `"video_optimizer": { ... }` object (currently starts at line 168), add these three keys. A good insertion point is right after `"aria_enable"` (line 181):

```json
    "label_desync_repeats": "DPI Desync Repeats",
    "help_desync_repeats": "Number of times the DPI-evading packet is sent for each matched flow. Higher values improve reliability when packets are lost or reordered, but increase CPU use and upstream bandwidth. Default 1 works for most users.",
    "aria_desync_repeats_info": "More information about DPI Desync Repeats",
```

- [ ] **Step 2: Add the same three keys to zh-CN local-network.json**

At the matching position inside the zh-CN `"video_optimizer"` object:

```json
    "label_desync_repeats": "DPI 干扰重复次数",
    "help_desync_repeats": "每个匹配流发送 DPI 干扰包的次数。数值越高,丢包或乱序时绕过越稳定,但 CPU 占用和上行带宽也会增加。默认 1 已适用于大多数用户。",
    "aria_desync_repeats_info": "关于 DPI 干扰重复次数的更多信息",
```

- [ ] **Step 3: JSON validity**

Run:
```bash
bun -e 'JSON.parse(require("fs").readFileSync("public/locales/en/local-network.json","utf8"))'
bun -e 'JSON.parse(require("fs").readFileSync("public/locales/zh-CN/local-network.json","utf8"))'
```
Expected: exit 0.

- [ ] **Step 4: Parity check**

Run: `bun run i18n:check`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add public/locales/en/local-network.json public/locales/zh-CN/local-network.json
git commit -m "i18n(local-network): add desync_repeats label, help, and tooltip aria"
```

---

## Task 7: Frontend — types + hook

**Files:**
- Modify: `types/video-optimizer.ts`
- Modify: `hooks/use-video-optimizer.ts`

- [ ] **Step 1: Add `desync_repeats` to types**

In `types/video-optimizer.ts`, add `desync_repeats: number` to both `VideoOptimizerSettings` (line 1–10) and `VideoOptimizerResponse` (line 12–22). Also extend `VideoOptimizerSavePayload` (lines 34–37) so it can carry the field.

New `VideoOptimizerSettings`:
```ts
export interface VideoOptimizerSettings {
  enabled: boolean;
  other_enabled: boolean;
  status: "running" | "stopped" | "restarting" | "error";
  uptime: string;
  packets_processed: number;
  domains_loaded: number;
  desync_repeats: number;
  binary_installed: boolean;
  kernel_module_loaded: boolean;
}
```

New `VideoOptimizerResponse`:
```ts
export interface VideoOptimizerResponse {
  success: boolean;
  enabled: boolean;
  other_enabled: boolean;
  status: "running" | "stopped" | "restarting" | "error";
  uptime: string;
  packets_processed: number;
  domains_loaded: number;
  desync_repeats: number;
  binary_installed: boolean;
  kernel_module_loaded: boolean;
}
```

New `VideoOptimizerSavePayload`:
```ts
export interface VideoOptimizerSavePayload {
  action: "save";
  enabled: boolean;
  desync_repeats?: number;
}
```

- [ ] **Step 2: Thread `desync_repeats` through the fetch path in the hook**

In `hooks/use-video-optimizer.ts`, in `fetchSettings` (around lines 63–72), extend the `setSettings` call so the new field is carried:

```ts
      setSettings({
        enabled: data.enabled,
        other_enabled: data.other_enabled,
        status: data.status,
        uptime: data.uptime,
        packets_processed: data.packets_processed,
        domains_loaded: data.domains_loaded,
        desync_repeats: data.desync_repeats,
        binary_installed: data.binary_installed,
        kernel_module_loaded: data.kernel_module_loaded,
      });
```

- [ ] **Step 3: Change `saveSettings` signature to accept an options object**

The current signature `saveSettings(enabled: boolean)` is too narrow. Replace the `saveSettings` callback (lines 81–116) with:

```ts
  const saveSettings = useCallback(
    async (
      input: { enabled: boolean; desync_repeats?: number },
    ): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      try {
        const body: { action: "save"; enabled: boolean; desync_repeats?: number } = {
          action: "save",
          enabled: input.enabled,
        };
        if (typeof input.desync_repeats === "number") {
          body.desync_repeats = input.desync_repeats;
        }

        const response = await authFetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!data.success) {
          setError(resolveErrorMessage(t, data.error, data.detail, "Failed to save settings"));
          return false;
        }

        // Silent re-fetch to get updated status
        await fetchSettings(true);
        return true;
      } catch (err) {
        if (mountedRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to save settings"
          );
        }
        return false;
      } finally {
        if (mountedRef.current) setIsSaving(false);
      }
    },
    [fetchSettings, t]
  );
```

Note the additional change to pass `data.error` into `resolveErrorMessage` — this lets the frontend render the localized `invalid_repeats` string added in Task 5. The previous code passed `undefined` as the code.

- [ ] **Step 4: Type check**

Run: `bun tsc --noEmit`
Expected: passes. If errors reference the settings card, that's expected — Task 8 will fix them. If errors reference other files in the repo, investigate: the only caller of `saveSettings` should be `video-optimizer-settings-card.tsx`.

Confirm by running:
```bash
grep -rn "saveSettings" components/ hooks/ app/ --include='*.tsx' --include='*.ts' | grep video
```
Expected output: one reference in `video-optimizer-settings-card.tsx` and internal uses in the hook itself.

- [ ] **Step 5: Commit**

```bash
git add types/video-optimizer.ts hooks/use-video-optimizer.ts
git commit -m "feat(video-optimizer): thread desync_repeats through types and hook"
```

---

## Task 8: Frontend — settings card UI (number input + info tooltip)

**Files:**
- Modify: `components/local-network/video-optimizer/video-optimizer-settings-card.tsx`

- [ ] **Step 1: Update imports**

Add these imports alongside the existing ones at the top of the file:

```tsx
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InfoIcon } from "lucide-react";
```

`InfoIcon` joins the existing `lucide-react` import — merge with the current icon list rather than adding a second import statement. Confirm by reading lines 32–41; add `InfoIcon,` into the same brace group.

- [ ] **Step 2: Update form-key so post-save re-fetch reinitializes repeats too**

Current line 281:
```tsx
  const formKey = settings ? `${settings.enabled}` : "empty";
```

Replace with:
```tsx
  const formKey = settings
    ? `${settings.enabled}:${settings.desync_repeats}`
    : "empty";
```

- [ ] **Step 3: Add local state for repeats + update dirty check**

Inside `VideoOptimizerForm` (around line 315 where `isEnabled` is declared), add:

```tsx
  const [isEnabled, setIsEnabled] = useState(settings?.enabled ?? false);
  const [repeatsText, setRepeatsText] = useState<string>(
    String(settings?.desync_repeats ?? 1),
  );
  const { saved, markSaved } = useSaveFlash();

  const repeatsValid = useMemo(() => {
    if (!/^\d+$/.test(repeatsText)) return false;
    const n = parseInt(repeatsText, 10);
    return n >= 1 && n <= 10;
  }, [repeatsText]);

  const isDirty = useMemo(() => {
    if (!settings) return false;
    const currentRepeats = settings.desync_repeats;
    const typedRepeats = repeatsValid ? parseInt(repeatsText, 10) : currentRepeats;
    return isEnabled !== settings.enabled || typedRepeats !== currentRepeats;
  }, [settings, isEnabled, repeatsText, repeatsValid]);
```

Remove the old single-line `isDirty` block (current lines 318–321).

- [ ] **Step 4: Update `handleSave` to pass repeats**

Replace the existing `handleSave` (lines 323–340) with:

```tsx
  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!repeatsValid) {
        toast.error(t("invalid_repeats", { ns: "errors" }));
        return;
      }
      const desync_repeats = parseInt(repeatsText, 10);
      const success = await saveSettings({ enabled: isEnabled, desync_repeats });
      if (success) {
        markSaved();
        toast.success(
          isEnabled
            ? t("video_optimizer.toast_success_enabled")
            : t("video_optimizer.toast_success_disabled"),
        );
        onSaved?.();
      } else {
        toast.error(error || t("video_optimizer.toast_error_apply"));
      }
    },
    [isEnabled, repeatsText, repeatsValid, saveSettings, markSaved, error, onSaved, t],
  );
```

- [ ] **Step 5: Add the repeats field to the form**

Inside `FieldGroup` (currently line 411), below the existing enable `<div className="flex items-center justify-between">...</div>` block and its `{isRunning && settings && ...}` stats block, add this new field **before** the closing `<Separator />` at line 451:

```tsx
              <Separator />

              <Field orientation="vertical" className="gap-2">
                <div className="flex items-center gap-2">
                  <FieldLabel htmlFor="dpi-desync-repeats">
                    {t("video_optimizer.label_desync_repeats")}
                  </FieldLabel>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("video_optimizer.aria_desync_repeats_info")}
                        className="inline-flex items-center text-muted-foreground hover:text-foreground"
                      >
                        <InfoIcon className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>{t("video_optimizer.help_desync_repeats")}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="dpi-desync-repeats"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10}
                  step={1}
                  value={repeatsText}
                  onChange={(e) => setRepeatsText(e.target.value)}
                  disabled={isSaving}
                  aria-invalid={!repeatsValid}
                  className="w-24"
                />
              </Field>
```

Rationale for placement: the new `<Separator />` above the field gives it visual separation from either the enable toggle (when not running) or the verification section (when running).

- [ ] **Step 6: Tighten the save-button disabled rule**

Current (line 459):
```tsx
            <SaveButton
              type="submit"
              isSaving={isSaving}
              saved={saved}
              disabled={!isDirty || !canToggle}
            />
```

Replace with:
```tsx
            <SaveButton
              type="submit"
              isSaving={isSaving}
              saved={saved}
              disabled={!isDirty || !canToggle || !repeatsValid}
            />
```

- [ ] **Step 7: Type check**

Run: `bun tsc --noEmit`
Expected: passes.

- [ ] **Step 8: Lint**

Run: `bun run lint`
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add components/local-network/video-optimizer/video-optimizer-settings-card.tsx
git commit -m "feat(video-optimizer): add DPI desync repeats input with info tooltip"
```

---

## Task 9: RELEASE_NOTE.md — append bullet

**Files:**
- Modify: `RELEASE_NOTE.md`

- [ ] **Step 1: Append improvement bullet**

Under the existing `## ✅ Improvements` section in `RELEASE_NOTE.md`, add this bullet at the end of the list (before `## 📥 Installation`):

```markdown
- **Video Optimizer — tunable DPI desync repeats.** A new **DPI Desync Repeats** field (1–10, default 1) on the Video Optimizer card lets you have `nfqws` emit the DPI-evading packet multiple times per matched flow. Most users don't need to touch it — the default `1` matches the shipped behavior from prior releases. If you still see occasional throttling, bumping to 2–4 usually helps at a small CPU and upstream-bandwidth cost; the info icon beside the field explains the tradeoff. Traffic Masquerade now uses `repeats=2` as a hardcoded baseline for more robust fake-SNI injection.
```

- [ ] **Step 2: Confirm placement**

Run: `grep -n "desync" RELEASE_NOTE.md`
Expected: one match, inside the `## ✅ Improvements` block (use `grep -n "## " RELEASE_NOTE.md` to confirm the surrounding section headers).

- [ ] **Step 3: Commit**

```bash
git add RELEASE_NOTE.md
git commit -m "docs(release): note configurable DPI desync repeats"
```

---

## Task 10: Final verification

- [ ] **Step 1: Whole-repo type check**

Run: `bun tsc --noEmit`
Expected: passes.

- [ ] **Step 2: Lint**

Run: `bun run lint`
Expected: passes (or no new errors introduced).

- [ ] **Step 3: i18n parity**

Run: `bun run i18n:check`
Expected: passes.

- [ ] **Step 4: Shell syntax check**

Run:
```bash
sh -n scripts/etc/init.d/qmanager_dpi
sh -n scripts/www/cgi-bin/quecmanager/network/video_optimizer.sh
```
Expected: both exit 0 with no output.

- [ ] **Step 5: Line-ending audit**

Run:
```bash
file scripts/etc/init.d/qmanager_dpi scripts/www/cgi-bin/quecmanager/network/video_optimizer.sh | grep -i crlf
```
Expected: no matches (both files are LF per repo convention).

- [ ] **Step 6: git status clean**

Run: `git status`
Expected: no pending changes (everything committed per task).

---

## Task 11: On-device smoke test (manual, documented for the reviewer)

This task is **not executed by the plan runner** — it's a checklist for whoever deploys the build to a test device. Include it in the plan so the reviewer knows what the user-facing acceptance criteria are.

- [ ] Fresh upgrade from prior build: `uci get quecmanager.video_optimizer.desync_repeats` → returns `1` (CGI's `ensure_dpi_config` backfilled).
- [ ] Open Video Optimizer card with VO disabled → field shows `1`, info tooltip renders the help text.
- [ ] Change repeats to `3`, save. `pidof nfqws` yields a PID; `ps | grep nfqws` shows `--dpi-desync-repeats=3` in the command line.
- [ ] Set repeats to `1`, save. `ps | grep nfqws` shows **no** `--dpi-desync-repeats` flag (command line byte-identical to prior releases).
- [ ] Set repeats to `0` via direct API call (`curl -X POST ... -d '{"action":"save","enabled":true,"desync_repeats":0}'`) → HTTP response contains `"error":"invalid_repeats"`.
- [ ] Same with `11` → same error.
- [ ] Enable Traffic Masquerade → `ps | grep nfqws` shows `--dpi-desync-repeats=2`.
- [ ] Switch UI language to 简体中文 → Video Optimizer card shows localized label + tooltip; invalid-repeats toast on bad input renders in Chinese.

---

## Self-Review Notes (for the plan author)

- ✅ Spec coverage: UCI key (Task 3), init.d for VO (Task 1), init.d for Masq (Task 2), CGI GET (Task 3), CGI POST (Task 4), types (Task 7), hook (Task 7), UI (Task 8), i18n error (Task 5), i18n label/help (Task 6), release note (Task 9), verification (Tasks 10, 11).
- ✅ No "TBD"/"TODO" placeholders — every step has concrete code.
- ✅ Type consistency: `desync_repeats: number` used identically in types, hook, CGI (jq `--argjson`), and UI. Save payload shape is consistent between types file and hook body builder.
- ✅ No forward references: `saveSettings` signature change (Task 7 Step 3) is consumed by the settings card (Task 8 Step 4); the order matters and is respected.
- ✅ One breaking call-site change (`saveSettings(enabled)` → `saveSettings({enabled, desync_repeats})`). Task 7 Step 4 includes the grep check to confirm only the settings card is affected; the compiler will catch any miss.
