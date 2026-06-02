#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
. /usr/lib/qmanager/cgi_at.sh
# =============================================================================
# apn.sh — CGI Endpoint: APN Profile Management (GET + POST), AT-only
# =============================================================================
# RM520N-GL has no Casa RDB key-value store and no wmmd daemon, so every live
# profile field is sourced directly from AT commands through qcmd. User-typed
# profile metadata (name/apn/pdp_type) is persisted to a JSON sidecar.
#
# "Active" is re-anchored on the TRUE WAN-bearing CID, derived inline from the
# AT+QMAP="WWAN" / AT+CGPADDR sections of one compound query. IMS and SOS
# (emergency) carrier contexts are classified and excluded from the list.
#
# GET  -> List data APN profiles (one per non-carrier PDP context CID 1-6).
# POST -> {"action":"save"|"toggle", ...} applies a configuration change.
#
# AT commands used (GET):
#   AT+CGDCONT?;+CGACT?;+CGPADDR;+QMAP="WWAN"   -> one round-trip, four sections
#     +CGDCONT: defined PDP contexts (CID, PDP type, APN)
#     +CGACT:   per-context activation state
#     +CGPADDR: per-CID assigned IP (active-CID fallback)
#     +QMAP:    authoritative WAN CID + IP
#
# AT commands used (POST):
#   AT+CGDCONT=<cid>,"<pdp>","<apn>"    -> define APN + PDP type (action: save)
#   AT+COPS=2 / AT+COPS=0               -> detach/re-attach        (action: save)
#   AT+CGACT=<0|1>,<cid>               -> toggle context          (action: toggle)
#
# Endpoint: GET/POST /cgi-bin/quecmanager/cellular/apn.sh
# Install location: <docroot>/cgi-bin/quecmanager/cellular/apn.sh
# =============================================================================

# --- Logging -----------------------------------------------------------------
qlog_init "cgi_apn"
cgi_headers
cgi_handle_options

# --- Configuration -----------------------------------------------------------
MAX_PROFILES=6
PROFILE_FILE="/usrdata/qmanager/apn_profiles.json"
LEGACY_NAME_FILE="/usrdata/qmanager/apn_names.json"

# =============================================================================
# Helpers
# =============================================================================

# die <error_code> <detail> — emit a JSON error and stop. CGI exits 0; the
# client distinguishes success via the "success" field, not the HTTP status.
die() {
    qlog_error "$1: ${2:-}"
    cgi_error "$1" "${2:-}"
    exit 0
}

# PDP type <-> frontend vocabulary. AT+CGDCONT uses IP/IPV6/IPV4V6; the UI
# uses ipv4/ipv6/ipv4v6.
pdp_to_frontend() {
    case "$1" in
        IP|IPV4) echo "ipv4" ;;
        IPV6)    echo "ipv6" ;;
        IPV4V6)  echo "ipv4v6" ;;
        *)       echo "" ;;
    esac
}
pdp_to_at() {
    case "$1" in
        ipv4)   echo "IP" ;;
        ipv6)   echo "IPV6" ;;
        ipv4v6) echo "IPV4V6" ;;
        *)      echo "" ;;
    esac
}

# Carrier-provisioned APN classification (case-insensitive substring match).
# IMS (VoLTE) and SOS/emergency/XCAP/RCS contexts are operator-managed; a
# non-empty result tags the row as carrier and EXCLUDES it from the list.
apn_type_of() {
    _at_lc=$(printf '%s' "$1" | tr 'A-Z' 'a-z')
    case "$_at_lc" in
        *ims*)                               echo "ims" ;;
        *sos*|*emergency*|*xcap*|*rcs*)      echo "emergency" ;;
        *)                                   echo "" ;;
    esac
}

# Read the persisted profile config as a compact JSON object keyed by CID.
# Missing/corrupt file -> "{}" (not an error). Migration nicety: if the new
# file is absent but the legacy name sidecar exists, seed names from it so a
# user's previously-typed names survive the upgrade.
read_profiles_json() {
    if [ -f "$PROFILE_FILE" ]; then
        _pj=$(jq -c '.' "$PROFILE_FILE" 2>/dev/null)
        [ -n "$_pj" ] && { printf '%s' "$_pj"; return; }
    fi
    if [ -f "$LEGACY_NAME_FILE" ]; then
        # Legacy file is {cid:name}; lift each into {name:<name>}.
        _lj=$(jq -c 'map_values({name: .})' "$LEGACY_NAME_FILE" 2>/dev/null)
        [ -n "$_lj" ] && { printf '%s' "$_lj"; return; }
    fi
    printf '%s' "{}"
}

