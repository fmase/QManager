#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
# =============================================================================
# quality_thresholds.sh — CGI: Connection Quality Thresholds (GET + POST)
# =============================================================================
# GET:  Returns the latency + loss presets. When the UCI section is ABSENT the
#       endpoint reports the tolerant/tolerant default with isDefault=true (the
#       absence IS the "default" signal — the section is never seeded).
# POST: action=save — validates both presets, creates the section if absent,
#       persists, then drops /tmp/qmanager_quality_reload so the poller re-maps
#       the presets to its QUALITY_* event-threshold globals within one cycle.
#
# Config: UCI quecmanager.quality_thresholds.{latency_preset,loss_preset}
#   latency_preset ∈ standard | tolerant | very-tolerant
#   loss_preset    ∈ standard | tolerant | very-tolerant
# The poller (resolve_quality_thresholds) owns the preset->numeric mapping.
#
# Endpoint: GET/POST /cgi-bin/quecmanager/system/quality_thresholds.sh
# Install location: /www/cgi-bin/quecmanager/system/quality_thresholds.sh
# =============================================================================

qlog_init "cgi_quality_thresholds"
cgi_headers
cgi_handle_options

RELOAD_FLAG="/tmp/qmanager_quality_reload"

# =============================================================================
# GET — Fetch quality thresholds (presence-aware)
# =============================================================================
if [ "$REQUEST_METHOD" = "GET" ]; then
    qlog_info "Fetching quality thresholds"

    if uci -q get quecmanager.quality_thresholds >/dev/null 2>&1; then
        latency_preset=$(uci -q get quecmanager.quality_thresholds.latency_preset 2>/dev/null)
        [ -z "$latency_preset" ] && latency_preset="tolerant"
        loss_preset=$(uci -q get quecmanager.quality_thresholds.loss_preset 2>/dev/null)
        [ -z "$loss_preset" ] && loss_preset="tolerant"

        jq -n \
            --arg lat "$latency_preset" \
            --arg loss "$loss_preset" \
            '{success: true,
              thresholds: {latency: {preset: $lat}, loss: {preset: $loss}},
              isDefault: false}'
    else
        # Section absent — report the default with isDefault=true.
        jq -n '{success: true,
                thresholds: {latency: {preset: "tolerant"}, loss: {preset: "tolerant"}},
                isDefault: true}'
    fi
    exit 0
fi

# =============================================================================
# POST — Save quality thresholds
# =============================================================================
if [ "$REQUEST_METHOD" = "POST" ]; then
    cgi_read_post

    ACTION=$(printf '%s' "$POST_DATA" | jq -r '.action // empty')
    if [ -z "$ACTION" ]; then
        cgi_error "missing_action" "action field is required"
        exit 0
    fi

    if [ "$ACTION" != "save" ]; then
        cgi_error "unknown_action" "Unknown action: $ACTION"
        exit 0
    fi

    LATENCY_PRESET=$(printf '%s' "$POST_DATA" | jq -r '.latency_preset // empty')
    LOSS_PRESET=$(printf '%s' "$POST_DATA" | jq -r '.loss_preset // empty')

    # --- Validate both against the 3-value allowlist ---
    case "$LATENCY_PRESET" in
        standard|tolerant|very-tolerant) ;;
        *)
            cgi_error "invalid_preset" "latency_preset must be one of: standard, tolerant, very-tolerant"
            exit 0
            ;;
    esac
    case "$LOSS_PRESET" in
        standard|tolerant|very-tolerant) ;;
        *)
            cgi_error "invalid_preset" "loss_preset must be one of: standard, tolerant, very-tolerant"
            exit 0
            ;;
    esac

    # --- Persist (create section if absent) + signal the poller ---
    if ! uci -q get quecmanager.quality_thresholds >/dev/null 2>&1; then
        uci set quecmanager.quality_thresholds=quality_thresholds
    fi
    uci set quecmanager.quality_thresholds.latency_preset="$LATENCY_PRESET"
    uci set quecmanager.quality_thresholds.loss_preset="$LOSS_PRESET"
    uci commit quecmanager

    touch "$RELOAD_FLAG"

    qlog_info "Quality thresholds saved: latency=$LATENCY_PRESET loss=$LOSS_PRESET"
    echo '{"success":true}'
    exit 0
fi

# Method not allowed
cgi_error "method_not_allowed" "Only GET and POST are supported"
