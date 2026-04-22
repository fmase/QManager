# Configurable DPI Desync Repeats — Design

**Date:** 2026-04-21
**Scope:** Video Optimizer (Plan 18+ follow-up)
**Feature type:** Improvement to existing feature

## Problem

The Video Optimizer uses `nfqws` with `--dpi-desync=split2` to fragment TLS ClientHello packets on hostlisted video CDNs, bypassing T-Mobile Binge On (and similar) DPI-based throttles. Today nfqws emits the desync packet exactly **once** per matched flow. Most users report it works, but a minority still see occasional throttling — consistent with the desync packet being dropped, reordered, or missed by the carrier's DPI state machine.

`nfqws` exposes `--dpi-desync-repeats=N` which emits the desync packet N times. This gives up a small amount of CPU and upstream bandwidth in exchange for higher evasion reliability. The on-modem QManager install has headroom (observed ≤15% CPU), so exposing this as a user-tunable knob is cheap.

## Non-goals

- SQM / CAKE QoS. Deferred — handled by users' dedicated routers.
- Per-hostname repeat tuning. YAGNI.
- UI-exposed repeats for Traffic Masquerade (see Masquerade section).
- Changing the current default behavior for existing installs.

## Current state (verified)

`scripts/etc/init.d/qmanager_dpi` builds nfqws args per-mode:

- **VO mode** (`scripts/etc/init.d/qmanager_dpi:69-76`):
  ```
  --hostlist=$DPI_HOSTLIST
  --dpi-desync=split2
  --dpi-desync-split-seqovl=1
  --dpi-desync-split-pos=1
  [--dpi-desync-udplen-increment=2]   # when quic_enabled != 0
  ```
- **Masquerade mode** (`scripts/etc/init.d/qmanager_dpi:52-55`):
  ```
  --dpi-desync=fake
  --dpi-desync-fake-tls-mod=sni=<sni_domain>
  --dpi-desync-fooling=badseq
  --dpi-desync-udplen-increment=2
  ```

Neither mode sets `--dpi-desync-repeats`, so nfqws uses its built-in default of `1`.

## Design

### UCI schema

Add one key under the existing `quecmanager.video_optimizer` section:

| Key              | Type | Range | Default |
|------------------|------|-------|---------|
| `desync_repeats` | int  | 1–10  | 1       |

Missing key is indistinguishable from `1` — no upgrade migration needed.

### Backend — `scripts/etc/init.d/qmanager_dpi`

**VO mode:**
- Read `quecmanager.video_optimizer.desync_repeats`.
- Clamp to `[1,10]`. Out-of-range or non-numeric → fall back to `1` (fail-safe, current behavior).
- Append `--dpi-desync-repeats=N` **only when `N > 1`** to keep the command line byte-identical for default users.

**Masquerade mode:**
- Unconditionally append `--dpi-desync-repeats=2`. Hardcoded baseline improvement, no UI.

### Backend — `scripts/www/cgi-bin/quecmanager/network/video_optimizer.sh`

**GET `?section=settings`:** include `desync_repeats` (numeric) in response.

**POST `save`:**
- Accept `desync_repeats` in the body.
- Validate: integer, `1 ≤ N ≤ 10`. Invalid → `{ error: "invalid_repeats" }`, HTTP 400.
- Write to UCI, commit, trigger nfqws restart via the existing save path (same flow as changing the QUIC toggle).

### Frontend

- **`types/video-optimizer.ts`** — add `desync_repeats: number` to settings type.
- **`hooks/use-video-optimizer.ts`** — round-trip the field in fetch and save.
- **VO settings card** — new form field **"DPI Desync Repeats"**:
  - shadcn `Input type="number"` with stepper, `min={1} max={10}`
  - Info icon (tooltip) beside the label
  - Sits in the existing settings form; saved via the existing save button (same brief nfqws restart as any other VO setting change)

### i18n

Add to `public/locales/{en,zh-CN}/network.json` under the video_optimizer namespace:
- `desync_repeats_label` — "DPI Desync Repeats"
- `desync_repeats_help` — "Number of times the DPI-evading packet is sent for each matched flow. Higher values improve reliability when packets are lost or reordered, but increase CPU use and upstream bandwidth. Default 1 works for most users."

Add to `public/locales/{en,zh-CN}/errors.json`:
- `invalid_repeats` — "DPI desync repeats must be a whole number between 1 and 10."

### Release notes

Append to `RELEASE_NOTE.md` under `## ✅ Improvements`:
- Video Optimizer: tunable DPI desync repeats (1–10) for users who still see occasional throttling. Default 1 preserves existing behavior.

## Edge cases

| Case | Behavior |
|------|----------|
| Fresh upgrade, no UCI key | Treated as `1`. Zero behavior change. |
| Non-integer / out-of-range value already in UCI | init.d clamps to `1`. CGI rejects on save. |
| User sets `desync_repeats=1` | No `--dpi-desync-repeats` flag added. Byte-identical to today's command line. |
| User changes value while nfqws is running | Save flow restarts nfqws. Same brief break as toggling QUIC. |
| Masquerade active (mutex with VO) | `desync_repeats` UCI value is ignored — only masquerade's hardcoded `repeats=2` applies. |

## Risk

Single risk: a user sets repeats=10 and notices upload bandwidth bump during heavy video use. Mitigation = info tooltip + conservative default (1). No other behavior surface changes.

## Files touched

**Backend:**
- `scripts/etc/init.d/qmanager_dpi`
- `scripts/www/cgi-bin/quecmanager/network/video_optimizer.sh`

**Frontend:**
- `types/video-optimizer.ts`
- `hooks/use-video-optimizer.ts`
- Video Optimizer settings card component

**i18n:**
- `public/locales/en/network.json`
- `public/locales/zh-CN/network.json`
- `public/locales/en/errors.json`
- `public/locales/zh-CN/errors.json`

**Docs:**
- `RELEASE_NOTE.md`

## Not touched

- `CLAUDE.md` DPI section — existing notes remain accurate (split2, hostlist, mutex with masquerade all unchanged).
- Config backup — Video Optimizer is not currently a backed-up section (scope: Network Mode/APN, bands, tower lock, TTL/HL, IMEI, profiles, SMS alerts, watchdog). No change needed; adding VO to backup is a separate future feature.
