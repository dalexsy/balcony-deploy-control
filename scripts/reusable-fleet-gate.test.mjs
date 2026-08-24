import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(
  join(root, ".github", "workflows", "reusable-fleet-gate.yml"),
  "utf8",
);

test("reusable app gates validate the caller SHA", () => {
  assert.match(workflow, /app-ref:[\s\S]*?default: ""/);
  assert.equal(
    workflow.match(/inputs\.app-ref != '' && inputs\.app-ref \|\| github\.sha/g)?.length,
    3,
  );
});

test("caller-repo airgap uses an available ephemeral runner", () => {
  const stagingJob = workflow.split("  staging-checklist:")[1];
  assert.match(stagingJob, /runs-on: ubuntu-latest/);
  assert.doesNotMatch(stagingJob, /runs-on: \[self-hosted/);
});
