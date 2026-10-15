#!/usr/bin/env bash
set -Eeuo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
project_name="dkb-integration-${USER:-unknown}-$$"
compose=(docker compose -f "$repo_root/compose.test.yml" -p "$project_name")
port=${TEST_POSTGRES_PORT:-55432}

cleanup() {
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

if ! command -v docker >/dev/null 2>&1; then
  echo "integration tests require Docker and Docker Compose" >&2
  exit 2
fi
if ! command -v cargo >/dev/null 2>&1; then
  echo "integration tests require Cargo (Rust toolchain)" >&2
  exit 2
fi

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

DATABASE_URL="postgres://integration:integration@127.0.0.1:${port}/integration" \
  cargo test --locked --test store_integration --test api_integration -- --test-threads=1
