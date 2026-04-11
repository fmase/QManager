#!/bin/sh
# =============================================================================
# sms_alerts.sh - SMS Alert Library for QManager
# =============================================================================
# Sourced by qmanager_poller and CGI scripts. Detects prolonged internet
# downtime and sends SMS notifications via sms_tool on the modem AT channel.
#
# Behavior summary:
# - When downtime exceeds threshold, attempt a "Connection down" SMS.
# - On recovery:
#   - if downtime SMS was sent, send a separate "Connection recovered" SMS.
#   - if downtime SMS was never sent/failed, send one dedup combined SMS.
# - Registration guard is enforced for runtime sends.
#
# Config:  /etc/qmanager/sms_alerts.json
# Log:     /tmp/qmanager_sms_log.json (NDJSON, max 100 entries)
# Reload:  /tmp/qmanager_sms_reload
# Lock:    /tmp/qmanager_at.lock
# =============================================================================

[ -n "$_SMS_ALERTS_LOADED" ] && return 0
_SMS_ALERTS_LOADED=1

# --- Constants ---------------------------------------------------------------
_SA_CONFIG="/etc/qmanager/sms_alerts.json"
_SA_LOG_FILE="/tmp/qmanager_sms_log.json"
_SA_RELOAD_FLAG="/tmp/qmanager_sms_reload"
_SA_LOCK_FILE="/tmp/qmanager_at.lock"
_SA_SMS_TOOL="/usr/bin/sms_tool"
_SA_AT_DEVICE="/dev/smd11"
_SA_MAX_LOG=100

# =============================================================================
# _sa_strip_noise - Filter tcgetattr/tcsetattr diagnostic lines from sms_tool
# =============================================================================
# sms_tool prints these to stdout/stderr whenever /dev/smd11 is a char device
# rather than a real TTY. They are harmless but pollute JSON parsing and
# user-visible output. Always apply to any sms_tool output before use.
_sa_strip_noise() {
    grep -v -e '^tcgetattr(' -e '^tcsetattr(' -e 'Inappropriate ioctl for device$'
}

# --- State (populated by sms_alerts_init / _sa_read_config) ------------------
_sa_enabled="false"
_sa_recipient=""
_sa_threshold_minutes=5

# --- Downtime tracking (poller runtime only) ---------------------------------
_sa_was_down="false"
_sa_downtime_start=0
# Values: "none" | "pending" | "sent" | "failed"
_sa_downtime_sms_status="none"

# =============================================================================
# _sa_flock_wait - BusyBox-compatible flock with timeout (polling loop)
# =============================================================================
# Usage: _sa_flock_wait <fd> <timeout_seconds>
# Returns: 0 = lock acquired, non-zero = timed out
_sa_flock_wait() {
    _fd="$1"
    _wait="$2"
    _elapsed=0

    while [ "$_elapsed" -lt "$_wait" ]; do
        if flock -x -n "$_fd" 2>/dev/null; then
            return 0
        fi
        sleep 1
        _elapsed=$((_elapsed + 1))
    done

    flock -x -n "$_fd" 2>/dev/null
}

# =============================================================================
# _sa_sms_locked - Run sms_tool under shared AT lock
# =============================================================================
# Always targets /dev/smd11 and always strips tcgetattr/tcsetattr noise from
# the returned output, regardless of success/failure.
_sa_sms_locked() {
    [ -e "$_SA_LOCK_FILE" ] || : > "$_SA_LOCK_FILE"

    (
        _sa_flock_wait 9 10 || exit 2
        _sa_raw=$("$_SA_SMS_TOOL" -d "$_SA_AT_DEVICE" "$@" 2>&1)
        _sa_rc=$?
        printf '%s\n' "$_sa_raw" | _sa_strip_noise
        exit "$_sa_rc"
    ) 9<"$_SA_LOCK_FILE"
}

# =============================================================================
# _sa_read_config - Read settings from config JSON
# =============================================================================
_sa_read_config() {
    if [ ! -f "$_SA_CONFIG" ]; then
        _sa_enabled="false"
        return 1
    fi

    _sa_enabled=$(jq -r '(.enabled) | if . == null then "false" else tostring end' "$_SA_CONFIG" 2>/dev/null)
    _sa_recipient=$(jq -r '.recipient_phone // ""' "$_SA_CONFIG" 2>/dev/null)
    _sa_threshold_minutes=$(jq -r '.threshold_minutes // 5' "$_SA_CONFIG" 2>/dev/null)

    if [ "$_sa_enabled" != "true" ]; then
        _sa_enabled="false"
        return 0
    fi
    if [ -z "$_sa_recipient" ]; then
        _sa_enabled="false"
        return 1
    fi

    return 0
}

