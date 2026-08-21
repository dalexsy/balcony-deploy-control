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
assert.match(delivery, /npm run verify:screen-fps/);
assert.ok(delivery.includes("DRYL_PASS: ${{ secrets.DRYL_PASS }}"));
console.log("[ok] delivery staging audit cannot be a printf fixture");
