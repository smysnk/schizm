#!/bin/sh
set -eu

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
    cd /app
    exec node packages/server/dist/index.js "$@"
    ;;
  *)
    exec "$cmd" "$@"
    ;;
esac
