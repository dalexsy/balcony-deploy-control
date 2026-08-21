#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SHA_RE = /^[a-f0-9]{40}$/;
const DIGEST_RE = /^[a-f0-9]{64}$/;

export function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

export function verifyPromotion({
  expectedSha,
  expectedDigest,
  artifactPath,
  stagingAudit,
  github,
}) {
  const failures = [];
  if (!SHA_RE.test(expectedSha)) failures.push("invalid expected commit SHA");
  if (!DIGEST_RE.test(expectedDigest)) failures.push("invalid expected artifact digest");
  if (github.repository !== "dalexsy/balcony-deploy-control") {
    failures.push("controller repository denied");
  }
  if (github.ref !== "refs/heads/main") failures.push("controller ref denied");
  if (!SHA_RE.test(github.sha)) failures.push("invalid controller SHA");
  const allowedEvents = new Set([
    "workflow_call",
    "workflow_dispatch",
    "push",
  ]);
  if (!allowedEvents.has(github.event)) {
    failures.push("controller event denied");
  }
  if (!fs.existsSync(artifactPath)) failures.push("artifact missing");
  const actualDigest = fs.existsSync(artifactPath) ? sha256(artifactPath) : null;
  if (actualDigest !== expectedDigest) failures.push("artifact digest mismatch");
  if (stagingAudit.ok !== true) failures.push("staging did not pass");
  if (stagingAudit.stage !== "staging") failures.push("invalid staging audit stage");
  if (stagingAudit.commitSha !== expectedSha) failures.push("staging SHA mismatch");
  if (stagingAudit.artifactDigest !== expectedDigest) {
    failures.push("staging artifact digest mismatch");
  }
  const stream = stagingAudit.stream || {};
  if (stream.liveVideo !== true) failures.push("staging liveVideo must be true");
  if (stream.fixtureSubstituted !== false) {
    failures.push("staging fixtureSubstituted must be false");
  }
  if (!(Number(stream.visualFps) >= 10)) {
    failures.push("staging visualFps must be >= 10");
  }
  if (stream.cafeCodec !== "h264") {
    failures.push("staging cafeCodec must be h264");
  }
  return {
    schemaVersion: 1,
    ok: failures.length === 0,
    commitSha: expectedSha,
    artifactDigest: actualDigest,
    workflowRunId: github.runId,
    workflowRunAttempt: github.runAttempt,
    controllerCommitSha: github.sha,
    controllerRepository: github.repository,
    controllerRef: github.ref,
    failures,
  };
}

function parseArgs(argv) {
  return Object.fromEntries(
    argv.slice(2).map((arg) => {
      const [key, ...rest] = arg.replace(/^--/, "").split("=");
      return [key, rest.join("=")];
    }),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv);
  const stagingAudit = JSON.parse(fs.readFileSync(args.staging, "utf8"));
  const audit = verifyPromotion({
    expectedSha: args.sha,
    expectedDigest: args.digest,
    artifactPath: path.resolve(args.artifact),
    stagingAudit,
    github: {
      repository: process.env.GITHUB_REPOSITORY,
      ref: process.env.GITHUB_REF,
      sha: process.env.GITHUB_SHA,
      event: process.env.GITHUB_EVENT_NAME,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    },
  });
  fs.writeFileSync(args.out, `${JSON.stringify(audit, null, 2)}\n`);
  if (!audit.ok) {
    console.error(audit.failures.join("\n"));
    process.exit(1);
  }
}
