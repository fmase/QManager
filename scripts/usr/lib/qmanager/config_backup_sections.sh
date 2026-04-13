#!/bin/sh
# =============================================================================
# config_backup_sections.sh — Config Backup Section Library
# =============================================================================
# Sourced by collect.sh (CGI) and qmanager_config_restore (worker).
# Exposes collect_<section> and apply_<section> function pairs plus a
# dispatch table listing the canonical section key order.
#
# Contract:
#   collect_<section>    → echoes a JSON fragment to stdout; exits non-zero on failure
#   apply_<section>      → reads a JSON fragment from stdin; exits:
#                            0  = success
#                            1  = generic failure (retryable)
#                            2  = unsupported on this modem (skip, no retry)
#
# Install location: /usr/lib/qmanager/config_backup_sections.sh
# =============================================================================

[ -n "$_CFG_BACKUP_SECTIONS_LOADED" ] && return 0
_CFG_BACKUP_SECTIONS_LOADED=1

# --- Logging ---
. /usr/lib/qmanager/qlog.sh 2>/dev/null || {
    qlog_init() { :; }
    qlog_info() { :; }
    qlog_warn() { :; }
    qlog_error() { :; }
}
qlog_init "cfg_backup"

# --- Canonical apply order (safe first, IMEI/profiles last) ---
CFG_BACKUP_APPLY_ORDER="sms_alerts watchdog network_mode_apn bands tower_lock ttl_hl imei profiles"

# --- Known section keys (used for validation) ---
CFG_BACKUP_KNOWN_SECTIONS="$CFG_BACKUP_APPLY_ORDER"

cfg_backup_is_known_section() {
    case " $CFG_BACKUP_KNOWN_SECTIONS " in
        *" $1 "*) return 0 ;;
        *) return 1 ;;
    esac
}

# --- Dispatcher: collect by key ---
cfg_backup_collect() {
    local key="$1"
    case "$key" in
        sms_alerts)       collect_sms_alerts ;;
        watchdog)         collect_watchdog ;;
        network_mode_apn) collect_network_mode_apn ;;
        bands)            collect_bands ;;
        tower_lock)       collect_tower_lock ;;
        ttl_hl)           collect_ttl_hl ;;
        imei)             collect_imei ;;
        profiles)         collect_profiles ;;
        *)                qlog_error "Unknown section: $key"; return 1 ;;
    esac
}

# --- Dispatcher: apply by key (reads stdin) ---
cfg_backup_apply() {
    local key="$1"
    case "$key" in
        sms_alerts)       apply_sms_alerts ;;
        watchdog)         apply_watchdog ;;
        network_mode_apn) apply_network_mode_apn ;;
        bands)            apply_bands ;;
        tower_lock)       apply_tower_lock ;;
        ttl_hl)           apply_ttl_hl ;;
        imei)             apply_imei ;;
        profiles)         apply_profiles ;;
        *)                qlog_error "Unknown section: $key"; return 1 ;;
    esac
}

# --- Per-section implementations follow below ---
# Each is a collect_<key>/apply_<key> pair. Keep them grouped.
