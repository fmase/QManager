#!/bin/sh
# =============================================================================
# debug_email_alerts.sh — Diagnostic script for email alerts + event detection
# =============================================================================
# Runs a complete CFUN=0 → wait → CFUN=1 simulation while capturing all
# relevant poller state, logs, and connectivity transitions.
#
# Usage: sh /tmp/debug_email_alerts.sh
# Output: /tmp/email_debug_report.txt
# =============================================================================

REPORT="/tmp/email_debug_report.txt"
DOWNTIME_SECS=90  # How long to keep CFUN=0 (must exceed threshold + debounce)

# Use qcmd for AT commands
QCMD="qcmd"

log() {
    printf "[%s] %s\n" "$(date '+%H:%M:%S')" "$1"
    printf "[%s] %s\n" "$(date '+%H:%M:%S')" "$1" >> "$REPORT"
}

section() {
    printf "\n=== %s ===\n" "$1"
    printf "\n=== %s ===\n" "$1" >> "$REPORT"
}

# Clear previous report
: > "$REPORT"

echo "Email Alerts Debug Script v2"
echo "============================"
echo "Report will be saved to: $REPORT"
echo ""

# =========================================================================
# PHASE 1: Pre-flight checks
# =========================================================================
section "PHASE 1: Pre-flight checks"

# 1a. LONG_FLAG check
log "Checking LONG_FLAG (/tmp/qmanager_long_running)..."
if [ -f /tmp/qmanager_long_running ]; then
    log "!!! LONG_FLAG EXISTS — events + email alerts run but AT commands skip"
    ls -la /tmp/qmanager_long_running >> "$REPORT" 2>&1
else
    log "No LONG_FLAG — OK"
fi

# 1b. All qmanager processes (check for duplicates!)
log "All qmanager processes:"
ps 2>/dev/null | grep qmanager | grep -v grep >> "$REPORT" 2>&1
ping_count=$(ps 2>/dev/null | grep qmanager_ping | grep -v grep | wc -l)
poller_count=$(ps 2>/dev/null | grep qmanager_poller | grep -v grep | wc -l)
log "  Ping daemons: $ping_count (expect 1)"
log "  Pollers: $poller_count (expect 1)"
if [ "$ping_count" -gt 1 ]; then
    log "  !!! DUPLICATE PING DAEMONS — may cause cache corruption"
fi
if [ "$poller_count" -gt 1 ]; then
    log "  !!! DUPLICATE POLLERS"
fi

# 1c. PID file check (new in v2)
log "Checking ping PID file..."
if [ -f /tmp/qmanager_ping.pid ]; then
    pid_val=$(cat /tmp/qmanager_ping.pid 2>/dev/null)
    if kill -0 "$pid_val" 2>/dev/null; then
        log "  PID file: $pid_val (alive) — OK"
    else
        log "  PID file: $pid_val (STALE — process not running)"
    fi
else
    log "  No PID file (ping daemon may be old version without PID lock)"
fi

# 1d. Email alerts library on device
log "Checking email alerts library..."
if [ -f /usr/lib/qmanager/email_alerts.sh ]; then
    log "Library exists: $(ls -la /usr/lib/qmanager/email_alerts.sh 2>&1)"
    # Verify it has the jq fix (key diagnostic)
    if grep -q 'if \. == null then' /usr/lib/qmanager/email_alerts.sh 2>/dev/null; then
        log "  jq null-safe pattern present — OK"
    else
        log "  !!! May have old jq // pattern — check for boolean bug"
    fi
else
    log "!!! Library NOT found at /usr/lib/qmanager/email_alerts.sh"
fi

# 1e. Poller has email alerts integration + jq fix
log "Checking poller version..."
if [ -f /usr/bin/qmanager_poller ]; then
    # Check for the jq fix (THE critical fix)
    if grep -q 'if \. == null then "null" else tostring end' /usr/bin/qmanager_poller 2>/dev/null; then
        log "  Poller has jq boolean-safe fix — OK"
    elif grep -q '.reachable // "null"' /usr/bin/qmanager_poller 2>/dev/null; then
        log "  !!! POLLER HAS OLD JQ BUG: .reachable // \"null\" converts false→null!"
        log "  !!! This is the ROOT CAUSE — deploy updated poller first"
    fi
    # Check for reordered poll_cycle (check_email_alert before AT commands)
    first_ea=$(grep -n 'check_email_alert\|poll_serving_cell' /usr/bin/qmanager_poller 2>/dev/null | head -2)
    log "  Execution order check: $first_ea"
    ea_refs=$(grep -c "check_email_alert\|email_alerts_init" /usr/bin/qmanager_poller 2>/dev/null)
    log "  Email alert references in poller: $ea_refs"
