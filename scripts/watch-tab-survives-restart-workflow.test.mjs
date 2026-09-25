import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(
  join(root, ".github", "workflows", "watch-tab-survives-restart.yml"),
  "utf8",
);

test("watch-tab guard has no cron — hosted */20 burned paid Actions minutes", () => {
  assert.doesNotMatch(workflow, /^\s*schedule:\s*$/m);
  assert.doesNotMatch(workflow, /cron:\s*["']/);
  assert.match(workflow, /workflow_dispatch:/);
});