# =============================================================================
# _sa_is_registered - Is modem currently able to send SMS?
# =============================================================================
_sa_is_registered() {
    [ "$modem_reachable" = "true" ] || return 1

    if [ "$lte_state" = "connected" ] || [ "$nr_state" = "connected" ]; then
        return 0
    fi

    return 1
}

# =============================================================================
# sms_alerts_init - Called once at poller startup
# =============================================================================
sms_alerts_init() {
    _sa_read_config
    if [ "$_sa_enabled" = "true" ]; then
        qlog_info "SMS alerts enabled: recipient=$_sa_recipient threshold=${_sa_threshold_minutes}m"
    else
        qlog_info "SMS alerts disabled or not configured"
    fi
}

# =============================================================================
# check_sms_alert - Called every poll cycle after detect_events
# =============================================================================
check_sms_alert() {
    # No alerts during scheduled low power mode
    [ -f "/tmp/qmanager_low_power_active" ] && return 0

    # Reload config on CGI signal
    if [ -f "$_SA_RELOAD_FLAG" ]; then
        rm -f "$_SA_RELOAD_FLAG"
        _sa_read_config
        qlog_info "SMS alerts config reloaded: enabled=$_sa_enabled"
    fi

    # Disabled / not configured
    [ "$_sa_enabled" != "true" ] && return 0

    # Null/stale ping state: skip only if not tracking.
    if [ "$conn_internet_available" = "null" ] || [ -z "$conn_internet_available" ]; then
        [ "$_sa_was_down" != "true" ] && return 0
        # Already tracking downtime - continue for threshold/pending checks.
    fi

    if [ "$conn_internet_available" = "false" ]; then
        # Enter downtime
        if [ "$_sa_was_down" != "true" ]; then
            _sa_downtime_start=$(date +%s)
            _sa_was_down="true"
            _sa_downtime_sms_status="none"
            qlog_debug "SMS alerts: downtime tracking started at $_sa_downtime_start"
        fi

    elif [ "$conn_internet_available" = "true" ] && [ "$_sa_was_down" = "true" ]; then
        # Recovery path
        now=$(date +%s)
        duration=$((now - _sa_downtime_start))
        dur_text=$(_sa_format_duration "$duration")
        threshold_secs=$((_sa_threshold_minutes * 60))

        qlog_info "SMS alerts: recovery detected - duration=${duration}s status=$_sa_downtime_sms_status"

        if [ "$_sa_downtime_sms_status" = "sent" ]; then
            # Separate recovery SMS
            body="[QManager] Connection recovered (down ${dur_text})"
            trigger="Connection recovered (down ${dur_text})"
            if _sa_do_send "$body"; then
                _sa_log_event "$trigger" "sent" "$_sa_recipient"
            else
                _sa_log_event "$trigger" "failed" "$_sa_recipient"
            fi
        elif [ "$duration" -ge "$threshold_secs" ]; then
            # Dedup path only when outage actually exceeded threshold.
            body="[QManager] Connection was down for ${dur_text}, now restored"
            trigger="Connection was down for ${dur_text}, now restored"
            if _sa_do_send "$body"; then
                _sa_log_event "$trigger" "sent" "$_sa_recipient"
            else
                _sa_log_event "$trigger" "failed" "$_sa_recipient"
            fi
        else
            qlog_info "SMS alerts: recovery below threshold (${duration}s < ${threshold_secs}s) - skipped"
        fi

        # Reset tracking
        _sa_was_down="false"
        _sa_downtime_start=0
        _sa_downtime_sms_status="none"
        return 0
    fi

    # Promote "none" -> "pending" when threshold exceeded
    if [ "$_sa_was_down" = "true" ] && [ "$_sa_downtime_sms_status" = "none" ]; then
        now=$(date +%s)
        elapsed=$((now - _sa_downtime_start))
        threshold_secs=$((_sa_threshold_minutes * 60))

        if [ "$elapsed" -ge "$threshold_secs" ]; then
            _sa_downtime_sms_status="pending"
            qlog_info "SMS alerts: threshold exceeded (${elapsed}s >= ${threshold_secs}s), marking pending"
        fi
    fi

    # Pending path: attempt downtime-start send only when registered
    if [ "$_sa_was_down" = "true" ] && [ "$_sa_downtime_sms_status" = "pending" ]; then
        if _sa_is_registered; then
            now=$(date +%s)
            duration=$((now - _sa_downtime_start))
            dur_text=$(_sa_format_duration "$duration")
            body="[QManager] Connection down ${dur_text}"
            trigger="Connection down ${dur_text}"

            qlog_info "SMS alerts: attempting downtime-start send (registered)"
            if _sa_do_send "$body"; then
                _sa_downtime_sms_status="sent"
                _sa_log_event "$trigger" "sent" "$_sa_recipient"
            else
                _sa_downtime_sms_status="failed"
                _sa_log_event "$trigger" "failed" "$_sa_recipient"
            fi
        else
            qlog_debug "SMS alerts: pending downtime send, modem not registered - waiting"
        fi
    fi
}

