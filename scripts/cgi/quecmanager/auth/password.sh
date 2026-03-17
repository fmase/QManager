#!/bin/sh
# password.sh — Password change endpoint.
# POST {"current_password":"...","new_password":"..."}
# Requires valid session (normal auth enforcement via cgi_base.sh)
. /usr/lib/qmanager/cgi_base.sh

qlog_init "cgi_auth_password"
cgi_headers
cgi_handle_options

if [ "$REQUEST_METHOD" != "POST" ]; then
    cgi_method_not_allowed
fi

cgi_read_post

_current=$(printf '%s' "$POST_DATA" | jq -r '.current_password // empty')
_new=$(printf '%s' "$POST_DATA" | jq -r '.new_password // empty')

if [ -z "$_current" ] || [ -z "$_new" ]; then
    cgi_error "missing_fields" "Both current_password and new_password are required"
    exit 0
fi

# Validate new password length
_pw_len=$(printf '%s' "$_new" | wc -c)
if [ "$_pw_len" -lt 6 ]; then
    cgi_error "password_too_short" "New password must be at least 6 characters"
    exit 0
fi

# Verify current password
if ! qm_verify_password "$_current"; then
    cgi_error "invalid_password" "Current password is incorrect"
    exit 0
fi

# Save new password
qm_save_password "$_new"
qlog_info "Password changed successfully"

# Invalidate session — forces re-login with new password
qm_destroy_session

cgi_success
