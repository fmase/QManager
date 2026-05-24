# DPI Settings (Video Optimizer + Traffic Masquerade)

CGI: `network/video_optimizer.sh` · Hooks: `use-video-optimizer.ts`, `use-cdn-hostlist.ts`, `use-traffic-masquerade.ts` · Types: `video-optimizer.ts` · Reboot: No

- Routes: `/local-network/video-optimizer` (settings + CDN hostlist), `/local-network/traffic-masquerade`. Old `/local-network/dpi-masking` redirects.
- Binary: `nfqws` from zapret, installed to `/usr/bin/nfqws` on demand by `qmanager_dpi_install` (arch-detect → fetch `openwrt-embedded.tar.gz`). State files: `/tmp/qmanager_dpi_install.{json,pid}`.
- **Single shared nfqws on queue 200** — VO and masquerade are mutually exclusive modes of ONE process: single PID (`/var/run/nfqws.pid`). Backend enforces mutex in `save`/`save_masquerade`; init.d checks masquerade first, then VO.
- **nft rules are persistent**, shipped as `/etc/nftables.d/12-mangle-qmanager-dpi.nft` (chain `mangle_postrouting_qmanager_dpi`, `oifname "rmnet*"`, `queue num 200 bypass`). fw4 sources the file on every load/reload, so rules survive `fw4 reload` (VPN toggles, port-forward edits, mwan3 ipset refreshes, etc. — all of which used to silently wipe the runtime-injected rules). The `bypass` flag means rules are safe to leave permanent even when nfqws is not running. The init.d script never touches nftables — it only manages the daemon. `dpi_helper.sh` no longer has `dpi_insert_rules` / `dpi_remove_rules`. Uninstall removes the .nft file and drops the live chain.
- Modes: VO = SNI split (`split2`) + QUIC desync, filtered by `--hostlist`. Masquerade = fake TLS ClientHello with spoofed SNI (default `speedtest.net`), all traffic.
- Hostlist: `/etc/qmanager/video_domains.txt` (active) + `video_domains_default.txt` (immutable). Hostlist CGI supports GET `?section=hostlist`, POST `save_hostlist`, POST `restore_hostlist`.
- GET handlers gate live stats on UCI `enabled` to avoid cross-mode contamination. Kernel check: `dpi_check_kmod()` reads `/proc/config.gz` for `CONFIG_NETFILTER_NETLINK_QUEUE=y`.
- Boot persistence: enabling either mode → init.d `enable`; disabling → `disable` only if BOTH are off. Uninstall always `disable`s.
- Deps: `libnetfilter-queue`, `libnfnetlink`, `libmnl`, full `curl`, NFQUEUE kernel support.
