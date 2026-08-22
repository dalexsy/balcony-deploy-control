import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(import.meta.dirname, "activate-production.sh"),
  "utf8",
);

test("activation restarts and waits for the backend readiness endpoint", () => {
  assert.match(source, /sudo -n systemctl restart balcony-log/);
  assert.match(source, /http:\/\/127\.0\.0\.1:3838\/api\/health/);
  assert.match(source, /"\$active" == "active" && "\$status" == "200"/);
  assert.match(source, /journalctl -u balcony-log -n 50/);
  assert.doesNotMatch(source, /\nkill "\$pid"/);
});
