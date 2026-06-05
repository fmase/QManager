#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
. /usr/lib/qmanager/cgi_at.sh
. /usr/lib/qmanager/apn_mgr.sh
# =============================================================================
# apn.sh — CGI Endpoint: APN Profile Management (GET + POST), AT-only
# =============================================================================
# RM551E-GL / RM520N-GL have no Casa RDB key-value store and no wmmd daemon, so
# every live profile field is sourced directly from AT commands through qcmd.
#
# MODEL (v2): the device keeps exactly FIVE stored data-profile slots (ids 1-5)
# in a JSON sidecar, plus a single "active" pointer. Activating a slot writes
# its APN to the modem and makes it the mutually-exclusive live data profile —
# there is only ever ONE active slot (the lone `active` field enforces this).
#
# A stored slot is decoupled from a modem CID: each slot carries its OWN target
# `cid` (1-6), so the user can stage several profiles and flip the live one
# without re-typing. Saving an INACTIVE slot is JSON-only; saving the ACTIVE
# slot (or activating any slot) drives the COPS detach/attach cycle so the new
# APN is negotiated with the carrier at attach time.
#
# Separately, the GET response still surfaces the modem's raw context table
# (CIDs 1-6) under `cids`, with IMS/SOS contexts TAGGED (not dropped) via
# apn_type_of(), so the UI can show what each hardware context currently holds.
#
# "Active CID" (the live WAN-bearing context) is derived inline from the
# AT+QMAP="WWAN" / AT+CGPADDR sections of one compound query — never via
# detect_active_cid(), which would re-query and negate the single round-trip.
#
# GET  -> { max_profiles, active_profile, active_cid, internet_cid,
#           profiles[5], cids[6] }
# POST -> {"action":"save"|"activate"|"clear", ...} applies a change.
#
# AT commands used (GET):
#   AT+CGDCONT?;+CGACT?;+CGPADDR;+QMAP="WWAN"   -> one round-trip, four sections
#     +CGDCONT: defined PDP contexts (CID, PDP type, APN)
#     +CGACT:   per-context activation state
#     +CGPADDR: per-CID assigned IP (active-CID fallback)
#     +QMAP:    authoritative WAN CID + IP
#
# AT commands used (POST save/activate):
#   AT+COPS=2                            -> deregister  (force full detach)
#   AT+CGDCONT=<cid>,"<PDP_AT>","<apn>"  -> define APN + PDP type
#   AT+COPS=0                            -> re-register (attaches with new APN)
#
# Endpoint: GET/POST /cgi-bin/quecmanager/cellular/apn.sh
# Install location: <docroot>/cgi-bin/quecmanager/cellular/apn.sh
# =============================================================================

# --- Logging -----------------------------------------------------------------
qlog_init "cgi_apn"
cgi_headers
cgi_handle_options

# =============================================================================
# Helpers
# =============================================================================
# v2 config I/O (MAX_SLOTS, MAX_CID, PROFILE_FILE, LEGACY_NAME_FILE, EMPTY_V2,
# pdp_to_at/pdp_to_frontend, normalize_v2, read_config_v2, write_config_v2),
# the COPS apply cycle (apply_apn_to_modem, cops_recover) and the active-slot
# reapply helper all live in /usr/lib/qmanager/apn_mgr.sh (sourced above).

# die <error_code> <detail> — emit a JSON error and stop. CGI exits 0; the
# client distinguishes success via the "success" field, not the HTTP status.
die() {
    qlog_error "$1: ${2:-}"
    cgi_error "$1" "${2:-}"
    exit 0
}

# Carrier-provisioned APN classification (case-insensitive substring match).
# IMS (VoLTE) and SOS/emergency/XCAP/RCS contexts are operator-managed. Unlike
# the prior version, a non-empty result no longer DROPS the row — it only TAGS
# the modem-context entry under `cids` so the UI can label it. The five stored
# `profiles` slots are unaffected by this classifier.
apn_type_of() {
    _at_lc=$(printf '%s' "$1" | tr 'A-Z' 'a-z')
    case "$_at_lc" in
        *ims*)                               echo "ims" ;;
        *sos*|*emergency*|*xcap*|*rcs*)      echo "emergency" ;;
        *)                                   echo "" ;;
    esac
}

