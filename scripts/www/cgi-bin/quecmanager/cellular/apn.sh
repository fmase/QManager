#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
. /usr/lib/qmanager/cgi_at.sh
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

# --- Configuration -----------------------------------------------------------
MAX_SLOTS=5                                          # stored profile slots (ids 1-5)
MAX_CID=6                                            # modem PDP contexts surfaced
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

# --- v2 config read ----------------------------------------------------------
# read_config_v2 — always print a VALID 5-slot v2 JSON object on stdout. Never
# errors: a missing or corrupt file yields a fresh empty v2 doc. Performs the
# one-time migration from prior on-disk shapes and writes the migrated doc back
# so the next read is a straight load.
#
# Migration precedence:
#   1. Already v2 (has version==2 and a profiles array)  -> normalize to 5 slots.
#   2. Old shape {"<cid>":{name,apn,pdp_type}}           -> lowest cid -> slot 1
#                                                           (active=1 if apn set).
#   3. Legacy apn_names.json {"<cid>":"<name>"}          -> lowest cid name ->
#                                                           slot 1, no apn,
#                                                           active=0.
#   4. Nothing                                           -> 5 empty slots,
#                                                           active=0.
#
# Invariant enforced on every path: a slot with an EMPTY apn is never `active`.
EMPTY_V2='{"version":2,"active":0,"profiles":[{"id":1,"name":"","apn":"","pdp_type":"ipv4v6","cid":1},{"id":2,"name":"","apn":"","pdp_type":"ipv4v6","cid":1},{"id":3,"name":"","apn":"","pdp_type":"ipv4v6","cid":1},{"id":4,"name":"","apn":"","pdp_type":"ipv4v6","cid":1},{"id":5,"name":"","apn":"","pdp_type":"ipv4v6","cid":1}]}'

# normalize_v2 <raw_v2_json> — coerce an arbitrary v2-ish object into exactly 5
# ordered slots (ids 1-5), each field type-checked and null-guarded, with the
# empty-slot-cannot-be-active invariant applied. Prints normalized JSON, or
# nothing (rc 1) if the input is not valid JSON.
normalize_v2() {
    printf '%s' "$1" | jq -c '
        # Index incoming profiles by id for lookup; tolerate a missing array.
        ( (if .profiles == null then [] else .profiles end)
          | map(select(type == "object"))
          | map({ key: ((if .id == null then 0 else .id end) | tostring), value: . })
          | from_entries
        ) as $by
        | (if .active == null then 0 else (.active | if type == "number" then . else 0 end) end) as $rawactive
        | { version: 2,
            profiles: ( [ range(1;6) as $i
              | (($by[($i|tostring)]) | if . == null then {} else . end) as $s
              | { id: $i,
                  name: (if $s.name == null then "" else ($s.name | tostring) end),
                  apn:  (if $s.apn  == null then "" else ($s.apn  | tostring) end),
                  pdp_type: (
                      (if $s.pdp_type == null then "ipv4v6" else ($s.pdp_type | tostring) end) as $p
                      | if ($p == "ipv4" or $p == "ipv6" or $p == "ipv4v6") then $p else "ipv4v6" end
                  ),
                  cid: (
                      (if $s.cid == null then 1 else $s.cid end) as $c
                      | (if ($c | type) == "number" then $c else 1 end) as $c
                      | if ($c >= 1 and $c <= 6) then $c else 1 end
                  )
                } ] )
          }
        # Enforce: active must point at a 1-5 slot whose apn is non-empty.
        | . as $doc
        | ( $doc.profiles | map(select(.apn != "") | .id) ) as $eligible
        | .active = (if ($eligible | index($rawactive)) != null then $rawactive else 0 end)
    ' 2>/dev/null
}

