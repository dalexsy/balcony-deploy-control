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
console.log("[ok] delivery staging audit cannot be a printf fixture");
