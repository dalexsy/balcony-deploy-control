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