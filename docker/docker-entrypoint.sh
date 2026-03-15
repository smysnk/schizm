#!/bin/sh
set -eu

. /app/docker/container-bootstrap.sh

cmd="${1:-web}"

if [ "$#" -gt 0 ]; then
  shift
fi

case "$cmd" in
  web)
    cd /app/packages/web
    exec node ../../node_modules/next/dist/bin/next start -H 0.0.0.0 -p "${WEB_PORT:-3000}" "$@"
    ;;
  api)
    configure_ssh
    configure_codex_auth
    sync_document_store_repo
    cd /app
    exec node packages/server/dist/index.js "$@"
    ;;
  *)
    exec "$cmd" "$@"
    ;;
esac
