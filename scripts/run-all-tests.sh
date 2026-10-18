#!/usr/bin/env bash
set -Eeuo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
log_dir=$(mktemp -d)
results=()

cleanup() {
  rm -rf "$log_dir"
}
trap cleanup EXIT INT TERM

run_phase() {
  local name=$1
  local blocked=$2
  shift 2

  local log_file="$log_dir/${#results[@]}.log"
  local started_at finished_at status duration outcome
  started_at=$(date +%s)

  printf 'Running %s...\n' "$name"
  set +e
  if [[ "${TEST_VERBOSE:-0}" == '1' ]]; then
    (cd "$repo_root" && "$@")
    status=$?
  else
    (cd "$repo_root" && "$@") >"$log_file" 2>&1
    status=$?
  fi
  set -e

  finished_at=$(date +%s)
  duration=$((finished_at - started_at))

  if [[ "$status" == '0' ]]; then
    outcome='passed'
  elif [[ "$blocked" == '1' && "$status" == '2' ]]; then
    outcome='blocked'
  else
    outcome='failed'
  fi

  results+=("$outcome|$name|${duration}s")
  printf '%s %s (%ss)\n' \
    "$(case "$outcome" in passed) echo '✅';; blocked) echo '⚠️';; *) echo '❌';; esac)" \
    "$name $outcome" "$duration"

  if [[ "$outcome" == 'failed' ]]; then
    printf '%s\n' "--- recent $name output ---" >&2
    tail -n 40 "$log_file" >&2 || true
    printf '%s\n' '--- end output ---' >&2
  fi
}

skip_phase() {
  local name=$1
  local reason=$2

  results+=("skipped|$name|not run")
  printf '⏭️ %s skipped (%s)\n' "$name" "$reason"
}

run_phase 'Rust build' 0 cargo build --locked
run_phase 'Unit tests' 0 npm run test:unit -- --reporter=dot
run_phase 'Component tests' 0 npm run test:components -- --reporter=line
skip_phase 'Integration tests' 'Docker disabled'
skip_phase 'Production E2E tests' 'Docker disabled'
skip_phase 'Deployment tests' 'Docker disabled'

printf '\nTest summary\n'
printf '%-24s %-10s %s\n' 'Phase' 'Status' 'Duration'
printf '%-24s %-10s %s\n' '------------------------' '----------' '--------'

failed_count=0
blocked_count=0
skipped_count=0
for result in "${results[@]}"; do
  IFS='|' read -r outcome name duration <<<"$result"
  printf '%-24s %-10s %s\n' "$name" "$outcome" "$duration"
  [[ "$outcome" == 'failed' ]] && ((failed_count += 1))
  [[ "$outcome" == 'blocked' ]] && ((blocked_count += 1))
  [[ "$outcome" == 'skipped' ]] && ((skipped_count += 1))
done

printf '\nOverall: %d passed, %d skipped, %d blocked, %d failed\n' \
  $(( ${#results[@]} - skipped_count - blocked_count - failed_count )) \
  "$skipped_count" "$blocked_count" "$failed_count"

if (( failed_count > 0 )); then
  exit 1
fi

if (( blocked_count > 0 )); then
  exit 2
fi
