# Qubit One — Deployment Guide

This document describes the **actual** deployment lifecycle of Qubit One. The primary path is a git-connected pipeline: **GitHub → GitHub Actions CI → Vercel (Next.js 16, standalone output) → Supabase PostgreSQL**. A self-hosted standalone deployment remains available and is documented at the end as an explicitly-labeled **alternative** — it is not the primary path.

Statuses in this document and in the deployment tooling use a precise vocabulary: **PASS · FAIL · WARN · NOT CONFIGURED · NOT RUN · BLOCKED · REQUIRES ACTION**. A capability that does not exist is labeled as such — nothing here is aspirational.

Production URL: **https://qbitone-qbit-one.vercel.app**

## 1. Deployment Architecture (Primary Path)

```text
GitHub — github.com/qbitone47/qbitone (branch main)
   │  push / pull request
   ▼
GitHub Actions CI (.github/workflows/ci.yml)
   │  secret scan → deployment gate → lint → prisma push (throwaway DB)
   │  → typegen → typecheck → production build → smoke tests
   ▼
Vercel project "qbitone" (git-connected; auto-deploy on push to main)
   │  Next.js 16, output: standalone, Node.js runtime
   ▼
Supabase PostgreSQL (production data plane; DATABASE_URL server-only, sslmode=require)
```