read_config_v2() {
    _rc_raw=""
    if [ -f "$PROFILE_FILE" ]; then
        _rc_raw=$(jq -c '.' "$PROFILE_FILE" 2>/dev/null)
    fi

    # --- Path 1: already a v2 doc -> normalize, persist if it changed. -------
    if [ -n "$_rc_raw" ]; then
        _rc_isv2=$(printf '%s' "$_rc_raw" | jq -r '
            if (.version == 2 and (.profiles | type) == "array") then "yes" else "no" end' 2>/dev/null)
        if [ "$_rc_isv2" = "yes" ]; then
            _rc_norm=$(normalize_v2 "$_rc_raw")
            [ -z "$_rc_norm" ] && _rc_norm="$EMPTY_V2"
            # Re-persist only when normalization actually changed the bytes, so
            # a steady-state read does not churn the file on every GET.
            if [ "$_rc_norm" != "$_rc_raw" ]; then
                write_config_v2 "$_rc_norm" || qlog_warn "read_config_v2: re-persist after normalize failed"
            fi
            printf '%s' "$_rc_norm"
            return 0
        fi
    fi

    # --- Path 2: old shape {"<cid>":{name,apn,pdp_type}} --------------------
    # Detect by: object whose first value is itself an object carrying apn/name.
    if [ -n "$_rc_raw" ]; then
        _rc_v2_from_old=$(printf '%s' "$_rc_raw" | jq -c '
            # Numeric-keyed cid -> object map. Take the lowest cid key.
            ( to_entries
              | map(select((.value | type) == "object"))
              | map(. + { _k: (.key | (tonumber? // null) | if . == null then 0 else . end) })
              | sort_by(._k)
            ) as $sorted
            | if ($sorted | length) == 0 then null
              else
                $sorted[0] as $first
                | ($first._k) as $cid
                | ($first.value) as $v
                | (if $v.name == null then "" else ($v.name | tostring) end) as $name
                | (if $v.apn  == null then "" else ($v.apn  | tostring) end) as $apn
                | ((if $v.pdp_type == null then "ipv4v6" else ($v.pdp_type | tostring) end)
                   | if (. == "ipv4" or . == "ipv6" or . == "ipv4v6") then . else "ipv4v6" end) as $pdp
                | (if ($cid >= 1 and $cid <= 6) then $cid else 1 end) as $cid
                | { version: 2,
                    active: (if $apn == "" then 0 else 1 end),
                    profiles: ( [ { id: 1, name: $name, apn: $apn, pdp_type: $pdp, cid: $cid } ]
                                + ( [ range(2;6) as $i
                                      | { id: $i, name: "", apn: "", pdp_type: "ipv4v6", cid: 1 } ] ) )
                  }
              end
        ' 2>/dev/null)
        if [ -n "$_rc_v2_from_old" ] && [ "$_rc_v2_from_old" != "null" ]; then
            _rc_norm=$(normalize_v2 "$_rc_v2_from_old")
            [ -z "$_rc_norm" ] && _rc_norm="$EMPTY_V2"
            write_config_v2 "$_rc_norm" || qlog_warn "read_config_v2: persist of migrated (old-shape) doc failed"
            qlog_info "Migrated apn_profiles.json from old cid-keyed shape to v2"
            printf '%s' "$_rc_norm"
            return 0
        fi
    fi

    # --- Path 3: legacy apn_names.json {"<cid>":"<name>"} ------------------
    if [ -f "$LEGACY_NAME_FILE" ]; then
        _rc_v2_from_names=$(jq -c '
            ( to_entries
              | map(select((.value | type) == "string"))
              | map(. + { _k: (.key | (tonumber? // null) | if . == null then 0 else . end) })
              | sort_by(._k)
            ) as $sorted
            | if ($sorted | length) == 0 then null
              else
                $sorted[0] as $first
                | (if ($first._k >= 1 and $first._k <= 6) then $first._k else 1 end) as $cid
                | { version: 2,
                    active: 0,
                    profiles: ( [ { id: 1, name: ($first.value | tostring),
                                    apn: "", pdp_type: "ipv4v6", cid: $cid } ]
                                + ( [ range(2;6) as $i
                                      | { id: $i, name: "", apn: "", pdp_type: "ipv4v6", cid: 1 } ] ) )
                  }
              end
        ' "$LEGACY_NAME_FILE" 2>/dev/null)
        if [ -n "$_rc_v2_from_names" ] && [ "$_rc_v2_from_names" != "null" ]; then
            _rc_norm=$(normalize_v2 "$_rc_v2_from_names")
            [ -z "$_rc_norm" ] && _rc_norm="$EMPTY_V2"
            write_config_v2 "$_rc_norm" || qlog_warn "read_config_v2: persist of migrated (legacy names) doc failed"
            qlog_info "Migrated legacy apn_names.json to v2 apn_profiles.json"
            printf '%s' "$_rc_norm"
            return 0
        fi
    fi

    # --- Path 4: nothing usable -> fresh empty v2 (persist so it's stable). --
    write_config_v2 "$EMPTY_V2" || qlog_warn "read_config_v2: persist of fresh empty v2 failed"
    printf '%s' "$EMPTY_V2"
    return 0
}

# write_config_v2 <json> — atomic write of the full v2 config object. Written
# by www-data (CGI runs as www-data; /usrdata/qmanager is world-writable), then
# chmod 644 on both the temp file (before move) and the final path (after), so
# the mode does not depend on the CGI process umask. Returns 1 on any failure.
write_config_v2() {
    _wc_json="$1"
    # Guard: never write non-JSON / empty content over the config.
    printf '%s' "$_wc_json" | jq -e '.' >/dev/null 2>&1 || return 1
    _wc_dir=$(dirname "$PROFILE_FILE")
    [ -d "$_wc_dir" ] || mkdir -p "$_wc_dir" 2>/dev/null
    _wc_tmp="${PROFILE_FILE}.tmp.$$"
    printf '%s\n' "$_wc_json" > "$_wc_tmp" 2>/dev/null || return 1
    chmod 644 "$_wc_tmp" 2>/dev/null
    mv "$_wc_tmp" "$PROFILE_FILE" 2>/dev/null || { rm -f "$_wc_tmp" 2>/dev/null; return 1; }
    chmod 644 "$PROFILE_FILE" 2>/dev/null
    return 0
}

# cops_recover — best-effort re-register on a post-detach error path. Never
# leave the modem detached after a partial APN write. Shared by save+activate.
cops_recover() { run_at "AT+COPS=0" >/dev/null 2>&1 || true; }

# apply_apn_to_modem <cid> <pdp_at> <apn> — drive the COPS detach/attach cycle
# that negotiates a new APN at attach time. On error it die()s with the precise
# stage code (after cops_recover() where the modem may be left detached).
#
# Why a full attach cycle (not AT+CGACT=0/1): on EPS (LTE / 5G-NSA) the default
# EPS bearer is established at *attach time* and the APN is a contract field
# with the MME/PGW. AT+CGACT only cycles the user-plane of an already-
# established bearer — the MME keeps the original APN, so the new CGDCONT value
# never reaches the network. AT+COPS=2 forces a full detach; the subsequent
# AT+COPS=0 attach carries the freshly-written APN and the PGW builds a new
# bearer. No sleeps: run_at goes through qcmd's flock, synchronous on OK/ERROR.
# The cellular WAN drops briefly but the LAN/Wi-Fi HTTP path to the modem does
# not, so the in-flight CGI response is unaffected. NO reboot, NO AT+CFUN.
apply_apn_to_modem() {
    _am_cid="$1"
    _am_pdp="$2"
    _am_apn="$3"

    # Step 1: deregister from the network.
    if ! run_at "AT+COPS=2" >/dev/null; then
        die "cops_detach_failed" "AT+COPS=2 (deregister) failed for CID $_am_cid"
    fi
    # Step 2: write APN + PDP type.
    if ! run_at "AT+CGDCONT=$_am_cid,\"$_am_pdp\",\"$_am_apn\"" >/dev/null; then
        cops_recover
        die "cgdcont_failed" "AT+CGDCONT failed for CID $_am_cid"
    fi
    # Step 3: re-register so the modem attaches with the new APN.
    if ! run_at "AT+COPS=0" >/dev/null; then
        die "cops_attach_failed" "AT+COPS=0 (re-register) failed for CID $_am_cid"
    fi
    return 0
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
            apply_apn_to_modem "$SLOT_CID" "$PDP_AT" "$APN"
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
        apply_apn_to_modem "$SLOT_CID" "$PDP_AT" "$SLOT_APN"

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
