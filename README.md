# Qubit One

**Qubit One is an Enterprise Business Operating System** — a unified, permission-aware enterprise platform delivered as ONE Next.js application with role-based navigation, not a collection of isolated apps. It covers sales/CRM, finance, HR, inventory, service, marketing, meetings, collaboration/workspace, analytics, automation, AI assistance and security/platform administration over a single shared shell, audit trail and permission model.

This is an active development codebase. It implements 152 of the 308 screens defined in the original product roadmap and runs on deterministic demo data. It is not production ready. See [Current Implementation Status](#30-current-implementation-status) and [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for the honest state of every module.

---

## 1. Overview

| | |
|---|---|
| Package | `qubit-one` (private) |
| Version | 0.2.1 |
| Application model | Single Next.js App Router application; one visible route with client-side screen switching via a typed screen registry |
| Screens implemented | 152 across 12 modules (roadmap numbers 01–110 and 267–308) + 24 operations screens (Phase 22, internal IDs P22-01–P22-24) |
| Roles | `administrator`, `dept-head`, `sales-exec`, `hr-manager`, `employee` |
| Data model | 9 typed in-process server stores seeded from structured fixtures; Prisma/PostgreSQL is currently scaffold-only |
| Runtime | Bun (also runs under Node 20+ via the standalone output) |
| License | Proprietary — see [LICENSE](LICENSE) |

## 2. Product Vision

Most enterprises run a patchwork of disconnected tools. Qubit One's premise is that the operating system of a company should be one connected, permission-aware platform: every module reads and writes through the same authorization plane, the same notification/approval model and the same audit trail. Users do not switch between hundreds of isolated apps — they sign in once and see a workspace shaped by their role. **Module structure is not user-experience structure**: the codebase is organized into modules, but users experience one coherent product with role-based navigation.

## 3. Core Capabilities

- **Sales Operating System** — leads, accounts, opportunities, quotations, orders, visits, targets, expenses, travel, forecasting and reporting (30 screens), all scoped server-side by role.
- **Sales AI** — server-side AI orchestration over governed sales data: daily brief, lead prioritization, next-best-action, customer summaries, follow-up writing, pipeline review.
- **CEO Command Center** — executive overview, approvals, alerts, reports and AI insights scoped to the executive boundary.
- **Employee Workspace** — My Tasks, My Calendar, My Meetings, My Approvals, My Documents, My Notifications, My Profile, My Activity, backed by a shared server store.
- **Mail and Meetings** — server-backed mail and meeting lifecycles (scheduling, minutes, action items that promote into My Tasks).
- **Security** — sign-in with MFA challenge verification, passkey and password flows, device/account session management, access requests, IP/network policies, alerts and a centralized audit log.
- **Analytics** — one governed analytics architecture over the existing sources of truth (sales, executive, tasks, audit), with report building, exports, schedules and drilldowns.
- **Mobile** — a mobile surface (16 screens) that shares the same server-side enforcement as the desktop (identical stores, role checks and audit).
- **Platform Ops** — system status, monitoring, backup/restore with SHA-256-verified copies, release management and hardening reviews, with honest "Not configured" boundaries where telemetry does not exist.
- **Enterprise governance** — org structure, role/permission matrices, workflow catalog, approval matrix, notification rules, integration map and data ownership (UI complete, fixture-backed).
- **Design System** — an 18-screen living style guide (tokens, typography, color, components, states, accessibility, responsive rules).

## 4. Architecture

One Next.js application behind a reference Caddy gateway. Route handlers enforce a fail-closed session gate, then delegate to server-only domain stores; every consequential mutation writes to one centralized audit trail. Optional socket.io mini-services can be reached through the gateway via the `XTransformPort` query parameter.

Full details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 5. Technology Stack

The stack below is the complete, real stack. No other frameworks, databases or infrastructure are used in this repository.

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, `output: "standalone"`) |
| UI runtime | React 19 |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 |
| Components | shadcn/ui (New York) on Radix primitives, lucide-react |
| Motion / carousel | framer-motion, embla-carousel |
| Data fetching / tables | @tanstack/react-query, @tanstack/react-table |
| Client state | zustand |
| Theming / i18n | next-themes, next-intl |
| Forms | react-hook-form (shadcn form wrapper); zod is a declared dependency but is not currently imported in application source — validation is hand-rolled server-side guards |
| Rich content | @mdxeditor/editor, react-markdown, react-syntax-highlighter |
| Command palette | cmdk |
| Utilities | date-fns, qrcode.react, input-otp, uuid |
| Realtime (reference) | socket.io-client (see `examples/websocket/`) |
| AI | z-ai-web-dev-sdk — server-side only, behind `src/lib/qubit/ai-engine.ts` |
| Database | Prisma 6 with PostgreSQL provider (scaffold schema; see [Database](#10-database)) |
| Runtime / package manager | Bun (`bun.lock`) |
| Reverse proxy (reference) | Caddy (repo-root `Caddyfile`) |

## 6. Repository Structure

```text
qubit-one/
├── Caddyfile               # Reference reverse-proxy gateway (:81; XTransformPort routing)
├── LICENSE                 # Proprietary license
├── README.md
├── SECURITY.md             # Vulnerability reporting policy
├── CONTRIBUTING.md
├── package.json            # Scripts and pinned dependencies (private package)
├── bun.lock                # Locked dependency graph (Bun)
├── next.config.ts          # standalone output, poweredByHeader disabled
├── tsconfig.json           # TypeScript strict configuration
├── components.json         # shadcn/ui configuration
├── prisma/
│   └── schema.prisma       # PostgreSQL provider (scaffold models only)
├── db/                     # Git-ignored runtime: backups, generated auth secret (local dev)
├── docs/                   # Engineering documentation (this documentation set)
├── examples/
│   └── websocket/          # socket.io reference demo for optional mini-services
├── scripts/                # One-shot TypeScript codemods from earlier hardening phases
└── src/
    ├── app/
    │   ├── page.tsx        # The single visible route (screens switch client-side)
    │   └── api/            # Route handlers (see Authentication and docs/ARCHITECTURE.md)
    ├── proxy.ts            # Edge proxy: security headers, CSRF/origin checks, body guard
    ├── components/
    │   ├── qubit/          # Shell, screen registry, 152 screens, primitives, per-module parts
    │   └── ui/             # shadcn/ui primitives
    ├── hooks/              # use-toast, use-mobile
    └── lib/
        ├── db.ts           # Prisma client
        └── qubit/          # Domain stores (*-server.ts), fixtures (*-data.ts), screens.ts, ai-engine.ts
```

Local sandbox artifacts (`tool-results/`, `upload/`, `download/`, `agent-ctx/`, `.agent-browser/`, `.zscripts/`, `worklog.md`, `*.db`, `dev.log`, `server.log`) and the runtime `db/` directory are git-ignored and are not part of the source tree.

## 7. Application Modules

The screen registry (`src/lib/qubit/screens.ts`) defines 152 screens across 12 modules. Status summary; per-module detail in [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

| Module | Screens | Roadmap numbers | One-line status |
|---|---:|---|---|
| Enterprise | 12 | 01–12 | UI complete, fixture-backed; no dedicated server store |
| Design System | 18 | 13–30 | Functional living style guide |
| Security | 10 | 31–40 | Functional — server-enforced auth, sessions, policies, audit |
| Workspace | 9 | 41–49 | Functional — server-backed tasks, approvals, docs, meetings |
| People | 5 | 50–54 | UI complete, fixture-backed; backend pending |
| Mail | 4 | 55–58 | Functional within demo scope; no external mailbox integration |
| CEO Command Center | 14 | 59–72 | Functional — server-backed executive boundary |
| Sales | 30 | 73–102 | Functional — server-backed with scope enforcement |
| Sales AI | 8 | 103–110 | Functional — server-side AI over governed data |
| Analytics | 18 | 267–284 | Functional — governed cross-domain analytics + audit |
| Mobile | 16 | 285–300 | Functional — shares desktop server enforcement |
| Platform Ops | 8 | 301–308 | Functional for measurable telemetry; honest boundaries elsewhere |

Sidebar entries for Finance, HR & People, Inventory, Marketing and Service currently route to governed Analytics views. Dedicated operating modules for those domains (roadmap numbers 111–266) are **not present in this repository**.

## 8. Authentication & Authorization

- The client obtains a **server-issued session** from `POST /api/auth/session`. The server validates the requested role against a server-side identity directory and issues an HMAC-SHA256-signed, expiring (8h), revocable token carried in an `httpOnly`, `SameSite=Strict` cookie (`Authorization: Bearer` is accepted for service/probe clients).
- Every API route resolves the acting identity through a fail-closed gate (`requireIdentity`). A missing or untrusted session receives a structured `401 { code: "session_required" }`. The `X-Qubit-Role` header is retained only as a display hint; the server never trusts a client-declared role.
- Authorization is role-based with five roles (`administrator`, `dept-head`, `sales-exec`, `hr-manager`, `employee`), enforced server-side in every store function.
- **Known limitation:** this is a demo-grade session/role model. A single demo identity can assume the five roles (role-preview model). No real identity provider (OAuth/OIDC/external IdP) is wired.

Details: [docs/SECURITY.md](docs/SECURITY.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 9. Security

Security architecture, controls, known gaps and the security roadmap: [docs/SECURITY.md](docs/SECURITY.md). Vulnerability reporting policy: [SECURITY.md](SECURITY.md) (private disclosure; do not open public issues for security reports).

## 10. Database

- `prisma/schema.prisma` uses the **PostgreSQL** provider and currently contains only scaffold models (`User`, `Post`). **The application domain state does not live in Prisma** — it lives in the 9 in-process server stores seeded deterministically from fixture modules at process start.
- The Prisma client is used by the Platform Ops store for a real database latency probe against the configured PostgreSQL database (Supabase in production); the schema is applied with `bun run db:push`.
- Consequence: application state is **per-process** and resets on process restart (with the exception of backup artifacts under `db/backups/`, which are real files). A persistent domain data layer is a roadmap item.

## 11. AI Platform

AI features are implemented **server-side only** via `z-ai-web-dev-sdk`, behind the provider-agnostic `src/lib/qubit/ai-engine.ts` abstraction. The client never sees provider details or keys. The orchestration layer (`sales-ai-server.ts`, `/api/sales-ai`) enforces:

- Authorization-first retrieval — AI context is fetched through the same role-scoped, permission-checked data access as users.
- Consequential actions are never executed silently — mutations go through the existing sales workflows and require explicit confirmation.
- Every AI operation is audited in the centralized audit trail; confidence is coarse (High/Medium/Low/Insufficient) and missing data is reported, never fabricated.
- Prompt-injection defense — retrieved business data is embedded as clearly delimited untrusted content.

## 12. Automation Engine

As implemented today, automation consists of:

- The approval engine in the workspace store (role-checked decisions, delegated meeting writes, promotion of meeting action items into tasks).
- Live, per-recipient notifications generated by server actions (meeting invites/cancellations) on top of a seeded notification catalog.
- Workflow catalog, approval matrix and notification-rule screens in the Enterprise module (fixture-backed governance catalogs).
- Scheduled-report configuration surfaced in Analytics/Platform Ops.

There is **no external job scheduler, queue or workflow runtime** in the repository; all actions execute in-request within the Next.js process.

## 13. Analytics

The Analytics module (18 screens) is one architecture, not a second data engine: every figure is read through the enforcement layer of its source system (sales via `salesGet` with scope reapplied, executive via the canonical executive blocks, tasks via the single workspace task store, audit via the audit query API). Role permissions, department scope, row scoping and export permissions are enforced server-side. Metric governance separates Booked/Recognized/Collected figures, and freshness is honest — partial or stale states are surfaced rather than papered over.

## 14. Integrations

- **Reverse proxy gateway** — the repo-root `Caddyfile` is the reference deployment topology: a `:81` listener proxies requests carrying `XTransformPort` to `localhost:{port}` (mini-services) and everything else to `localhost:3000` (the application).
- **Optional mini-services** — `mini-services/` is currently a `.gitkeep` placeholder extension point; `examples/websocket/` is a small socket.io reference demo for the pattern such services would use.
- **No external integrations are wired.** The Integration Map screen is a fixture-backed catalog. There are no external mail, calendar, SSO, CRM or payment integrations in this repository.

## 15. Local Development

Prerequisites:

- **Bun 1.2+** — required for install, scripts and the dev server (https://bun.sh).
- No other services are required. The database is PostgreSQL (Supabase in production).

## 16. Environment Variables

Copy [.env.example](.env.example) to `.env` and fill in values. `.env` is git-ignored; never commit it.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes (for `db:*` scripts and the Prisma-backed health probe) | Prisma PostgreSQL connection URL (Supabase in production; server-only) |
| `QUBIT_AUTH_SECRET` | No | Session-token signing secret (min 32 chars). If unset, a CSPRNG secret is generated once and persisted to the git-ignored `db/.auth-secret` |
| `APP_URL` | No | Reserved for deployment-specific configuration behind a reverse proxy |

## 17. Installation

```bash
bun install
```

## 18. Running Locally

```bash
# 1. Initialize the database schema (applies the Prisma models to DATABASE_URL)
bun run db:push

# 2. Start the dev server on port 3000 (output is teed to dev.log)
bun run dev
```

Open http://localhost:3000. All scripts: `bun run dev`, `build`, `start`, `lint`, `typecheck`, `db:push`, `db:generate`, `db:migrate`, `db:reset` (see `package.json`).

## 19. Build

```bash
bun run build
```

`next build` produces the **standalone** output; the script then copies `.next/static` and `public` into `.next/standalone/` so the server bundle is self-contained.

## 20. Test

**There is no automated test suite.** No unit or integration test runner is configured in `package.json`. Quality is enforced by:

```bash
bun run lint        # ESLint (flat config)
bun run typecheck   # tsc --noEmit
bun run build       # production build
```

CI runs these gates plus a secret scan, a deployment gate (env-var coverage, Prisma validation, dependency-audit critical gate), a schema push against a throwaway PostgreSQL service and standalone smoke tests (see [CI/CD](#23-cicd)). Changes are otherwise verified manually (route probes with session cookies, browser walkthroughs). Adding a real test suite is a roadmap item; until then, do not describe the project as test-covered.

## 21. Production Deployment

The primary deployment path is git-connected: **GitHub** (`github.com/qbitone47/qbitone`, branch `main`) → **GitHub Actions CI** → **Vercel** (project `qbitone`, auto-deploy on push to `main`) → **Supabase PostgreSQL**. Production URL: https://qbitone-qbit-one.vercel.app. The full lifecycle — CI stages, environment-variable matrix, preview deployments, database migration policy, application vs database rollback, incident procedure and the Phase 24 deployment tooling (`/api/health` probe, smoke tests, deployment gate, secret scan, release tagging) — is documented in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). A self-hosted standalone deployment remains available there as an explicitly-labeled alternative.

## 22. Docker

**No Docker image, Dockerfile or docker-compose setup is provided in this repository.** Container packaging is not implemented. Deployment is managed on Vercel (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)); a self-hosted standalone server behind a reverse proxy remains a documented alternative.

## 23. CI/CD

The CI pipeline runs on **GitHub Actions** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) on every push and pull request to `main`, under least-privilege permissions (`contents: read`) with cancel-in-progress concurrency:

```text
checkout → Bun install (frozen lockfile)
→ secret scan (scripts/security/secret-scan.ts)
→ deployment gate (scripts/deploy/deployment-gate.ts --ci: env-var coverage ·
   prisma validate · bun audit, CRITICAL advisories blocking)
→ lint → prisma generate → prisma db push (throwaway postgres:16-alpine service)
→ next typegen → typecheck → production build
→ artifact size report (report-only) → standalone smoke tests (scripts/deploy/smoke-test.ts --strict-db)
```

No production secrets are used in CI (the PostgreSQL service is throwaway; the CI session secret is a non-credential test value). A failed check blocks merge and deploy — failures are never masked. There are no test jobs (there is no test suite) and CI does not deploy: **Vercel auto-deploys when `main` advances**. Dependabot is enabled for the `github-actions` ecosystem only — the npm/Bun ecosystems are intentionally not enabled because Dependabot has no Bun lockfile support, and dependency auditing is enforced natively by `bun audit` in the deployment gate. Full detail, including the Phase 24 deployment tooling: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## 24. Monitoring

- **Process logs** — `bun run dev` and `bun run start` tee output to `dev.log` / `server.log` respectively. These logs plus the audit trail are the monitoring story; there is **no external APM**.
- **Audit trail** — every consequential mutation (including denials) is written through the centralized `writeAudit` and is queryable via `GET /api/security/audit` and the Audit Log screen.
- **In-app telemetry** — the Platform Ops module measures what is genuinely measurable in this environment (database latency via a live `SELECT 1`, system memory/load/uptime, API round-trip self-probe, security headers read from a real response, browser vitals posted by the client) and labels everything else "Not configured" / "Not connected".

## 25. Backup & Recovery

- The Platform Ops module creates **real file copies** of the local development SQLite database into `db/backups/` with SHA-256 checksums (verified by re-hash and SQLite header check) and tests restores into a staging copy — production is never touched. In production (PostgreSQL/Supabase), use managed database backups instead; the file-based backup operations degrade gracefully where no local database file exists.
- Operational backup is otherwise **manual**: copy the git-ignored SQLite file(s) under `db/`. Restore is file replacement while the process is stopped.
- There is **no automated disaster recovery**, no offsite replication and no scheduled backup jobs.

## 26. Git Workflow

- `main` is the integration branch and must always pass `lint`, `typecheck` and `build`.
- Work happens on short-lived branches and lands via pull requests (see [CONTRIBUTING.md](CONTRIBUTING.md)).
- Dependencies are locked in `bun.lock`; lockfile changes accompany dependency changes in the same PR.

## 27. Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Integration branch; protected; tagged at releases |
| `feature/*` | New functionality (e.g. `feature/audit-retention`) |
| `fix/*` | Bug fixes (e.g. `fix/meeting-promote-conflict`) |
| `release/*` | Release stabilization and version bumps |

## 28. Release Process

1. Cut a `release/*` branch; verify `lint`, `typecheck` and `build` pass.
2. Merge to `main` and tag with **Conventional Commits**-derived semver (e.g. `v0.3.0`) — `bun scripts/deploy/create-release.ts --summary "…"` records the annotated tag (version ↔ commit ↔ summary).
3. Vercel auto-deploys from `main`; the tag is the immutable release record, not a deployment. Verification and rollback: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `refactor:`).

## 29. Known Limitations

- **152 of 308 roadmap screens** exist; roadmap numbers 111–266 were never committed to this repository.
- **No automated tests** — no unit/integration test runner is configured.
- **Demo-grade authentication** — single demo identity with role preview; no real identity provider, no user registration or credential store.
- **In-process state** — the 9 domain stores are per-process and reset on restart; Prisma models are scaffold-only.
- `typescript.ignoreBuildErrors` is **true** in `next.config.ts`; typecheck is enforced separately via `bun run typecheck` locally and in CI.
- **Rate limiting is in-process** (fixed-window, per-instance) — not a distributed or edge-level control.
- **CSP is partial** (frame-ancestors/object-src/base-uri/form-action; no script-src nonce strategy).
- All data is **synthetic demo fixtures** — no real PII; the audit trail is in-memory with a capped live window.
- No Docker/Kubernetes, no external APM, no queue infrastructure, no automated DR.
- A Radix `DialogContent` accessibility warning fires when the command palette opens (pre-existing, tracked).

## 30. Current Implementation Status

The original product roadmap defined **308 screens across 18 phases**. This codebase contains **152 screens**: roadmap numbers **1–110** (phases 1–7: enterprise architecture, design system, security, workspace, CEO command center, sales OS, sales AI) and **267–308** (phases 17–18: analytics/audit and enterprise hardening + mobile). **Roadmap numbers 111–266 (phases 8–16) were never committed to this repository and are not present.**

| Roadmap range | Phases | Content | Status |
|---|---|---|---|
| 001–110 | 1–7 | Enterprise, design system, security, workspace, executive, sales, sales AI | Implemented (152 screens incl. below) |
| 111–266 | 8–16 | Dedicated operating modules (e.g. Finance, HR, Inventory, Marketing, Service OS) | **Absent from the codebase** |
| 267–284 | 17 | Analytics / audit | Implemented |
| 285–308 | 18 | Enterprise hardening + mobile | Implemented |

Full module-by-module status with the status legend: [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## 31. Roadmap

- Implement roadmap numbers 111–266 — the dedicated operating modules (Finance, HR & People, Inventory, Marketing, Service).
- Replace the in-process stores with a persistent domain data layer (Prisma schema beyond scaffold).
- Introduce a real identity provider and per-user identities (OAuth/OIDC), replacing the demo role-preview model.
- Add an automated test suite (unit + integration) and wire it into CI.
- Replace `ignoreBuildErrors` with a clean build; harden CSP (script-src strategy) and consider a distributed rate-limiting layer.
- Durable audit retention and log shipping; optional container packaging.

## 32. Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — branch naming, Conventional Commits, review expectations, code standards (server-side role checks and audit for every new backend mutation) and documentation requirements.

## 33. Security Reporting

Found a security vulnerability? Do **not** open a public issue. Follow the private disclosure process in [SECURITY.md](SECURITY.md).

## 34. License

Proprietary. Copyright (c) 2025 Qubit One. All Rights Reserved. See [LICENSE](LICENSE). Third-party dependencies retain their own licenses.
