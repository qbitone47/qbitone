# Qubit One — Project Status

Engineering status document. Last reviewed: Phase 21 (repository preparation). This file describes the codebase as it exists, including what is incomplete. Nothing here is aspirational.

## Status Legend

| Status | Meaning |
|---|---|
| Functional | Implements its scope end-to-end within the demo environment (server-backed, role-checked, audited) |
| Partially Functional | Works for part of its scope; the remainder is fixture-backed or absent |
| UI Complete – Backend Pending | Screens render with realistic fixture data; no dedicated server enforcement store |
| Backend Complete – UI Pending | Server enforcement exists; UI is not wired (not currently applicable to any module) |
| Integration Pending | Built, but not connected to an external system or transport |
| Placeholder | Extension point only; no implementation |
| Broken | Exists but does not work (no module is currently in this state) |
| Needs Validation | Implemented and believed working, but not verified in this review |

## Module Status Matrix

Screen counts and roadmap numbers are extracted from `src/lib/qubit/screens.ts` (152 entries in `SCREENS`; the `SCREEN_COMPONENTS` map in `src/components/qubit/screen-registry.tsx` wires 152 of 152).

| Module (id) | Screens | Roadmap | Status | Basis |
|---|---:|---|---|---|
| Enterprise (`enterprise`) | 12 | 01–12 | UI Complete – Backend Pending | Rich fixture-backed screens (org structure, role/permission matrices, workflows, approvals catalog, integrations map). No dedicated server store; several screens link into live modules (Security Center, approvals). |
| Design System (`design-system`) | 18 | 13–30 | Functional | Serves its purpose as the living style guide; static by design. |
| Security (`security`) | 10 | 31–40 | Functional | Full server enforcement behind `/api/security/*` (login with MFA challenge verification, passkey/password flows, sessions, policies, access requests, alerts, audit). Screens 36 (Security Center) and 49 (My Activity) run on live server data. Remaining partials: password-recovery screen (34) still composes fixture rows; auth factors/recovery methods/security recommendations remain labeled config fixtures. |
| Workspace (`workspace`) | 9 | 41–49 | Functional | Server-backed (`workspace-server.ts`, `/api/workspace/*`): tasks, approvals, documents (Confidential/Restricted matrix), mail, meetings, notifications (per-recipient scoping), profile. All mutations role-checked and audited. |
| People (`people`) | 5 | 50–54 | UI Complete – Backend Pending | Directory/profile/360 screens render from client fixtures; no people server store. |
| Mail (`mail`) | 4 | 55–58 | Integration Pending | Mail store is server-backed and consistent with search/notifications, but there is no external mailbox/SMTP integration. |
| CEO Command Center (`executive`) | 14 | 59–72 | Functional | Server-backed (`executive-server.ts`, `/api/executive`) with an executive-only boundary; denials audited. |
| Sales (`sales`) | 30 | 73–102 | Functional | Server-backed (`sales-server.ts`, `/api/sales`): leads, accounts, opportunities, quotations, orders, visits, targets, expenses, travel, forecasts, reports. Scope (company/team/own) enforced server-side. |
| Sales AI (`sales-ai`) | 8 | 103–110 | Functional | Server-side AI orchestration (`sales-ai-server.ts`, `ai-engine.ts`, `/api/sales-ai`) over governed sales data; authorization-first retrieval, confirm-gated actions, per-call audit. AI runs only server-side. |
| Analytics (`analytics`) | 18 | 267–284 | Functional | One governed architecture (`analytics-server.ts`, `/api/analytics`) reading through the source-of-truth stores; role/row scoping, export permissions, numeric anti-hallucination gate, honest freshness states. |
| Mobile (`mobile`) | 16 | 285–300 | Functional | `mobile-server.ts` + `/api/mobile` share the desktop stores and enforcement (meeting writes delegate to the same organizer-only rules). |
| Platform Ops (`platform`) | 8 | 301–308 | Functional | `platform-server.ts` + `/api/platform`. Real telemetry where measurable (live `SELECT 1` DB latency, memory/load/uptime, API self-probe, real security headers, SHA-256-verified DB backups into `db/backups/`, staged restore tests, client-posted vitals). Everything not measurable is labeled "Not configured" / "Not connected". Administrator-only screens return audited 403s for other roles. |

Additional domain visibility: the sidebar exposes **Finance, HR & People, Inventory, Marketing and Service** as governed **Analytics** views. Dedicated operating modules for those domains are part of the unimplemented roadmap range below.

