#!/bin/sh
# Thin bootstrap wrapper for one-liner installs.
# It downloads the latest pre-release tarball, verifies sha256, then runs install/uninstall.

set -e

REPO="${QMANAGER_REPO:-dr-dolomite/QManager}"
TAG="${QMANAGER_TAG:-}"
ACTION="install"

usage() {
    cat <<'EOF'
QManager bootstrap installer

Usage:
  sh qmanager-installer.sh [--uninstall] [--tag <tag>] [--repo <owner/repo>]

Options:
  --uninstall      Run uninstall.sh instead of install.sh
  --tag <tag>      Use an explicit release tag (for example: v0.1.14)
  --repo <repo>    Override repository (default: dr-dolomite/QManager)
  -h, --help       Show this help

Environment overrides:
  QMANAGER_TAG     Same as --tag
  QMANAGER_REPO    Same as --repo
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --uninstall)
            ACTION="uninstall"
            ;;
        --tag)
            shift
            [ "$#" -gt 0 ] || { echo "Missing value for --tag" >&2; exit 1; }
            TAG="$1"
            ;;
        --repo)
            shift
            [ "$#" -gt 0 ] || { echo "Missing value for --repo" >&2; exit 1; }
            REPO="$1"
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
    shift
done

fetch_text() {
    url="$1"

    if command -v uclient-fetch >/dev/null 2>&1; then
        uclient-fetch -qO- "$url" 2>/dev/null && return 0
    fi

    if command -v wget >/dev/null 2>&1; then
        wget -qO- "$url" 2>/dev/null && return 0
    fi

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$url" 2>/dev/null && return 0
    fi

    return 1
}

download_file() {
    url="$1"
    out="$2"

    if command -v wget >/dev/null 2>&1; then
        wget -q -O "$out" "$url" && return 0
    fi

    if command -v uclient-fetch >/dev/null 2>&1; then
        uclient-fetch -qO "$out" "$url" && return 0
    fi

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL -o "$out" "$url" && return 0
    fi

    return 1
}

if [ -z "$TAG" ]; then
    API="https://api.github.com/repos/${REPO}/releases?per_page=20"
    JSON="$(fetch_text "$API" || true)"

    [ -n "$JSON" ] || {
        echo "Failed to fetch release metadata from ${API}" >&2
        exit 1
    }

    TAG="$(printf '%s' "$JSON" \
        | tr -d '\n' \
        | sed 's/},{/}\
{/g' \
        | sed -n '/"prerelease":[[:space:]]*true/{s/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p;q}')"
fi

[ -n "$TAG" ] || {
    echo "Failed to resolve latest pre-release tag" >&2
    exit 1
}

BASE="https://github.com/${REPO}/releases/download/${TAG}"
WORK_DIR="/tmp/qmanager-bootstrap"

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"

cleanup() {
    rm -rf "$WORK_DIR"
}

trap cleanup EXIT INT TERM

cd "$WORK_DIR"

download_file "$BASE/qmanager.tar.gz" qmanager.tar.gz || {
    echo "Failed to download qmanager.tar.gz from ${BASE}" >&2
    exit 1
}

download_file "$BASE/sha256sum.txt" sha256sum.txt || {
    echo "Failed to download sha256sum.txt from ${BASE}" >&2
    exit 1
}

command -v sha256sum >/dev/null 2>&1 || {
    echo "sha256sum is required but not available" >&2
    exit 1
}

command -v tar >/dev/null 2>&1 || {
    echo "tar is required but not available" >&2
    exit 1
}

sha256sum -c sha256sum.txt

if tar xzf qmanager.tar.gz 2>/dev/null; then
    :
elif command -v gzip >/dev/null 2>&1; then
    gzip -dc qmanager.tar.gz | tar xf -
else
    echo "Unable to extract qmanager.tar.gz (tar -z/gzip missing)" >&2
    exit 1
fi

if [ "$ACTION" = "uninstall" ]; then
    sh "$WORK_DIR/qmanager_install/uninstall.sh"
else
    sh "$WORK_DIR/qmanager_install/install.sh"
fi
