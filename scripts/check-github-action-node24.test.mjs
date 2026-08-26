import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("pin list names Node-24 or composite runtimes", () => {
  const pins = JSON.parse(
    readFileSync(join(root, "scripts/github-action-node24-pins.json"), "utf8"),
  ).pins;
  for (const [name, pin] of Object.entries(pins)) {
    assert.match(pin.using, /^(node24|composite)$/, name);
    assert.match(pin.sha, /^[0-9a-f]{40}$/, name);
  }
});

test("npm test runs the Node-24 action pin gate", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.match(pkg.scripts.test, /check-github-action-node24\.mjs/);
});
