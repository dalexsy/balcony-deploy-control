#!/usr/bin/env bash
set -euo pipefail

artifact="${1:?artifact tarball}"
digest="${2:?sha256 digest}"
sha="${3:?commit sha}"
mode="${4:-restart}"
prod="${PROD_HOST:-192.168.178.79}"

echo "${digest}  ${artifact}" | sha256sum -c -
scp -o BatchMode=yes -o ConnectTimeout=8 \
  "$artifact" "pi@${prod}:/tmp/balcony-activate.tar.gz"
ssh -o BatchMode=yes -o ConnectTimeout=8 "pi@${prod}" \
  "DIGEST=${digest} SHA=${sha} MODE=${mode} bash -s" <<'REMOTE'
set -euo pipefail
echo "${DIGEST}  /tmp/balcony-activate.tar.gz" | sha256sum -c -
mkdir -p /home/pi/balcony-log
tar -C /home/pi/balcony-log -xzf /tmp/balcony-activate.tar.gz
test "$(python3 -c 'import json; print(json.load(open("/home/pi/balcony-log/build-manifest.json"))["commitSha"])')" = "$SHA"

if [[ "${MODE}" != "static" ]]; then
  sudo -n systemctl restart balcony-log
fi

deadline=$((SECONDS + 45))
while (( SECONDS < deadline )); do
  active="$(systemctl is-active balcony-log 2>/dev/null || true)"
  status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
    --max-time 2 http://127.0.0.1:3838/api/health || true)"
  if [[ "$active" == "active" && "$status" == "200" ]]; then
    break
  fi
  sleep 1
done
if [[ "${active:-}" != "active" || "${status:-}" != "200" ]]; then
  echo "[fail] balcony-log did not become ready after activation" >&2
  systemctl status balcony-log --no-pager >&2 || true
  journalctl -u balcony-log -n 50 --no-pager >&2 || true
  exit 1
fi

manifest_ok="$(curl -fsS --max-time 2 http://127.0.0.1:3838/api/build-manifest \
  | python3 -c 'import json,sys,os
try:
  d=json.load(sys.stdin)
  print("1" if d.get("commitSha")==os.environ["SHA"] else "0")
except Exception:
  print("0")
' || echo 0)"
if [[ "$manifest_ok" != "1" ]]; then
  echo "[fail] disk build-manifest commitSha != ${SHA}" >&2
  exit 1
fi

if [[ "${MODE}" == "static" ]]; then
  echo "[ok] static activate — files on disk, remux process not bounced"
  exit 0
fi

deadline=$((SECONDS + 180))
while (( SECONDS < deadline )); do
  ready="$(curl -fsS --max-time 2 http://127.0.0.1:3838/api/health \
    | python3 -c 'import json,sys
try:
  d=json.load(sys.stdin)
  s=d.get("stream") or {}
  ok = d.get("ok") is True and s.get("connected") is True and s.get("remuxInitReady") is True and not (d.get("issues") or [])
  print("1" if ok else "0")
except Exception:
  print("0")
' || echo 0)"
  if [[ "$ready" == "1" ]]; then
    echo "[ok] balcony-log active, healthy, remux producing"
    exit 0
  fi
  sleep 2
done

echo "[fail] balcony-log remux did not become ready after activation" >&2
systemctl status balcony-log --no-pager >&2 || true
journalctl -u balcony-log -n 50 --no-pager >&2 || true
exit 1
REMOTE
