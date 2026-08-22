#!/usr/bin/env bash
set -euo pipefail

artifact="${1:?artifact tarball}"
digest="${2:?sha256 digest}"
sha="${3:?commit sha}"
asset="${4:?watch asset version}"
expected_host="${STAGING_HOSTNAME:-dryl-staging}"
target="/home/pi/balcony-log"

test "$(hostname)" = "$expected_host"
test -f "${target}/.env"
grep -qx 'DRYL_ENV=staging' "${target}/.env"
echo "${digest}  ${artifact}" | sha256sum -c -
tar -C "$target" -xzf "$artifact"
test "$(python3 -c "import json; print(json.load(open('${target}/build-manifest.json'))['commitSha'])")" = "$sha"
sudo -n systemctl restart balcony-log

deadline=$((SECONDS + 45))
while (( SECONDS < deadline )); do
  active="$(systemctl is-active balcony-log 2>/dev/null || true)"
  actual="$(curl -fsS --max-time 2 http://127.0.0.1:3838/api/health \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("watchAssetVersion", ""))' \
    2>/dev/null || true)"
  if [[ "$active" == "active" && "$actual" == "$asset" ]]; then
    echo "[ok] staging serves candidate sha=${sha} asset=${asset}"
    exit 0
  fi
  sleep 1
done

echo "[fail] staging did not serve candidate asset ${asset}" >&2
systemctl status balcony-log --no-pager >&2 || true
journalctl -u balcony-log -n 50 --no-pager >&2 || true
exit 1
