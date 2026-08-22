import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { sha256, verifyPromotion } from "./verify-promotion.mjs";

const SHA = "a".repeat(40);

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "balcony-control-"));
  const artifactPath = path.join(dir, "balcony.tar");
  fs.writeFileSync(artifactPath, "immutable balcony artifact");
  const digest = sha256(artifactPath);
  const github = {
    repository: "dalexsy/balcony-deploy-control",
    ref: "refs/heads/main",
    sha: "c".repeat(40),
    event: "workflow_call",
    runId: "123",
    runAttempt: "1",
  };
  const stagingAudit = {
    ok: true,
    stage: "staging",
    commitSha: SHA,
    artifactDigest: digest,
    stream: {
      liveVideo: true,
      fixtureSubstituted: false,
      visualFps: 12,
      cafeCodec: "h264",
    },
    observed: {
      commitSha: SHA,
      watchAssetVersion: "20260822093035-f706555245",
    },
  };
  return { artifactPath, digest, github, stagingAudit };
}

for (const event of ["workflow_call", "workflow_dispatch", "push"]) {
  test(`accepts controller event ${event}`, () => {
    const f = fixture();
    f.github.event = event;
    assert.equal(
      verifyPromotion({
        expectedSha: SHA,
        expectedDigest: f.digest,
        ...f,
      }).ok,
      true,
    );
  });
}

for (const mutation of [
  (f) => (f.github.repository = "attacker/repo"),
  (f) => (f.github.ref = "refs/heads/feature"),
  (f) => (f.github.sha = "invalid"),
  (f) => (f.github.event = "pull_request"),
  (f) => (f.stagingAudit.ok = false),
  (f) => (f.stagingAudit.commitSha = "b".repeat(40)),
  (f) => (f.stagingAudit.artifactDigest = "0".repeat(64)),
  (f) => delete f.stagingAudit.stream,
  (f) => (f.stagingAudit.stream.liveVideo = false),
  (f) => (f.stagingAudit.stream.fixtureSubstituted = true),
  (f) => (f.stagingAudit.stream.visualFps = 2),
  (f) => fs.appendFileSync(f.artifactPath, "tampered"),
  (f) => delete f.stagingAudit.observed,
  (f) => (f.stagingAudit.observed.commitSha = "b".repeat(40)),
  (f) => (f.stagingAudit.observed.watchAssetVersion = ""),
]) {
  test("fails closed on altered authority or evidence", () => {
    const f = fixture();
    mutation(f);
    const result = verifyPromotion({
      expectedSha: SHA,
      expectedDigest: f.digest,
      ...f,
    });
    assert.equal(result.ok, false);
    assert.ok(result.failures.length > 0);
  });
}
