# Qubit One — Security Architecture

This document describes the security posture of the codebase **as it exists**, including gaps. It complements the reporting policy in the root [SECURITY.md](../SECURITY.md).

## Authentication

- **Session model.** The client obtains a server-issued session from `POST /api/auth/session`. The server validates the requested role against a server-side identity directory (`src/lib/qubit/auth-server.ts`) and issues an HMAC-SHA256-signed token (`v1.<payload>.<sig>`, WebCrypto) with an 8-hour absolute TTL, carried in an `httpOnly`, `SameSite=Strict` cookie (`qubit_session`; `Secure` is applied automatically when the request is HTTPS). `Authorization: Bearer` is accepted for service/probe clients.
- **Explicitly demo-grade.** The identity directory contains a single demo principal who may assume the five product roles (role-preview model). There is **no real identity provider** (no OAuth/OIDC/NextAuth), no user registration, and no production credential store. The MFA challenge in the demo login flow does perform genuine code comparison and lockout, but it exists inside this demo boundary.
- **Session security.** Signing secret comes from `QUBIT_AUTH_SECRET` (≥32 chars) when provided; otherwise a CSPRNG secret is generated once and persisted to the git-ignored `db/.auth-secret` with `0600` permissions. Signature comparison is constant-time; expired-token reuse is blocked; sessions can be revoked individually, per user, or all-except-current, and revocation is enforced on every resolve. The session registry is process-local — **a process restart invalidates all sessions**.

## Authorization (RBAC)

Five roles, enforced **server-side** in every store function and route handler:

| Role | Boundary (examples) |
|---|---|
| `administrator` | Full access incl. Security administration, Platform Ops, audit CSV export |
| `dept-head` | Department-scope management and approvals |
| `sales-exec` | Sales records within scope (company/team/own) |
| `hr-manager` | HR surfaces; no sales write access |
| `employee` | Personal workspace only (own tasks, meetings, documents, notifications) |

The acting identity is always derived from the signed session server-side. The `X-Qubit-Role` header is a display hint only and is ignored for authorization. Unauthorized access returns structured `403` responses and — for sensitive boundaries (e.g. Platform Ops) — is written to the audit trail.

## Session Security

- 8h absolute TTL, server-side expiry check on every resolve; expired tokens are rejected even if signed.
- Revocation registry enforced in the identity gate (revoked sessions fail immediately).
- Cookie: `httpOnly`, `SameSite=Strict`, `Secure` on HTTPS, path-scoped. SameSite=Strict is the primary CSRF control.
- Rate-limited session issuance (60/min per client profile) with structured `429` + `Retry-After`.

## API Security

- **Fail-closed gate.** Every protected route handler resolves identity first (`requireIdentity`); no session → structured `401 { code: "session_required" }`. Present-but-invalid tokens are audit-logged (throttled) and rejected.
- **Structured errors.** Failures are JSON `{ code, message }` — no stack traces or internals leak to clients. Identical auth failure messaging prevents account enumeration.
- **CSRF/origin checks.** Mutating API requests are rejected (`403 origin_rejected`) on cross-site `sec-fetch-site` values or `Origin`/`Host` mismatch (`src/proxy.ts` and `originAllowed` in `auth-server.ts`). Non-browser clients without `Origin` are unaffected.
- **Request-size guard.** API bodies above 1 MiB are rejected with `413 payload_too_large` (APIs are JSON documents; there are no uploads yet).
- **Rate limiting.** In-process fixed-window limiter with named profiles: session issue 60/min, search 90/min, AI 30/min, export 12/min, generic writes 240/min. See the gap note below.
- **Export controls.** Audit CSV export fails closed (`403` for non-administrators), is rate-limited, and the export event itself is audited with the requesting identity. CSV output neutralizes formula-injection prefixes (`= + - @`, tab/CR).

## Input Validation

- Validation is implemented with **hand-rolled server-side guards**: `boundedString` (trim/length caps), JSON parse guards with structured `400`, numeric paging validation (non-numeric page parameters rejected rather than coerced), integer/index checks, explicit state-transition checks (`409` conflicts), and `422` validation errors from store functions.
- **Honest note:** `zod` is a declared dependency but is not currently imported in application source. If you introduce zod schemas, do it in the server stores/route handlers, not only in the client.

## Secrets Management

- `.env` is git-ignored and contains only `DATABASE_URL` for a local SQLite file; `.env.example` documents variable names only.
- `QUBIT_AUTH_SECRET` (optional) is read from the environment; when absent, the generated secret lives in git-ignored `db/.auth-secret` (outside version control, process-readable only). No secret is hardcoded in source.
- For CI, inject secrets via **GitHub Actions Secrets**; never commit credentials.

