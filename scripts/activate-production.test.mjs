import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(import.meta.dirname, "activate-production.sh"),
  "utf8",
);

test("activation restarts remux unless mode=static", () => {
  assert.match(source, /mode="\$\{4:-restart\}"/);
  assert.match(source, /\[\[ "\$\{MODE\}" != "static" \]\]/);
  assert.match(source, /sudo -n systemctl restart balcony-log/);
  assert.match(source, /http:\/\/127\.0\.0\.1:3838\/api\/health/);
  assert.match(source, /static activate/);
  assert.match(source, /remuxInitReady/);
  assert.doesNotMatch(source, /\nkill "\$pid"/);
});
