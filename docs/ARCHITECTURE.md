# Qubit One — Architecture

This document describes the system **as implemented**. Where a capability is partial or absent, it says so.

## System Architecture

```text
                         ┌──────────────────────────────────────────────┐
                         │                    Browser                   │
                         │  single route (src/app/page.tsx) — screens   │
                         │  switch client-side via the screen registry  │
                         └───────────────┬──────────────────────────────┘
                                         │ http
                          ┌──────────────▼──────────────┐
                          │        Caddy gateway :81    │   repo-root Caddyfile
                          │  query XTransformPort=N ──► localhost:N   (mini-services)
                          │  everything else ────────► localhost:3000 (Next.js)
                          └──────────────┬──────────────┘
                                         │
┌────────────────────────────────────────▼────────────────────────────────────────┐
│                              Next.js 16 (standalone)                            │
│                                                                                 │
│  src/proxy.ts (edge)      security headers, CSRF/origin checks, 1 MiB body guard │
│  App Router               one visible route; shell (sidebar/topbar/palette)     │
│  /api/* route handlers    identity gate → validation → store call → JSON        │
│        │                                                                        │
│        ▼                                                                        │
│  requireIdentity (auth-server.ts)   HMAC-signed session cookie; fail-closed 401 │
│        │                                                                        │
│        ▼                                                                        │
│  9 domain stores (*-server.ts)      globalThis singletons, structuredClone-seeded│
│  analytics · auth · executive · mobile · platform · sales-ai · sales ·          │
│  security · workspace                 from *-data.ts fixtures                   │
│        │                                    │                                   │
│        └────────────┬───────────────────────┘                                   │
│                     ▼                                                           │
│  writeAudit (security-server.ts)  — ONE centralized audit trail                 │
│                                                                                 │
│  ai-engine.ts (server-only)   z-ai-web-dev-sdk behind a provider abstraction    │
│  Prisma client (lib/db.ts)    PostgreSQL, scaffold schema — latency probe        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Optional mini-services (socket.io pattern, see `examples/websocket/`) would run as separate processes reached through the gateway's `XTransformPort` routing. `mini-services/` is currently a placeholder.

## Frontend Architecture

- **One route, 152 screens.** `src/app/page.tsx` is the single visible route. Screens are client-side views switched via the navigation context (`nav-context.tsx`); no per-screen URL routes exist.
- **Screen registry chain.** `src/lib/qubit/screens.ts` is pure metadata (`ScreenId`, `SCREENS` — 152 entries with id, roadmap number, title, module). `src/components/qubit/screen-registry.tsx` holds `SCREEN_COMPONENTS`, a `Record<ScreenId, ComponentType>` wiring **152 of 152** screens.
- **Shell.** `src/components/qubit/shell/` provides `app-shell.tsx`, `sidebar.tsx` (role-aware, sectioned navigation), `topbar.tsx` (breadcrumbs, palette, notifications), `command-palette.tsx` (cmdk) and `module-placeholder.tsx` (module landing pages). A `ScreenLoadError` fallback renders if a screen component throws or is missing.
- **Role-aware UX.** `role-context.tsx` manages the active role (preview model) and issues the server session on mount and on every role switch. The sidebar, permission-gated actions and record scopes follow the active role; the server re-derives the identity from the session on every API call.
- **Design system.** shadcn/ui (New York) primitives under `src/components/ui/`, plus Qubit primitives (`primitives.tsx`, `data-table.tsx`, `page-header.tsx`, drawers/dialogs/tree). Deep navy sidebar (`#0D1B33`), enterprise blue primary (`#2563EB`), 8px radius, status badges with dot+label (never color-only).

## Backend Architecture

- **Route handlers** under `src/app/api/` are thin: resolve identity → parse/validate → call a store function → return JSON.
- **Server stores.** Nine server-only modules own all domain state. Each is a `globalThis` singleton (one shared instance across separately-bundled routes) seeded deterministically at process start by `structuredClone` of structured fixture modules (`*-data.ts`). Mutations go through store functions that enforce role checks, scope rules and validation — the frontend is never the source of truth.
- **Discriminated-action POST pattern.** Write endpoints accept `{ action: "create" | "cancel" | ... , ...fields }` and dispatch in a `switch`; unknown actions return structured `400`.
- **Structured error contract.** Failures are JSON `{ code, message }` (plus `conflicts` where relevant): `400 bad_request`, `401 session_required`, `403` (`permission_denied`, `origin_rejected`, `platform_admin_required`, resource-class codes such as `confidential`/`restricted`), `404`, `409` (state conflicts), `413 payload_too_large`, `422` (validation), `429 rate_limited` (with `Retry-After`). Internal error details are not leaked to clients.
- **API surface (complete, 25 route handlers):**