fi

# 1f. Email alerts config
log "Checking email alerts config..."
if [ -f /etc/qmanager/email_alerts.json ]; then
    jq '{enabled, sender_email, recipient_email, has_password: (.app_password | length > 0), threshold_minutes}' \
        /etc/qmanager/email_alerts.json >> "$REPORT" 2>&1
    threshold=$(jq -r '.threshold_minutes' /etc/qmanager/email_alerts.json 2>/dev/null)
    enabled=$(jq -r '.enabled' /etc/qmanager/email_alerts.json 2>/dev/null)
    log "  enabled=$enabled, threshold=${threshold}m"
    if [ "$enabled" != "true" ]; then
        log "  !!! Email alerts are DISABLED — enable in UI first"
    fi
else
    log "!!! No config file at /etc/qmanager/email_alerts.json"
fi

# 1g. msmtp config
log "Checking msmtp config..."
if [ -f /etc/qmanager/msmtprc ]; then
    log "msmtprc exists ($(wc -c < /etc/qmanager/msmtprc) bytes)"
    grep -c "tls_trust_file" /etc/qmanager/msmtprc > /dev/null 2>&1 && \
        log "  tls_trust_file present — OK" || \
        log "  !!! tls_trust_file MISSING — re-save settings in UI"
else
    log "!!! msmtprc NOT found — save settings in UI to generate it"
fi

# 1h. Current connectivity state — THE KEY DIAGNOSTIC
section "PHASE 1.5: Connectivity state verification"

log "Reading raw ping daemon output..."
if [ -f /tmp/qmanager_ping.json ]; then
    jq '.' /tmp/qmanager_ping.json >> "$REPORT" 2>&1
    raw_reachable=$(jq -r '.reachable' /tmp/qmanager_ping.json 2>/dev/null)
    raw_type=$(jq -r '.reachable | type' /tmp/qmanager_ping.json 2>/dev/null)
    log "  ping.reachable = $raw_reachable (type: $raw_type)"
else
    log "!!! Ping cache not found"
fi

log "Reading poller cache connectivity..."
if [ -f /tmp/qmanager_status.json ]; then
    jq '.connectivity | {internet_available, status, packet_loss}' \
        /tmp/qmanager_status.json >> "$REPORT" 2>&1
    inet=$(jq -r '.connectivity.internet_available' /tmp/qmanager_status.json 2>/dev/null)
    log "  cache.internet_available = $inet"

    # THE KEY CHECK: does poller correctly map ping.reachable to internet_available?
    if [ "$raw_reachable" = "true" ] && [ "$inet" = "true" ]; then
        log "  Mapping: ping=true → cache=true — CORRECT"
    elif [ "$raw_reachable" = "false" ] && [ "$inet" = "false" ]; then
        log "  Mapping: ping=false → cache=false — CORRECT (jq fix working!)"
    elif [ "$raw_reachable" = "false" ] && [ "$inet" = "null" ]; then
        log "  !!! Mapping: ping=false → cache=null — JQ BUG STILL PRESENT"
        log "  !!! Deploy updated poller with boolean-safe jq pattern"
    else
        log "  Mapping: ping=$raw_reachable → cache=$inet (check stale threshold)"
    fi
else
    log "!!! Poller cache not found at /tmp/qmanager_status.json"
fi

# =========================================================================
# PHASE 2: Baseline capture
# =========================================================================
section "PHASE 2: Baseline capture"

log "Saving logread baseline..."
logread > /tmp/debug_logread_before.txt 2>/dev/null
before_lines=$(wc -l < /tmp/debug_logread_before.txt 2>/dev/null)
log "Baseline logread: $before_lines lines"

log "Saving msmtp.log baseline..."
if [ -f /tmp/msmtp.log ]; then
    cp /tmp/msmtp.log /tmp/debug_msmtp_before.txt
    before_msmtp=$(wc -l < /tmp/debug_msmtp_before.txt 2>/dev/null)
    log "Baseline msmtp.log: $before_msmtp lines"
else
    : > /tmp/debug_msmtp_before.txt
    log "No existing msmtp.log"
fi

