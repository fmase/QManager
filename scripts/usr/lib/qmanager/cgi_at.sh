#!/bin/sh
# AT command helper library — shared utilities for CGI scripts and daemons.
# Source after qlog.sh or cgi_base.sh so qlog functions are already available.

[ -n "$_CGI_AT_LOADED" ] && return 0
_CGI_AT_LOADED=1

# Ensure qlog_warn is a no-op if sourced before logging is initialised.
command -v qlog_warn >/dev/null 2>&1 || qlog_warn() { :; }

# ---------------------------------------------------------------------------
# strip_at_response <raw>
# Remove the command echo, trailing OK, and ERROR lines from a raw qcmd
# response, then print the payload on stdout.
# ---------------------------------------------------------------------------
strip_at_response() {
    printf '%s' "$1" | tr -d '\r' | sed '1d' | sed '/^OK$/d' | sed '/^ERROR$/d'
}

# ---------------------------------------------------------------------------
# run_at <at_command>
# Execute an AT command via qcmd and print the stripped response.
# Returns 0 on success, 1 on failure (no output written on failure).
#
# Usage:
#   result=$(run_at "AT+CGDCONT?") || { handle_error; }
# ---------------------------------------------------------------------------
run_at() {
    local raw
    raw=$(qcmd "$1" 2>/dev/null)
    local rc=$?
    if [ $rc -ne 0 ] || [ -z "$raw" ]; then
        qlog_warn "AT command failed: $1 (rc=$rc)"
        return 1
    fi
    case "$raw" in
        *ERROR*)
            qlog_warn "AT command returned ERROR: $1"
            return 1
            ;;
    esac
    strip_at_response "$raw"
}