```text
GET  /api                          # root — simple JSON message (liveness probe)
POST /api/auth/session             # issue signed session (role validated server-side)
GET  /api/auth/session             # server-derived identity diagnostic
GET  /api/analytics  /api/executive  /api/mobile  /api/platform  /api/sales
POST /api/sales                    # sales workflow actions
POST /api/sales-ai                 # AI operations (server-side only)
GET  /api/search                   # cross-module record search (role-scoped)
     /api/security/access-requests /api/security/alerts      /api/security/audit
     /api/security/auth/login      /api/security/auth/mfa    /api/security/password
     /api/security/passkey         /api/security/policies    /api/security/sessions
     /api/workspace/approvals      /api/workspace/documents  /api/workspace/mail
     /api/workspace/meetings       /api/workspace/notifications
     /api/workspace/profile        /api/workspace/tasks
```

## Data Architecture

```text
*-data.ts fixtures (deterministic, synthetic demo enterprise)
        │  structuredClone at process start
        ▼
9 in-process stores (globalThis singletons, per-process lifetime)
        │  mutations via store functions (role checks + writeAudit)
        ▼
JSON responses to the client (client never imports server stores)
```

- **Consequence:** application state is **per-process** and resets on process restart. Running multiple instances would give each its own divergent state. This is acceptable at demo fixture scale and is the most important constraint to understand before deploying.
- **PostgreSQL/Prisma scaffold.** `prisma/schema.prisma` (PostgreSQL provider) contains only `User`/`Post` scaffold models. `bun run db:push` applies the models to the database configured in `DATABASE_URL` (Supabase PostgreSQL in production); the Prisma client is used for a real database latency probe in Platform Ops. Domain persistence is a roadmap item.
- **Synthetic data only.** Fixtures model "Qubit One Pvt Ltd" with deterministic values (including a fixed demo clock). No real PII is present.

## Authentication & Authorization

As implemented (see `src/lib/qubit/auth-server.ts`, `src/lib/qubit/api.ts`):

1. **Session issuance.** `POST /api/auth/session { role }` validates the requested role against a server-side identity directory and issues a session: `v1.<payload>.<sig>` — payload is base64url JSON (`sid`, `uid`, `r`, `iat`, `exp`), signature is **HMAC-SHA256** (WebCrypto). TTL is 8 hours (absolute). The token is set as an `httpOnly`, `SameSite=Strict` cookie (`qubit_session`); `Secure` is applied automatically on HTTPS. `Authorization: Bearer` is accepted for service/probe clients.
2. **Fail-closed gate.** Every protected route calls `requireIdentity(req)`. `verifySessionToken` checks the signature (constant-time comparison), expiry, revocation status and that the (user, role) pair still matches the server directory — any failure returns a structured `401 { code: "session_required" }`. The acting role is always **server-derived**; the `X-Qubit-Role` header is a display hint only and is ignored for authorization.
3. **RBAC.** Five roles: `administrator`, `dept-head`, `sales-exec`, `hr-manager`, `employee`. Store functions enforce role boundaries and record scope (company/team/own) per action; denials return structured `403` and are audited.
4. **Revocation.** Sessions can be revoked individually, per user, or all-except-current; revocation is enforced on every resolve, not cosmetically.
5. **Demo boundary (documented, not hidden).** The identity directory contains one demo principal who may hold all five roles (role-preview model). There is no real identity provider; user onboarding and credential management do not exist.
6. **Client integration.** `src/lib/qubit/api.ts` wraps fetch with `ensureSession()` (idempotent issuance on role change) and auto-heal — a `401 session_required` re-issues the session once and retries once, so idle tabs recover transparently.

## Notification, Approval and Automation Model (as implemented)

