#!/usr/bin/env bash
set -euo pipefail

artifact="${1:?artifact tarball}"
digest="${2:?sha256 digest}"
sha="${3:?commit sha}"
mode="${4:-restart}"
prod="${PROD_HOST:-192.168.178.79}"

run_post_activate_ship_verify() {
  if [[ "${mode}" == "static" ]]; then
    echo "[info] static activate — shipVerify skipped (OIDC restart path only)"
    return 0
  fi
  echo "[activate] post-activate manifest shipVerify (OIDC fail-closed)"
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  bash "${script_dir}/post-activate-ship-verify.sh"
}

if [[ "${DRYL_ACTIVATE_SKIP_REMOTE:-}" == "1" ]]; then
  echo "[test] DRYL_ACTIVATE_SKIP_REMOTE=1 — skipping Pi activate; running shipVerify hook only"
  run_post_activate_ship_verify
  exit 0
fi

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
  disk_asset="$(python3 -c 'import json; print(json.load(open("/home/pi/balcony-log/build-manifest.json")).get("watchAssetVersion",""))')"
  live_asset="$(curl -fsS --max-time 2 http://127.0.0.1:3838/api/health \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("watchAssetVersion",""))' || true)"
  if [[ -n "$disk_asset" && "$disk_asset" != "$live_asset" ]]; then
    echo "[info] static activate — watchAssetVersion stale in process; restarting balcony-log"
    sudo -n systemctl restart balcony-log
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
    live_asset="$(curl -fsS --max-time 2 http://127.0.0.1:3838/api/health \
      | python3 -c 'import json,sys; print(json.load(sys.stdin).get("watchAssetVersion",""))' || true)"
    if [[ "$disk_asset" != "$live_asset" ]]; then
      echo "[fail] watchAssetVersion still stale after static restart (disk=${disk_asset} live=${live_asset})" >&2
      exit 1
    fi
  fi
  echo "[ok] static activate — files on disk${live_asset:+, watch stamp ${live_asset}}"
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

run_post_activate_ship_verify
