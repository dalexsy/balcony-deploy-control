#!/usr/bin/env bash
set -euo pipefail
# Run on the deploy runner after activate-production.sh succeeds (OIDC path).
root="${REPOS_ROOT:-${HOME}/Repos}"
if [[ ! -d "${root}/balcony-log" ]]; then
  root="$(cd "$(dirname "$0")/../.." && pwd)"
fi
python3 "${root}/balcony-log/scripts/run-manifest-ship-verify.py"
