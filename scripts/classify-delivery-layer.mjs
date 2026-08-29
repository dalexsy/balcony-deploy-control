/**
 * static = copy watch IIFE / log SPA, do not bounce remux.
 * restart = Node/remux changed — systemctl restart + stream soak.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";

const NODE_WATCH =
  /^src\/server\/watch\/(watch-viewer-template|watch-viewer-script-tags|watch-page-stamp-policy|watch-asset-version|presence|pip-trace-route)(\.ts)?$/;
const NODE_WATCH_DIR = /^src\/server\/watch\/capture(\/|$)/;

export function ignoreForLayer(file) {
  const n = String(file ?? "").replace(/\\/g, "/");
  if (!n) return true;
  if (n.startsWith(".cursor/") || n.startsWith("docs/")) return true;
  if (/\.md$/i.test(n)) return true;
  if (/^scripts\/(test-|verify-)/.test(n)) return true;
  if (/^scripts\/lib\/verify-/.test(n)) return true;
  return false;
}

export function fileNeedsRemuxRestart(file) {
  const n = String(file ?? "").replace(/\\/g, "/");
  if (ignoreForLayer(n)) return false;
  if (n.startsWith("src/server/static/")) return false;
  if (n.startsWith("src/app/")) return false;
  if (n.startsWith("src/server/watch/")) {
    return NODE_WATCH.test(n) || NODE_WATCH_DIR.test(n);
  }
  if (n.startsWith("src/server/")) return true;
  if (n === "server.ts" || n === "package.json" || n === "package-lock.json") {
    return true;
  }
  if (/^scripts\/lib\/balcony_stream_/.test(n)) return true;
  if (/^scripts\/(balcony_stream|remux-warmup)/.test(n)) return true;
  return false;
}

export function classifyDeliveryLayer(files) {
  const list = (Array.isArray(files) ? files : []).filter((f) => !ignoreForLayer(f));
  if (!list.length) return "static";
  return list.some(fileNeedsRemuxRestart) ? "restart" : "static";
}

const isCli =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  process.stdout.write(`${classifyDeliveryLayer(process.argv.slice(2))}\n`);
}
