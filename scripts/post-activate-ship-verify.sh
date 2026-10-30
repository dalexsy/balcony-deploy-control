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
  echo "[shipVerify] installing Python deps for manifest runner"
  if command -v apt-get >/dev/null 2>&1; then
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3-paramiko
  else
    req="${root}/directory/scripts/requirements.txt"
    if [[ -f "$req" ]] && "${py[@]}" -m pip --version >/dev/null 2>&1; then
      "${py[@]}" -m pip install --user -q -r "$req"
    elif "${py[@]}" -m pip --version >/dev/null 2>&1; then
      "${py[@]}" -m pip install --user -q paramiko
    else
      echo "[fail] paramiko required (apt: python3-paramiko or enable pip)" >&2
      exit 1
    fi
  fi
fi
"${py[@]}" "${root}/balcony-log/scripts/run-manifest-ship-verify.py"
