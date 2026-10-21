# Debugging notes — balcony-deploy-control

**Budget:** ≤200 lines (fleet hard fail: `cd directory && npm run check:debugging-notes`).  
**Contents:** symptom table + one-line failed experiments + deploy timing.  
**Not here:** session logs, chat dumps, multi-page post-mortems → `.cursor/rules/debugging-archive.md`

Agents: read **Symptoms** before retrying. After a failed attempt, add **one line** under Failed experiments (date + do-not-repeat). If over budget, archive first — do not grow this file.

Shared hub/infra: `directory/.cursor/rules/debugging.md`. Fleet rules: `Repos/speculation/` only.

---

## Triage (run first)

| Check | Command |
|-------|---------|
| Build / unit | `npm test` / `npm run build` (when wired) |
| Production | live hostname + screenshot verify — not curl alone |
| Prior fails | Failed experiments below |

---

## Symptoms

| Symptom | Fix path | Do not |
|---------|----------|--------|
| Deploy log ok, browser broken | `npm run verify:console` + Read PNGs | Trust smoke redirect only |
| Auth / custom-token 503 | Redeploy dryl-auth; re-verify | Ignore sites.json |
| Public 502 / wrong Pi | See `directory/docs/INFRASTRUCTURE.md` — deploy = dryl-prod `.79` | Deploy to magicmirror `.74` |

Add a **row** per real production failure. Max ~15 lines per deep-dive; narrative → archive.

---

## Failed experiments (do not repeat)

<!-- One line each. Max 20 bullets. Oldest → debugging-archive.md -->
- **2026-09-04** — `heal-production.yml` `*/5` cron emailed Daryl on every fail. Do not re-add `schedule:`/`cron:`; keep `workflow_dispatch` only. OWNER: `errors:maintain` / `github:ensure-policy`.

---

## Deploy timing (auto)

_No production deploy samples yet for **balcony-deploy-control**._ Wait `block_until_ms` **300000** until data exists · `.dryl-deploy-timing.json`

<!-- end deploy-timing -->

---

## Deploy & verify

- Local design: `npm run verify:localhost` when wired
- Ship: `npm run deploy:dryl` → wired verify → Read `[agent-required]` PNGs → quote `QUOTE_VISIBLE`
- drylApi: `node ../directory/scripts/verify-dryl-app.mjs https://<hostname> <site-id>`
- Mindset: `.cursor/rules/ecosystem-health.mdc` · stack: `Repos/speculation/master-spec.md`
