#!/usr/bin/env bash
# Start local-only Webmail preview with mocked browser API, assert GET / 200,
# run real Chrome layout checks, and remove the temporary dev process.
set -euo pipefail
cd "$(dirname "$0")/.."
port=5189
if ss -ltn | grep -q ":$port "; then
  echo 'Webmail preview port is occupied; refusing to disturb another process' >&2
  exit 2
fi
log=$(mktemp /tmp/atoman-webmail-vite.XXXXXXXX)
web_pid=''
cleanup() {
  if [[ -n "$web_pid" ]]; then kill "$web_pid" 2>/dev/null || true; wait "$web_pid" 2>/dev/null || true; fi
  rm -f "$log"
}
trap cleanup EXIT INT TERM
VITE_API_URL=/api/v1 VITE_DEV_PROXY_TARGET=http://127.0.0.1:9 \
  node node_modules/vite/bin/vite.js --mode development --host 127.0.0.1 --port "$port" --strictPort >"$log" 2>&1 &
web_pid=$!
ready=''
for attempt in $(seq 1 50); do
  status=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/" || true)
  if [[ "$status" == 200 ]]; then ready=1; break; fi
  kill -0 "$web_pid" 2>/dev/null || { tail -n 40 "$log" >&2; exit 1; }
  sleep 1
done
[[ "$ready" == 1 ]] || { tail -n 50 "$log" >&2; echo 'GET / did not return 200' >&2; exit 1; }
echo 'MAIL_PREVIEW_GET_ROOT_HTTP_200'
MAIL_PREVIEW_URL="http://127.0.0.1:$port" node scripts/check-mail-webmail-preview.cjs
