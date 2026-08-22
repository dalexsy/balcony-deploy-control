#!/usr/bin/env bash
set -euo pipefail

artifact="${1:?artifact tarball}"
digest="${2:?sha256 digest}"
sha="${3:?commit sha}"
prod="${PROD_HOST:-192.168.178.79}"

echo "${digest}  ${artifact}" | sha256sum -c -
scp -o BatchMode=yes -o ConnectTimeout=8 \
  "$artifact" "pi@${prod}:/tmp/balcony-activate.tar.gz"
ssh -o BatchMode=yes -o ConnectTimeout=8 "pi@${prod}" \
  "DIGEST=${digest} SHA=${sha} bash -s" <<'REMOTE'
set -euo pipefail
echo "${DIGEST}  /tmp/balcony-activate.tar.gz" | sha256sum -c -
mkdir -p /home/pi/balcony-log
tar -C /home/pi/balcony-log -xzf /tmp/balcony-activate.tar.gz
test "$(python3 -c 'import json; print(json.load(open("/home/pi/balcony-log/build-manifest.json"))["commitSha"])')" = "$SHA"
sudo -n systemctl restart balcony-log

deadline=$((SECONDS + 45))
while (( SECONDS < deadline )); do
  active="$(systemctl is-active balcony-log 2>/dev/null || true)"
  status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
    --max-time 2 http://127.0.0.1:3838/api/health || true)"
  if [[ "$active" == "active" && "$status" == "200" ]]; then
    echo "[ok] balcony-log active and /api/health returned 200"
    exit 0
  fi
  sleep 1
done

echo "[fail] balcony-log did not become ready after activation" >&2
systemctl status balcony-log --no-pager >&2 || true
journalctl -u balcony-log -n 50 --no-pager >&2 || true
exit 1
REMOTE