# write_profile_entry <cid> <name> <apn> <pdp_type> — merge one entry into the
# config. Written by www-data (CGI runs as www-data; /usrdata/qmanager is
# 0777), then chmod 644 explicitly so the mode does not depend on umask.
write_profile_entry() {
    _wc="$1"
    _wn="$2"
    _wa="$3"
    _wp="$4"
    _wdir=$(dirname "$PROFILE_FILE")
    [ -d "$_wdir" ] || mkdir -p "$_wdir" 2>/dev/null
    _wcur=$(read_profiles_json)
    _wnew=$(printf '%s' "$_wcur" | jq -c \
        --arg k "$_wc" --arg n "$_wn" --arg a "$_wa" --arg p "$_wp" \
        '.[$k]={name:$n, apn:$a, pdp_type:$p}' 2>/dev/null)
    [ -z "$_wnew" ] && return 1
    _wtmp="${PROFILE_FILE}.tmp.$$"
    printf '%s\n' "$_wnew" > "$_wtmp" 2>/dev/null || return 1
    chmod 644 "$_wtmp" 2>/dev/null
    mv "$_wtmp" "$PROFILE_FILE" 2>/dev/null || { rm -f "$_wtmp" 2>/dev/null; return 1; }
    chmod 644 "$PROFILE_FILE" 2>/dev/null
    return 0
}

# get_cgact_state <cid> — activation state for one CID from the cached
# AT+CGACT? response ("1" = active, "" otherwise).
get_cgact_state() {
    printf '%s\n' "$cgact_raw" | awk -F'[:,]' -v c="$1" '
        /\+CGACT:/ {
            cid = $2; gsub(/[^0-9]/, "", cid)
            if (cid == c) { st = $3; gsub(/[^0-9]/, "", st); print st; exit }
        }'
}

