#!/bin/sh
. /usr/lib/qmanager/cgi_base.sh
# =============================================================================
# ssh_password.sh — CGI Endpoint: Change SSH (root) Password
# =============================================================================
# Validates the current root password against /etc/shadow by re-hashing with
# mkpasswd, then applies the new password via chpasswd.
#
# POST body: {"current_password":"...","new_password":"...","enforce_strong":true}
# Session: required (standard QManager cookie via cgi_base.sh).
#
# Endpoint: POST /cgi-bin/quecmanager/system/ssh_password.sh
# Install location: /www/cgi-bin/quecmanager/system/ssh_password.sh
# =============================================================================

qlog_init "cgi_ssh_password"
cgi_headers
cgi_handle_options

if [ "$REQUEST_METHOD" != "POST" ]; then
    cgi_error "method_not_allowed" "Use POST"
    exit 0
fi

cgi_read_post

_current=$(printf '%s' "$POST_DATA" | jq -r '.current_password // empty' 2>/dev/null)
_new=$(printf '%s' "$POST_DATA" | jq -r '.new_password // empty' 2>/dev/null)
_enforce_strong=$(printf '%s' "$POST_DATA" | jq -r 'if .enforce_strong == false then "false" else "true" end' 2>/dev/null)

if [ -z "$_current" ] || [ -z "$_new" ]; then
    cgi_error "missing_fields" "Both current_password and new_password are required"
    exit 0
fi

# --- New-password policy (mirrors auth/password.sh exactly) -----------------
_pw_len=$(printf '%s' "$_new" | wc -c)
if [ "$_enforce_strong" = "false" ]; then
    if [ "$_pw_len" -lt 5 ]; then
        cgi_error "password_weak" "New password must be at least 5 characters"
        exit 0
    fi
else
    if [ "$_pw_len" -lt 5 ] \
       || ! printf '%s' "$_new" | grep -q '[A-Z]' \
       || ! printf '%s' "$_new" | grep -q '[a-z]' \
       || ! printf '%s' "$_new" | grep -q '[0-9]'; then
        cgi_error "password_weak" "New password must be at least 5 characters and include uppercase, lowercase, and a number"
        exit 0
    fi
fi

# --- Validate current password against /etc/shadow --------------------------
if [ ! -r /etc/shadow ]; then
    qlog_error "Cannot read /etc/shadow (uhttpd not running as root?)"
    cgi_error "shadow_unreadable" "Could not read system password file"
    exit 0
fi

_shadow_line=$(awk -F: '$1 == "root" { print $2 }' /etc/shadow 2>/dev/null)
if [ -z "$_shadow_line" ]; then
    qlog_error "No root entry in /etc/shadow"
    cgi_error "shadow_unreadable" "Could not read system password file"
    exit 0
fi

# /etc/shadow hash field format: $id$salt$hash
#   id=1 md5, id=5 sha-256, id=6 sha-512
_hash_id=$(printf '%s' "$_shadow_line" | awk -F'$' '{ print $2 }')
_hash_salt=$(printf '%s' "$_shadow_line" | awk -F'$' '{ print $3 }')

case "$_hash_id" in
    5) _hash_method="sha-256" ;;
    6) _hash_method="sha-512" ;;
    *)
        qlog_error "Unsupported hash id in /etc/shadow: $_hash_id"
        cgi_error "hash_parse_failed" "Unsupported password hash format"
        exit 0
        ;;
esac

if [ -z "$_hash_salt" ]; then
    qlog_error "Empty salt in /etc/shadow root entry"
    cgi_error "hash_parse_failed" "Unsupported password hash format"
    exit 0
fi

_recomputed=$(mkpasswd -m "$_hash_method" -S "$_hash_salt" "$_current" 2>/dev/null)
if [ -z "$_recomputed" ] || [ "$_recomputed" != "$_shadow_line" ]; then
    # Flatten response-time channel on mismatch
    sleep 1
    cgi_error "invalid_password" "Current password is incorrect"
    exit 0
fi

# --- Apply new password via chpasswd stdin ----------------------------------
printf 'root:%s\n' "$_new" | chpasswd 2>/dev/null
_rc=$?
if [ "$_rc" -ne 0 ]; then
    qlog_error "chpasswd failed (rc=$_rc)"
    cgi_error "chpasswd_failed" "Failed to apply new password"
    exit 0
fi

qlog_info "SSH root password updated"
cgi_success
