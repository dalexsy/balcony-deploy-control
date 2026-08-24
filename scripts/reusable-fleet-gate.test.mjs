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

test("hosted airgap audits caller source without private siblings", () => {
  const stagingJob = workflow.split("  staging-checklist:")[1];
  assert.doesNotMatch(stagingJob, /repository: dalexsy\/(?:directory|dryl)/);
  assert.match(stagingJob, /fetch-depth: 0/);
  assert.match(stagingJob, /Hosted staging source audit/);
  assert.match(stagingJob, /file dependency lock audit passed/);
  assert.match(stagingJob, /node --check "\$file"/);
  assert.match(stagingJob, /npm run test:ocr/);
  assert.match(stagingJob, /working-directory: \$\{\{ inputs\.app-path \}\}/);
});

test("scale gate prefers the app's canonical scanner", () => {
  assert.match(workflow, /if \[\[ -f scripts\/check-max-lines\.mjs \]\]/);
  assert.match(workflow, /node scripts\/check-max-lines\.mjs/);
  assert.match(workflow, /scan_roots = \["src"/);
  assert.doesNotMatch(workflow, /for dirpath, dirnames, filenames in os\.walk\(root\)/);
});
