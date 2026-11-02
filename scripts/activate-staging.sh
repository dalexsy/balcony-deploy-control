#!/usr/bin/env bash
set -euo pipefail

artifact="${1:?artifact tarball}"
digest="${2:?sha256 digest}"
sha="${3:?commit sha}"
asset="${4:?watch asset version}"
mode="${5:-restart}"
expected_host="${STAGING_HOSTNAME:-dryl-staging}"
target="/home/pi/balcony-log"

test "$(hostname)" = "$expected_host"
test -f "${target}/.env"
grep -qE '^DRYL_ENV=staging($|[^A-Za-z0-9_])' "${target}/.env"
echo "${digest}  ${artifact}" | sha256sum -c -
tar -C "$target" -xzf "$artifact"
check="${target}/tools/activation-check"
test -x "$check"
test "$("$check" field commitSha "${target}/build-manifest.json")" = "$sha"
# The process must load the candidate stamp, including a static candidate.
sudo -n systemctl restart balcony-log

deadline=$((SECONDS + 180))
while (( SECONDS < deadline )); do
  active="$(systemctl is-active balcony-log 2>/dev/null || true)"
  health="$(curl -fsS --max-time 2 http://127.0.0.1:3838/api/health || true)"
  manifest="$(curl -fsS --max-time 2 http://127.0.0.1:3838/api/build-manifest || true)"
  ready="$(HEALTH="$health" MANIFEST="$manifest" "$check" staging "$sha" "$asset" 2>/dev/null || echo 0)"
  if [[ "$active" == "active" && "$ready" == "1" ]]; then
    echo "[ok] staging serves candidate sha=${sha} asset=${asset} mode=${mode}"
    exit 0
  fi
  sleep 2
done

echo "[fail] staging did not serve candidate sha=${sha} asset=${asset} mode=${mode}" >&2
systemctl status balcony-log --no-pager >&2 || true
journalctl -u balcony-log -n 50 --no-pager >&2 || true
exit 1
