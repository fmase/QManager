# LAN Gateway / Subnet Configuration

QManager lets users change the modem's LAN bridge IP address and subnet prefix directly from the Local Network page. Because the device is the router, changing its own LAN IP severs the serving HTTP connection — the apply is designed to flush the response before the network reloads, then leave the user a persistent banner pointing at the new address.

---

## Quick Reference

| Item | Value |
|---|---|
| CGI script | `scripts/www/cgi-bin/quecmanager/network/lan_config.sh` |
| Install path | `/www/cgi-bin/quecmanager/network/lan_config.sh` |
| Endpoint | `GET/POST /cgi-bin/quecmanager/network/lan_config.sh` |
| UCI keys written | `network.lan.ipaddr`, `network.lan.netmask` |
| Event emitted | `lan_address_changed` |
| Reboot? | No — `network reload` only |
| Frontend card | `components/local-network/lan-config-card.tsx` |
| Hook | `hooks/use-lan-config.ts` |
| Types | `types/lan-config.ts` |
| i18n namespace | `lan_config.*` (all 4 `local-network.json` locales) |

---

## Endpoint Contract

### GET `/cgi-bin/quecmanager/network/lan_config.sh`

Returns the current LAN bridge address and derived CIDR prefix.

**Response:**

```json
{
  "success": true,
  "device": "br-lan",
  "ipaddr": "192.168.1.1",
  "netmask": "255.255.255.0",
  "prefix": 24
}
```

- `device` is read from `network.lan.device`; defaults to `"br-lan"` if absent.
- `prefix` is computed by the CGI from the stored `netmask` via a pure-shell popcount — it is never stored independently.
- Error if either `ipaddr` or `netmask` is absent from UCI, or if the stored netmask is malformed: `{ "success": false, "error": "lan_read_failed", "detail": "..." }`.

### POST `/cgi-bin/quecmanager/network/lan_config.sh`

Applies a new gateway IP and subnet prefix.

**Request body:**

```json
{ "ipaddr": "192.168.2.1", "prefix": 24 }
```

- `ipaddr` — string, exactly 4 decimal octets each 0–255, no leading zeros, first octet 1–223 and not 127. Rejects multicast (224+), class-E, loopback, and 0.x.x.x.
- `prefix` — integer, enforced range **16–30**.

**Success response (emitted before the apply):**

```json
{
  "success": true,
  "apply_in_progress": true,
  "disconnect_window_seconds": 15,
  "new_ipaddr": "192.168.2.1",
  "netmask": "255.255.255.0",
  "prefix": 24
}
```

After flushing this response, the CGI fire-and-forgets:

```sh
( ( sleep 1 && /etc/init.d/network reload ) </dev/null >/dev/null 2>&1 & )
```

The 1-second sleep ensures HTTP bytes have flushed before `br-lan` rebinds.

**Error codes:**

| Code | Meaning |
|---|---|
| `invalid_ipaddr` | Address is absent, wrong type, non-numeric, out of 0–255 range, has leading zeros, or is non-unicast |
| `invalid_prefix` | Prefix is absent, non-integer, or outside 16–30 |
| `invalid_host_in_subnet` | Supplied IP is the network address or broadcast address of the resulting `/<prefix>` subnet |
| `lan_read_failed` | GET only — could not read UCI or stored netmask is malformed |
| `lan_save_failed` | POST only — `uci commit network` failed |

---

## Key Invariants

### 1. "Gateway" = `network.lan.ipaddr`

On a LAN bridge there is no `network.lan.gateway` key — the router's own LAN IP is the gateway that DHCP clients are given. The CGI reads and writes only `network.lan.ipaddr` and `network.lan.netmask`. No `gateway` key is ever created.

**Why:** OpenWRT's `network.lan` section models the device as a host *on* its own LAN, not as a router with a separate next-hop. The device IS the gateway.

### 2. Self-severing apply

Changing the LAN IP and running `network reload` rebinds `br-lan` to the new address. This drops the TCP connection the browser used to make the POST request, and if the IP changed, the old origin is gone. The CGI **must** flush the HTTP response before the reload fires.

