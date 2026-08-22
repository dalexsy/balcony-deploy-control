import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const script = readFileSync(
  join(import.meta.dirname, "activate-staging.sh"),
  "utf8",
);
const workflow = readFileSync(
  join(import.meta.dirname, "..", ".github", "workflows", "delivery.yml"),
  "utf8",
);

test("staging activation serves the exact candidate before visual proof", () => {
  assert.match(script, /test "\$\(hostname\)" = "\$expected_host"/);
  assert.match(script, /grep -qx 'DRYL_ENV=staging'/);
  assert.match(script, /sudo -n systemctl restart balcony-log/);
  assert.match(script, /watchAssetVersion/);
  const staging = workflow.slice(
    workflow.indexOf("  staging:"),
    workflow.indexOf("  promote:"),
  );
  assert.ok(
    staging.indexOf("Activate exact candidate on staging") <
      staging.indexOf("Prove live cafe remux on staging hostname"),
  );
  assert.match(staging, /scripts\/activate-staging\.sh/);
});
