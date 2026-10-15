#!/usr/bin/env bash
set -Eeuo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
project_name="dkb-e2e-${USER:-unknown}-$$"
db_port=${TEST_POSTGRES_PORT:-55433}
api_port=${E2E_API_PORT:-18080}
oidc_port=${E2E_OIDC_PORT:-18081}
compose=(docker compose -f "$repo_root/compose.test.yml" -p "$project_name")
api_pid=''
oidc_pid=''

cleanup() {
  if [[ -n "$api_pid" ]]; then
    kill "$api_pid" >/dev/null 2>&1 || true
    wait "$api_pid" >/dev/null 2>&1 || true
  fi
  if [[ -n "$oidc_pid" ]]; then
    kill "$oidc_pid" >/dev/null 2>&1 || true
    wait "$oidc_pid" >/dev/null 2>&1 || true
  fi
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

for command in docker cargo npm curl; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "production E2E tests require $command" >&2
    exit 2
  fi
done

export TEST_POSTGRES_PORT="$db_port"
npm --prefix "$repo_root" run build
"${compose[@]}" up --detach
for attempt in $(seq 1 60); do
  if "${compose[@]}" exec --no-TTY postgres pg_isready -U integration -d integration >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == 60 ]]; then
    echo "PostgreSQL did not become ready within 60 seconds" >&2
    exit 1
  fi
  sleep 1
done

OIDC_PORT="$oidc_port" OIDC_CLIENT_ID=e2e-client node "$repo_root/tests/e2e/oidc-stub.mjs" \
  >"$repo_root/oidc-e2e.log" 2>&1 &
oidc_pid=$!

for attempt in $(seq 1 30); do
  if curl --fail --silent "http://127.0.0.1:${oidc_port}/.well-known/openid-configuration" >/dev/null; then
    break
  fi
  if ! kill -0 "$oidc_pid" >/dev/null 2>&1; then
    cat "$repo_root/oidc-e2e.log" >&2
    exit 1
  fi
  if [[ "$attempt" == 30 ]]; then
    echo "OIDC stub did not become ready within 30 seconds" >&2
    exit 1
  fi
  sleep 1
done

(
  cd "$repo_root"
  exec env \
    DATABASE_URL="postgres://integration:integration@127.0.0.1:${db_port}/integration" \
    KEYCLOAK_ISSUER="http://127.0.0.1:${oidc_port}" \
    KEYCLOAK_CLIENT_ID=e2e-client \
    ALLOWED_ORIGINS="http://127.0.0.1:${api_port}" \
    ALLOWED_HOSTS="127.0.0.1,localhost" \
    FRONTEND_DIR="$repo_root/frontend/dist" \
    PORT="$api_port" \
    LEGACY_RULE_STORE_PATH='' \
    cargo run --locked
) >"$repo_root/api-e2e.log" 2>&1 &
api_pid=$!

for attempt in $(seq 1 90); do
  if curl --fail --silent -H 'Host: 127.0.0.1' "http://127.0.0.1:${api_port}/healthz" >/dev/null; then
    break
  fi
  if ! kill -0 "$api_pid" >/dev/null 2>&1; then
    cat "$repo_root/api-e2e.log" >&2
    exit 1
  fi
  if [[ "$attempt" == 90 ]]; then
    echo "API did not become ready within 90 seconds" >&2
    exit 1
  fi
  sleep 1
done

set +e
E2E_BASE_URL="http://127.0.0.1:${api_port}" \
  npx --prefix "$repo_root" playwright test --config="$repo_root/playwright.e2e.config.js"
status=$?
set -e
if [[ "$status" != 0 ]]; then
  echo '--- OIDC stub log ---' >&2
  cat "$repo_root/oidc-e2e.log" >&2 || true
  echo '--- API log ---' >&2
  cat "$repo_root/api-e2e.log" >&2 || true
fi
exit "$status"