The pattern mirrors the no-in-flight-reboot rule in CLAUDE.md: the response encodes `new_ipaddr` so the frontend can tell the user exactly where to reconnect. The hook (`use-lan-config.ts`) therefore has **no retry loop** against the old origin — on a successful POST it transitions immediately to an "applied" state, and the card shows a persistent `Alert` banner linking the new address.

**Why:** A retry loop against the now-dead old origin would hang until timeout and then report a spurious error. Acknowledging the deliberate disconnect upfront is the correct pattern for any self-severing apply.

### 3. Validation is hand-rolled shell — `ipcalc.sh` is NOT the validator

`ipcalc.sh` on OpenWRT silently wraps invalid octets modulo 256 and exits 0. Device `jq` (1.6, compiled without Oniguruma) has no regex operators (`test()`, `match()`, `sub()`, `gsub()`). All octet range checks, prefix range enforcement, and network/broadcast-address rejection are therefore implemented in pure POSIX shell arithmetic in `lan_config.sh`.

**Why:** Relying on `ipcalc.sh` or `jq` regex would silently accept malformed input and write it to UCI.

### 4. Null bytes are invalid in shell source; SCP can mask this defect

A `\x00` (NUL) byte embedded in a `jq` filter string is rejected during shell source-parsing and corrupts text tooling on the device. The production deploy path (`cp -r` + `tr -d '\r'`) preserves null bytes verbatim. SCP-based transfers silently convert null bytes to newlines, so a script that contains a null byte may pass SCP-based on-device tests and fail in production.

**Safe pattern:** use a leading space as a sentinel in jq case patterns (e.g., `" not_object"`) — a `case` glob match catches the sentinel value identically and does not require a NUL. This is the pattern used in `lan_config.sh`'s `ipaddr` parser.

See also: [`docs/reference/busybox-shell-quirks.md`](../reference/busybox-shell-quirks.md) for the full BusyBox/deploy quirk catalog.

---

## Apply Flow

```
POST /network/lan_config.sh
  ↓
Validate ipaddr (pure-shell: 4 octets, range, no leading zeros, unicast)
Validate prefix (integer, 16–30)
Reject network/broadcast address of the resulting subnet
  ↓
uci set network.lan.ipaddr=<new>
uci set network.lan.netmask=<derived-from-prefix>
uci commit network
append_event "lan_address_changed"
  ↓
Emit HTTP response  ← MUST flush before the reload severs the connection
  ↓
Fire-and-forget: ( sleep 1 && /etc/init.d/network reload )
                 ^ 1s ensures TCP buffer drains
  ↓
br-lan rebinds; old HTTP origin is dead
```

No reboot is issued. `network reload` re-reads UCI and rebinds `br-lan` without touching the cellular interface or other network sections.

---

## Frontend Files

| File | Purpose |
|---|---|
| `components/local-network/lan-config-card.tsx` | Card with gateway IP `Input` + CIDR prefix `Select` (/16–/30), `AlertDialog` confirm warning, post-apply persistent `Alert` banner |
| `hooks/use-lan-config.ts` | Fetch/save hook; flips to `applied` state on success — no retry after apply |
| `types/lan-config.ts` | `LanConfigStatus`, `LanConfigSaveRequest`, `LanConfigSaveResponse` |

The card slots into `components/local-network/ethernet-status.tsx`, replacing the removed Wake-on-LAN card.

---

## Removed Feature: Wake-on-LAN

WoL was removed in the same change that introduced this feature. The `qmanager.network.disable_wol` UCI key is retired by the installer's cleanup function (`uci -q delete quecmanager.network.disable_wol`). The `qmanager_wol_fix` init.d service is pruned by the existing init.d prune loop on upgrade.

> ⚠️ WARNING: On already-installed devices upgraded without a clean install, the old `wol.sh` CGI file may persist at `/www/cgi-bin/quecmanager/network/wol.sh`. There is no CGI prune loop in the installer. The file is auth-gated and harmless, but it is a known artifact of the upgrade path.

The `wol_changed` event type has been **repurposed** to `lan_address_changed` across `events.json` (all 4 locales), `constants/network-events.ts`, and the `NetworkEventType` union in `types/modem-status.ts`.
