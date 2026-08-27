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
assert.match(delivery, /python scripts\/remux-warmup\.py/);
assert.match(delivery, /WATCH_PROBE_LOCAL=1 BALCONY_PUBLIC_URL=http:\/\/127\.0\.0\.1:3838/);
assert.match(delivery, /npm run verify:staging-origin-decode/);
assert.match(
  delivery,
  /Staging log layout includes \/watch link[\s\S]*WATCH_PROBE_LOCAL: "1"/,
);
assert.match(delivery, /npm run observe:watch-viewer/);
assert.match(delivery, /printf '\{"commitSha":"%s","watchAssetVersion":"%s"\}/);
assert.match(delivery, /activate-staging\.sh/);
assert.match(delivery, /STAGING_FPS_RESULT_JSON=/);
assert.match(delivery, /npm run verify:log-layout/);
assert.doesNotMatch(delivery, /schemaVersion":1,"commitSha"/);
assert.ok(delivery.includes("DRYL_PASS: ${{ secrets.DRYL_PASS }}"));
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
