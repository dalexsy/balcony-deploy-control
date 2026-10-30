#!/usr/bin/env bash
set -euo pipefail
# Run on the deploy runner after activate-production.sh succeeds (OIDC path).
root="${REPOS_ROOT:-${HOME}/Repos}"
if [[ ! -d "${root}/balcony-log" ]]; then
  if [[ -n "${GITHUB_WORKSPACE:-}" && -d "${GITHUB_WORKSPACE}/balcony-log" ]]; then
    root="${GITHUB_WORKSPACE}"
  else
    root="$(cd "$(dirname "$0")/../.." && pwd)"
  fi
fi
py=(python3)
if ! command -v python3 >/dev/null 2>&1; then
  if command -v py >/dev/null 2>&1; then
    py=(py -3)
  elif command -v python >/dev/null 2>&1; then
    py=(python)
  else
    echo "[fail] python3 required for manifest shipVerify" >&2
    exit 1
  fi
fi
"${py[@]}" "${root}/balcony-log/scripts/run-manifest-ship-verify.py"
