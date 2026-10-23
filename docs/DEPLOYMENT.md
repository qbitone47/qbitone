# Qubit One — Deployment Guide

This is the **actual** deployment path for Qubit One as it exists today: development → build → CI → standalone artifact → process start behind a reverse proxy → health checks → logs/backup. The production deployment target is **Vercel (Next.js) + Supabase PostgreSQL**; a single-process self-hosted deployment via the standalone output remains available. Anything not provided is listed explicitly at the end.

## Pipeline Overview

```text
Development ──► Production Build ──► CI (GitHub Actions) ──► Artifact (.next/standalone)
                                                                    │
                                                                    ▼
   Monitoring ◄── Logging (server.log) ◄── Health Check (/api) ◄── Process (Bun/Node)
                                   behind Caddy gateway (:81)
```

## 1. Prerequisites

- **Bun ≥ 1.2** — required for `bun install`, all package scripts and the documented start command (https://bun.sh).
- **Node 20+** (alternative) — the standalone output is a plain Node-compatible server; `node .next/standalone/server.js` works where Bun is unavailable. The documented scripts assume Bun.
- No external services are required. There is no Redis, queue, mail relay or external database.

## 2. Environment Variables

Copy `.env.example` to `.env` in the deployment directory:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes for `db:*` scripts and the DB latency probe | Prisma PostgreSQL connection URL (Supabase in production; server-only) |
| `QUBIT_AUTH_SECRET` | No | Session signing secret (min 32 chars). If unset, a CSPRNG secret is generated once into `db/.auth-secret` |
| `APP_URL` | No | Reserved for reverse-proxy deployments |

Inject secrets via your platform's secret store or GitHub Actions Secrets. Never commit `.env`. The `db/` directory (database, backups, auth secret) and `*.log` files are git-ignored.

## 3. Database Initialization

```bash
bun run db:push
```

`prisma db push` applies the Prisma models to the PostgreSQL database configured in `DATABASE_URL`. **Note:** the Prisma schema is a scaffold (`User`, `Post` only); application domain state lives in the in-process server stores and is re-seeded from fixtures at process start (see [ARCHITECTURE.md](ARCHITECTURE.md#data-architecture)).

## 4. Running (Development)

```bash
bun run dev        # next dev -p 3000, output teed to dev.log
```

The application serves on **http://localhost:3000**.

## 5. Production Build

```bash
bun run build
```

Runs `next build` (output: `standalone`) and then copies `.next/static` and `public` into `.next/standalone/`, making the artifact self-contained. The build directory `.next/` is reproducible from any clean checkout at the same commit.

CI (GitHub Actions) runs the same gates on every push/PR: `bun install --frozen-lockfile` → `bun run lint` → `bun run typecheck` → `bun run build`. CI does not deploy; deployment is performed from a tagged build (see Rollback).

## 6. Production Start

```bash
bun run start      # NODE_ENV=production bun .next/standalone/server.js, teed to server.log
```

Or without Bun:

```bash
NODE_ENV=production node .next/standalone/server.js
```

The server listens on port **3000**. Run it under a process supervisor (systemd, tmux, or your platform's equivalent) — no supervisor configuration is shipped in the repository.

## 7. Reverse Proxy (Caddy)

The repo-root `Caddyfile` is the reference gateway. It listens on `:81`; requests with a `XTransformPort` query parameter are proxied to `localhost:{port}` (the optional mini-services extension point), everything else to `localhost:3000`:

```caddyfile
:81 {
    @transform_port_query {
        query XTransformPort=*
    }
    handle @transform_port_query {
        reverse_proxy localhost:{query.XTransformPort} {
            header_up Host {host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up X-Real-IP {remote_host}
        }
    }
    handle {
        reverse_proxy localhost:3000 {
            header_up Host {host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up X-Real-IP {remote_host}
        }
    }
}
```

Forwarded headers are honored: over HTTPS the session cookie gains `Secure` and `Strict-Transport-Security` is emitted automatically. Any equivalent reverse proxy works; the Caddyfile is the shipped reference.

## 8. Health Checks

- `GET /api` returns a small JSON message with HTTP 200 — use it as the liveness probe.
- Deeper, in-app diagnostics: Platform Ops measures real database latency (`SELECT 1`), memory/load/uptime and an API round-trip self-probe, and labels everything it cannot measure as "Not configured" / "Not connected".

## 9. Logging

- Development: `dev.log` (via `bun run dev`).
- Production: `server.log` (via `bun run start`).
- The centralized audit trail is queryable via `GET /api/security/audit` and exportable to CSV by administrators (rate-limited, audited). **Export before any restart** — the live audit window is in-memory.
- There is no log shipper or APM.

## 10. Backup & Recovery

**Honest state: backups are manual or in-app; there is no automated disaster recovery.**

- **In-app backups (real).** The Platform Ops module copies the SQLite database file into `db/backups/` with SHA-256 checksums (verified by re-hash and SQLite header check); the last 10 are retained. Restore tests run against a **staging copy** — production is never touched, and restore requests are audited.
- **Manual backup.** Stop the process (or accept a copy at rest) and copy the git-ignored SQLite file(s) under `db/` to safe storage. Schedule and retention are the operator's responsibility.
- **Restore.** Replace the database file with the chosen backup and restart the process. Application domain state (in-process stores) re-seeds from fixtures at startup; only the Prisma-backed artifacts reflect the restored file.

## 11. Rollback

Deploy the previous tagged build: check out the prior release tag, run `bun install --frozen-lockfile && bun run build`, and restart the process (or redeploy the previously built `.next/standalone` artifact if it was archived). Because application state is per-process and fixture-seeded, rollback carries no data-migration concern for the in-process stores; the PostgreSQL database (scaffold models) is unaffected by application rollbacks.

## 12. Migration Safety

- `bun run db:push` runs with `--accept-data-loss` — **never run it against a database holding real data.**
- **Never run `bun run db:reset` against production data**; it drops and re-creates the database.
- Schema changes belong in pull requests with the schema diff reviewed; the current schema is scaffold-only.

## Not Provided / Not Present

The following are **not part of this repository**; do not assume them in deployment planning:

- Docker image, Dockerfile or docker-compose (no container packaging)
- Kubernetes manifests or orchestration tooling
- External APM/observability agents or hosted monitoring integrations
- Queue infrastructure, schedulers or background workers (all work executes in-request)
- Automated disaster recovery, offsite replication or scheduled backup jobs
- Multi-instance coordination (state is per-process; run exactly one instance per database file)
