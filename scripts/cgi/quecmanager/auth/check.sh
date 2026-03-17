#!/bin/sh
# check.sh — Session validity check endpoint.
# GET — returns auth status without enforcing (used by frontend on app load)
_SKIP_AUTH=1
. /usr/lib/qmanager/cgi_base.sh

qlog_init "cgi_auth_check"
cgi_headers

# Setup mode check
if is_setup_required; then
    jq -n '{"authenticated":false,"setup_required":true}'
    exit 0
fi

# Try to validate the token from Authorization header
_token=$(_extract_bearer_token)
if [ -n "$_token" ] && qm_validate_token "$_token"; then
    jq -n '{"authenticated":true}'
else
    jq -n '{"authenticated":false}'
fi
