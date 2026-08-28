import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const workflow = fs.readFileSync(
  path.join(import.meta.dirname, "..", ".github", "workflows", "heal-production.yml"),
  "utf8",
);

test("heal installs tested recovery scripts and forces cafe power on", () => {
  assert.match(workflow, /Checkout balcony recovery source/);
  assert.match(workflow, /ref: main/);
  assert.match(workflow, /test-balcony-stream-plug\.py/);
  assert.match(workflow, /test-balcony-stream-heal-plan\.py/);
  assert.match(workflow, /balcony_stream_plug\.py/);
  assert.match(workflow, /balcony_stream_heal\.py/);
  assert.match(workflow, /BALCONY_CAFE_STILL_DOWN=1/);
  assert.match(workflow, /cafe-unreachable/);
  assert.match(workflow, /lights\/65550\?power=true/);
  assert.match(workflow, /grep -q "\\"power\\":true"/);
  assert.doesNotMatch(workflow, /power=false/);
});

test("heal fails closed on stream health and never touches the kiosk Pi", () => {
  assert.match(workflow, /cron: "\*\/5 \* \* \* \*"/);
  assert.match(workflow, /BALCONY_EDGE/);
  assert.match(workflow, /BALCONY_RECOVERY_NEEDED/);
  assert.match(workflow, /BALCONY_NO_EDGE/);
  assert.match(workflow, /if: env\.BALCONY_RECOVERY_NEEDED == '1' && env\.BALCONY_NO_EDGE != '1'/);
  assert.match(workflow, /Camera\/remux recovery postcondition failed/);
  assert.match(workflow, /exit 1/);
  // The kiosk Pi (magicmirror, 192.168.178.74) is a physical living-room
  // display. It must never be started as a production edge again — no
  // systemctl start of dryl-auth/balcony-log/cloudflared-balcony on it.
  assert.doesNotMatch(workflow, /edge=192\.168\.178\.74/);
  assert.doesNotMatch(workflow, /service\.kiosk-disabled/);
  assert.doesNotMatch(
    workflow,
    /sudo systemctl start nginx dryl-auth balcony-log/,
  );
});

test("heal reports physical-check-needed when no edge and no direct plug route work", () => {
  assert.match(workflow, /Cafe plug cycle with no production edge reachable/);
  assert.match(workflow, /if: env\.BALCONY_NO_EDGE == '1'/);
  assert.match(workflow, /needs physical check/);
  assert.match(workflow, /no LAN presence/);
});
