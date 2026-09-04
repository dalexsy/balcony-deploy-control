import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

/** Registry / audit API flakes - not dependency findings. */
export function isTransientNpmAuditError(combinedOutput) {
  const text = String(combinedOutput ?? "");
  if (!text) return false;
  if (/audit endpoint returned an error/i.test(text)) return true;
  if (/service unavailable/i.test(text)) return true;
  if (/\b503\b/.test(text)) return true;
  if (/npm ERR! code E503/i.test(text)) return true;
  if (/registry\.npmjs\.org.*503/i.test(text)) return true;
  return false;
}

export async function runNpmAuditWithRetry(options = {}) {
  const {
    cwd = process.cwd(),
    maxAttempts = 3,
    backoffSeconds = [30, 45, 60],
    runAudit = () =>
      spawnSync("npm", ["audit", "--audit-level=high"], {
        cwd,
        encoding: "utf8",
        shell: false,
      }),
    log = console.error,
    sleepFn = sleep,
  } = options;

  let last = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    last = runAudit();
    const combined = `${last.stdout ?? ""}${last.stderr ?? ""}`;
    const code = last.status ?? 1;

    if (code === 0) {
      if (combined.trim()) process.stdout.write(combined);
      return 0;
    }

    const transient = isTransientNpmAuditError(combined);
    if (!transient) {
      process.stderr.write(combined);
      return code;
    }
    if (attempt === maxAttempts) {
      process.stderr.write(combined);
      return code;
    }

    const waitSec = backoffSeconds[attempt - 1] ?? backoffSeconds.at(-1) ?? 45;
    log(
      `npm audit failed with transient registry error (attempt ${attempt}/${maxAttempts}); retrying in ${waitSec}s...`,
    );
    await sleepFn(waitSec * 1000);
  }

  return last?.status ?? 1;
}

const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const code = await runNpmAuditWithRetry();
  process.exit(code);
}
