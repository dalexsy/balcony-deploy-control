#!/usr/bin/env bash
set -euo pipefail
# Fail-closed: activate-production must invoke post-activate shipVerify on OIDC (non-static) success.
root="$(cd "$(dirname "$0")/.." && pwd)"
activate="${root}/scripts/activate-production.sh"
grep -q 'run_post_activate_ship_verify' "$activate"
grep -q 'post-activate-ship-verify.sh' "$activate"
export DRYL_ACTIVATE_SKIP_REMOTE=1
export REPOS_ROOT="${REPOS_ROOT:-${HOME}/Repos}"
bash "$activate" /dev/null deadbeef "${DRYL_ACTIVATE_TEST_SHA:-deadbeef}" restart 2>&1 | tee /tmp/activate-ship-hook-test.log
grep -q '\[activate\] post-activate manifest shipVerify' /tmp/activate-ship-hook-test.log
grep -q '\[shipVerify\] ok balcony' /tmp/activate-ship-hook-test.log
echo "[ok] activate-production post-activate shipVerify hook"
