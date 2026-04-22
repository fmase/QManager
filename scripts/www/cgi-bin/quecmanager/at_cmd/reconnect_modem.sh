#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
# =============================================================================
# reconnect_modem.sh — CGI Endpoint: Force Modem Network Reconnect
# =============================================================================
# Deregisters the modem from the network (AT+COPS=2), waits 2 seconds for
# full detach, then re-registers (AT+COPS=0). The server-side delay ensures
# the modem has time to fully detach before reselecting a cell.
#
# Endpoint: POST /cgi-bin/quecmanager/at_cmd/reconnect_modem.sh
# Request body: (none required)
# Response: {"success": true}
#       or: {"success": false, "error": "reconnect_deregister_failed", "detail": "..."}
#       or: {"success": false, "error": "reconnect_reregister_failed", "detail": "..."}
#
# Install location: /www/cgi-bin/quecmanager/at_cmd/reconnect_modem.sh
# =============================================================================

# --- Logging -----------------------------------------------------------------
qlog_init "cgi_reconnect_modem"
cgi_headers
cgi_handle_options

# --- Validate method ---------------------------------------------------------
if [ "$REQUEST_METHOD" != "POST" ]; then
    cgi_error "method_not_allowed" "Use POST"
    exit 0
fi

# --- Step 1: Deregister (AT+COPS=2) ------------------------------------------
qlog_info "Reconnect: sending AT+COPS=2 (deregister)"
DEREGISTER_RESULT=$(qcmd -j "AT+COPS=2")

if ! printf '%s' "$DEREGISTER_RESULT" | jq -e '.success == true' >/dev/null 2>&1; then
    DETAIL=$(printf '%s' "$DEREGISTER_RESULT" | jq -r '.detail // .response // "No detail"')
    qlog_error "Reconnect: deregister failed — $DETAIL"
    jq -n \
        --arg error "reconnect_deregister_failed" \
        --arg detail "$DETAIL" \
        '{"success": false, "error": $error, "detail": $detail}'
    exit 0
fi

qlog_info "Reconnect: deregistered OK, waiting 2s"

# --- Step 2: Wait for modem to fully detach ----------------------------------
sleep 2

# --- Step 3: Re-register (AT+COPS=0) -----------------------------------------
qlog_info "Reconnect: sending AT+COPS=0 (auto-select)"
REREGISTER_RESULT=$(qcmd -j "AT+COPS=0")

if ! printf '%s' "$REREGISTER_RESULT" | jq -e '.success == true' >/dev/null 2>&1; then
    DETAIL=$(printf '%s' "$REREGISTER_RESULT" | jq -r '.detail // .response // "No detail"')
    qlog_error "Reconnect: re-register failed — modem is stuck deregistered! $DETAIL"
    jq -n \
        --arg error "reconnect_reregister_failed" \
        --arg detail "$DETAIL" \
        '{"success": false, "error": $error, "detail": $detail}'
    exit 0
fi

qlog_info "Reconnect: re-registered OK"
jq -n '{"success": true}'
