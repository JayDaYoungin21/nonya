#!/bin/sh
set -eu

if [ -n "${DISPLAY:-}" ]; then
  if ! pgrep -x Xvfb >/dev/null 2>&1; then
    Xvfb "${DISPLAY}" -screen 0 1920x1080x24 >/tmp/xvfb.log 2>&1 &
    sleep 0.5
  fi
fi

exec "$@"
