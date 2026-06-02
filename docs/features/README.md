# Feature Notes

Per-feature deep-dives extracted from `CLAUDE.md` to keep the always-loaded prompt small. Read these on demand when working on a specific feature.

## CGI Endpoint Reference

| Feature | CGI Script | Hook | Types | Reboot? |
|---|---|---|---|---|
| Traffic Engine (Video Optimizer + Masquerade) | `network/video_optimizer.sh` | `use-video-optimizer.ts` + `use-cdn-hostlist.ts` + `use-traffic-masquerade.ts` | `video-optimizer.ts` | No |
| NetBird VPN | `vpn/netbird.sh` | `use-netbird.ts` | inline | Yes (uninstall) |
| Config Backup | `system/config-backup/{collect,apply,apply_status,apply_cancel}.sh` | `use-config-backup.ts` + `use-config-restore.ts` | `config-backup.ts` | Deferred (dialog + banner for IMEI/profile) |
| Bandwidth Monitor | `monitoring/bandwidth.sh` | `use-bandwidth-monitor.ts` + `use-bandwidth-settings.ts` | `bandwidth-monitor.ts` | No |
| Connection Scenarios | `scenarios/{activate,list,add,edit,delete}.sh` | `use-scenario-list.ts` | inline | No |
| Scenario-to-Profile Binding | `scenarios/activate.sh` (guard) + `profiles/{deactivate,list,get,save}.sh` | `use-active-profile.ts` + `hooks/use-sim-profiles.ts` | `sim-profile.ts` (ScenarioSchedule, ProfileScenarioBinding) | No |
| SMS Inbox + Alerts | `cellular/sms.sh` + `monitoring/sms_alerts.sh` + `monitoring/sms_alert_log.sh` | — | inline | No |

## Index

| Doc | When to read |
|---|---|
| [DPI Settings](dpi-settings.md) | Traffic Engine (unified Video Optimizer + Masquerade at `/local-network/traffic-engine`), nfqws, NFQUEUE 200, persistent nft rules, mode takeover |
| [Custom SIM Profiles](custom-sim-profiles.md) | APN/TTL/IMEI/MPDN apply pipeline, lock layering, Verizon MPDN, ICCID auto-apply, 2-col page (form card + list card), pills require per-row get.sh, flat save body, mismatch derived client-side |
| [Config Backup & Restore](config-backup-restore.md) | `.qmbackup` format, AES-GCM, async restore worker, deferred-reboot pattern |
| [Language Packs](language-packs.md) | Hybrid bundled/downloaded i18n, install/remove pipeline, publishing workflow, manifest |
| [Error Code Vocabulary](error-codes.md) | Backend `{ error, detail }` contract, `resolveErrorMessage()`, `at-commands` namespace |
| [Tower Lock Failover](tower-lock-failover.md) | Tower locking, signal failover daemon, unlock/stop semantics |
| [Antenna Alignment](antenna-alignment.md) | `/cellular/antenna-alignment`, alignment meter scoring, antenna type toggle |
| [Bandwidth Monitor](bandwidth-monitor.md) | `bridge_traffic_monitor_rm551` + `websocat:8838`, UCI config, dashboard 5-state row, security constraints |
| [Scenario-to-Profile Binding](scenario-profile-binding.md) | `.scenario` schema, canonical resolution rule, cron install/teardown, teardown ordering, `scenario_locked_by_schedule` guard, schedule UI contract |
| [SMS](sms.md) | `sms_tool` binary patches, `/dev/smd11` char-device invariant, shared lock, inbox CGI, alert library, phone-number handling |
