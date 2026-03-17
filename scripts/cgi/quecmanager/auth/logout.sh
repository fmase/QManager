#!/bin/sh
# logout.sh — Session invalidation endpoint.
# POST — destroys the current session
_SKIP_AUTH=1
. /usr/lib/qmanager/cgi_base.sh

qlog_init "cgi_auth_logout"
cgi_headers
cgi_handle_options

if [ "$REQUEST_METHOD" != "POST" ]; then
    cgi_method_not_allowed
fi

# Validate the token before destroying (prevent unauthenticated session wipe)
_token=$(_extract_bearer_token)
if [ -n "$_token" ] && qm_validate_token "$_token"; then
    qm_destroy_session
    qlog_info "Session destroyed via logout"
fi

cgi_success
