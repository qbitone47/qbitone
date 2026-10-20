# Security Policy

## Supported State

Qubit One is an active development codebase (152 of 308 roadmap screens; demo-grade authentication and synthetic data — see `docs/PROJECT_STATUS.md`). Security fixes are applied to the latest `main` and released as patch versions from tagged builds.

## Reporting a Vulnerability — Private Disclosure

**Do NOT open a public GitHub issue, discussion, pull request or social media post for security vulnerabilities.**

Report privately:

1. Email: **security@YOUR-DOMAIN.example** *(placeholder — replace with the project's real security contact before publishing this repository)*
2. Include: a description of the issue, affected screens/endpoints, reproduction steps or proof-of-concept, and your assessment of impact.
3. If possible, include the audit `correlationId` of any request that demonstrates the issue.

## Response Expectations

| Stage | Target |
|---|---|
| Acknowledgement | Within 5 business days |
| Initial assessment and severity assignment | Within 10 business days |
| Status updates while a fix is in progress | At least weekly |
| Fix and coordinated disclosure | Agreed with the reporter; credit given unless anonymity is requested |

Please give the team a reasonable window to remediate before any public disclosure. Do not test against systems you do not own, do not access or exfiltrate data beyond what is needed to demonstrate the issue, and do not disrupt the service (no DoS, no spam, no social engineering).

## Scope

In scope: this repository's application code (`src/`), the API surface (`src/app/api/**`), the session/authorization model, the AI layer, build/deployment configuration (`next.config.ts`, `src/proxy.ts`, `Caddyfile`) and this repository's CI workflows.

Known, documented limitations (for example: demo-grade single-principal session model, in-process rate limiting, partial CSP, in-memory audit trail) are tracked in `docs/SECURITY.md` — reports that only restate a documented gap without new impact may be closed as known limitations, but novel exploitation paths for them are very much in scope.

## Security Architecture

The security architecture, controls, honest gap inventory and security roadmap live in [`docs/SECURITY.md`](docs/SECURITY.md).

## Incident Handling

Incident handling is currently manual: preserve `dev.log`/`server.log`, export the audit CSV (`GET /api/security/audit?export=csv`, administrator-only) before any process restart — the live audit window is in-memory — and rotate `QUBIT_AUTH_SECRET` (or delete `db/.auth-secret`) to invalidate all sessions.
