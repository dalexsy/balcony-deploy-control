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
    repository: "dalexsy/balcony-log",
    ref: "refs/heads/main",
    sha: SHA,
    event: "push",
    runId: "123",
    runAttempt: "1",
  };
  const stagingAudit = {
    ok: true,
    stage: "staging",
    commitSha: SHA,
    artifactDigest: digest,
  };
  return { artifactPath, digest, github, stagingAudit };
}

test("accepts only the exact staged artifact", () => {
  const f = fixture();
  assert.equal(
    verifyPromotion({
      expectedSha: SHA,
      expectedDigest: f.digest,
      ...f,
    }).ok,
    true,
  );
});

for (const mutation of [
  (f) => (f.github.repository = "attacker/repo"),
  (f) => (f.github.ref = "refs/heads/feature"),
  (f) => (f.github.sha = "b".repeat(40)),
  (f) => (f.github.event = "pull_request"),
  (f) => (f.stagingAudit.ok = false),
  (f) => (f.stagingAudit.commitSha = "b".repeat(40)),
  (f) => (f.stagingAudit.artifactDigest = "0".repeat(64)),
  (f) => fs.appendFileSync(f.artifactPath, "tampered"),
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
