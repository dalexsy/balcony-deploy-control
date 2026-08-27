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
  assert.match(workflow, /lights\/65550\?power=true/);
  assert.match(workflow, /grep -q "\\"power\\":true"/);
  assert.doesNotMatch(workflow, /power=false/);
});

test("heal restores the rollback edge and fails closed on stream health", () => {
  assert.match(workflow, /cron: "\*\/5 \* \* \* \*"/);
  assert.match(workflow, /BALCONY_EDGE/);
  assert.match(workflow, /BALCONY_RECOVERY_NEEDED/);
  assert.match(workflow, /if: env\.BALCONY_RECOVERY_NEEDED == '1'/);
  assert.match(workflow, /192\.168\.178\.74/);
  assert.match(workflow, /StrictHostKeyChecking=accept-new/);
  assert.match(workflow, /service\.kiosk-disabled/);
  assert.match(workflow, /systemctl is-active nginx dryl-auth balcony-log/);
  assert.match(workflow, /Camera\/remux recovery postcondition failed/);
  assert.match(workflow, /exit 1/);
});