log "Events file state:"
if [ -f /tmp/qmanager_events.json ]; then
    evt_count=$(wc -l < /tmp/qmanager_events.json 2>/dev/null)
    log "  $evt_count events in file"
    cp /tmp/qmanager_events.json /tmp/debug_events_before.txt 2>/dev/null
else
    log "  No events file"
    : > /tmp/debug_events_before.txt
fi

# =========================================================================
# PHASE 3: Simulate downtime
# =========================================================================
section "PHASE 3: Simulating ${DOWNTIME_SECS}s downtime"

log "Disconnecting modem (AT+CFUN=0)..."
$QCMD 'AT+CFUN=0' >> "$REPORT" 2>&1
log "CFUN=0 sent"

# Sample connectivity state during downtime
elapsed=0
sample_interval=10
while [ "$elapsed" -lt "$DOWNTIME_SECS" ]; do
    sleep "$sample_interval"
    elapsed=$((elapsed + sample_interval))

    # Read raw ping daemon cache
    ping_reach="N/A"
    ping_streak_f="?"
    if [ -f /tmp/qmanager_ping.json ]; then
        ping_reach=$(jq -r '.reachable' /tmp/qmanager_ping.json 2>/dev/null)
        ping_streak_f=$(jq -r '.streak_fail' /tmp/qmanager_ping.json 2>/dev/null)
    fi

    # Read poller cache
    inet="N/A"
    if [ -f /tmp/qmanager_status.json ]; then
        inet=$(jq -r '.connectivity.internet_available' /tmp/qmanager_status.json 2>/dev/null)
    fi

    log "  T+${elapsed}s: ping.reachable=$ping_reach (fail_streak=$ping_streak_f) → cache.internet=$inet"

    # Check LONG_FLAG
    if [ -f /tmp/qmanager_long_running ]; then
        log "  !!! LONG_FLAG appeared during test"
    fi

    # Check for new poller log lines (indicates poller is alive)
    new_poller_lines=$(logread 2>/dev/null | grep "qm_poller" | wc -l)
    baseline_poller_lines=$(grep "qm_poller" /tmp/debug_logread_before.txt 2>/dev/null | wc -l)
    delta=$((new_poller_lines - baseline_poller_lines))
    log "  Poller log delta: +$delta lines (0 = poller may be stuck on AT cmds)"
done

log "Reconnecting modem (AT+CFUN=1)..."
$QCMD 'AT+CFUN=1' >> "$REPORT" 2>&1
log "CFUN=1 sent — waiting 30s for recovery detection..."

# Sample during recovery
for i in 1 2 3; do
    sleep 10
    ping_reach="N/A"
    inet="N/A"
    if [ -f /tmp/qmanager_ping.json ]; then
        ping_reach=$(jq -r '.reachable' /tmp/qmanager_ping.json 2>/dev/null)
    fi
    if [ -f /tmp/qmanager_status.json ]; then
        inet=$(jq -r '.connectivity.internet_available' /tmp/qmanager_status.json 2>/dev/null)
    fi
    log "  Recovery T+${i}0s: ping.reachable=$ping_reach → cache.internet=$inet"
done

# =========================================================================
# PHASE 4: Collect results
# =========================================================================
section "PHASE 4: Results"

# 4a. New log messages (diff)
log "New log messages (email/event/internet/alert/recover):"
logread > /tmp/debug_logread_after.txt 2>/dev/null
diff /tmp/debug_logread_before.txt /tmp/debug_logread_after.txt 2>/dev/null | \
    grep "^>" | grep -i "email\|event\|internet\|alert\|signal\|recover\|downtime\|reachable" >> "$REPORT" 2>&1
new_email=$(diff /tmp/debug_logread_before.txt /tmp/debug_logread_after.txt 2>/dev/null | \
    grep "^>" | grep -ic "email")
new_event=$(diff /tmp/debug_logread_before.txt /tmp/debug_logread_after.txt 2>/dev/null | \
    grep "^>" | grep -ic "event\|internet\|signal\|reachable")
log "  New email-related log lines: $new_email"
log "  New event-related log lines: $new_event"

# ALL new poller log lines
section "ALL new poller log lines"
diff /tmp/debug_logread_before.txt /tmp/debug_logread_after.txt 2>/dev/null | \
    grep "^>" | grep "qm_poller\|qm_ping" >> "$REPORT" 2>&1
