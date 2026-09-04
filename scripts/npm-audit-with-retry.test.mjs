import assert from "node:assert/strict";
import { isTransientNpmAuditError, runNpmAuditWithRetry } from "./npm-audit-with-retry.mjs";

assert.equal(isTransientNpmAuditError("npm ERR! audit endpoint returned an error"), true);
assert.equal(isTransientNpmAuditError("503 Service Unavailable"), true);
assert.equal(
  isTransientNpmAuditError("GET https://registry.npmjs.org/-/npm/v1/security/advisories/bulk 503"),
  true,
);
assert.equal(
  isTransientNpmAuditError("# npm audit report\n\nhigh  Prototype Pollution\n"),
  false,
);
assert.equal(isTransientNpmAuditError("found 2 vulnerabilities (1 high, 1 moderate)"), false);

let calls = 0;
const sleeps = [];
const code = await runNpmAuditWithRetry({
  maxAttempts: 3,
  backoffSeconds: [1, 1, 1],
  sleepFn: async (ms) => {
    sleeps.push(ms);
  },
  log: () => {},
  runAudit: () => {
    calls += 1;
    if (calls < 3) {
      return {
        status: 1,
        stdout: "",
        stderr: "npm ERR! audit endpoint returned an error\n",
      };
    }
    return { status: 0, stdout: "found 0 vulnerabilities\n", stderr: "" };
  },
});
assert.equal(code, 0);
assert.equal(calls, 3);
assert.deepEqual(sleeps, [1000, 1000]);

calls = 0;
const vulnCode = await runNpmAuditWithRetry({
  maxAttempts: 3,
  backoffSeconds: [1],
  sleepFn: async () => {
    throw new Error("should not sleep on real vulns");
  },
  log: () => {},
  runAudit: () => {
    calls += 1;
    return {
      status: 1,
      stdout: "# npm audit report\n\nhigh  some-package\n",
      stderr: "",
    };
  },
});
assert.equal(vulnCode, 1);
assert.equal(calls, 1);


calls = 0;
const exhausted = await runNpmAuditWithRetry({
  maxAttempts: 3,
  backoffSeconds: [1, 1],
  sleepFn: async (ms) => {
    sleeps.push(ms);
  },
  log: () => {},
  runAudit: () => {
    calls += 1;
    return {
      status: 1,
      stdout: "",
      stderr: "503 Service Unavailable\n",
    };
  },
});
assert.equal(exhausted, 1);
assert.equal(calls, 3);
console.log("[ok] npm-audit-with-retry transient vs fail-closed");


