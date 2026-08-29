import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeLayer,
  resolveDeliveryLayer,
} from "./resolve-delivery-layer.mjs";

test("unknown input fail-closes to restart", () => {
  assert.equal(normalizeLayer("nope"), "restart");
  assert.equal(normalizeLayer("static"), "static");
});

test("explicit static skips classify", () => {
  const got = resolveDeliveryLayer({
    input: "static",
    files: ["src/server/live/env-persist.ts"],
    prodSha: "a".repeat(40),
  });
  assert.equal(got.layer, "static");
});

test("auto + viewer-only files stay static", () => {
  const got = resolveDeliveryLayer({
    input: "auto",
    files: ["src/server/watch/viewer-display-stats.ts"],
    prodSha: "b".repeat(40),
  });
  assert.equal(got.layer, "static");
});

test("auto + remux files restart", () => {
  const got = resolveDeliveryLayer({
    input: "auto",
    files: ["src/server/live/env-persist.ts"],
    prodSha: "c".repeat(40),
  });
  assert.equal(got.layer, "restart");
});

test("auto without a diff fail-closes to restart", () => {
  const got = resolveDeliveryLayer({ input: "auto", files: null, prodSha: "" });
  assert.equal(got.layer, "restart");
});
