#!/usr/bin/env bash
set -euo pipefail

artifact="${1:?artifact tarball}"
digest="${2:?sha256 digest}"
sha="${3:?commit sha}"
mode="${4:-restart}"
prod="${PROD_HOST:-192.168.178.79}"

run_post_activate_ship_verify() {
  echo "[activate] post-activate manifest shipVerify (OIDC fail-closed)"
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  bash "${script_dir}/post-activate-ship-verify.sh"
}

[[ "$sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$digest" =~ ^[0-9a-f]{64}$ ]]
[[ "$mode" == "static" || "$mode" == "restart" ]]

echo "${digest}  ${artifact}" | sha256sum -c -
scp -o BatchMode=yes -o ConnectTimeout=8 \
  "$artifact" "pi@${prod}:/tmp/balcony-activate.tar.gz"
ssh -o BatchMode=yes -o ConnectTimeout=8 "pi@${prod}" \
  "DIGEST=${digest} SHA=${sha} MODE=${mode} bash -s" <<'REMOTE'
set -euo pipefail
echo "${DIGEST}  /tmp/balcony-activate.tar.gz" | sha256sum -c -
mkdir -p /home/pi/balcony-log
tar -C /home/pi/balcony-log -xzf /tmp/balcony-activate.tar.gz
check=/home/pi/balcony-log/tools/activation-check
test -x "$check"
test "$("$check" field commitSha /home/pi/balcony-log/build-manifest.json)" = "$SHA"

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

manifest_sha="$(curl -fsS --max-time 2 http://127.0.0.1:3838/api/build-manifest \
  | "$check" field commitSha || true)"
if [[ "$manifest_sha" != "$SHA" ]]; then
  echo "[fail] disk build-manifest commitSha != ${SHA}" >&2
  exit 1
fi

health_sha="$(curl -fsS --max-time 2 http://127.0.0.1:3838/api/health \
  | "$check" field appBuildVersion || true)"
if [[ -z "$health_sha" || "$health_sha" != "$SHA" ]]; then
  echo "[fail] health appBuildVersion (${health_sha:-missing}) != activate SHA ${SHA}" >&2
  exit 1
fi

if [[ "${MODE}" == "static" ]]; then
  disk_asset="$("$check" field watchAssetVersion /home/pi/balcony-log/build-manifest.json)"
  live_asset="$(curl -fsS --max-time 2 http://127.0.0.1:3838/api/health \
    | "$check" field watchAssetVersion || true)"
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
      | "$check" field watchAssetVersion || true)"
    if [[ "$disk_asset" != "$live_asset" ]]; then
      echo "[fail] watchAssetVersion still stale after static restart (disk=${disk_asset} live=${live_asset})" >&2
      exit 1
    fi
  fi
  echo "[ok] static activate — files on disk${live_asset:+, watch stamp ${live_asset}}"
fi

need_consecutive=3
consecutive_ok=0
deadline=$((SECONDS + 180))
while (( SECONDS < deadline )); do
  sample="$(curl -fsS --max-time 2 http://127.0.0.1:3838/api/live/status \
    | "$check" stream 2>/dev/null || echo wait)"
  if [[ "$sample" == "ok" ]]; then
    consecutive_ok=$((consecutive_ok + 1))
    if [[ "$consecutive_ok" -ge "$need_consecutive" ]]; then
      echo "[ok] balcony-log active, healthy, remux producing (tier-C loopback gate — HLS fragments)"
      exit 0
    fi
  else
    consecutive_ok=0
  fi
  sleep 2
done

echo "[fail] balcony-log remux did not pass sustained tier-C loopback gate after activation" >&2
systemctl status balcony-log --no-pager >&2 || true
journalctl -u balcony-log -n 50 --no-pager >&2 || true
exit 1
REMOTE

run_post_activate_ship_verify