- **Approvals.** Approval requests live in the workspace store. Decisions go through `decideApproval`-style store functions that check the acting role and reporting line, enforce state transitions (e.g. `409` on already-decided records), notify affected participants and audit the decision. The CEO Command Center has its own executive approval surface with the same pattern.
- **Notifications.** The notification center is the seeded fixture catalog plus live notifications generated by server actions (meeting invites/cancellations). Every notification carries a `recipientId` and lists are filtered to the session user — one viewer can never surface another viewer's invites (desktop and mobile share this path). The organizer never notifies themselves.
- **Meetings → tasks.** Meeting minutes and action items are recorded server-side (organizer-only, Completed-state enforced; mobile delegates to the same enforcement). Action items can be **promoted into My Tasks** (a repeat promotion returns `409`).
- **Document controls.** Documents carry confidentiality classes; `Confidential` downloads/shares are allowed only for owner/administrator/dept-head and produce audited `403`s otherwise; `Restricted` documents block downloads/shares for everyone.
- **Scheduled reports** exist as seeded configuration surfaced in Analytics/Platform Ops. There is **no external scheduler, queue or workflow runtime** — every action executes in-request inside the Next.js process. The Enterprise module's workflow catalog and approval matrix are governance catalogs (fixture-backed).

## Observability

- **Logs.** `bun run dev` tees to `dev.log`; `bun run start` tees to `server.log`. There is no external APM or log shipper.
- **Audit trail.** One centralized trail via `writeAudit` (see `src/lib/qubit/security-server.ts`). Record shape (`AuditEvent`): `id`, `ts` (epoch ms), `time` (formatted), `actor`, `actorId`, `action`, `resource`, `result` (`Success` | `Failure` | `Blocked`), `severity` (`Info` | `Warning` | `High` | `Critical`), `source`, `ipMasked`, `correlationId` (`QB-AUD-2026-<seq>`), `context`. Every module and the AI layer write to this same trail. Retention is in-memory (live window capped at 200 events, seeded with fixture history); CSV export is administrator-only, rate-limited and audited. Exposed via `GET /api/security/audit` (server-side filtering, pagination validated, non-admins scoped to their own events).
- **Health.** `GET /api` returns a simple JSON message and serves as a liveness probe. Platform Ops adds real probes (DB latency, memory/load, API round-trip, security headers, browser vitals) and honestly labels everything it cannot measure.

## Deployment Topology

The repo-root `Caddyfile` is the reference gateway:

```caddyfile
:81 {
    @transform_port_query { query XTransformPort=* }
    handle @transform_port_query {           # optional mini-services
        reverse_proxy localhost:{query.XTransformPort}
    }
    handle {                                  # the application
        reverse_proxy localhost:3000
    }
}
```

Requests carrying `XTransformPort` in the query string are proxied to `localhost:{port}` (the mini-services extension point); everything else goes to the Next.js server on port 3000. Forwarded headers (`Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Real-IP`) are preserved; the session cookie's `Secure` flag and HSTS activate automatically behind an HTTPS terminating proxy. Full runbook: [DEPLOYMENT.md](DEPLOYMENT.md).

## MODULE STRUCTURE ≠ USER EXPERIENCE STRUCTURE

Qubit One is deliberately **one connected platform, not many isolated apps**. The codebase is organized into modules (Enterprise, Sales, Analytics, …) for engineering reasons — ownership, registries, stores — but users never experience module boundaries the way they would with separate products:

- One sign-in, one shell, one navigation. Users see a **role-based workspace**: an employee lands on Home and their tasks; a sales executive on the Sales module; an administrator additionally on Security and Platform Ops. Nobody gets "hundreds of apps".
- One permission model. Every module's data access passes through the same session gate, the same five-role RBAC and the same scope rules (company/team/own), re-applied server-side on every call.
- One audit trail. A meeting action item promoted into a task, an AI recommendation accepted, a document share denied — all land in the same enterprise audit stream with correlation IDs.
- Cross-module flows are first-class: meetings create tasks, approvals notify participants, analytics reads through each source system's own enforcement, search spans modules within the caller's permissions.

When adding a new module, the requirement is not "build another app" — it is "join the platform": register screens in the registry, enforce roles server-side, write audit events through `writeAudit`, and let the shell present it to the right roles.
