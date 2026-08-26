#!/usr/bin/env node
/** Fail closed: workflows may only pin Node-24 (or composite) actions. */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pins = JSON.parse(
  readFileSync(join(root, "scripts/github-action-node24-pins.json"), "utf8"),
).pins;
const dir = join(root, ".github/workflows");
const files = readdirSync(dir).filter((name) => name.endsWith(".yml"));
const usesRe = /uses:\s+(actions\/[a-z0-9-]+)@([0-9a-f]{40})/gi;
const fails = [];

for (const name of files) {
  const text = readFileSync(join(dir, name), "utf8");
  if (/FORCE_JAVASCRIPT_ACTIONS_TO_NODE24/.test(text)) {
    fails.push(`${name}: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 forces Node-20 actions instead of failing`);
  }
  if (
    /ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION/.test(text) &&
    !/ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION:\s*"false"/.test(text)
  ) {
    fails.push(`${name}: unsecure Node versions must stay false`);
  }
  for (const match of text.matchAll(usesRe)) {
    const action = match[1];
    const sha = match[2];
    const allowed = pins[action];
    if (!allowed) {
      fails.push(`${name}: unlisted ${action}@${sha}`);
      continue;
    }
    if (allowed.sha !== sha) {
      fails.push(`${name}: ${action} pin ${sha} is not ${allowed.version} (${allowed.sha})`);
    }
  }
}

assert.equal(fails.length, 0, fails.join("\n"));
console.log(`[ok] github-action-node24 — ${files.length} workflows, Node-20 pins forbidden`);
