#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const delivery = fs.readFileSync(
  path.join(root, ".github/workflows/delivery.yml"),
  "utf8",
);

assert.doesNotMatch(delivery, /printf '\{\"schemaVersion\":1,\"ok\":true/);
assert.match(delivery, /write-staging-stream-audit\.mjs/);
assert.match(delivery, /collect-staging-stream-evidence\.mjs/);
assert.match(delivery, /BALCONY_PUBLIC_URL: "http:\/\/balcony\.staging\.dryl\.io"/);
assert.match(delivery, /LIVE_VIDEO: "1"/);
assert.match(delivery, /assert-cafe-live-h264\.py/);
assert.match(delivery, /workflow_dispatch:/);
assert.match(delivery, /uses: \.\/\.github\/workflows\/promote\.yml/);
assert.match(delivery, /BALCONY_PUBLIC_URL: "https:\/\/balcony\.dryl\.io"/);
assert.match(delivery, /BALCONY_MIN_SCREEN_FPS: "5"/);
assert.match(delivery, /BALCONY_MIN_SCREEN_FPS: "10"/);
assert.match(delivery, /npm run verify:screen-fps/);
assert.ok(delivery.includes("DRYL_PASS: ${{ secrets.DRYL_PASS }}"));

// CENTRAL_FLEET_VALIDATION_REPAIR — air-gapped dispatch contract.
assert.match(
  delivery,
  /promote-production:\s*\r?\n\s*description:.*\r?\n\s*required: true\s*\r?\n\s*type: boolean\s*\r?\n\s*default: false/,
);
assert.match(delivery, /watch_asset_version=\$\{asset\}/);
assert.match(delivery, /watch-asset-version: \$\{\{ steps\.meta\.outputs\.watch_asset_version \}\}/);
function jobStart(name) {
  const m = new RegExp(`\\r?\\n  ${name}:`).exec(delivery);
  assert.ok(m, `missing job ${name}`);
  return m.index;
}
function nextJobStart(fromIndex) {
  const lineEnd = delivery.indexOf("\n", fromIndex + 1) + 1;
  const m = /\r?\n  [A-Za-z-]/.exec(delivery.slice(lineEnd));
  return m ? lineEnd + m.index : delivery.length;
}

for (const job of ["promote", "activate", "verify-production"]) {
  const start = jobStart(job);
  const block = delivery.slice(start, nextJobStart(start));
  assert.match(
    block,
    /if:\s*\$\{\{\s*inputs\.promote-production\s*==\s*true\s*\}\}/,
    `${job} must be gated behind inputs.promote-production == true`,
  );
}
// Staging candidate work must run unconditionally (before the promote gate).
const stagingStart = jobStart("staging");
const stagingBlock = delivery.slice(stagingStart, jobStart("promote"));
assert.doesNotMatch(stagingBlock, /if:\s*\$\{\{\s*inputs\.promote-production/);
assert.match(stagingBlock, /probe-watch-loading\.mjs/);
assert.match(stagingBlock, /EXPECTED_COMMIT_SHA: \$\{\{ needs\.build\.outputs\.commit-sha \}\}/);
assert.match(stagingBlock, /EXPECTED_WATCH_ASSET_VERSION: \$\{\{ needs\.build\.outputs\.watch-asset-version \}\}/);
assert.match(stagingBlock, /STAGING_FPS_RESULT_JSON=/);

const verifyProdBlockGate = delivery.slice(jobStart("verify-production"));
assert.match(verifyProdBlockGate, /probe-watch-loading\.mjs/);
assert.match(verifyProdBlockGate, /EXPECTED_COMMIT_SHA: \$\{\{ needs\.build\.outputs\.commit-sha \}\}/);
assert.match(verifyProdBlockGate, /EXPECTED_WATCH_ASSET_VERSION: \$\{\{ needs\.build\.outputs\.watch-asset-version \}\}/);
const productionVerify = delivery.slice(delivery.indexOf("  verify-production:"));
assert.match(
  productionVerify,
  /Checkout directory read-only for verify credentials[\s\S]*path: directory/,
);
assert.ok(
  productionVerify.indexOf("path: directory") <
    productionVerify.indexOf("npm run verify:screen-fps"),
);
console.log("[ok] delivery staging audit cannot be a printf fixture");

// CENTRAL_FLEET_VALIDATION_REPAIR — reusable-fleet-gate.yml manifest verifier contract hook.
const gate = fs.readFileSync(
  path.join(root, ".github", "workflows", "reusable-fleet-gate.yml"),
  "utf8",
);
assert.match(gate, /test-build-manifest-verifier\.mjs/);
console.log("[ok] reusable-fleet-gate wires the build-manifest verifier contract hook");
