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
# Public functions:
#   cfg_backup_is_known_section <key>  → returns 0 if key is valid
#   cfg_backup_collect <key>           → echoes the section's JSON to stdout
#   cfg_backup_apply <key>             → reads section JSON from stdin and applies
#
# Install location: /usr/lib/qmanager/config_backup_sections.sh
# =============================================================================

[ -n "$_CFG_BACKUP_SECTIONS_LOADED" ] && return 0
_CFG_BACKUP_SECTIONS_LOADED=1

# --- Logging ---
. /usr/lib/qmanager/qlog.sh 2>/dev/null || {
    qlog_init() { :; }
    qlog_debug() { :; }
    qlog_info() { :; }
    qlog_warn() { :; }
    qlog_error() { :; }
}

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

# =============================================================================
# SMS Alerts — /etc/qmanager/sms_alerts.json + /tmp/qmanager_sms_reload flag
# =============================================================================
collect_sms_alerts() {
    local cfg="/etc/qmanager/sms_alerts.json"
    if [ ! -f "$cfg" ]; then
        echo '{"enabled":false,"recipient_phone":"","threshold_minutes":5}'
        return 0
    fi
    jq -c '{enabled: (.enabled // false),
            recipient_phone: (.recipient_phone // ""),
            threshold_minutes: (.threshold_minutes // 5)}' "$cfg"
}

apply_sms_alerts() {
    local cfg="/etc/qmanager/sms_alerts.json"
    local input
    input=$(cat)
    # Validate structure
    echo "$input" | jq -e '.enabled, .recipient_phone, .threshold_minutes' >/dev/null 2>&1 || {
        qlog_error "apply_sms_alerts: invalid input"
        return 1
    }
    # Atomic write
    mkdir -p /etc/qmanager
    local tmp="${cfg}.tmp.$$"
    echo "$input" | jq '.' > "$tmp" || { rm -f "$tmp"; return 1; }
    mv "$tmp" "$cfg" || return 1
    # Signal poller to reload
    touch /tmp/qmanager_sms_reload
    return 0
}

# =============================================================================
# Watchdog / Watchcat — UCI quecmanager.watchcat.*
# =============================================================================
_WATCHCAT_KEYS="enabled max_failures check_interval cooldown tier1_enabled tier2_enabled tier3_enabled tier4_enabled backup_sim_slot max_reboots_per_hour"

collect_watchdog() {
    local out="{"
    local sep=""
    local k v
    for k in $_WATCHCAT_KEYS; do
        v=$(uci -q get "quecmanager.watchcat.$k")
        # Encode as string (type handling happens on apply)
        out="${out}${sep}\"${k}\":$(echo "$v" | jq -R '.')"
        sep=","
    done
    out="${out}}"
    echo "$out"
}

apply_watchdog() {
    local input k v
    input=$(cat)
    # Ensure section exists
    uci -q get quecmanager.watchcat >/dev/null 2>&1 || {
        uci set quecmanager.watchcat=service
    }
    for k in $_WATCHCAT_KEYS; do
        v=$(echo "$input" | jq -r --arg k "$k" '.[$k] // empty')
        # Empty string is a valid value for backup_sim_slot
        if [ "$k" = "backup_sim_slot" ] || [ -n "$v" ]; then
            uci set "quecmanager.watchcat.${k}=${v}"
        fi
    done
    uci commit quecmanager || return 1
    touch /tmp/qmanager_watchcat_reload

    local enabled
    enabled=$(uci -q get quecmanager.watchcat.enabled)
    if [ "$enabled" = "1" ]; then
        rm -f /tmp/qmanager_watchcat_disabled
        /etc/init.d/qmanager_watchcat enable >/dev/null 2>&1
        ( /etc/init.d/qmanager_watchcat restart >/dev/null 2>&1 & )
    else
        ( /etc/init.d/qmanager_watchcat stop >/dev/null 2>&1 & )
        /etc/init.d/qmanager_watchcat disable >/dev/null 2>&1
    fi
    return 0
}

# =============================================================================
# Network Mode + APN — AT commands via qcmd
# =============================================================================
collect_network_mode_apn() {
    local resp
    # Compound read: nr5g_disable_mode, roam_pref, mode_pref, APN contexts
    resp=$(qcmd 'AT+QNWPREFCFG="nr5g_disable_mode";+QNWPREFCFG="roam_pref";+QNWPREFCFG="mode_pref";+CGDCONT?') || return 1

    local nr5g_dis roam mode
    nr5g_dis=$(echo "$resp" | awk -F',' '/nr5g_disable_mode/ {gsub(/[[:space:]"]/,"",$2); print $2; exit}')
    roam=$(echo "$resp"     | awk -F',' '/roam_pref/         {gsub(/[[:space:]"]/,"",$2); print $2; exit}')
    mode=$(echo "$resp"     | awk -F',' '/mode_pref/         {gsub(/[[:space:]"]/,"",$2); print $2; exit}')

    # Parse all +CGDCONT lines → JSON array
    local contexts
    contexts=$(echo "$resp" | awk '
        /\+CGDCONT:/ {
            gsub(/\+CGDCONT: */, "", $0);
            n = split($0, a, ",");
            cid = a[1]; gsub(/"/, "", cid);
            pdp = a[2]; gsub(/"/, "", pdp);
            apn = a[3]; gsub(/"/, "", apn);
            printf "%s{\"cid\":%s,\"pdp_type\":\"%s\",\"apn\":\"%s\"}", (first==""?"":","), cid, pdp, apn;
            first="done";
        }
        END { }
    ')
    contexts="[${contexts}]"

    jq -n \
      --arg nr "$nr5g_dis" --arg ro "$roam" --arg md "$mode" \
      --argjson ctx "$contexts" \
      '{nr5g_disable_mode: ($nr|tonumber? // 0),
        roam_pref: ($ro|tonumber? // 1),
        mode_pref: $md,
        contexts: $ctx}'
}

apply_network_mode_apn() {
    local input
    input=$(cat)

    local nr5g_dis roam mode
    nr5g_dis=$(echo "$input" | jq -r '.nr5g_disable_mode // empty')
    roam=$(echo "$input"     | jq -r '.roam_pref // empty')
    mode=$(echo "$input"     | jq -r '.mode_pref // empty')

    # Order: nr5g_disable → roam → mode_pref → APN contexts
    if [ -n "$nr5g_dis" ]; then
        qcmd "AT+QNWPREFCFG=\"nr5g_disable_mode\",${nr5g_dis}" >/dev/null || return 1
        sleep 1
    fi
    if [ -n "$roam" ]; then
        qcmd "AT+QNWPREFCFG=\"roam_pref\",${roam}" >/dev/null || return 1
        sleep 1
    fi
    if [ -n "$mode" ] && [ "$mode" != "null" ]; then
        qcmd "AT+QNWPREFCFG=\"mode_pref\",${mode}" >/dev/null || return 1
        sleep 1
    fi

    # Apply each APN context
    local count i cid pdp apn
    count=$(echo "$input" | jq '.contexts | length')
    i=0
    while [ "$i" -lt "$count" ]; do
        cid=$(echo "$input" | jq -r ".contexts[$i].cid")
        pdp=$(echo "$input" | jq -r ".contexts[$i].pdp_type")
        apn=$(echo "$input" | jq -r ".contexts[$i].apn")
        qcmd "AT+CGDCONT=${cid},\"${pdp}\",\"${apn}\"" >/dev/null || return 1
        sleep 1
        i=$((i+1))
    done
    return 0
}

# =============================================================================
# LTE/5G Bands — AT+QNWPREFCFG lte_band, nsa_nr5g_band, nr5g_band
# =============================================================================
collect_bands() {
    local resp
    resp=$(qcmd 'AT+QNWPREFCFG="ue_capability_band"') || return 1
    # Each line: +QNWPREFCFG: "lte_band",1:3:7:28   (colon-delimited numeric list)
    local lte nsa sa
    lte=$(echo "$resp" | awk -F',' '/"lte_band"/         {print $2; exit}')
    nsa=$(echo "$resp" | awk -F',' '/"nsa_nr5g_band"/    {print $2; exit}')
    sa=$(echo  "$resp" | awk -F',' '/"nr5g_band"/ && !/nsa_/ && !/nrdc_/ {print $2; exit}')

    # failover flag
    local failover
    failover=$(cat /etc/qmanager/band_failover_enabled 2>/dev/null || echo "0")

    jq -n --arg l "$lte" --arg n "$nsa" --arg s "$sa" --arg f "$failover" \
        '{lte_bands: $l, nsa_bands: $n, sa_bands: $s, failover_enabled: ($f == "1")}'
}

apply_bands() {
    local input lte nsa sa failover
    input=$(cat)
    lte=$(echo "$input"       | jq -r '.lte_bands // empty')
    nsa=$(echo "$input"       | jq -r '.nsa_bands // empty')
    sa=$(echo "$input"        | jq -r '.sa_bands  // empty')
    failover=$(echo "$input"  | jq -r '.failover_enabled // false')

    # Kill any running band failover watcher before re-locking
    if [ -f /tmp/qmanager_band_failover.pid ]; then
        kill "$(cat /tmp/qmanager_band_failover.pid 2>/dev/null)" 2>/dev/null
        rm -f /tmp/qmanager_band_failover.pid /tmp/qmanager_band_failover
    fi

    [ -n "$lte" ] && { qcmd "AT+QNWPREFCFG=\"lte_band\",${lte}"        >/dev/null || return 1; sleep 1; }
    [ -n "$nsa" ] && { qcmd "AT+QNWPREFCFG=\"nsa_nr5g_band\",${nsa}"   >/dev/null || return 1; sleep 1; }
    [ -n "$sa"  ] && { qcmd "AT+QNWPREFCFG=\"nr5g_band\",${sa}"        >/dev/null || return 1; sleep 1; }

    # Restore failover flag + respawn watcher if enabled
    mkdir -p /etc/qmanager
    if [ "$failover" = "true" ]; then
        echo "1" > /etc/qmanager/band_failover_enabled
        ( /usr/bin/qmanager_band_failover </dev/null >/dev/null 2>&1 & )
    else
        rm -f /etc/qmanager/band_failover_enabled
    fi
    return 0
}