# =============================================================================
# GET — 5 stored slots + raw modem context table
# =============================================================================
if [ "$REQUEST_METHOD" = "GET" ]; then
    qlog_info "Listing APN profiles (v2, AT)"

    # One compound call. Each qcmd invocation carries a fixed per-call cost
    # (process spawn + flock + modem channel handshake) that dominates the AT
    # payload itself; chaining all four queries pays that cost once.
    blob=$(run_at 'AT+CGDCONT?;+CGACT?;+CGPADDR;+QMAP="WWAN"')
    cgdcont_raw=$(printf '%s\n' "$blob" | grep '+CGDCONT:')

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

    # --- Modem context table (cids[]): every CID 1..MAX_CID, tagged ---------
    # No carrier-skip: IMS/SOS contexts are kept and TAGGED via apn_type_of so
    # the UI can label them. apn = live CGDCONT string ("" if undefined),
    # is_internet = (cid == active_cid). Streamed as TSV (apn last column; it
    # may legitimately be empty) then assembled with jq for correct typing.
    cids_tsv=""
    cid=1
    while [ "$cid" -le "$MAX_CID" ]; do
        cgd_line=$(printf '%s\n' "$cgdcont_raw" | grep "^+CGDCONT: $cid,")
        live_apn=""
        if [ -n "$cgd_line" ]; then
            live_apn=$(printf '%s' "$cgd_line" | awk -F'"' '{print $4}')
        fi
        apn_type=$(apn_type_of "$live_apn")
        [ "$cid" = "$active_cid" ] && is_internet=1 || is_internet=0
        # 4 columns: cid, apn_type, is_internet, apn. apn is LAST because it can
        # be empty — a trailing empty field survives the awk/split round-trip.
        cids_tsv="${cids_tsv}${cid}	${apn_type}	${is_internet}	${live_apn}