# =============================================================================
# _sa_do_send - Send SMS with retries, re-checking registration each attempt
# =============================================================================
_sa_do_send() {
    body="$1"
    phone="${_sa_recipient#+}"
    attempt=0
    max_attempts=3
    retry_delay=5

    if [ ! -x "$_SA_SMS_TOOL" ]; then
        qlog_error "SMS alerts: sms_tool not found at $_SA_SMS_TOOL"
        printf '%s' "sms_tool not found" > /tmp/qmanager_sms_last_err 2>/dev/null
        return 1
    fi

    while [ "$attempt" -lt "$max_attempts" ]; do
        attempt=$((attempt + 1))

        if [ "$attempt" -gt 1 ]; then
            sleep "$retry_delay"
        fi

        # In CGI test-send context, this is overridden to always pass.
        if ! _sa_is_registered; then
            qlog_warn "SMS alerts: attempt $attempt/$max_attempts skipped - not registered"
            continue
        fi

        send_out=$(_sa_sms_locked send "$phone" "$body" 2>&1)
        rc=$?

        if [ "$rc" -eq 0 ]; then
            qlog_info "SMS alerts: sms_tool send succeeded on attempt $attempt"
            rm -f /tmp/qmanager_sms_last_err 2>/dev/null
            return 0
        fi

        # _sa_sms_locked already strips tcgetattr noise; just fall back to a
        # generic message if the stripped output is empty.
        [ -z "$send_out" ] && send_out="sms_tool send failed (rc=$rc)"
        printf '%s' "$send_out" > /tmp/qmanager_sms_last_err 2>/dev/null
        qlog_warn "SMS alerts: sms_tool send failed on attempt $attempt/$max_attempts (rc=$rc)"
    done

    return 1
}

# =============================================================================
# _sa_send_test_sms - Called by CGI to send a test SMS
# =============================================================================
_sa_send_test_sms() {
    body="[QManager] Test SMS from your modem"

    if _sa_do_send "$body"; then
        _sa_log_event "Test SMS" "sent" "$_sa_recipient"
        return 0
    fi

    _sa_log_event "Test SMS" "failed" "$_sa_recipient"
    return 1
}

# =============================================================================
# _sa_log_event - Append entry to NDJSON log file
# =============================================================================
_sa_log_event() {
    trigger="$1"
    status="$2"
    recipient="$3"
    ts=$(date "+%Y-%m-%d %H:%M:%S")

    jq -n -c \
        --arg ts "$ts" \
        --arg trigger "$trigger" \
        --arg status "$status" \
        --arg recipient "$recipient" \
        '{timestamp: $ts, trigger: $trigger, status: $status, recipient: $recipient}' \
        >> "$_SA_LOG_FILE"

    count=$(wc -l < "$_SA_LOG_FILE" 2>/dev/null || echo 0)
    if [ "$count" -gt "$_SA_MAX_LOG" ]; then
        tmp="${_SA_LOG_FILE}.tmp"
        if tail -n "$_SA_MAX_LOG" "$_SA_LOG_FILE" > "$tmp" 2>/dev/null; then
            mv "$tmp" "$_SA_LOG_FILE" 2>/dev/null || rm -f "$tmp"
        else
            rm -f "$tmp"
        fi
    fi
}

# =============================================================================
# _sa_format_duration - Convert seconds to human-readable string
# =============================================================================
_sa_format_duration() {
    secs="$1"
    hours=$((secs / 3600))
    remaining=$((secs % 3600))
    mins=$((remaining / 60))
    remaining=$((remaining % 60))

    if [ "$hours" -gt 0 ]; then
        printf "%dh %dm %ds" "$hours" "$mins" "$remaining"
    elif [ "$mins" -gt 0 ]; then
        printf "%dm %ds" "$mins" "$remaining"
    else
        printf "%ds" "$remaining"
    fi
}
