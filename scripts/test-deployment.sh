#!/usr/bin/env bash
set -Eeuo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
project_name="dkb-deployment-${USER:-unknown}-$$"
app_port=${DEPLOYMENT_APP_PORT:-18082}
oidc_port=${DEPLOYMENT_OIDC_PORT:-18083}
compose=(docker compose -f "$repo_root/compose.deployment.yml" -p "$project_name")

cleanup() {
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

for command in docker curl node; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "deployment tests require $command" >&2
    exit 2
  fi
done

export DEPLOYMENT_APP_PORT="$app_port"
export DEPLOYMENT_OIDC_PORT="$oidc_port"
"${compose[@]}" config >/dev/null
"${compose[@]}" up --detach --build

for attempt in $(seq 1 90); do
  if curl --fail --silent -H 'Host: localhost' "http://127.0.0.1:${app_port}/readyz" >/dev/null; then
    break
  fi
  if [[ "$attempt" == 90 ]]; then
    echo "container did not become ready within 90 seconds" >&2
    "${compose[@]}" logs >&2 || true
    exit 1
  fi
  sleep 1
done

health=$(curl --fail --silent -H 'Host: localhost' "http://127.0.0.1:${app_port}/healthz")
[[ "$health" == *'"status":"ok"'* ]]
ready=$(curl --fail --silent -H 'Host: localhost' "http://127.0.0.1:${app_port}/readyz")
[[ "$ready" == *'"status":"ready"'* ]]
homepage=$(curl --fail --silent -H 'Host: localhost' "http://127.0.0.1:${app_port}/")
[[ "$homepage" == *'<div id="root"></div>'* ]]
config=$(curl --fail --silent -H 'Host: localhost' "http://127.0.0.1:${app_port}/config.js")
[[ "$config" == *'http://oidc:8081'* ]]
[[ "$config" != *'GEMINI_API_KEY'* ]]

secure_headers=$(curl --fail --silent --dump-header - --output /dev/null \
  -H 'Host: localhost' -H 'X-Forwarded-Proto: https' \
  "http://127.0.0.1:${app_port}/healthz")
grep -iq '^strict-transport-security: max-age=31536000; includeSubDomains' <<<"$secure_headers"
grep -iq '^content-security-policy:' <<<"$secure_headers"

invalid_host=$(curl --silent --output /dev/null --write-out '%{http_code}' \
  -H 'Host: attacker.invalid' "http://127.0.0.1:${app_port}/healthz")
[[ "$invalid_host" == 400 ]]

allowed_cors=$(curl --fail --silent --dump-header - --output /dev/null -X OPTIONS \
  -H 'Host: localhost' -H "Origin: http://localhost:${app_port}" \
  -H 'Access-Control-Request-Method: PUT' \
  "http://127.0.0.1:${app_port}/api/rules")
grep -iq "^access-control-allow-origin: http://localhost:${app_port}" <<<"$allowed_cors"
blocked_cors=$(curl --silent --dump-header - --output /dev/null -X OPTIONS \
  -H 'Host: localhost' -H 'Origin: https://attacker.invalid' \
  -H 'Access-Control-Request-Method: PUT' \
  "http://127.0.0.1:${app_port}/api/rules")
! grep -iq '^access-control-allow-origin: https://attacker.invalid' <<<"$blocked_cors"

token=$(node "$repo_root/tests/e2e/get-token.mjs" "http://127.0.0.1:${oidc_port}/token")
rule_payload='{"rules":[{"keyword":"CONTAINER SHOP","category":"items","column":"recipient"}]}'
curl --fail --silent -X PUT -H 'Host: localhost' -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' -d "$rule_payload" \
  "http://127.0.0.1:${app_port}/api/rules" >/dev/null
rules=$(curl --fail --silent -H 'Host: localhost' -H "Authorization: Bearer $token" \
  "http://127.0.0.1:${app_port}/api/rules")
[[ "$rules" == *'CONTAINER SHOP'* ]]

"${compose[@]}" restart app >/dev/null
for attempt in $(seq 1 60); do
  if curl --fail --silent -H 'Host: localhost' "http://127.0.0.1:${app_port}/readyz" >/dev/null; then
    break
  fi
  if [[ "$attempt" == 60 ]]; then
    echo "container did not recover after restart" >&2
    exit 1
  fi
  sleep 1
done
reloaded_rules=$(curl --fail --silent -H 'Host: localhost' -H "Authorization: Bearer $token" \
  "http://127.0.0.1:${app_port}/api/rules")
[[ "$reloaded_rules" == *'CONTAINER SHOP'* ]]

app_id=$("${compose[@]}" ps -q app)
readonly_root=$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' "$app_id")
[[ "$readonly_root" == 'true' ]]
runtime_user=$(docker inspect -f '{{.Config.User}}' "$app_id")
[[ "$runtime_user" == 'app' || "$runtime_user" == '10001' ]]
cap_drop=$(docker inspect -f '{{json .HostConfig.CapDrop}}' "$app_id")
grep -q 'ALL' <<<"$cap_drop"

echo "deployment smoke passed"
