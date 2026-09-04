import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(import.meta.dirname, "activate-staging.sh"),
  "utf8",
);

test("staging activation extracts the candidate and waits for remux identity", () => {
  assert.match(source, /STAGING_HOSTNAME:-dryl-staging/);
  assert.match(source, /DRYL_ENV=staging/);
  assert.match(source, /mode="\$\{5:-restart\}"/);
  assert.match(source, /sudo -n systemctl restart balcony-log/);
  assert.match(source, /\/api\/build-manifest/);
  assert.match(source, /remuxInitReady/);
  assert.match(source, /watchAssetVersion/);
  assert.doesNotMatch(source, /dryl-prod/);
});
