#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
# =============================================================================
# sms_alerts.sh - CGI Endpoint: SMS Alert Settings (GET + POST)
# =============================================================================
# GET:  Returns current SMS alert configuration.
# POST: action=save_settings  -> persists settings JSON, signals poller reload
#       action=send_test      -> sends a test SMS via sms_tool
#
# Config files:
#   /etc/qmanager/sms_alerts.json   -> Settings storage
#   /tmp/qmanager_sms_reload        -> Flag for poller config reload
#   /tmp/qmanager_sms_log.json      -> NDJSON sent/failed log
#
# Endpoint: GET/POST /cgi-bin/quecmanager/monitoring/sms_alerts.sh
# Install location: /www/cgi-bin/quecmanager/monitoring/sms_alerts.sh
# =============================================================================

qlog_init "cgi_sms_alerts"
cgi_headers
cgi_handle_options

CONFIG="/etc/qmanager/sms_alerts.json"
RELOAD_FLAG="/tmp/qmanager_sms_reload"

# Validation: E.164-ish - optional +, first digit 1-9, total 7-15 digits
_validate_phone() {
    _vp=$(printf '%s' "$1" | sed 's/^+//')
    case "$_vp" in
        ''|*[!0-9]*) return 1 ;;
    esac
    _vp_len=${#_vp}
    [ "$_vp_len" -lt 7 ] || [ "$_vp_len" -gt 15 ] && return 1
    _vp_first=$(printf '%s' "$_vp" | cut -c1)
    [ "$_vp_first" = "0" ] && return 1
    return 0
}

# =============================================================================
# GET - Fetch current settings
# =============================================================================
if [ "$REQUEST_METHOD" = "GET" ]; then
    qlog_info "Fetching SMS alert settings"

    if [ -f "$CONFIG" ]; then
        enabled=$(jq -r '(.enabled) | if . == null then "false" else tostring end' "$CONFIG" 2>/dev/null)
        recipient_phone=$(jq -r '.recipient_phone // ""' "$CONFIG" 2>/dev/null)
        threshold_minutes=$(jq -r '.threshold_minutes // 5' "$CONFIG" 2>/dev/null)

        jq -n \
            --argjson enabled "$enabled" \
            --arg recipient_phone "$recipient_phone" \
            --argjson threshold_minutes "$threshold_minutes" \
            '{
                success: true,
                settings: {
                    enabled: $enabled,
                    recipient_phone: $recipient_phone,
                    threshold_minutes: $threshold_minutes
                }
            }'
    else
        printf '{"success":true,"settings":{"enabled":false,"recipient_phone":"","threshold_minutes":5}}'
    fi
    exit 0
fi

# =============================================================================
# POST - Save settings or send test SMS
# =============================================================================
if [ "$REQUEST_METHOD" = "POST" ]; then
    cgi_read_post

    ACTION=$(printf '%s' "$POST_DATA" | jq -r '.action // empty')

    if [ -z "$ACTION" ]; then
        cgi_error "missing_action" "action field is required"
        exit 0
    fi

    # -------------------------------------------------------------------------
    # action: save_settings
    # -------------------------------------------------------------------------
    if [ "$ACTION" = "save_settings" ]; then
        qlog_info "Saving SMS alert settings"

        new_enabled=$(printf '%s' "$POST_DATA" | jq -r 'if has("enabled") then (.enabled | tostring) else "false" end')
        new_phone=$(printf '%s' "$POST_DATA" | jq -r '.recipient_phone // ""')
        new_threshold=$(printf '%s' "$POST_DATA" | jq -r '.threshold_minutes // 5')

        # Validate threshold first (non-numeric guard, then range)
        case "$new_threshold" in
            ''|*[!0-9]*)
                cgi_error "invalid_threshold" "Threshold must be a number between 1 and 60"
                exit 0
                ;;
        esac
        if [ "$new_threshold" -lt 1 ] || [ "$new_threshold" -gt 60 ]; then
            cgi_error "invalid_threshold" "Threshold must be between 1 and 60 minutes"
            exit 0
        fi

        # Validate phone only if enabling. When disabling, allow empty.
        if [ "$new_enabled" = "true" ]; then
            if [ -z "$new_phone" ]; then
                cgi_error "missing_phone" "Recipient phone is required when enabled"
                exit 0
            fi
            if ! _validate_phone "$new_phone"; then
                cgi_error "invalid_phone" "Recipient phone must be E.164 format, e.g. +14155551234"
                exit 0
            fi
        fi

        mkdir -p /etc/qmanager

        jq -n \
            --argjson enabled "$new_enabled" \
            --arg recipient_phone "$new_phone" \
            --argjson threshold_minutes "$new_threshold" \
            '{
                enabled: $enabled,
                recipient_phone: $recipient_phone,
                threshold_minutes: $threshold_minutes
            }' > "$CONFIG"

        qlog_info "SMS alerts config written: enabled=$new_enabled recipient=$new_phone threshold=${new_threshold}m"

        # Signal poller to reload next cycle
        touch "$RELOAD_FLAG"

        cgi_success
        exit 0
    fi

    # -------------------------------------------------------------------------
    # action: send_test
    # -------------------------------------------------------------------------
    if [ "$ACTION" = "send_test" ]; then
        qlog_info "Sending test SMS"

        . /usr/lib/qmanager/sms_alerts.sh 2>/dev/null || {
            cgi_error "library_missing" "SMS alerts library not found"
            exit 0
        }

        _sa_read_config
        if [ "$_sa_enabled" != "true" ]; then
            cgi_error "not_configured" "SMS alerts must be enabled and fully configured before sending a test"
            exit 0
        fi

        # CGI context does not have poller registration globals.
        # Test sends are user-initiated and should still attempt delivery.
        _sa_is_registered() { return 0; }

        rm -f /tmp/qmanager_sms_last_err

        if _sa_send_test_sms; then
            cgi_success
        else
            _detail=$(cat /tmp/qmanager_sms_last_err 2>/dev/null)
            [ -z "$_detail" ] && _detail="sms_tool send failed - check modem status and recipient number"
            cgi_error "send_failed" "$_detail"
        fi
        exit 0
    fi

    cgi_error "unknown_action" "Unknown action: $ACTION"
    exit 0
fi

cgi_error "method_not_allowed" "Only GET and POST are supported"
