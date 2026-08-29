/**
 * auto → classify git diff vs prod build-manifest SHA.
 * Fail closed to restart when SSH or git cannot prove a static ship.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyDeliveryLayer } from "./classify-delivery-layer.mjs";

export function normalizeLayer(raw) {
  const v = String(raw ?? "auto").trim().toLowerCase();
  if (v === "static" || v === "restart" || v === "auto") return v;
  return "restart";
}

export function gitChangedFiles(repo, fromSha, toSha) {
  if (!fromSha || !toSha) return null;
  if (fromSha === toSha) return [];
  try {
    execFileSync("git", ["-C", repo, "cat-file", "-e", `${fromSha}^{commit}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const out = execFileSync(
      "git",
      ["-C", repo, "diff", "--name-only", `${fromSha}..${toSha}`],
      { encoding: "utf8" },
    );
    return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

export function readProdSha(host) {
  try {
    const raw = execFileSync(
      "ssh",
      [
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=8",
        `pi@${host}`,
        "cat /home/pi/balcony-log/build-manifest.json",
      ],
      { encoding: "utf8", timeout: 20_000 },
    );
    const sha = JSON.parse(raw)?.commitSha;
    return typeof sha === "string" ? sha.trim() : "";
  } catch {
    return "";
  }
}

export function resolveDeliveryLayer({ input, files, prodSha }) {
  const normalized = normalizeLayer(input);
  if (normalized !== "auto") {
    return { layer: normalized, reason: `input ${normalized}`, prodSha };
  }
  if (!Array.isArray(files)) {
    return {
      layer: "restart",
      reason: "git diff unavailable — fail closed restart",
      prodSha,
    };
  }
  return {
    layer: classifyDeliveryLayer(files),
    reason: files.length ? `diff ${files.length} files` : "no file diff vs prod",
    prodSha,
  };
}

function writeGithubOutput(layer, reason, prodSha) {
  const dest = process.env.GITHUB_OUTPUT;
  if (!dest) return;
  appendFileSync(
    dest,
    `layer=${layer}\nreason=${reason}\nprod_sha=${prodSha}\n`,
  );
}

function parseArg(name, argv) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1 || !argv[i + 1]) return "";
  return argv[i + 1];
}

const isCli =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  const argv = process.argv.slice(2);
  const input = parseArg("input", argv) || process.env.DELIVERY_LAYER_INPUT || "auto";
  const repo = parseArg("repo", argv);
  const headSha = parseArg("head-sha", argv);
  const host = parseArg("prod-host", argv) || process.env.PROD_HOST || "192.168.178.79";
  const prodSha = readProdSha(host);
  const files = gitChangedFiles(repo, prodSha, headSha);
  const resolved = resolveDeliveryLayer({ input, files, prodSha });
  process.stdout.write(`delivery-layer=${resolved.layer} ${resolved.reason}\n`);
  writeGithubOutput(resolved.layer, resolved.reason, resolved.prodSha || "");
}
