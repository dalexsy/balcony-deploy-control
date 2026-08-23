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
grep -qE '^DRYL_ENV=staging($|[^A-Za-z0-9_])' "${target}/.env"
echo "${digest}  ${artifact}" | sha256sum -c -
tar -C "$target" -xzf "$artifact"
test "$(python3 -c "import json; print(json.load(open('${target}/build-manifest.json'))['commitSha'])")" = "$sha"
sudo -n systemctl restart balcony-log

deadline=$((SECONDS + 180))
while (( SECONDS < deadline )); do
  active="$(systemctl is-active balcony-log 2>/dev/null || true)"
  health="$(curl -fsS --max-time 2 http://127.0.0.1:3838/api/health || true)"
  manifest="$(curl -fsS --max-time 2 http://127.0.0.1:3838/api/build-manifest || true)"
  ready="$(HEALTH="$health" MANIFEST="$manifest" SHA="$sha" ASSET="$asset" python3 - <<'PY'
import json, os
try:
    health = json.loads(os.environ.get("HEALTH") or "{}")
    manifest = json.loads(os.environ.get("MANIFEST") or "{}")
    stream = health.get("stream") or {}
    issues = health.get("issues") or []
    ok = (
        health.get("ok") is True
        and stream.get("connected") is True
        and stream.get("remuxInitReady") is True
        and issues == []
        and health.get("watchAssetVersion") == os.environ["ASSET"]
        and manifest.get("commitSha") == os.environ["SHA"]
        and manifest.get("watchAssetVersion") == os.environ["ASSET"]
    )
    print("1" if ok else "0")
except Exception:
    print("0")
PY
)"
  if [[ "$active" == "active" && "$ready" == "1" ]]; then
    echo "[ok] staging serves candidate sha=${sha} asset=${asset}"
    exit 0
  fi
  sleep 2
done

echo "[fail] staging did not serve candidate sha=${sha} asset=${asset}" >&2
systemctl status balcony-log --no-pager >&2 || true
journalctl -u balcony-log -n 50 --no-pager >&2 || true
exit 1
