#!/usr/bin/env bash
set -euo pipefail
# Run on the deploy runner after activate-production.sh succeeds (OIDC path).

repos_root_has_ship_verify_siblings() {
  local candidate="$1"
  [[ -n "$candidate" ]] || return 1
  [[ -f "${candidate}/balcony-log/scripts/run-manifest-ship-verify.py" ]] \
    && [[ -f "${candidate}/directory/scripts/pi_dryl_common.py" ]]
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
if ! "${py[@]}" -c "import paramiko" 2>/dev/null; then
  req="${root}/directory/scripts/requirements.txt"
  echo "[shipVerify] installing Python deps for manifest runner"
  if [[ -f "$req" ]]; then
    "${py[@]}" -m pip install --user -q -r "$req"
  else
    "${py[@]}" -m pip install --user -q paramiko
  fi
fi
"${py[@]}" "${root}/balcony-log/scripts/run-manifest-ship-verify.py"