"
        cid=$((cid + 1))
    done

    cids_json=$(printf '%s' "$cids_tsv" | jq -Rsc '
        split("\n") | map(select(length > 0) | split("\t") | {
            cid:         (.[0] | tonumber),
            apn_type:    (if .[1] == null then "" else .[1] end),
            is_internet: (.[2] == "1"),
            apn:         (if .[3] == null then "" else .[3] end)
        })')
    [ -z "$cids_json" ] && die "parse_failed" "Could not assemble modem context list"

    # --- Stored slots (profiles[]): the 5 config slots, NOT the modem -------
    config_json=$(read_config_v2)
    active_profile=$(printf '%s' "$config_json" | jq -r '.active')

    profiles_json=$(printf '%s' "$config_json" | jq -c '
        (.active) as $act
        | .profiles | map({
            id:        .id,
            name:      (if .name == null then "" else .name end),
            apn:       (if .apn == null then "" else .apn end),
            pdp_type:  (if .pdp_type == null then "ipv4v6" else .pdp_type end),
            cid:       (if .cid == null then 1 else .cid end),
            is_active: (.id == $act)
        })')
    [ -z "$profiles_json" ] && die "parse_failed" "Could not assemble stored profile list"

    qlog_info "APN v2: 5 slots, active_profile=$active_profile, active_cid=$active_cid"

    jq -n \
        --argjson profiles "$profiles_json" \
        --argjson cids "$cids_json" \
        --argjson max "$MAX_SLOTS" \
        --argjson active_profile "$active_profile" \
        --argjson active_cid "$active_cid" \
        '{
            success: true,
            max_profiles: $max,
            active_profile: $active_profile,
            active_cid: $active_cid,
            internet_cid: $active_cid,
            profiles: $profiles,
            cids: $cids
        }'
    exit 0
fi

# =============================================================================
# POST — {"action":"save"|"activate"|"clear", ...}
# =============================================================================
if [ "$REQUEST_METHOD" = "POST" ]; then

    cgi_read_post
    ACTION=$(printf '%s' "$POST_DATA" | jq -r 'if .action == null then empty else .action end')

    # -----------------------------------------------------------------------
    # action: save — persist a slot; re-apply to the modem only if it's active
    # -----------------------------------------------------------------------
    if [ "$ACTION" = "save" ]; then
        ID=$(printf '%s' "$POST_DATA" | jq -r 'if .id == null then "" else (.id | tostring) end')
        SLOT_CID=$(printf '%s' "$POST_DATA" | jq -r 'if .cid == null then "" else (.cid | tostring) end')
        NAME=$(printf '%s' "$POST_DATA" | jq -r 'if .name == null then "" else .name end')
        APN=$(printf '%s' "$POST_DATA" | jq -r 'if .apn == null then "" else .apn end')
        PDP=$(printf '%s' "$POST_DATA" | jq -r 'if .pdp_type == null then "" else .pdp_type end')

        # --- Validate slot id (1..MAX_SLOTS) -------------------------------
        case "$ID" in
            ''|*[!0-9]*) die "invalid_id" "id must be an integer 1-${MAX_SLOTS}" ;;
        esac
        if [ "$ID" -lt 1 ] || [ "$ID" -gt "$MAX_SLOTS" ]; then
            die "invalid_id" "id must be 1-${MAX_SLOTS}"
        fi

        # --- Validate target cid (1..MAX_CID) ------------------------------
        case "$SLOT_CID" in
            ''|*[!0-9]*) die "invalid_cid" "cid must be an integer 1-${MAX_CID}" ;;
        esac
        if [ "$SLOT_CID" -lt 1 ] || [ "$SLOT_CID" -gt "$MAX_CID" ]; then
            die "invalid_cid" "cid must be 1-${MAX_CID}"
        fi

        # --- Validate apn + pdp_type ---------------------------------------
        [ -z "$APN" ] && die "missing_fields" "apn is required"
        case "$APN" in
            *'"'*) die "invalid_value" "APN may not contain a double-quote" ;;
        esac
        PDP_AT=$(pdp_to_at "$PDP")
        [ -z "$PDP_AT" ] && die "invalid_pdp_type" "pdp_type must be ipv4, ipv6, or ipv4v6"

        qlog_info "Save slot $ID: apn=$APN pdp=$PDP_AT cid=$SLOT_CID"

        # --- Persist the slot (merge by id) before touching the modem ------
        config_json=$(read_config_v2)
        new_config=$(printf '%s' "$config_json" | jq -c \
            --argjson id "$ID" \
            --arg name "$NAME" \
            --arg apn "$APN" \
            --arg pdp "$PDP" \
            --argjson cid "$SLOT_CID" \
            '.profiles |= map(
                if .id == $id
                then { id: .id, name: $name, apn: $apn, pdp_type: $pdp, cid: $cid }
                else . end
            )' 2>/dev/null)
        [ -z "$new_config" ] && die "persist_failed" "Could not build updated config for slot $ID"
        if ! write_config_v2 "$new_config"; then
            die "persist_failed" "Could not write apn_profiles.json for slot $ID"
        fi

        # --- Re-apply to the modem ONLY if this slot is the active one -----
        # An inactive-slot save is JSON-only; only the live profile drives the
        # COPS cycle (and the brief WAN drop that comes with it).
        active_id=$(printf '%s' "$new_config" | jq -r '.active')
        if [ "$active_id" = "$ID" ]; then
            qlog_info "Slot $ID is active — applying to modem (cid=$SLOT_CID)"
            apply_apn_to_modem "$SLOT_CID" "$PDP_AT" "$APN" || die "$APN_APPLY_ERR_CODE" "$APN_APPLY_ERR_DETAIL"
        fi

        cgi_success
        exit 0
    fi

    # -----------------------------------------------------------------------
    # action: activate — make a slot the live, mutually-exclusive data profile
    # -----------------------------------------------------------------------
    if [ "$ACTION" = "activate" ]; then
        ID=$(printf '%s' "$POST_DATA" | jq -r 'if .id == null then "" else (.id | tostring) end')
        case "$ID" in
            ''|*[!0-9]*) die "invalid_id" "id must be an integer 1-${MAX_SLOTS}" ;;
        esac
        if [ "$ID" -lt 1 ] || [ "$ID" -gt "$MAX_SLOTS" ]; then
            die "invalid_id" "id must be 1-${MAX_SLOTS}"
        fi

        # --- Load the slot from config -------------------------------------
        config_json=$(read_config_v2)
        SLOT_APN=$(printf '%s' "$config_json" | jq -r \
            --argjson id "$ID" '.profiles[] | select(.id == $id) | .apn')
        SLOT_PDP=$(printf '%s' "$config_json" | jq -r \
            --argjson id "$ID" '.profiles[] | select(.id == $id) | .pdp_type')
        SLOT_CID=$(printf '%s' "$config_json" | jq -r \
            --argjson id "$ID" '.profiles[] | select(.id == $id) | .cid')

        [ -z "$SLOT_APN" ] && die "empty_profile" "cannot activate a profile with no APN"

        PDP_AT=$(pdp_to_at "$SLOT_PDP")
        # Slots normalize to a valid pdp_type, but guard anyway before AT.
        [ -z "$PDP_AT" ] && PDP_AT="IPV4V6"

        qlog_info "Activate slot $ID: apn=$SLOT_APN pdp=$PDP_AT cid=$SLOT_CID"

        # --- Drive the modem first; the modem is the live source of truth --
        apply_apn_to_modem "$SLOT_CID" "$PDP_AT" "$SLOT_APN" || die "$APN_APPLY_ERR_CODE" "$APN_APPLY_ERR_DETAIL"

        # --- Persist the active pointer. If this fails AFTER a successful
        # modem write, still report success: the modem is already live on the
        # new profile, so failing the request would mislead the UI. Warn only.
        new_config=$(printf '%s' "$config_json" | jq -c \
            --argjson id "$ID" '.active = $id' 2>/dev/null)
        if [ -n "$new_config" ] && write_config_v2 "$new_config"; then
            :
        else
            qlog_warn "Activated slot $ID on modem but failed to persist active pointer"
        fi

        jq -n --argjson id "$ID" '{success: true, active: $id}'
        exit 0
    fi

    # -----------------------------------------------------------------------
    # action: clear — empty a slot (refuse if it is the active one)
    # -----------------------------------------------------------------------
    if [ "$ACTION" = "clear" ]; then
        ID=$(printf '%s' "$POST_DATA" | jq -r 'if .id == null then "" else (.id | tostring) end')
        case "$ID" in
            ''|*[!0-9]*) die "invalid_id" "id must be an integer 1-${MAX_SLOTS}" ;;
        esac
        if [ "$ID" -lt 1 ] || [ "$ID" -gt "$MAX_SLOTS" ]; then
            die "invalid_id" "id must be 1-${MAX_SLOTS}"
        fi

        config_json=$(read_config_v2)
        active_id=$(printf '%s' "$config_json" | jq -r '.active')
        if [ "$active_id" = "$ID" ]; then
            die "active_locked" "deactivate or switch profiles before clearing the active one"
        fi

        qlog_info "Clear slot $ID"
        new_config=$(printf '%s' "$config_json" | jq -c \
            --argjson id "$ID" \
            '.profiles |= map(
                if .id == $id
                then { id: .id, name: "", apn: "", pdp_type: "ipv4v6", cid: 1 }
                else . end
            )' 2>/dev/null)
        [ -z "$new_config" ] && die "persist_failed" "Could not build cleared config for slot $ID"
        if ! write_config_v2 "$new_config"; then
            die "persist_failed" "Could not write apn_profiles.json for slot $ID"
        fi

        cgi_success
        exit 0
    fi

    die "invalid_action" "action must be save, activate, or clear"
fi

# --- Method not allowed -------------------------------------------------------
cgi_method_not_allowed