## Roadmap Coverage: 152 of 308 Screens

The original product roadmap defined **308 screens across 18 phases**. The codebase contains **152**:

- **Implemented — roadmap numbers 1–110** (phases 1–7): Enterprise Architecture, Enterprise Design System, Authentication & Security, Core Employee Workspace, CEO Command Center, Sales Operating System, Sales AI.
- **Implemented — roadmap numbers 267–308** (phases 17–18): Analytics/Audit (267–284) and Enterprise Hardening + Mobile (285–308).
- **Absent — roadmap numbers 111–266** (phases 8–16): the dedicated operating modules (including Finance, HR & People, Inventory, Marketing and Service OS). **These screens were never committed to this repository.** They are not "planned-but-hidden" or stubbed — they do not exist here. Any documentation or demo claiming otherwise is inaccurate.

Verification: `src/lib/qubit/screens.ts` numbers run 01–110 and 267–308; the sum of the 12 module counts above is 152.

## Known Gaps

1. **In-process state.** All 9 domain stores (`src/lib/qubit/*-server.ts`) are `globalThis` singletons seeded via `structuredClone` from fixture modules at process start. State is per-process and **resets on restart**; it is not shared across instances. Exception: platform backup files under `db/backups/` are real, persistent artifacts.
2. **Prisma models are scaffold-only.** `prisma/schema.prisma` contains `User` and `Post` only. Domain state does not persist to SQLite; a runtime `db/custom.db` exists (git-ignored) and is used for a real latency probe and backup/restore exercises.
3. **Demo-grade session authentication.** A single demo identity may assume the five product roles via the authenticated session endpoint (role-preview model). There is no real identity provider (no OAuth/OIDC), no user registration and no credential store.
4. **No automated tests.** No test runner is configured; CI gates are lint + typecheck + production build. Verification is manual (curl/browser probes recorded in the internal worklog).
5. **`typescript.ignoreBuildErrors: true`** in `next.config.ts`. Type safety is enforced separately (`bun run typecheck`) locally and in CI — a failing type would not fail `bun run build`.
6. **Rate limiting is in-process** (fixed-window; profiles: session issue 60/min, search 90/min, AI 30/min, export 12/min, generic writes 240/min). It is per-instance only; restarting or adding instances bypasses accumulated counts. There is no edge/distributed limiter.
7. **CSP is partial.** `src/proxy.ts` sets `frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'` plus nosniff, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy (HSTS on HTTPS). There is no `script-src`/`style-src` restriction strategy yet.
8. **Fixtures are synthetic demo data** ("Qubit One Pvt Ltd") — deterministic and realistic, but entirely synthetic. No real PII exists in the codebase.
9. **Audit trail retention.** `writeAudit` records are held in memory (live window capped at 200 events, seeded with a fixture history) and reset on process restart. CSV export is available (administrator-only, rate-limited, audited). There is no durable audit sink.
10. **No external integrations.** Mail, calendar, SSO and the integration map are demo/catalog surfaces; socket.io mini-services are a reference pattern (`examples/websocket/`) and `mini-services/` is a placeholder.
11. **No operational infrastructure.** No Docker/Kubernetes, no external APM, no queues/schedulers, no automated disaster recovery.

## How This Status Was Determined

- **Screen inventory:** direct extraction from `src/lib/qubit/screens.ts` (module counts and roadmap numbers) and the `SCREEN_COMPONENTS` map in `src/components/qubit/screen-registry.tsx` (152/152 wired).
- **Server-backing claims:** each "Functional" module corresponds to a server store (`src/lib/qubit/*-server.ts`) and route handlers under `src/app/api/`, all gated by `requireIdentity` (`src/lib/qubit/auth-server.ts`).
- **Security posture:** a full security audit across 15 domains was performed as part of Phase 21 (secrets, injection, XSS, exports, error messages, rate limiting, AI, auth flows, files, dependencies, browser storage, privacy, mobile, CORS/headers, data serving), followed by hardening (signed session plane, MFA challenge verification, per-recipient notification scoping, dual-dimension auth lockout, CSV formula-injection neutralization) and regression verification. `docs/SECURITY.md` records the residual gaps.
- **Honesty rule:** any capability not verifiable in source is either omitted or labeled "Not configured" / "Needs Validation". Nothing in this document is aspirational.
