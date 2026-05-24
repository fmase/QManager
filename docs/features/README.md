# Feature Notes

Per-feature deep-dives extracted from `CLAUDE.md` to keep the always-loaded prompt small. Read these on demand when working on a specific feature.

## CGI Endpoint Reference

| Feature | CGI Script | Hook | Types | Reboot? |
|---|---|---|---|---|
| Video Optimizer | `network/video_optimizer.sh` | `use-video-optimizer.ts` + `use-cdn-hostlist.ts` | `video-optimizer.ts` | No |
| Traffic Masquerade | `network/video_optimizer.sh` | `use-traffic-masquerade.ts` | `video-optimizer.ts` | No |
| NetBird VPN | `vpn/netbird.sh` | `use-netbird.ts` | inline | Yes (uninstall) |
| Config Backup | `system/config-backup/{collect,apply,apply_status,apply_cancel}.sh` | `use-config-backup.ts` + `use-config-restore.ts` | `config-backup.ts` | Deferred (dialog + banner for IMEI/profile) |

## Index

| Doc | When to read |
|---|---|
| [DPI Settings](dpi-settings.md) | Video Optimizer, Traffic Masquerade, nfqws, NFQUEUE 200, persistent nft rules |
| [Custom SIM Profiles](custom-sim-profiles.md) | APN/TTL/IMEI/MPDN apply pipeline, lock layering, Verizon MPDN, ICCID auto-apply |
| [Config Backup & Restore](config-backup-restore.md) | `.qmbackup` format, AES-GCM, async restore worker, deferred-reboot pattern |
| [Language Packs](language-packs.md) | Hybrid bundled/downloaded i18n, install/remove pipeline, publishing workflow, manifest |
| [Error Code Vocabulary](error-codes.md) | Backend `{ error, detail }` contract, `resolveErrorMessage()`, `at-commands` namespace |
| [Tower Lock Failover](tower-lock-failover.md) | Tower locking, signal failover daemon, unlock/stop semantics |
| [Antenna Alignment](antenna-alignment.md) | `/cellular/antenna-alignment`, alignment meter scoring, antenna type toggle |
