#!/usr/bin/env bash
set -euo pipefail
# Exercise the real entrypoint with isolated test transports.
root="$(cd "$(dirname "$0")/.." && pwd)"
go test -C "${root}/tools/activation" -run TestActivationCannotSkipRemoteOrVerification -count=1 -v