## Audit Logging

- One centralized trail: `writeAudit` in `src/lib/qubit/security-server.ts`. Every module — including the AI layer — writes to the same trail.
- Record shape (`AuditEvent`): `id`, `ts` (epoch ms), `time` (formatted), `actor`, `actorId`, `action`, `resource`, `result` (`Success` | `Failure` | `Blocked`), `severity` (`Info` | `Warning` | `High` | `Critical`), `source`, `ipMasked` (masked IPs), `correlationId` (`QB-AUD-2026-<seq>`), `context`.
- Exposed via `GET /api/security/audit`: server-side filtering, validated pagination, non-admin viewers scoped to their own events.
- **Retention caveat:** the trail is in-memory (live window capped at 200 events, seeded with fixture history) and **resets on process restart**. There is no durable sink; CSV export is the only bulk extract.

## Data Protection

- All application data is **synthetic demo fixtures** ("Qubit One Pvt Ltd"). No real PII exists in the codebase, and fixtures must stay synthetic.
- Audit records mask IP addresses (`ipMasked`). Documents model confidentiality classes (`Confidential`, `Restricted`) with server-enforced download/share rules and audited denials.
- The runtime database (`db/`) and logs (`dev.log`, `server.log`) are git-ignored.

## AI Permission Boundaries

- AI runs **server-side only** via `z-ai-web-dev-sdk` behind `src/lib/qubit/ai-engine.ts`; the client never sees provider details, keys or raw model output plumbing.
- Authorization-first retrieval: AI context is fetched through the same role-scoped data access as users (`salesGet` with the session role) — the AI never reads raw fixtures directly and never outranks the caller.
- Consequential actions require explicit confirmation and execute through the existing audited workflows; every AI operation is audited.
- Prompt-injection defense: retrieved business/customer data is embedded as delimited untrusted content with standing rules; confidence is coarse (High/Medium/Low/Insufficient) and missing data is reported, never fabricated.

## Rate Limiting

**Implemented, but limited.** A fixed-window, in-process limiter protects expensive or enumeration-prone endpoints (sessions, search, AI, exports, generic writes) and throttles bad-token audit lines. It is **per-instance and resets on restart**; it is not a distributed or edge-level control and does not protect across replicas. Treat it as abuse blunting, not a defense perimeter.

## Security Headers

Set on every response by `src/proxy.ts` (Next.js proxy convention) and `next.config.ts`:

- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera/microphone/payment/usb/interest-cohort disabled).
- `Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'` — **partial by design**; no `script-src`/`style-src` restriction strategy exists yet.
- `Strict-Transport-Security` only on HTTPS transports.
- `poweredByHeader: false` (framework version not advertised).

## Dependency Security

- Dependencies are pinned in `bun.lock` (installed with `bun install --frozen-lockfile` in CI).
- Recommendation: enable Dependabot (or equivalent) and run `bun audit`/lockfile review in CI. A dead `next-auth` dependency was removed in Phase 21; keep the dependency list minimal.

## Security Reporting

See the root [SECURITY.md](../SECURITY.md) — private disclosure only; do not open public issues for security vulnerabilities.

## Incident Handling

Manual. There is no automated incident pipeline, paging or forensics tooling. Responders should: preserve `dev.log`/`server.log`, export the audit CSV before any process restart (the in-memory trail is lost on restart), and rotate `QUBIT_AUTH_SECRET`/`db/.auth-secret` to invalidate all sessions.

## Security Roadmap / Gaps

| # | Gap | Current state | Target |
|---|---|---|---|
| 1 | Real identity provider | Demo single-principal role preview | OAuth/OIDC with per-user identities |
| 2 | Durable session store | Process-local registry; restart invalidates sessions | Shared/persistent session store |
| 3 | Durable audit sink | In-memory, capped live window (200), fixture-seeded | Persistent, append-only audit storage |
| 4 | Distributed rate limiting | In-process fixed-window per instance | Edge/shared limiter across replicas |
| 5 | Full CSP | `frame-ancestors/object-src/base-uri/form-action` only | `script-src` nonce/strict-dynamic strategy |
| 6 | Automated security tests | Manual probes recorded during hardening phases | Regression suite for the role matrix and IDOR checks in CI |
| 7 | zod schema validation | Hand-rolled guards | Schema-validated inputs at the store boundary |
| 8 | Automated dependency patching | Pinned lockfile; manual review | Dependabot/audit gate in CI |
| 9 | Secret rotation policy | Manual env/file rotation | Documented rotation cadence and procedure |