new_poller=$(diff /tmp/debug_logread_before.txt /tmp/debug_logread_after.txt 2>/dev/null | \
    grep "^>" | grep -c "qm_poller\|qm_ping")
log "  Total new poller/ping log lines: $new_poller"

# 4b. msmtp.log changes
log "msmtp.log changes:"
if [ -f /tmp/msmtp.log ]; then
    diff /tmp/debug_msmtp_before.txt /tmp/msmtp.log 2>/dev/null | grep "^>" >> "$REPORT" 2>&1
    new_msmtp=$(diff /tmp/debug_msmtp_before.txt /tmp/msmtp.log 2>/dev/null | grep -c "^>")
    log "  New msmtp.log entries: $new_msmtp"
else
    new_msmtp=0
    log "  No msmtp.log"
fi

# 4c. Email alert log
log "Email alert log:"
if [ -f /tmp/qmanager_email_log.json ]; then
    cat /tmp/qmanager_email_log.json >> "$REPORT" 2>&1
    log "  $(wc -l < /tmp/qmanager_email_log.json) entries"
else
    log "  No email log file"
fi

# 4d. Network events — check for internet_lost/restored
log "Network events (internet/signal):"
if [ -f /tmp/qmanager_events.json ]; then
    new_events=$(diff /tmp/debug_events_before.txt /tmp/qmanager_events.json 2>/dev/null | grep "^>" | wc -l)
    log "  New events since test: $new_events"
    grep -i "internet\|signal" /tmp/qmanager_events.json >> "$REPORT" 2>&1
else
    log "  No events file"
fi

# 4e. Final poller cache state
log "Final poller cache connectivity:"
if [ -f /tmp/qmanager_status.json ]; then
    jq '.connectivity' /tmp/qmanager_status.json >> "$REPORT" 2>&1
fi

# 4f. msmtp error log
log "msmtp last error log:"
if [ -f /tmp/msmtp_last_err.log ]; then
    cat /tmp/msmtp_last_err.log >> "$REPORT" 2>&1
else
    log "  No error log"
fi

# =========================================================================
# Summary
# =========================================================================
section "SUMMARY"

# Quick diagnosis
if grep -q '.reachable // "null"' /usr/bin/qmanager_poller 2>/dev/null; then
    log "DIAGNOSIS: POLLER HAS OLD JQ BUG (root cause)."
    log "  .reachable // \"null\" converts boolean false to string \"null\"."
    log "  Deploy updated poller with: (.reachable) | if . == null then \"null\" else tostring end"
elif [ -f /tmp/qmanager_long_running ]; then
    log "DIAGNOSIS: LONG_FLAG is present. Events skip AT commands but email alerts should still run."
    log "  If email alerts still fail, check library loading."
elif [ "$new_email" -gt 0 ] 2>/dev/null && [ "$new_msmtp" -gt 0 ] 2>/dev/null; then
    log "DIAGNOSIS: SUCCESS! Email alert fired AND msmtp was invoked."
    log "  Check msmtp.log for delivery result."
elif [ "$new_email" -gt 0 ] 2>/dev/null; then
    log "DIAGNOSIS: Email alert logic ran but msmtp was NOT invoked."
    log "  Downtime may have been below threshold (${threshold}m = $((threshold * 60))s)."
    log "  Ping debounce eats ~15s, so effective test time = $((DOWNTIME_SECS - 15))s."
elif [ "$new_event" -gt 0 ] 2>/dev/null; then
    log "DIAGNOSIS: Events fired but email alerts did not."
    log "  Check email_alerts library loading and config."
elif [ "$new_poller" -eq 0 ] 2>/dev/null; then
    log "DIAGNOSIS: ZERO new poller/ping log lines during entire test."
    log "  Poller may be stuck on AT commands (qcmd timeout not working?)."
    log "  Or poller crashed. Check: ps | grep qmanager_poller"
else
    log "DIAGNOSIS: Poller ran but neither events nor email alerts fired."
    log "  Check connectivity transitions in the samples above."
    log "  Expected: ping=false during downtime, cache.internet=false (not null!)"
fi

echo ""
echo "========================================="
echo "Debug complete. Full report saved to:"
echo "  $REPORT"
echo ""
echo "To view: cat $REPORT"
echo "========================================="

# Cleanup temp files
rm -f /tmp/debug_logread_before.txt /tmp/debug_logread_after.txt
rm -f /tmp/debug_msmtp_before.txt /tmp/debug_events_before.txt