- Vercel deploys automatically whenever `main` advances. There is no deploy script and no deploy step in CI.
- CI never holds production secrets: the PostgreSQL service in CI is a throwaway and the CI session secret is a non-credential test value (see §4).
- No Redis, no queues, no Kubernetes, no Docker — see [Not Provided](#17-not-provided).

## 2. Local Setup

```bash
bun install                # postinstall runs prisma generate
cp .env.example .env       # fill in the variables from §3 — never commit .env
bun run dev                # http://localhost:3000
```

Bun ≥ 1.2 is required for install, scripts and the dev server (https://bun.sh). Node 20+ can run the standalone output where Bun is unavailable, but the documented commands assume Bun.

## 3. Environment Variables

Full classified template: [.env.example](../.env.example). Every variable is classified as `public` / `server-only` / `system`.

| Variable | Scope | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | server-only | **Required** | Prisma PostgreSQL connection URL. Production = Supabase PostgreSQL (credentials RFC 3986 percent-encoded, `?sslmode=require` appended). Used by `prisma/schema.prisma`, `src/lib/db.ts`, the platform DB probe and `/api/health`. Never expose to the client bundle. |
| `QUBIT_AUTH_SECRET` | server-only | **Required in production and preview** | HMAC session-signing secret, ≥ 32 chars (`openssl rand -hex 32`). Required in production/preview so every serverless instance signs sessions identically. Locally, if unset, the server generates and persists a secret to the git-ignored `db/.auth-secret`. |
| `VERCEL_TOKEN` | server-only | Optional | Enables live Vercel API telemetry for the Operations screens: Deployment Status (P22-02), Deployment History (P22-17), Rollback Center (P22-19), Deployment Impact (P23-17). Without it those screens honestly show "Not configured" — nothing is simulated. |
| `GITHUB_TOKEN` | server-only | Optional | Enables live GitHub Actions CI status in the same screens. Repository-scoped where possible. |
| `APP_URL` | server-only | Reserved | Public base URL for reverse-proxied deployments; currently unused by the code. |
| `VERCEL_GIT_COMMIT_SHA`, `VERCEL_DEPLOYMENT_ID`, `VERCEL_ENV`, `VERCEL_REGION`, … | system | Injected by Vercel | Runtime deployment metadata. Listed in `.env.example` for audit completeness; never set manually. |

**Vercel environment matrix.** `DATABASE_URL` + `QUBIT_AUTH_SECRET` are configured in the Vercel project per-environment — production, preview and development are reviewed separately.

**Rules of record.** Real values live only in platform secret stores (local `.env` git-ignored, Vercel per-environment settings, encrypted CI secrets) — never in the repository, never in logs or reports. New environment variables must be added to `.env.example` (names only) before their first commit; the deployment gate **FAIL**s when code references an undocumented variable (and on sensitive `NEXT_PUBLIC_*` exposure).

## 4. CI Pipeline

`.github/workflows/ci.yml` runs on every push and pull request to `main`, with least-privilege permissions (`contents: read`), cancel-in-progress concurrency and a 30-minute job timeout. Stages, in order:

1. **Checkout** and **Bun setup**, then `bun install --frozen-lockfile`.
2. **Secret scan** — `bun scripts/security/secret-scan.ts` (§5.4).
3. **Deployment gate** — `bun scripts/deploy/deployment-gate.ts --ci` (§5.3): env-var documentation coverage, `prisma validate`, `bun audit` with **CRITICAL advisories blocking**.
4. **Lint** — `bun run lint`.
5. **Prisma generate**, then **schema push** — `prisma db push` against a **throwaway `postgres:16-alpine` service container** only (never a real environment).
6. **Next.js route typegen** (`next typegen`) and **typecheck** (`tsc --noEmit`).
7. **Production build** (`next build` + standalone assembly).
8. **Artifact size report** — `du -sh .next/standalone` appended to the GitHub step summary. **Report-only; no threshold is enforced** (evidence-based gates only).
9. **Standalone artifact upload** — best-effort (`continue-on-error`), 7-day retention, so a validated artifact can be inspected after a green run.
10. **Standalone smoke tests** — the built server is started against the throwaway CI database and `bun scripts/deploy/smoke-test.ts http://localhost:3000 --strict-db` runs (§5.2).

A failed check **blocks the pipeline, and therefore blocks merge and deploy**. Failures are never masked. No production secrets are used in CI: the database is throwaway and `QUBIT_AUTH_SECRET` in CI is a non-credential test value that is allowlisted in the secret scanner.

## 5. Phase 24 Deployment Tooling

### 5.1 Health probe — `GET /api/health`

Public, unauthenticated and deliberately **non-sensitive**. Response shape:

```json
{
  "status": "ok",
  "service": "qubit-one",
  "checks": { "application": "pass", "database": { "status": "connected", "latencyMs": 12 } },
  "commit": "<VERCEL_GIT_COMMIT_SHA or null>",
  "uptimeSec": 120,
  "timestamp": "…"
}
```

- `checks.database.status` is `connected` or `unavailable`; the probe discards every error detail.
- `commit` is the deployed commit SHA injected by Vercel (`VERCEL_GIT_COMMIT_SHA`); it is `null` on self-hosted runs. Production verification requires this field to equal the pushed commit.
- The endpoint **never returns credentials, connection strings, host names, environment values, error text or stack traces** (health checks must not expose sensitive information). Served with `Cache-Control: no-store`.

### 5.2 Smoke tests — `scripts/deploy/smoke-test.ts`

```bash
bun scripts/deploy/smoke-test.ts [BASE_URL] [--strict-db]
# BASE_URL defaults to http://localhost:3000
# --strict-db additionally FAILs unless /api/health reports database "connected"
```

Ten checks, run in CI against the built server and post-deployment against production:

1. `GET /` returns 200 and contains the application marker.
2. `GET /api` returns 200 (liveness).
3. `GET /api/health` returns 200 with `status: "ok"` and `application: "pass"` (`--strict-db` requires `database.status === "connected"`).
4. `POST /api/auth/session` issues a signed `qubit_session` cookie.
5. `GET /api/platform` without a session returns **401** (authorization enforced).
6. Authenticated round-trip (`GET /api/platform?section=status` with the issued cookie) returns 200.
7. Security headers on `GET /`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
8. Unknown routes return 404.
9. Static assets serve (`GET /logo.svg` → 200).
10. No credential markers in any served response body.

Every check reports **PASS** or **FAIL** with observed evidence; a check that cannot run reports **FAIL** with the reason — never a fabricated PASS. Exit code 1 on any FAIL.

### 5.3 Deployment gate — `scripts/deploy/deployment-gate.ts`

```bash
bun scripts/deploy/deployment-gate.ts [--ci]
# (no flag) release mode — includes repository state checks (on main, clean tree, synced with origin)
# --ci      CI mode — skips repo-state checks CI enforces itself
```

Gates: secret scan (§5.4) · env-var coverage (FAIL if code references a variable missing from `.env.example`; FAIL on sensitive `NEXT_PUBLIC_*` exposure) · `prisma validate` · dependency audit (`bun audit` — **CRITICAL blocks**, high/moderate/low reported) · backup/DR documentation gate (**WARN** by design: backup VERIFICATION is provider-managed and requires human confirmation in the Supabase dashboard before high-risk changes; in-app DR checks (P22-16) honestly report restore drills not performed) · optional health probe of a local instance.

Statuses: **PASS · FAIL · WARN · NOT RUN** per gate. Exit code 1 = **BLOCKED** (deployment not allowed). Lint/typecheck/build/smoke are delegated to CI and reported as such, never claimed as locally verified.

### 5.4 Secret scan — `scripts/security/secret-scan.ts`

Scans every git-tracked text file with **9 credential patterns**: Supabase service keys and service-role JWTs, database URLs with embedded credentials (non-localhost), GitHub personal access tokens, AWS access keys, private key blocks, Slack tokens, OpenAI-style API keys, and hard-coded secret-shaped assignments. On a finding it prints the **pattern name and `file:line` only — never the matched content**. Exit codes: 0 clean · 1 findings (remove and rotate the credential) · 2 scan could not run. Wired into CI and into the deployment gate.

### 5.5 Release tagging — `scripts/deploy/create-release.ts`

```bash
bun scripts/deploy/deployment-gate.ts                      # run the gate FIRST
bun scripts/deploy/create-release.ts --summary "…" [--version x.y.z]
```

Creates and pushes an **annotated Git tag `v<version>`** as the immutable release record linking version ↔ commit ↔ summary ↔ author ↔ timestamp. Refuses to run on a dirty working tree, off `main`, out of sync with `origin/main`, or when the tag already exists. The script **does NOT deploy** — Vercel deploys from `main` — and it deliberately does not create a second governance system: release approval/decision records remain in the in-app **Release Approval screen (P22-18)** + Enterprise Audit Log.

## 6. Preview Deployments

Vercel automatically builds a **preview deployment for every pull request**. Previews use the preview-scoped set of environment variables (the per-environment matrix from §3) and **never touch production data**. CI gates run on the PR before merge; the preview is the review surface.

## 7. Production Deployment Path

1. **Merge to `main`.** CI must be green — a failed check blocks merge and deploy.
2. **Vercel auto-deploys** the `main` commit (git-connected integration).
3. **Verify the deployment identity:** `GET https://qbitone-qbit-one.vercel.app/api/health` — the `commit` field must equal the pushed commit SHA, and `checks.database.status` must be `"connected"`.
4. **Run the smoke suite against production:**
   ```bash
   bun scripts/deploy/smoke-test.ts https://qbitone-qbit-one.vercel.app --strict-db
   ```
   All ten checks must report PASS (exit 0).
5. **Optional release record:** run the deployment gate, then `bun scripts/deploy/create-release.ts --summary "…"` to tag the release (§5.5). Deployment itself already happened in step 2 — the tag is traceability, not deployment.

## 8. Database Migration Policy

Read this section before touching `prisma/schema.prisma`.

- **The Prisma schema is a scaffold** (`User`, `Post` only). Application domain state lives in in-process server stores re-seeded from fixtures at process start — see [ARCHITECTURE.md](ARCHITECTURE.md).
- **There is no `prisma/migrations` directory.** The schema is applied with `prisma db push` — a schema push with **no migration history**.
- **NEVER run `bun run db:push`** (which is `prisma db push --accept-data-loss`) **or `bun run db:reset`** (which drops and re-creates the database) **against a database holding real data.** CI runs `db push` against a throwaway `postgres:16-alpine` service only.
- **For future real schema changes** (baseline procedure = **REQUIRES ACTION** decision):
  - Prefer `prisma migrate` going forward, which requires baselining the existing pushed schema first.
  - Use **expand-and-contract** (additive change → backfill/verify → contract) for high-risk changes.
  - Schema changes belong in pull requests with the schema diff reviewed (the PR template has a Database Changes section).
  - **Confirm a restorable backup in the Supabase dashboard BEFORE any high-risk migration.** Backup verification is provider-managed and requires human confirmation (§10).
- **Database rollback is NOT automatic when application code rolls back.** A Vercel rollback re-points the application to a previous deployment; the database keeps whatever state newer code wrote. With the current fixture-seeded stores this is low-impact — it becomes critical the moment real domain data lives in PostgreSQL.

## 9. Rollback

### Application rollback

- **Vercel instant rollback** to a previous production deployment via the Vercel dashboard, or via the in-app **Rollback Center (P22-19)**, which requires the server-only `VERCEL_TOKEN`, is authorization-gated, audited, and **never auto-executes**.
- Because the deployment maps to a commit, rollback = **re-point production to the previous known-good deployment**.

### Database rollback

- **Not automatic.** Restoring the database means restoring from a Supabase backup **per the Supabase dashboard** — never ad-hoc destructive SQL against production.

## 10. Backup & Disaster Recovery

- **Provider-managed.** Database backups are a Supabase capability (scheduled backups / point-in-time recovery per plan) — **VERIFY in the Supabase dashboard** which tier is active. Backup **verification** is provider-managed and requires a human to confirm a restorable backup exists in the Supabase dashboard before any high-risk change (the deployment gate reports WARN with exactly this reminder).
- **In-app DR self-checks (P22-15/P22-16) honestly report restore drills NOT performed.** **RPO and RTO are not defined.**
- There is no in-app backup or restore of Supabase data in this repository.

## 11. Failed Deployment / Incident Procedure

1. **Detect.** A CI failure blocks deploy before it happens; a Vercel build failure leaves the previous production deployment live.
2. **Stop rollout.** Do not blindly retry — a red pipeline is a signal, not noise.
3. **Identify the failing stage.** CI logs (GitHub Actions check run) or Vercel build logs; each CI step maps to one documented gate (§4).
4. **Inspect logs** and determine impact (users affected, data written, deployments since the last known-good state).
5. **Roll back if required.** Application: Vercel rollback (§9). Database: restore from a Supabase backup per the dashboard — never ad-hoc destructive SQL.
6. **Verify recovery.** Re-run the smoke suite: `bun scripts/deploy/smoke-test.ts https://qbitone-qbit-one.vercel.app --strict-db`; confirm `/api/health` reports the expected `commit` and `database: connected`.
7. **Document root cause.** The in-app **Incident Center (P22-23)** exists for incident records.

## 12. Dependency & Supply-Chain Policy

- `bun audit` runs on **every push/PR** via the deployment gate. **CRITICAL advisories block the pipeline** (FAIL); high/moderate/low are reported but non-blocking.
- Current posture after the Phase 24 upgrade: **0 critical** advisories; **52 remaining non-blocking advisories** (32 high, 18 moderate, 2 low) — mostly transitive dev-chain plus sharp/libvips inherited CVEs. (Counts are point-in-time; the gate reports live numbers on every run.) Remediation is **targeted, compatibility-reviewed updates — not blind churn**.
- Phase 24 upgrades: `next` 16.1.1 → **16.4.3** (remediating **4 critical RCE advisories**), `sharp` 0.34.3 → **0.34.5**, `eslint-config-next` → **16.4.3** (see [PROJECT_STATUS.md](PROJECT_STATUS.md) for the lint-rule consequences of that update).
- **Dependabot is enabled for the `github-actions` ecosystem only** ([.github/dependabot.yml](../.github/dependabot.yml), weekly). The npm/Bun ecosystems are **intentionally NOT enabled**: Dependabot has no Bun lockfile support (verified against dependabot-core in Phase 24) and npm-based PRs could not update `bun.lock`, breaking the frozen-lockfile CI install. Vulnerability scanning is enforced natively by `bun audit` instead.

## 13. Required Credentials & Access

| Access | Holder | Used for |
|---|---|---|
| GitHub repository admin — `github.com/qbitone47/qbitone` | repository owner (`qbitone47`) | Branch protection settings (§15), Actions settings, release tag push |
| Vercel project access — project `qbitone` | repository owner | Environment-variable matrix, deployments, rollbacks; `VERCEL_TOKEN` (server-only) for in-app rollback/telemetry screens |
| Supabase dashboard | repository owner | Production database, backups, restore, pre-migration backup verification |

None of these credentials are stored in the repository. Tokens live in the respective platform secret stores; `VERCEL_TOKEN`/`GITHUB_TOKEN` are optional server-only runtime variables (§3).

## 14. Ownership

Repository owner: **qbitone47** (`github.com/qbitone47/qbitone`). Deployment, rollback and incident authority follow repository ownership; the Vercel project `qbitone` and the Supabase project are administered by the same owner.

## 15. Branch Protection & Deployment Approval — REQUIRES ACTION

- **Branch protection must be configured in the GitHub UI** (Settings → Branches). Recommendation: require a pull request before merge to `main` where practical, and require the **"CI"** check to pass. This was **not force-enabled programmatically**, to avoid locking out the established push-to-deploy path — owner decision (**REQUIRES ACTION**).
- **Vercel "Production Deployment Approval"** (deployment protection) can be enabled in the Vercel dashboard settings if a human approval gate before production deployments is wanted — **REQUIRES ACTION**, owner decision.

## 16. Troubleshooting

| Symptom | Action |
|---|---|
| CI red | Read the failing stage's logs first — each step maps to one gate (§4). Fix forward. Failures are never bypassed or masked. |
| `/api/health` unavailable, or `database.status: "unavailable"` | Check `DATABASE_URL` and the platform secret store (Vercel per-environment settings); confirm the Supabase project is reachable; redeploy after correcting. |
| Smoke test 401 on the authenticated path | Session/signing problem: verify `QUBIT_AUTH_SECRET` is set (≥ 32 chars) and identical across instances — a missing or mismatched secret breaks signed-cookie validation. |
| Vercel build failure | The previous production deployment stays live. Read the build logs; fix forward or roll back to the previous known-good deployment (§9). Build failures are never bypassed. |

## 17. Not Provided

The following are **not part of this repository or its deployment**; do not assume them in planning:

- Redis, message queues, schedulers or background workers (all work executes in-request)
- Kubernetes, Docker image / Dockerfile / docker-compose
- External APM agents, uptime-monitoring services or error-aggregation SaaS
- Automated disaster recovery run by this repository; defined RPO/RTO targets
- SMTP / external mail relay
- Deploy scripts or deploy credentials in CI (CI validates; Vercel deploys from git)

## 18. Known Limitations (stated honestly)

- `next.config.ts` sets `typescript.ignoreBuildErrors: true` — a **pre-existing decision**. Type safety is enforced by the CI **typecheck stage** (`next typegen` + `tsc --noEmit`), which blocks merge, so a type error cannot reach production through the pipeline; the build itself would not catch it.
- **No uptime monitoring service, no APM/error aggregator, no SMTP** — the configured-integration list is unchanged; the Operations screens (P22-08, P22-10) report these as "Not configured".
- Backup/DR is provider-managed; restore drills have **not** been performed; RPO/RTO undefined (§10).
- Branch protection and Vercel deployment approval are manual owner actions (§15, REQUIRES ACTION).

## 19. Alternative: Self-Hosted Standalone (not the primary path)

The Next.js `output: "standalone"` build can be self-hosted on a single process. This path is **kept as-is and explicitly secondary** to the Vercel + Supabase pipeline above.

```bash
bun run build        # next build; .next/static and public copied into .next/standalone/
bun run start        # NODE_ENV=production bun .next/standalone/server.js, teed to server.log
# or: NODE_ENV=production node .next/standalone/server.js
```

- The server listens on **port 3000**. Run it under a process supervisor (systemd, tmux, or platform equivalent) — none is shipped in the repository.
- **Reverse proxy:** the repo-root `Caddyfile` is the reference gateway — a `:81` listener that proxies requests carrying an `XTransformPort` query parameter to `localhost:{port}` (optional mini-services) and everything else to `localhost:3000`. Forwarded headers are honored (HTTPS gains `Secure` cookie attribute + HSTS automatically). Any equivalent proxy works.
- **Health checks:** `GET /api` (liveness) and `GET /api/health` (§5.1; `commit` is `null` outside Vercel).
- **Logging:** `dev.log` (via `bun run dev`) and `server.log` (via `bun run start`); no log shipper. Export the audit trail before any restart — the live audit window is in-memory.
- **Rollback:** check out the prior release tag, rebuild, restart (or redeploy an archived `.next/standalone` artifact). In-process state is fixture-seeded, so application rollback carries no data-migration concern for the stores; the PostgreSQL database (scaffold models) is unaffected by application rollbacks.
- All other policies in this document (secrets, migrations, dependencies, incident procedure) apply equally to this path.
