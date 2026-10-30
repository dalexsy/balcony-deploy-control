#!/usr/bin/env bash
set -euo pipefail
# Run on the deploy runner after activate-production.sh succeeds (OIDC path).
# Native Go shipVerify — no python3 / paramiko on the runner success path.

repos_root_has_ship_verify_siblings() {
  local candidate="$1"
  [[ -n "$candidate" ]] || return 1
  [[ -f "${candidate}/directory/scripts/dryl-static-sites.json" ]] \
    && [[ -f "${candidate}/directory/tools/fleetctl/main.go" ]] \
    && [[ -f "${candidate}/balcony-log/package.json" ]]
}

resolve_repos_root() {
  local candidate
  for candidate in \
    "${REPOS_ROOT:-}" \
    "${GITHUB_WORKSPACE:-}" \
    "$(cd "$(dirname "$0")/../.." && pwd)" \
    "${HOME}/Repos"; do
    if repos_root_has_ship_verify_siblings "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  echo "[fail] shipVerify REPOS_ROOT: need balcony-log + directory siblings (set REPOS_ROOT or check out both under GITHUB_WORKSPACE)" >&2
  return 1
}

root="$(resolve_repos_root)"
export REPOS_ROOT="$root"
export AGENT_DRYL_USER="${AGENT_DRYL_USER:-agent}"
export AGENT_DRYL_PASS="${AGENT_DRYL_PASS:-${DRYL_PASS:-}}"
if [[ -z "${AGENT_DRYL_PASS}" ]]; then
  echo "[fail] shipVerify needs AGENT_DRYL_PASS or DRYL_PASS in runner env" >&2
  exit 1
fi
if ! command -v go >/dev/null 2>&1; then
  echo "[fail] go required for native manifest shipVerify (fleetctl ship-verify)" >&2
  exit 1
fi
go run -C "${root}/directory/tools/fleetctl" . ship-verify balcony --directory "${root}/directory" --repos-root "$root"