# =============================================================================
# GET — list data APN profiles
# =============================================================================
if [ "$REQUEST_METHOD" = "GET" ]; then
    qlog_info "Listing APN profiles (AT)"

    # One compound call. Each qcmd invocation carries a fixed per-call cost
    # (process spawn + flock + modem channel handshake) that dominates the AT
    # payload itself; chaining all four queries pays that cost once. Proven
    # on-device to return every section greppable in a single round-trip.
    blob=$(run_at 'AT+CGDCONT?;+CGACT?;+CGPADDR;+QMAP="WWAN"')
    cgdcont_raw=$(printf '%s\n' "$blob" | grep '+CGDCONT:')
    cgact_raw=$(printf '%s\n' "$blob" | grep '+CGACT:')

    # --- Active CID (inline, NOT detect_active_cid which re-queries) --------
    # Copied verbatim from profiles/current_settings.sh: CGPADDR collects CIDs
    # with a valid 4-octet IPv4 (first octet > 0); QMAP is authoritative (first
    # non-zero IP wins); CGPADDR is the fallback; default "1".
    cgpaddr_cids=$(printf '%s\n' "$blob" | awk -F'[,"]' '
        /\+CGPADDR:/ {
            cid = $1; gsub(/[^0-9]/, "", cid)
            ip = $3
            if (ip != "" && ip != "0.0.0.0" && ip !~ /^0+(\.0+)*$/) {
                split(ip, octets, ".")
                if (length(octets) == 4 && octets[1]+0 > 0) {
                    print cid
                }
            }
        }
    ')
    qmap_cid=$(printf '%s\n' "$blob" | awk -F',' '
        /\+QMAP:/ {
            gsub(/"/, "", $5)
            ip = $5
            cid = $3
            gsub(/[^0-9]/, "", cid)
            if (ip != "" && ip != "0.0.0.0" && ip != "0:0:0:0:0:0:0:0") {
                print cid
                exit
            }
        }
    ')
    if [ -n "$qmap_cid" ]; then
        active_cid="$qmap_cid"
    elif [ -n "$cgpaddr_cids" ]; then
        active_cid=$(printf '%s\n' "$cgpaddr_cids" | head -1)
    else
        active_cid="1"
    fi

    profiles_json=$(read_profiles_json)

    # --- Build the profile-slot list ---------------------------------------
    # Surface every CID slot 1-MAX that is NOT a carrier (IMS/SOS) context — a
    # slot is emitted even when undefined on the modem and absent from config,
    # so the UI shows an empty, editable row the user can populate. Only the
    # carrier-managed contexts are hidden. name/apn/pdp_type come from the
    # config entry if present, else live values, else empty. name is kept OUT
    # of the TSV stream (injected via jq below).
    tsv=""
    cid=1
    while [ "$cid" -le "$MAX_PROFILES" ]; do
        cgd_line=$(printf '%s\n' "$cgdcont_raw" | grep "^+CGDCONT: $cid,")
        live_apn=""
        live_pdp=""
        if [ -n "$cgd_line" ]; then
            pdp_raw=$(printf '%s' "$cgd_line" | awk -F'"' '{print $2}')
            live_apn=$(printf '%s' "$cgd_line" | awk -F'"' '{print $4}')
            live_pdp=$(pdp_to_frontend "$pdp_raw")

            # Carrier-managed (IMS/SOS) contexts are not user-editable data APN
            # slots — drop them entirely so they never appear in the list.
            if [ -n "$(apn_type_of "$live_apn")" ]; then
                cid=$((cid + 1))
                continue
            fi
        fi
        state=$(get_cgact_state "$cid")
        [ "$state" = "1" ] && enabled=1 || enabled=0
        [ "$cid" = "$active_cid" ] && is_active=1 || is_active=0
        # 5 tab-separated columns; name + config overrides applied in jq.
        tsv="${tsv}${cid}	${live_apn}	${live_pdp}	${enabled}	${is_active}
"
        cid=$((cid + 1))
    done

    profiles_json=$(printf '%s' "$tsv" | jq -Rsc --argjson cfg "$profiles_json" '
        split("\n") | map(select(length > 0) | split("\t") | . as $r |
            (if ($cfg[$r[0]] == null) then {} else $cfg[$r[0]] end) as $c | {
                index:    ($r[0] | tonumber),
                cid:      ($r[0] | tonumber),
                name:     ((if $c.name == null then "" else $c.name end) | tostring),
                apn:      (if (if $c.apn == null then "" else $c.apn end) == "" then $r[1] else $c.apn end),
                pdp_type: (if (if $c.pdp_type == null then "" else $c.pdp_type end) == "" then $r[2] else $c.pdp_type end),
                enabled:  ($r[3] == "1"),
                is_active:($r[4] == "1"),
                apn_type: ""
            })')

    if [ -z "$profiles_json" ]; then
        die "parse_failed" "Could not assemble APN profile list"
    fi

    qlog_info "APN profiles: $(printf '%s' "$profiles_json" | jq -c 'length') data slots, active_cid=$active_cid"

    jq -n \
        --argjson profiles "$profiles_json" \
        --argjson max "$MAX_PROFILES" \
        --argjson active "$active_cid" \
        '{
            success: true,
            max_profiles: $max,
            active_cid: $active,
            internet_cid: $active,
            profiles: $profiles
        }'
    exit 0
fi

# =============================================================================
# POST — apply a profile change ({"action":"save"|"toggle", ...})
# =============================================================================
if [ "$REQUEST_METHOD" = "POST" ]; then

    cgi_read_post
    ACTION=$(printf '%s' "$POST_DATA" | jq -r 'if .action == null then empty else .action end')

    # --- Common: validate the target slot index (1-6 == CID) ---------------
    IDX=$(printf '%s' "$POST_DATA" | jq -r 'if .index == null then "" else (.index | tostring) end')
    case "$IDX" in
        *[!0-9]*|"") die "invalid_index" "index must be a number 1-${MAX_PROFILES}" ;;
    esac
    if [ "$IDX" -lt 1 ] || [ "$IDX" -gt "$MAX_PROFILES" ]; then
        die "invalid_index" "index must be 1-${MAX_PROFILES}"
    fi

    # -----------------------------------------------------------------------
    # action: toggle — activate/deactivate one PDP context
    # -----------------------------------------------------------------------
    if [ "$ACTION" = "toggle" ]; then
        ENABLED=$(printf '%s' "$POST_DATA" | jq -r 'if .enabled == true then "1" elif .enabled == false then "0" else "" end')
        [ -z "$ENABLED" ] && die "missing_fields" "enabled (boolean) is required"

        qlog_info "Toggle profile $IDX -> enabled=$ENABLED"
        if ! run_at "AT+CGACT=$ENABLED,$IDX" >/dev/null; then
            die "cgact_failed" "AT+CGACT=$ENABLED,$IDX failed"
        fi
        cgi_success
        exit 0
    fi

    # -----------------------------------------------------------------------
    # action: save — write APN, PDP type, name; then reattach
    # -----------------------------------------------------------------------
    if [ "$ACTION" = "save" ]; then
        NAME=$(printf '%s' "$POST_DATA" | jq -r 'if .name == null then "" else .name end')
        APN=$(printf '%s' "$POST_DATA" | jq -r 'if .apn == null then "" else .apn end')
        PDP=$(printf '%s' "$POST_DATA" | jq -r 'if .pdp_type == null then "" else .pdp_type end')

        # --- Validate ------------------------------------------------------
        [ -z "$APN" ] && die "missing_fields" "apn is required"
        PDP_AT=$(pdp_to_at "$PDP")
        [ -z "$PDP_AT" ] && die "invalid_pdp_type" "pdp_type must be ipv4, ipv6, or ipv4v6"

        # Reject embedded double-quotes: they would break the quoted AT args.
        case "$APN" in
            *'"'*) die "invalid_value" "APN may not contain a double-quote" ;;
        esac

        qlog_info "Save profile $IDX: apn=$APN pdp=$PDP_AT"

        # --- Persist the config entry (filesystem) before touching the modem.
        if ! write_profile_entry "$IDX" "$NAME" "$APN" "$PDP"; then
            qlog_warn "Failed to persist APN profile for CID $IDX to $PROFILE_FILE"
        fi

        # Apply order: deregister -> write APN -> re-register.
        #
        # Why a full attach cycle (not AT+CGACT=0,<cid> / AT+CGACT=1,<cid>):
        # in EPS (LTE / 5G-NSA), the default EPS bearer for CID 1 is
        # established at *attach time* and the APN is a contract field with
        # the MME/PGW. AT+CGACT only cycles the user-plane of an already-
        # established bearer — the MME keeps the original APN. The new
        # CGDCONT value never reaches the network. AT+COPS=2 forces a full
        # detach, so the next AT+COPS=0 attach carries the freshly-written
        # APN in its Attach Request and the PGW builds a new bearer.
        #
        # The CGI runs on lighttpd via LAN/Wi-Fi to the modem; the cellular
        # WAN drops briefly during the cycle, but the HTTP/SSH path to the
        # modem itself does not. No buffer sleep is needed — run_at goes
        # through qcmd's flock, which is synchronous on OK/ERROR.

        # Helper: best-effort re-register on the error path. Never leave
        # the modem detached after a partial save.
        cops_recover() { run_at "AT+COPS=0" >/dev/null 2>&1 || true; }

        # --- Step 1: deregister from the network --------------------------
        if ! run_at "AT+COPS=2" >/dev/null; then
            die "cops_detach_failed" "AT+COPS=2 (deregister) failed for CID $IDX"
        fi

        # --- Step 2: APN + PDP type ---------------------------------------
        if ! run_at "AT+CGDCONT=$IDX,\"$PDP_AT\",\"$APN\"" >/dev/null; then
            cops_recover
            die "cgdcont_failed" "AT+CGDCONT failed for CID $IDX"
        fi

        # --- Step 3: re-register so the modem attaches with the new APN ---
        # AT+COPS=0 = automatic operator selection. The MME/PGW build a
        # fresh default EPS bearer using the CGDCONT value written above.
        if ! run_at "AT+COPS=0" >/dev/null; then
            die "cops_attach_failed" "AT+COPS=0 (re-register) failed for CID $IDX"
        fi

        cgi_success
        exit 0
    fi

    die "invalid_action" "action must be 'save' or 'toggle'"
fi

# --- Method not allowed -------------------------------------------------------
cgi_method_not_allowed
