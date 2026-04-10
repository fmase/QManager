#!/bin/sh
# =============================================================================
# sms_alerts.sh - SMS Alert Library for QManager
# =============================================================================
# Sourced by qmanager_poller and the SMS alerts CGI. Detects prolonged
# internet downtime and sends a single downtime notification via sms_tool
# once the outage duration exceeds the configured threshold. Unlike email
# alerts, SMS fires WHILE STILL DOWN because the cellular control channel
# is independent of the data connection.
#
# Dependencies: jq, sms_tool (required package), qlog_* (optional)
# Install location: /usr/lib/qmanager/sms_alerts.sh
#
# Global variables used from poller:
#   Read: conn_internet_available ("true"/"false"/"null")
#
# Config:  /etc/qmanager/sms_alerts.json
# Log:     /tmp/qmanager_sms_log.json  (NDJSON, max 100 entries)
# Reload:  /tmp/qmanager_sms_reload    (flag file, touched by CGI)
# =============================================================================

[ -n "$_SMS_ALERTS_LOADED" ] && return 0
_SMS_ALERTS_LOADED=1

# --- Constants ---------------------------------------------------------------
_SA_CONFIG="/etc/qmanager/sms_alerts.json"
_SA_LOG_FILE="/tmp/qmanager_sms_log.json"
_SA_RELOAD_FLAG="/tmp/qmanager_sms_reload"
_SA_MAX_LOG=100

# --- State (populated by sms_alerts_init / _sa_read_config) ------------------
_sa_enabled="false"
_sa_recipient=""
_sa_threshold_minutes=5

# --- Downtime tracking (poller runtime only) ---------------------------------
_sa_was_down="false"
_sa_downtime_start=0
_sa_alert_sent="false"   # Single-shot guard: one SMS per outage

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
# _sa_format_duration - Convert seconds to human-readable "Xh Ym Zs"
# =============================================================================
_sa_format_duration() {
    _sa_fd_secs="$1"
    _sa_fd_hours=$((_sa_fd_secs / 3600))
    _sa_fd_rem=$((_sa_fd_secs % 3600))
    _sa_fd_mins=$((_sa_fd_rem / 60))
    _sa_fd_rem=$((_sa_fd_rem % 60))

    if [ "$_sa_fd_hours" -gt 0 ]; then
        printf "%dh %dm %ds" "$_sa_fd_hours" "$_sa_fd_mins" "$_sa_fd_rem"
    elif [ "$_sa_fd_mins" -gt 0 ]; then
        printf "%dm %ds" "$_sa_fd_mins" "$_sa_fd_rem"
    else
        printf "%ds" "$_sa_fd_rem"
    fi
}

# =============================================================================
# _sa_build_downtime_message - Plain-text SMS body (<=160 chars target)
# =============================================================================
# Args: $1 = start epoch, $2 = elapsed seconds, $3 = threshold minutes
# Output example:
#   "QManager: Internet down 5m 12s (started 14:03). Threshold 5m exceeded."
# =============================================================================
_sa_build_downtime_message() {
    _sa_bm_start="$1"
    _sa_bm_dur="$2"
    _sa_bm_thresh="$3"

    _sa_bm_time=$(date -d "@$_sa_bm_start" "+%H:%M" 2>/dev/null) || \
        _sa_bm_time=$(awk "BEGIN{print strftime(\"%H:%M\",$_sa_bm_start)}" 2>/dev/null) || \
        _sa_bm_time="?"

    _sa_bm_durtxt=$(_sa_format_duration "$_sa_bm_dur")

    printf "QManager: Internet down %s (started %s). Threshold %dm exceeded." \
        "$_sa_bm_durtxt" "$_sa_bm_time" "$_sa_bm_thresh"
}

# =============================================================================
# _sa_build_test_message - Plain-text body for test SMS
# =============================================================================
_sa_build_test_message() {
    printf "QManager: Test SMS alert - your configuration is working."
}

# =============================================================================
# _sa_do_send - Send an SMS via sms_tool
# =============================================================================
# Args: $1 = recipient (E.164, with or without leading +)
#       $2 = message body (plain text)
# Returns: 0 on success, non-zero on failure
# =============================================================================
_sa_do_send() {
    _sa_ds_to="$1"
    _sa_ds_body="$2"

    if ! command -v sms_tool >/dev/null 2>&1; then
        qlog_error "SMS alerts: sms_tool not installed"
        return 1
    fi

    # Strip leading + - sms_tool expects bare digits
    _sa_ds_to_clean=$(printf '%s' "$_sa_ds_to" | sed 's/^+//')

    # Optional device override via UCI (matches cellular/sms.sh pattern)
    _sa_ds_dev=$(uci -q get quecmanager.settings.sms_tool_device 2>/dev/null)
    if [ -n "$_sa_ds_dev" ]; then
        _sa_ds_result=$(sms_tool -d "$_sa_ds_dev" send "$_sa_ds_to_clean" "$_sa_ds_body" 2>&1)
    else
        _sa_ds_result=$(sms_tool send "$_sa_ds_to_clean" "$_sa_ds_body" 2>&1)
    fi
    _sa_ds_rc=$?

    # Strip sms_tool tty diagnostics (same as cellular/sms.sh)
    _sa_ds_result=$(printf '%s\n' "$_sa_ds_result" | grep -v -e '^tcgetattr(' -e '^tcsetattr(' -e '^Failed tcsetattr(')

    if [ "$_sa_ds_rc" -eq 0 ]; then
        qlog_info "SMS alerts: sent to $_sa_ds_to_clean"
        return 0
    fi

    qlog_error "SMS alerts: sms_tool send failed (rc=$_sa_ds_rc): $_sa_ds_result"
    # Stash last error detail so the CGI test-send path can surface it
    printf '%s' "$_sa_ds_result" > /tmp/qmanager_sms_last_err 2>/dev/null
    return "$_sa_ds_rc"
}

