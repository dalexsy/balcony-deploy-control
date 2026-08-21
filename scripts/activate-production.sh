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
pid="$(systemctl show balcony-log -p MainPID --value)"
test -n "$pid"
test "$pid" != "0"
kill "$pid"
REMOTE
