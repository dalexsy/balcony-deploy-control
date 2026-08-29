import assert from "node:assert/strict";
import { classifyDeliveryLayer, fileNeedsRemuxRestart } from "./classify-delivery-layer.mjs";

assert.equal(classifyDeliveryLayer(["src/server/static/viewer.js"]), "static");
assert.equal(
  classifyDeliveryLayer(["src/server/watch/viewer-display-stats.ts"]),
  "static",
);
assert.equal(classifyDeliveryLayer(["src/app/home/live-feed-card.ts"]), "static");
assert.equal(classifyDeliveryLayer([".cursor/rules/debugging.md"]), "static");
assert.equal(classifyDeliveryLayer(["src/server/live/env-persist.ts"]), "restart");
assert.equal(classifyDeliveryLayer(["server.ts"]), "restart");
assert.equal(
  classifyDeliveryLayer(["src/server/watch/watch-viewer-template.ts"]),
  "restart",
);
assert.equal(
  fileNeedsRemuxRestart("src/server/watch/viewer-display-stats.ts"),
  false,
);
assert.equal(classifyDeliveryLayer(["src/server/media/jpeg-meta.ts", "docs/x.md"]), "restart");
assert.equal(
  classifyDeliveryLayer(["src/server/watch/watch-asset-version.ts"]),
  "restart",
);
assert.equal(classifyDeliveryLayer(["src/app/home/page.ts", "docs/x.md"]), "static");
console.log("[ok] classify-delivery-layer static vs remux restart");
