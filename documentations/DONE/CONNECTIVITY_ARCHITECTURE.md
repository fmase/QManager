# QManager Connectivity Architecture

**Unified Ping Daemon, Watchcat Integration, and Internet Status**

**Project:** QManager — Custom GUI for Quectel RM551E-GL 5G Modem  
**Platform:** OpenWRT (Embedded Linux)  
**Version:** 1.0  
**Date:** February 15, 2026

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Architecture Overview](#2-architecture-overview)
3. [Component 1: Unified Ping Daemon (qmanager_ping)](#3-component-1-unified-ping-daemon-qmanager_ping)
4. [Component 2: Watchcat State Machine (qmanager_watchcat)](#4-component-2-watchcat-state-machine-qmanager_watchcat)
5. [Component 3: Poller Integration](#5-component-3-poller-integration)
6. [Component 4: Frontend Consumers](#6-component-4-frontend-consumers)
7. [Lock File Registry](#7-lock-file-registry)
8. [JSON Data Contract Additions](#8-json-data-contract-additions)
9. [Init System & Process Management](#9-init-system--process-management)
10. [Edge Cases & Mitigations](#10-edge-cases--mitigations)
11. [Configuration (UCI)](#11-configuration-uci)
12. [Implementation Build Order](#12-implementation-build-order)

---

## 1. Problem Statement

### Three Consumers, One Network Stack

QManager needs ping-based network data for three distinct purposes:

| Consumer | Needs | Cares About |
|----------|-------|-------------|
| **Watchcat** (Connection Health) | Periodic reachability checks to trigger escalation recovery | Binary success/fail, streak counts |
| **Internet Badge** (Network Status Component) | Real-time "is internet actually working?" indicator | Binary reachable/unreachable |
| **Live Latency** (Dashboard Component + future histogram) | Continuous RTT measurements for display | Millisecond values, history |

### Why Three Separate Ping Processes Are Wrong

The naive approach — each consumer runs its own ping loop — fails on an embedded device:

**Resource waste.** Three processes forking BusyBox `ping` every few seconds. Each invocation is a fork+exec on a system with limited RAM and CPU.

**Split-brain health assessments.** If the watchcat pings 8.8.8.8 and the latency service pings 1.1.1.1, the internet badge could show "connected" while the watchcat triggers recovery because its specific target is unreachable. The user sees contradictory information.

**Recovery interference.** When the watchcat triggers ifup/ifdown, the latency graph spikes. The UI has no way to distinguish "real network degradation" from "watchcat just restarted the interface."

**Duplicate ICMP on metered connections.** On cellular, minimizing unnecessary traffic matters.

### The Lock File Collision

The Watchcat Architecture Guide uses `/tmp/qmanager.lock` for its LOCKED state (maintenance mode during band switching). The existing `qcmd` gatekeeper uses `/var/lock/qmanager.lock` for serial port mutex. These serve completely different purposes but have dangerously similar names. A bug that confuses them could either prevent the watchcat from detecting maintenance mode, or accidentally clear the serial port lock.

---

## 2. Architecture Overview

The solution is a **single ping daemon** that produces data consumed by all three systems. No consumer pings on its own.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PING DATA FLOW                               │
│                                                                     │
│  ┌──────────────┐                                                   │
│  │ qmanager_    │──writes──▶ /tmp/qmanager_ping.json                │
│  │ ping         │           (RTT, reachable, streaks, history)      │
│  │ (daemon)     │                                                   │
│  └──────────────┘                │                │                 │
│                                  │                │                 │
│                         ┌────────▼───┐    ┌───────▼──────┐         │
│                         │ qmanager_  │    │ qmanager_    │         │
│                         │ poller     │    │ watchcat     │         │
│                         │ (reads)    │    │ (reads)      │         │
│                         └────────┬───┘    └───────┬──────┘         │
│                                  │                │                 │
│                    ┌─────────────▼──┐    ┌────────▼──────────┐     │
│                    │ status.json    │    │ Recovery Actions  │     │
│                    │ (connectivity  │    │ Tier 1: ifup      │     │
│                    │  section)      │    │ Tier 2: AT+CFUN   │──▶ qcmd
│                    └────────┬───────┘    │ Tier 3: reboot    │     │
│                             │            └───────────────────┘     │
│                    ┌────────▼───────┐                               │
│                    │ Frontend       │                               │
│                    │ • Internet ●   │                               │
│                    │ • Latency 34ms │                               │
│                    │ • Watchcat: OK │                               │
│                    └────────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Single source of truth.** One daemon pings. Everyone else reads. No split-brain.
2. **Independent failure domains.** If the ping daemon crashes, modem data still flows. If the poller crashes, ping data still flows. If the watchcat crashes, the dashboard still works.
3. **No modem dependency.** The ping daemon never touches the serial port. It runs on its own cadence regardless of modem lock state, long scans, or poller status.
4. **Merge at the poller.** The frontend fetches one file (`status.json`). The poller reads the ping daemon's output and includes a `connectivity` section. No extra HTTP requests.

---

## 3. Component 1: Unified Ping Daemon (`qmanager_ping`)

### Purpose

A lightweight background daemon that runs a continuous ping loop against one or two targets and writes results to a shared RAM file. All ping consumers read from this file.

### File Locations

| File | Path |
|------|------|
| Daemon binary | `/usr/bin/qmanager_ping` |
| Output cache | `/tmp/qmanager_ping.json` |
| History buffer | `/tmp/qmanager_ping_history` |
| Configuration | `/etc/config/qmanager` (UCI) |

### Output Schema (`/tmp/qmanager_ping.json`)

```json
{
  "timestamp": 1707900000,
  "targets": ["8.8.8.8", "1.1.1.1"],
  "interval_sec": 2,
  "last_rtt_ms": 34.2,
  "avg_rtt_ms": 37.1,
  "min_rtt_ms": 28.5,
  "max_rtt_ms": 52.3,
  "jitter_ms": 4.8,
  "packet_loss_pct": 0,
  "samples_total": 1200,
  "reachable": true,
  "streak_success": 30,
  "streak_fail": 0,
  "history": [34.2, 35.1, 33.8, 36.0, 31.2, "...60 entries max"]
}
```

### Key Design Decisions

**Dual-target pinging.** The daemon pings two targets (default: `8.8.8.8` and `1.1.1.1`) in alternation. `reachable` is `true` if *either* target responds. This prevents false positives when a single DNS provider has issues. The RTT recorded is from whichever target responded on that cycle.

**Hysteresis on `reachable` flag.** The `reachable` boolean does NOT flip on a single failed ping. It requires `streak_fail >= 3` (configurable) consecutive failures before going `false`. This prevents the internet badge from flickering on transient packet loss (common on cellular). Similarly, recovery from `false` → `true` requires `streak_success >= 2` to avoid bounce.

**History ring buffer.** The `history` array holds the last 60 RTT values (2 minutes at 2-second intervals). Stored as a flat file (`/tmp/qmanager_ping_history`) with one value per line, trimmed via `tail -n 60`. The daemon reads this into the JSON array on each write. Failed pings are recorded as `null` entries in the history so the frontend can distinguish "no data" from "0ms latency."

**Atomic writes.** Same pattern as the poller: write to `.tmp`, `mv` to final path. Readers never see partial JSON.

**Recovery awareness.** Before each ping, the daemon checks for `/tmp/qmanager_recovery_active`. If present, the daemon:
- Continues pinging (so the recovery outcome is measured)
- Tags results internally so the watchcat knows these samples occurred during recovery
- Adds `"during_recovery": true` to the JSON output

This prevents the watchcat from misinterpreting recovery-induced packet loss as a new failure.

### Pseudocode

```sh
#!/bin/sh
# /usr/bin/qmanager_ping — Unified Ping Daemon

TARGETS="8.8.8.8 1.1.1.1"
INTERVAL=2
FAIL_THRESHOLD=3
RECOVER_THRESHOLD=2
HISTORY_SIZE=60
CACHE="/tmp/qmanager_ping.json"
HISTORY_FILE="/tmp/qmanager_ping_history"

streak_success=0
streak_fail=0
reachable="true"
target_index=0

while true; do
    # Select target (alternate between targets)
    target=$(echo "$TARGETS" | awk -v i=$target_index '{print $(i+1)}')
    target_index=$(( (target_index + 1) % $(echo "$TARGETS" | wc -w) ))

    # Check recovery state
    during_recovery="false"
    [ -f /tmp/qmanager_recovery_active ] && during_recovery="true"

    # Execute ping (BusyBox compatible: -c1 -W2)
    result=$(ping -c1 -W2 "$target" 2>/dev/null)
    exit_code=$?

    if [ $exit_code -eq 0 ]; then
        rtt=$(echo "$result" | grep -o 'time=[0-9.]*' | cut -d= -f2)
        streak_success=$((streak_success + 1))
        streak_fail=0

        # Require sustained success to flip back to reachable
        if [ "$reachable" = "false" ] && [ $streak_success -ge $RECOVER_THRESHOLD ]; then
            reachable="true"
        elif [ "$reachable" = "true" ]; then
            : # already reachable, stay reachable
        fi
    else
        rtt="null"
        streak_fail=$((streak_fail + 1))
        streak_success=0

        # Only mark unreachable after sustained failure
        if [ $streak_fail -ge $FAIL_THRESHOLD ]; then
            reachable="false"
        fi
    fi

    # Append to history ring buffer
    echo "$rtt" >> "$HISTORY_FILE"
    tail -n "$HISTORY_SIZE" "$HISTORY_FILE" > "${HISTORY_FILE}.tmp"
    mv "${HISTORY_FILE}.tmp" "$HISTORY_FILE"

    # Compute stats via awk (min, max, avg, jitter from history)
    stats=$(awk '
        /^[0-9]/ {
            n++; sum+=$1;
            if(n==1||$1<min) min=$1;
            if(n==1||$1>max) max=$1;
            if(n>1) jsum += ($1-prev>0 ? $1-prev : prev-$1);
            prev=$1
        }
        END {
            if(n>0) printf "%.1f %.1f %.1f %.1f", min, sum/n, max, (n>1?jsum/(n-1):0);
            else print "0 0 0 0"
        }
    ' "$HISTORY_FILE")

    min_rtt=$(echo "$stats" | awk '{print $1}')
    avg_rtt=$(echo "$stats" | awk '{print $2}')
    max_rtt=$(echo "$stats" | awk '{print $3}')
    jitter=$(echo "$stats" | awk '{print $4}')

    # Build history JSON array
    history_json=$(awk '
        BEGIN { printf "[" }
        NR>1 { printf "," }
        /^[0-9]/ { printf "%.1f", $1 }
        /^null/ { printf "null" }
        END { printf "]" }
    ' "$HISTORY_FILE")

    # Calculate packet loss from history
    loss_pct=$(awk '
        { total++ }
        /^null/ { lost++ }
        END { if(total>0) printf "%d", (lost/total)*100; else print 0 }
    ' "$HISTORY_FILE")

    # Atomic JSON write
    cat > "${CACHE}.tmp" <<EOF
{
  "timestamp": $(date +%s),
  "targets": ["8.8.8.8", "1.1.1.1"],
  "interval_sec": $INTERVAL,
  "last_rtt_ms": $rtt,
  "avg_rtt_ms": $avg_rtt,
  "min_rtt_ms": $min_rtt,
  "max_rtt_ms": $max_rtt,
  "jitter_ms": $jitter,
  "packet_loss_pct": $loss_pct,
  "reachable": $reachable,
  "streak_success": $streak_success,
  "streak_fail": $streak_fail,
  "during_recovery": $during_recovery,
  "history": $history_json
}
EOF
    mv "${CACHE}.tmp" "$CACHE"

    sleep "$INTERVAL"
done
```

### BusyBox Compatibility Notes

- `ping -c1 -W2` — BusyBox `ping` supports both flags.
- `grep -o 'time=[0-9.]*'` — BusyBox `grep` supports `-o`.
- `awk` — BusyBox awk is sufficient for the stats computation.
- No use of `rev`, `seq`, `readarray`, or other missing commands.
- `date +%s` — BusyBox `date` supports epoch output.

---

## 4. Component 2: Watchcat State Machine (`qmanager_watchcat`)

### Purpose

Monitors internet health by reading the ping daemon's output and executes tiered recovery actions when connectivity is lost. The watchcat **never pings on its own** — it is a pure state machine that reads data and makes decisions.

### File Locations

| File | Path |
|------|------|
| Daemon binary | `/usr/bin/qmanager_watchcat` |
| State output | `/tmp/qmanager_watchcat.json` |
| Maintenance lock | `/tmp/qmanager_watchcat.lock` |
| Recovery flag | `/tmp/qmanager_recovery_active` |
| Crash log | `/etc/qmanager/crash.log` |

### State Machine

```
                    ┌───────────────────────────────────┐
                    │                                   │
                    ▼                                   │
              ┌──────────┐   streak_fail == 0     ┌────┴─────┐
         ┌───▶│ MONITOR  │◀──────────────────────│ COOLDOWN │
         │    └────┬─────┘                        └──────────┘
         │         │ streak_fail >= 1                  ▲
         │         ▼                                   │
         │    ┌──────────┐                             │
         │    │ SUSPECT  │   failure_counter++         │
         │    └────┬─────┘                             │
         │         │ failure_counter > threshold        │
         │         ▼                                   │
         │    ┌──────────┐   execute action       ┌────┴─────┐
         │    │ RECOVERY │──────────────────────▶│ COOLDOWN │
         │    └──────────┘                        └──────────┘
         │
         │    ┌──────────┐
         └────│ LOCKED   │◀── /tmp/qmanager_watchcat.lock exists
              └──────────┘
```

| State | Description | Transition Trigger |
|-------|-------------|-------------------|
| `MONITOR` | Passive observation. Reads ping data, all is well. | Default state. Entered when `streak_fail == 0`. |
| `SUSPECT` | Ping failures detected. Increments internal `failure_counter`. | `streak_fail >= 1` (from ping daemon). |
| `RECOVERY` | Failure threshold breached. Executes next escalation tier. | `failure_counter > max_failures` (default: 5). |
| `COOLDOWN` | Post-recovery pause. Ignores ping failures for a grace period. | Recovery action executed. Duration: 60 seconds. |
| `LOCKED` | Maintenance mode. Watchcat sleeps. Doesn't read or act. | `/tmp/qmanager_watchcat.lock` exists (set by NetModing, band switching, or manual maintenance). |

### Escalation Ladder

Recovery actions are tiered from least to most disruptive:

| Tier | Action | Method | Impact |
|------|--------|--------|--------|
| **Tier 1 (Soft)** | Restart network interface | `ifup wan && ifdown wan` | Brief disconnection (~5s). No modem interaction. |
| **Tier 2 (Medium)** | Radio toggle | `qcmd 'AT+CFUN=0'` → wait 5s → `qcmd 'AT+CFUN=1'` | Full radio restart (~15s). Goes through `qcmd` (serialized). |
| **Tier 3 (Hard)** | System reboot | `reboot` | Full restart (~60s). Token-bucket protected. |

### Escalation Rules

- The watchcat starts at Tier 1 and escalates on each consecutive recovery attempt.
- After a successful recovery (ping daemon reports `reachable: true` again), the escalation level resets to Tier 1.
- **Tier 3 token bucket:** Maximum 3 reboots per hour. If exceeded, the watchcat disables itself, writes `"state": "disabled"` to its JSON, and logs a critical error. This prevents bootloops.
- **Tier 2 pre-check:** Before sending `AT+CFUN` commands, the watchcat checks `/tmp/qmanager_long_running`. If a long scan is active, it skips Tier 2 and escalates to Tier 3 (or waits, depending on configuration).

### Recovery Flow (Detailed)

```
1. Watchcat reads /tmp/qmanager_ping.json
2. streak_fail > threshold → enter RECOVERY
3. Set /tmp/qmanager_recovery_active (so ping daemon tags samples)
4. Execute current tier action:
   - Tier 1: ifup/ifdown (no modem lock needed)
   - Tier 2: qcmd 'AT+CFUN=0' → sleep 5 → qcmd 'AT+CFUN=1'
   - Tier 3: log to crash.log → reboot
5. Clear /tmp/qmanager_recovery_active
6. Enter COOLDOWN for 60 seconds
7. After cooldown:
   - If reachable → back to MONITOR, reset escalation
   - If still unreachable → increment tier, back to RECOVERY
```

### State Output (`/tmp/qmanager_watchcat.json`)

```json
{
  "timestamp": 1707900000,
  "state": "monitor",
  "failure_count": 0,
  "current_tier": 1,
  "last_recovery_action": null,
  "last_recovery_time": null,
  "reboots_this_hour": 0,
  "cooldown_remaining_sec": 0,
  "enabled": true
}
```

### Interaction with Other Actors

**With `qcmd` (serial port gatekeeper):**
The watchcat is one of the three competing actors for modem access. It only needs the modem for Tier 2 recovery (`AT+CFUN` commands). These go through `qcmd` like everything else — the watchcat waits its turn in the flock queue. The "sip, don't gulp" poller strategy ensures gaps for the watchcat to slip in.

**With the poller:**
The poller reads `/tmp/qmanager_watchcat.json` and includes a `watchcat` section in the main status cache. The poller also checks `/tmp/qmanager_recovery_active` — during recovery, it can annotate its JSON with `system_state: "recovery_in_progress"` so the frontend shows an appropriate indicator instead of confusing the user with signal drops.

**With NetModing (band switching):**
NetModing scripts set `/tmp/qmanager_watchcat.lock` before applying band changes (which cause intentional disconnections). The watchcat sees this lock and enters LOCKED state, preventing it from interpreting the band-switch disconnection as a failure. The lock is removed after the band change completes.

---

## 5. Component 3: Poller Integration

### Merge Strategy

The poller already writes `/tmp/qmanager_status.json` every ~2 seconds. Rather than forcing the frontend to fetch a second file, the poller reads the ping daemon's output each cycle and merges it into the existing status JSON.

### What the Poller Does Each Cycle

```
poll_cycle() {
    # ... existing modem polling (Tier 1 / Tier 2) ...

    # Read ping daemon output (no modem lock needed)
    read_ping_data

    # Read watchcat state (no modem lock needed)
    read_watchcat_data

    # Merge everything into status JSON
    write_cache
}

read_ping_data() {
    if [ -f /tmp/qmanager_ping.json ]; then
        # Extract fields from ping JSON (jq not available, use grep/awk)
        ping_reachable=$(grep '"reachable"' /tmp/qmanager_ping.json | ...)
        ping_latency=$(grep '"last_rtt_ms"' /tmp/qmanager_ping.json | ...)
        ping_avg=$(grep '"avg_rtt_ms"' /tmp/qmanager_ping.json | ...)
        # ... etc
        ping_history=$(grep '"history"' /tmp/qmanager_ping.json | ...)
    else
        ping_reachable="null"
        ping_latency="null"
        # ... defaults
    fi
}
```

### Cross-Referencing: Intelligent Status Derivation

The poller can cross-reference modem state with ping data to produce richer status information:

| Modem State | Ping State | Interpretation |
|-------------|------------|----------------|
| `CONNECT` + good signal | `reachable: true` | Everything working normally |
| `CONNECT` + good signal | `reachable: false` | Likely APN issue, upstream problem, or DNS failure |
| `NOCONN` (registered, idle) | `reachable: true` | Unusual but possible (data bearer established despite idle modem state) |
| `NOCONN` | `reachable: false` | Expected — no data bearer means no internet |
| `SEARCH` | any | No service — modem not registered |
| Modem unreachable | any | Hardware-level issue — modem unresponsive |

The poller writes these as the `connectivity.status` field (see Section 8).

---

## 6. Component 4: Frontend Consumers

### Consumer 1: Internet Status Badge (Network Status Component)

**Current state:** `hasInternet = isServiceActive` (placeholder, not based on actual reachability).

**New state:** `hasInternet = data?.connectivity?.internet_available ?? false`

The badge reads the merged `connectivity` section from the existing status JSON. No new fetch needed. No new hook needed. Just a prop change.

| `internet_available` | Badge Display |
|---|---|
| `true` | 🟢 "Internet" (green cloud icon) |
| `false` | 🔴 "Internet" (red cloud icon) |
| `null` (ping daemon not running) | ⚪ "Internet" (gray cloud icon, unknown) |

### Consumer 2: Live Latency Component

**Data source:** `data.connectivity.latency_ms` (current value) and `data.connectivity.latency_history` (array of last 60 RTTs).

The component displays:
- Current latency as a large number with ms unit
- A mini sparkline or line chart using the `latency_history` array
- Min/max/avg/jitter as secondary metrics
- Packet loss percentage
- Color coding: green (<50ms), yellow (50-100ms), red (>100ms)

**History is server-side, not client-side.** Unlike Signal History (which accumulates client-side from polling snapshots), latency history comes pre-built from the ping daemon. The frontend just renders it. This means:
- Page refresh doesn't lose history (it's persisted in the ping daemon's ring buffer)
- No client-side ring buffer needed
- History length is consistent (always 60 samples = 2 minutes)

### Consumer 3: Watchcat Status (Optional Debug Info)

**Data source:** `data.watchcat` from the merged status JSON.

Useful for advanced users and debugging. Could be shown in Device Metrics or as a separate indicator:
- Current state: MONITOR / SUSPECT / RECOVERY / COOLDOWN / LOCKED
- Failure count
- Current escalation tier
- Last recovery action and time
- Reboots this hour
- Cooldown remaining

---

## 7. Lock File Registry

A complete, disambiguated list of every lock and flag file in the system. This is the authoritative reference — no new lock files should be created without adding them here.

| File | Type | Purpose | Who Sets | Who Reads |
|------|------|---------|----------|-----------|
| `/var/lock/qmanager.lock` | flock mutex | Serial port serialization | `qcmd` (via flock) | `qcmd` (via flock) |
| `/var/lock/qmanager.pid` | PID file | Stale lock detection for serial port | `qcmd` | `qcmd` |
| `/tmp/qmanager_long_running` | Presence flag | Long AT command in progress (QSCAN, etc.) | `qcmd` | Poller (skips modem), Watchcat (skips Tier 2) |
| `/tmp/qmanager_watchcat.lock` | Presence flag | Maintenance mode — watchcat should sleep | NetModing scripts, manual maintenance | Watchcat only |
| `/tmp/qmanager_recovery_active` | Presence flag | Watchcat is executing a recovery action | Watchcat | Ping daemon (tags samples), Poller (annotates JSON) |

### Critical Rename

The Watchcat Architecture Guide specifies `/tmp/qmanager.lock` for the watchcat's LOCKED state. This has been **renamed** to `/tmp/qmanager_watchcat.lock` to prevent confusion with the serial port lock at `/var/lock/qmanager.lock`. All scripts referencing the watchcat lock must use the new path.

---

## 8. JSON Data Contract Additions

These sections are added to the existing `/tmp/qmanager_status.json` schema. All existing fields remain unchanged.

### `connectivity` Section

Added by the poller by reading `/tmp/qmanager_ping.json` each cycle.

```json
{
  "connectivity": {
    "internet_available": true,
    "status": "connected",
    "latency_ms": 34.2,
    "avg_latency_ms": 37.1,
    "min_latency_ms": 28.5,
    "max_latency_ms": 52.3,
    "jitter_ms": 4.8,
    "packet_loss_pct": 0,
    "ping_target": "8.8.8.8",
    "latency_history": [34.2, 35.1, null, 33.8, 36.0],
    "history_interval_sec": 2,
    "history_size": 60,
    "during_recovery": false
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `internet_available` | `boolean \| null` | `true` if ping daemon reports reachable. `null` if ping daemon not running. |
| `status` | `string` | Derived status: `"connected"`, `"degraded"` (high loss), `"disconnected"`, `"unknown"` (no ping data), `"recovery"` (watchcat acting). |
| `latency_ms` | `number \| null` | Most recent RTT in milliseconds. `null` if last ping failed. |
| `avg_latency_ms` | `number \| null` | Rolling average from history window. |
| `min_latency_ms` | `number \| null` | Minimum RTT in history window. |
| `max_latency_ms` | `number \| null` | Maximum RTT in history window. |
| `jitter_ms` | `number \| null` | Average inter-packet RTT variation. |
| `packet_loss_pct` | `number` | Percentage of failed pings in history window. 0-100. |
| `ping_target` | `string` | Currently active ping target (for display). |
| `latency_history` | `array` | Ring buffer of last N RTT values. `null` entries = failed pings. |
| `history_interval_sec` | `number` | Seconds between history samples. |
| `history_size` | `number` | Maximum entries in history array. |
| `during_recovery` | `boolean` | `true` if watchcat recovery is currently active. |

### `connectivity.status` Derivation

| Condition | Status |
|-----------|--------|
| `internet_available == true` and `packet_loss_pct < 10` | `"connected"` |
| `internet_available == true` and `packet_loss_pct >= 10` | `"degraded"` |
| `internet_available == false` | `"disconnected"` |
| `during_recovery == true` | `"recovery"` |
| Ping daemon not running / no data | `"unknown"` |

### `watchcat` Section

Added by the poller by reading `/tmp/qmanager_watchcat.json` each cycle.

```json
{
  "watchcat": {
    "state": "monitor",
    "enabled": true,
    "failure_count": 0,
    "current_tier": 1,
    "last_recovery_action": null,
    "last_recovery_time": null,
    "reboots_this_hour": 0,
    "cooldown_remaining_sec": 0
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `state` | `string` | `"monitor"`, `"suspect"`, `"recovery"`, `"cooldown"`, `"locked"`, `"disabled"` |
| `enabled` | `boolean` | Whether watchcat is active. `false` if disabled by bootloop protection. |
| `failure_count` | `number` | Current consecutive failure count in SUSPECT state. |
| `current_tier` | `number` | Next recovery action tier (1, 2, or 3). |
| `last_recovery_action` | `string \| null` | `"interface_restart"`, `"radio_toggle"`, `"reboot"`, or `null`. |
| `last_recovery_time` | `number \| null` | Unix timestamp of last recovery action. |
| `reboots_this_hour` | `number` | Reboot count in the current hour (for token bucket). |
| `cooldown_remaining_sec` | `number` | Seconds remaining in cooldown. 0 if not in cooldown. |

### TypeScript Interface Additions

```typescript
// Add to types/modem-status.ts

export interface ConnectivityStatus {
  internet_available: boolean | null;
  status: "connected" | "degraded" | "disconnected" | "recovery" | "unknown";
  latency_ms: number | null;
  avg_latency_ms: number | null;
  min_latency_ms: number | null;
  max_latency_ms: number | null;
  jitter_ms: number | null;
  packet_loss_pct: number;
  ping_target: string;
  latency_history: (number | null)[];
  history_interval_sec: number;
  history_size: number;
  during_recovery: boolean;
}

export interface WatchcatStatus {
  state: "monitor" | "suspect" | "recovery" | "cooldown" | "locked" | "disabled";
  enabled: boolean;
  failure_count: number;
  current_tier: number;
  last_recovery_action: "interface_restart" | "radio_toggle" | "reboot" | null;
  last_recovery_time: number | null;
  reboots_this_hour: number;
  cooldown_remaining_sec: number;
}

// Add to ModemStatus interface
export interface ModemStatus {
  // ... existing fields ...
  connectivity: ConnectivityStatus;
  watchcat: WatchcatStatus;
}
```

---

## 9. Init System & Process Management

### Three Daemons, One Init Script

All three daemons are managed by a single procd init script with separate instances. This allows independent restart/respawn while keeping management simple.

```sh
#!/bin/sh /etc/rc.common
# /etc/init.d/qmanager

START=99
USE_PROCD=1

start_service() {
    # 1. Ping daemon (starts first — no dependencies)
    procd_open_instance "ping"
    procd_set_param command /usr/bin/qmanager_ping
    procd_set_param respawn 3600 5 5
    procd_set_param stdout 1
    procd_set_param stderr 1
    procd_close_instance

    # 2. Poller daemon (needs ping data for connectivity section)
    procd_open_instance "poller"
    procd_set_param command /usr/bin/qmanager_poller
    procd_set_param respawn 3600 5 5
    procd_set_param stdout 1
    procd_set_param stderr 1
    procd_close_instance

    # 3. Watchcat daemon (needs ping data for health decisions)
    procd_open_instance "watchcat"
    procd_set_param command /usr/bin/qmanager_watchcat
    procd_set_param respawn 3600 5 5
    procd_set_param stdout 1
    procd_set_param stderr 1
    procd_close_instance
}
```

### Startup Order

| Order | Daemon | Why This Order |
|-------|--------|---------------|
| 1 | `qmanager_ping` | No dependencies. Produces data others consume. |
| 2 | `qmanager_poller` | Reads ping data to populate `connectivity` section. |
| 3 | `qmanager_watchcat` | Reads ping data for health decisions. Needs poller running so status cache exists. |

### Process Management

```bash
# Restart everything
/etc/init.d/qmanager restart

# Restart only the ping daemon (if it misbehaves)
# procd instances can be individually controlled:
kill $(pgrep -f qmanager_ping)   # procd auto-respawns it

# Check all three are running
ps | grep qmanager
# Should show: qmanager_ping, qmanager_poller, qmanager_watchcat
```

### Respawn Configuration

`procd_set_param respawn 3600 5 5` means:
- **3600:** Respawn threshold period (1 hour)
- **5:** Minimum seconds between respawns
- **5:** Maximum respawn attempts within threshold period

If a daemon crashes 5 times within an hour, procd stops respawning it. This prevents runaway restarts.

---

## 10. Edge Cases & Mitigations

### 10.1 Ping Target Unreachable vs. Internet Down

**Risk:** If the sole ping target (e.g., Google DNS) has an outage, the watchcat triggers recovery for no reason.

**Mitigation:** Dual-target pinging. The daemon alternates between 8.8.8.8 and 1.1.1.1. `reachable` is `true` if *either* responds. Both must fail for the system to consider internet down. Configurable targets allow the user to add their own (e.g., their ISP's DNS).

### 10.2 Ping During Watchcat Recovery

**Risk:** When the watchcat executes Tier 1 (ifup/ifdown), the interface goes down for ~5 seconds. The ping daemon records failures during this window. On the next watchcat cycle, it sees the new failures and immediately escalates to Tier 2, creating a cascade.

**Mitigation:** Two-layer protection:
1. The watchcat sets `/tmp/qmanager_recovery_active` before starting any action. The ping daemon marks samples during this period as recovery-related.
2. The watchcat enters COOLDOWN for 60 seconds after any action. During cooldown, it ignores all ping failures and waits for the network to stabilize.

### 10.3 Long Scan Conflicts

**Risk:** AT+QSCAN holds the modem lock for 2-3 minutes. If the watchcat needs to execute Tier 2 (AT+CFUN) during a scan, it queues behind the lock and times out.

**Mitigation:** Before Tier 2, the watchcat checks `/tmp/qmanager_long_running`. If present, it either:
- Waits for the scan to complete (check every 10s for flag removal)
- Skips Tier 2 and escalates to Tier 3 (configurable behavior)

### 10.4 Ping Daemon Crash

**Risk:** If `qmanager_ping` crashes, `/tmp/qmanager_ping.json` goes stale. The watchcat keeps reading old data and never triggers recovery. The internet badge shows outdated status.

**Mitigation:** Both the watchcat and poller check the `timestamp` field in the ping JSON. If the timestamp is older than `3 × interval_sec` (6 seconds by default), the data is considered stale:
- Poller sets `connectivity.internet_available: null` and `connectivity.status: "unknown"`
- Watchcat enters a "ping daemon missing" state and falls back to running its own emergency pings (simple `ping -c1`) until the daemon recovers via procd respawn

### 10.5 BusyBox `ping` Output Variations

**Risk:** BusyBox `ping` output format may differ across versions or when DNS resolution fails.

**Mitigation:**
- Always use IP addresses as targets (no DNS resolution needed)
- Parse RTT from single-packet output only (`time=X.X ms` pattern)
- If the pattern doesn't match, treat as failure (`rtt=null`)
- Never rely on the summary line (which may not appear with `-c1`)

### 10.6 Metered Connection — ICMP Volume

**Risk:** One ping every 2 seconds = ~43,200 pings/day. Each ICMP echo is ~64 bytes → ~5.5 MB/day. On an unlimited 5G plan this is negligible. On a metered plan it could matter.

**Mitigation:** The ping interval is configurable via UCI (2s, 5s, 10s, 30s). The user can also disable pinging entirely, which disables the internet badge, latency display, and watchcat simultaneously. The frontend shows "Ping disabled" in place of latency data.

### 10.7 Latency History for Long-Term Analysis

**Risk:** The 60-entry ring buffer (2 minutes) is insufficient for a 24-hour latency histogram.

**Mitigation:** This is a future concern, not a launch blocker. When the histogram is implemented, a separate aggregation process will write minute-level summaries to a second file (`/tmp/qmanager_ping_hourly.json`). The current 60-entry buffer stays as-is for the Live Latency sparkline. The histogram reads the aggregated file.

---

## 11. Configuration (UCI)

All ping and watchcat settings are stored in UCI for persistence across reboots.

```
# /etc/config/qmanager

config ping 'ping'
    option enabled '1'
    option target1 '8.8.8.8'
    option target2 '1.1.1.1'
    option interval '2'
    option fail_threshold '3'
    option recover_threshold '2'
    option history_size '60'

config watchcat 'watchcat'
    option enabled '1'
    option check_interval '10'
    option max_failures '5'
    option cooldown_sec '60'
    option tier2_scan_behavior 'wait'
    option max_reboots_per_hour '3'
```

| Setting | Default | Description |
|---------|---------|-------------|
| `ping.enabled` | `1` | Enable/disable the ping daemon. Disabling also disables internet badge, latency, and watchcat. |
| `ping.target1` | `8.8.8.8` | Primary ping target (Google DNS). |
| `ping.target2` | `1.1.1.1` | Secondary ping target (Cloudflare DNS). |
| `ping.interval` | `2` | Seconds between pings. |
| `ping.fail_threshold` | `3` | Consecutive failures before `reachable` flips to `false`. |
| `ping.recover_threshold` | `2` | Consecutive successes before `reachable` flips back to `true`. |
| `ping.history_size` | `60` | Number of RTT samples in ring buffer. |
| `watchcat.enabled` | `1` | Enable/disable the watchcat. Can be disabled independently of ping. |
| `watchcat.check_interval` | `10` | Seconds between watchcat reads of ping data. |
| `watchcat.max_failures` | `5` | Failure count threshold before triggering recovery. |
| `watchcat.cooldown_sec` | `60` | Seconds to wait after recovery before evaluating again. |
| `watchcat.tier2_scan_behavior` | `wait` | Behavior when long scan is active: `"wait"` (wait for scan) or `"skip"` (escalate to Tier 3). |
| `watchcat.max_reboots_per_hour` | `3` | Token bucket limit for Tier 3 reboots. |

---

## 12. Implementation Build Order

Each step is independently testable before the next depends on it.

### Phase 1: Ping Daemon

1. **Rename watchcat lock file** — Search all existing scripts and documentation for `/tmp/qmanager.lock` references in watchcat context. Rename to `/tmp/qmanager_watchcat.lock`. This prevents the lock file collision before any new code is written.

2. **Build `qmanager_ping`** — Implement the unified ping daemon. Start with single-target pinging, atomic JSON writes, RTT extraction, streak counting, and the history ring buffer. Test on the modem by running it manually and checking `/tmp/qmanager_ping.json`.

3. **Verify BusyBox compatibility** — Run the daemon on the actual modem. Confirm `ping -c1 -W2`, `grep -o`, `awk` stats computation, and `date +%s` all work. Fix any BusyBox quirks before proceeding.

### Phase 2: Poller Integration

4. **Add `read_ping_data()` to poller** — The poller reads `/tmp/qmanager_ping.json` each cycle and extracts fields into shell variables. Handles missing/stale ping file gracefully.

5. **Extend JSON contract** — Add the `connectivity` section to `qmanager_status.json` output. Update `types/modem-status.ts` with `ConnectivityStatus` interface.

6. **Wire the Internet badge** — Replace `hasInternet = isServiceActive` with `data?.connectivity?.internet_available` in `network-status.tsx`. Deploy and verify the badge reflects actual ping results.

### Phase 3: Live Latency Component

7. **Build the Live Latency component** — Renders `connectivity.latency_ms` (big number), `connectivity.latency_history` (sparkline/chart), and secondary stats (min/max/avg/jitter/loss). Uses the existing `useModemStatus()` hook — no new data fetching.

### Phase 4: Watchcat

8. **Build `qmanager_watchcat`** — Implement the state machine. Start with MONITOR/SUSPECT states only (read ping data, count failures, log warnings). No recovery actions yet.

9. **Add Tier 1 recovery** — Implement ifup/ifdown with the recovery flag and cooldown. Test by blocking ping targets via iptables and verifying the watchcat restarts the interface.

10. **Add Tier 2 recovery** — Implement `AT+CFUN` toggle via `qcmd`. Verify it goes through the serial port gatekeeper correctly and the poller yields during the toggle.

11. **Add Tier 3 recovery** — Implement reboot with token bucket protection. Test the bootloop guard (crash log + 3/hour limit).

12. **Add watchcat state to poller** — The poller reads `/tmp/qmanager_watchcat.json` and includes `watchcat` section in status JSON. Wire optional watchcat status display in the frontend.

### Phase 5: Polish

13. **UCI configuration** — Read ping interval, targets, thresholds, and watchcat settings from `/etc/config/qmanager` instead of hardcoded values.

14. **Update init script** — Extend `/etc/init.d/qmanager` with three procd instances.

15. **Dual-target pinging** — Upgrade from single to alternating dual-target.

16. **Frontend settings page** — Allow users to configure ping targets, intervals, and watchcat behavior from the UI (write-path CGI endpoint).

---

*End of Document*

QManager Connectivity Architecture v1.0
