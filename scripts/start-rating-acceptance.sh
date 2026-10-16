#!/usr/bin/env bash
set -euo pipefail

# --foreground：供人工浏览器检查；--test：自动跑完整浏览器验收。
# 两种模式均以前台方式运行，Ctrl-C/退出会回收服务和临时数据库。
mode="${1:---foreground}"
[[ "$mode" == --foreground || "$mode" == --test ]] || { echo '用法：bash scripts/start-rating-acceptance.sh [--foreground|--test]' >&2; exit 2; }
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend="${ATOMAN_BACKEND_DIR:-$root/../Atoman-Backend}"
export RATING_ACCEPTANCE_PORT="${RATING_ACCEPTANCE_PORT:-5187}"
export RATING_ACCEPTANCE_BACKEND_PORT="${RATING_ACCEPTANCE_BACKEND_PORT:-8187}"
db_port="${RATING_ACCEPTANCE_DB_PORT:-56437}"
export RATING_ACCEPTANCE_BASE_URL="http://127.0.0.1:$RATING_ACCEPTANCE_PORT"
backend_url="http://127.0.0.1:$RATING_ACCEPTANCE_BACKEND_PORT"
tmp="$(mktemp -d)"
container="atoman-rating-acceptance-$$"
api_pid=""
web_pid=""
cleanup() {
  trap - EXIT INT TERM
  [[ -z "$web_pid" ]] || kill "$web_pid" 2>/dev/null || true
  if [[ -n "$api_pid" ]]; then
    curl -fsS -X POST "$backend_url/__rating_acceptance/stop" >/dev/null 2>&1 || kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
  [[ -z "$web_pid" ]] || wait "$web_pid" 2>/dev/null || true
  docker stop "$container" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
wait_for() {
  local url="$1" pid="$2"
  for ((i=0; i<120; i++)); do
    [[ "$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)" == 200 ]] && return
    kill -0 "$pid" 2>/dev/null || { echo "服务提前退出：$url" >&2; return 1; }
    sleep 1
  done
  echo "等待 200 超时：$url" >&2
  return 1
}

cd "$root"
[[ -f "$backend/internal/app/rating_acceptance_test.go" ]] || { echo '请通过 ATOMAN_BACKEND_DIR 指定含验收 fixture 的后端仓库。' >&2; exit 1; }
[[ -x node_modules/.bin/vite ]] || bun install --frozen-lockfile
docker run --rm -d --name "$container" -e POSTGRES_DB=rating_acceptance -e POSTGRES_HOST_AUTH_METHOD=trust -p "127.0.0.1:$db_port:5432" postgres:16-alpine >/dev/null
for ((i=0; i<30; i++)); do
  docker exec "$container" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
export TEST_POSTGRES_DSN="postgres://postgres@127.0.0.1:$db_port/rating_acceptance?sslmode=disable"
(
  cd "$backend"
  GOFLAGS="${GOFLAGS:-} -buildvcs=false" go test -c -o "$tmp/api.test" ./internal/app
)
ENV=development FRONTEND_URL="$RATING_ACCEPTANCE_BASE_URL" REDIS_URL= "$tmp/api.test" -test.run '^TestServeRatingAcceptance$' -test.timeout 0 >"$tmp/backend.log" 2>&1 &
api_pid=$!
wait_for "$backend_url/__rating_acceptance" "$api_pid" || { tail -60 "$tmp/backend.log" >&2; exit 1; }
# 清除所有远端 API 配置；开发代理只指向本脚本创建的本地后端。
VITE_API_URL=/api/v1 VITE_DEV_PROXY_TARGET="$backend_url" VITE_DEV_PROXY_ORIGIN="$RATING_ACCEPTANCE_BASE_URL" \
  node node_modules/vite/bin/vite.js --mode development --host 127.0.0.1 --port "$RATING_ACCEPTANCE_PORT" --strictPort >"$tmp/frontend.log" 2>&1 &
web_pid=$!
wait_for "$RATING_ACCEPTANCE_BASE_URL/" "$web_pid" || { tail -60 "$tmp/frontend.log" >&2; exit 1; }
echo "GET / = 200；验收地址：$RATING_ACCEPTANCE_BASE_URL"
echo "测试数据：$backend_url/__rating_acceptance"
if [[ "$mode" == --test ]]; then
  bunx playwright test --config playwright.rating.config.ts
else
  wait "$web_pid"
fi