# =============================================================================
# _sa_log_event - Append entry to NDJSON log file, trim to max
# =============================================================================
# Args: $1 = trigger text, $2 = "sent"|"failed", $3 = recipient
# =============================================================================
_sa_log_event() {
    _sa_le_trigger="$1"
    _sa_le_status="$2"
    _sa_le_recipient="$3"
    _sa_le_ts=$(date "+%Y-%m-%d %H:%M:%S")

    jq -n -c \
        --arg ts "$_sa_le_ts" \
        --arg trigger "$_sa_le_trigger" \
        --arg status "$_sa_le_status" \
        --arg recipient "$_sa_le_recipient" \
        '{timestamp: $ts, trigger: $trigger, status: $status, recipient: $recipient}' \
        >> "$_SA_LOG_FILE"

    # Trim to max entries
    _sa_le_count=$(wc -l < "$_SA_LOG_FILE" 2>/dev/null || echo 0)
    if [ "$_sa_le_count" -gt "$_SA_MAX_LOG" ]; then
        _sa_le_tmp="${_SA_LOG_FILE}.tmp"
        if tail -n "$_SA_MAX_LOG" "$_SA_LOG_FILE" > "$_sa_le_tmp" 2>/dev/null; then
            mv "$_sa_le_tmp" "$_SA_LOG_FILE" 2>/dev/null || rm -f "$_sa_le_tmp"
        else
            rm -f "$_sa_le_tmp"
        fi
    fi
}

# =============================================================================
# check_sms_alert - Called every poll cycle by qmanager_poller
# =============================================================================
# Semantics:
#   * On entering downtime: record start time.
#   * While still down AND elapsed >= threshold AND not yet sent this outage:
#       send SMS, set single-shot guard.
#   * On recovery: reset tracking + guard (no recovery SMS).
#
# Unlike email_alerts which fires on recovery, SMS fires DURING the outage
# because the cellular control channel is independent of the data connection.
# =============================================================================
check_sms_alert() {
    # No alerts during scheduled low power mode
    [ -f "/tmp/qmanager_low_power_active" ] && return 0

    # Reload on CGI signal
    if [ -f "$_SA_RELOAD_FLAG" ]; then
        rm -f "$_SA_RELOAD_FLAG"
        _sa_read_config
        qlog_info "SMS alerts config reloaded: enabled=$_sa_enabled"
    fi

    [ "$_sa_enabled" != "true" ] && return 0

    # Stale/unknown ping state: keep existing downtime timer running if any,
    # otherwise do nothing (same guard as email_alerts).
    if [ "$conn_internet_available" = "null" ] || [ -z "$conn_internet_available" ]; then
        return 0
    fi

    if [ "$conn_internet_available" = "false" ]; then
        # Start tracking on first down cycle
        if [ "$_sa_was_down" != "true" ]; then
            _sa_downtime_start=$(date +%s)
            _sa_was_down="true"
            _sa_alert_sent="false"
            qlog_debug "SMS alerts: downtime tracking started at $_sa_downtime_start"
            return 0
        fi

        # Already tracking - check threshold if we haven't fired yet
        if [ "$_sa_alert_sent" = "true" ]; then
            return 0
        fi

        _sa_now=$(date +%s)
        _sa_elapsed=$((_sa_now - _sa_downtime_start))
        _sa_threshold_secs=$((_sa_threshold_minutes * 60))

        if [ "$_sa_elapsed" -ge "$_sa_threshold_secs" ]; then
            qlog_info "SMS alerts: threshold exceeded (elapsed=${_sa_elapsed}s, threshold=${_sa_threshold_secs}s), sending SMS"
            _sa_body=$(_sa_build_downtime_message "$_sa_downtime_start" "$_sa_elapsed" "$_sa_threshold_minutes")
            _sa_trigger="Connection down $(_sa_format_duration "$_sa_elapsed")"

            if _sa_do_send "$_sa_recipient" "$_sa_body"; then
                _sa_log_event "$_sa_trigger" "sent" "$_sa_recipient"
            else
                _sa_log_event "$_sa_trigger" "failed" "$_sa_recipient"
            fi
            # Single-shot for this outage regardless of send outcome - we
            # don't want to retry-spam the modem/cellular network every 2s.
            _sa_alert_sent="true"
        fi

    elif [ "$conn_internet_available" = "true" ] && [ "$_sa_was_down" = "true" ]; then
        # Recovery - reset state, no SMS sent
        qlog_debug "SMS alerts: recovery detected, resetting tracking"
        _sa_was_down="false"
        _sa_downtime_start=0
        _sa_alert_sent="false"
    fi
}

# =============================================================================
# _sa_send_test_sms - Called by CGI send_test action
# =============================================================================
# Returns 0 on success, non-zero on failure. Assumes _sa_read_config was
# already called by the caller.
# =============================================================================
_sa_send_test_sms() {
    _sa_st_body=$(_sa_build_test_message)
    if _sa_do_send "$_sa_recipient" "$_sa_st_body"; then
        _sa_log_event "Test SMS" "sent" "$_sa_recipient"
        return 0
    fi
    _sa_log_event "Test SMS" "failed" "$_sa_recipient"
    return 1
}
