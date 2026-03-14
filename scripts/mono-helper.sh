#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_DIR="$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)"
LOCAL_MONO_HELPER="${SCRIPT_DIR}/../../mono-helper/mono-helper"

set -a
[ -f "${REPO_DIR}/.env" ] && . "${REPO_DIR}/.env"
[ -f "${REPO_DIR}/.env.local" ] && . "${REPO_DIR}/.env.local"
set +a

if [ -x "${LOCAL_MONO_HELPER}" ]; then
  exec "${LOCAL_MONO_HELPER}" "$@"
fi

if command -v mono-helper >/dev/null 2>&1; then
  exec mono-helper "$@"
fi

echo "mono-helper not found. Expected ${LOCAL_MONO_HELPER} or a mono-helper binary in PATH." >&2
exit 1
