# balcony-deploy-control

Immutable reusable workflow for balcony production promotion.

The app repository may build and test code, but it cannot authorize production.
This repository verifies the caller, exact `main` SHA, artifact SHA-256, and
staging audit before requesting deployment with a GitHub OIDC token.

Production must independently validate these OIDC claims:

- `repository = dalexsy/balcony-log`
- `ref = refs/heads/main`
- `aud = dryl-balcony-deploy`
- `job_workflow_ref` identifies this workflow at an allowlisted immutable SHA
- `run_id` and `run_attempt` have not been used before

The endpoint must reject missing, stale, replayed, or mismatched evidence. No
SSH key, local environment variable, deploy marker, or conversational claim is
authorization.

## Production delivery (operator)

Manual ship after `balcony-log` is on `main`:

```bash
gh workflow run unattended-balcony-delivery --repo dalexsy/balcony-deploy-control
```

Workflow: `.github/workflows/unattended-balcony-delivery.yml` — builds an attested
tarball, runs `scripts/activate-production.sh` on the staging control runner, then
fail-closed manifest `shipVerify` via `scripts/post-activate-ship-verify.sh`.
`directory/scripts/pi-deploy-dryl-site.py` refuses balcony / `exclusiveHardwareResource` sites.

The delivery workflow builds the Go `tools/activation` checks into the attested
artifact. Staging must activate that artifact and report the candidate commit and
live asset version before production runs. Both static and restart production
activations require fresh fragments and post-activate `shipVerify`; neither has
an environment switch to skip activation. The activation scripts and CI size
check do not invoke Python. Legacy heal workflows are separate from this path.

Run `go test -C tools/activation ./...` on a Linux runner for JSON validation and
entrypoint integration tests. The entrypoint tests exercise remote activation
failure, verification failure, and success for both deployment modes with
isolated test transports; they do not count as a live deployment certificate.
