# Contributing to Qubit One

Thank you for contributing. This document defines the branch model, commit conventions, review expectations, code standards and quality gates. The non-negotiable rule: **the documentation and this codebase must stay honest** — describe what exists, not what is planned.

## Getting Started

1. Install [Bun](https://bun.sh) (≥ 1.2).
2. `bun install`
3. `bun run db:push` (initializes the local SQLite file)
4. `bun run dev` and open http://localhost:3000

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) before your first change — they explain the one-route screen registry, the server-store pattern and the current implementation status (152 of 308 roadmap screens).

## Branch Naming

Branch from `main`:

| Pattern | Use for | Example |
|---|---|---|
| `feature/*` | New functionality | `feature/audit-retention` |
| `fix/*` | Bug fixes | `fix/meeting-promote-conflict` |
| `hotfix/*` | Urgent fixes to `main` | `hotfix/session-gate-401` |
| `release/*` | Release stabilization, version bumps | `release/v0.3.0` |

## Commits — Conventional Commits

All commits follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
feat(sales): add quotation revision history
fix(workspace): prevent double promotion of meeting action items (409)
docs(security): document session revocation semantics
chore(deps): bump next to 16.1.1
ci(actions): run typecheck before build
refactor(analytics): extract shared export permission check
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`. Releases are tagged from `main` with Conventional-Commits-derived semver.

## Pull Request Process

1. Open a PR against `main` with a filled template (Summary, Changes, Reason, Screens/Modules affected, Database changes, API changes, Security impact, Tests performed, Deployment impact, Rollback considerations).
2. Keep PRs focused; one logical change per PR. Link related issues.
3. Ensure all three gates pass locally before requesting review:
   ```bash
   bun run lint         # ESLint — zero errors, zero warnings
   bun run typecheck    # tsc --noEmit — clean
   bun run build        # production build succeeds
   ```
4. Review expectations: every PR is reviewed by at least one maintainer before merge. Reviewers check correctness, the code standards below, and honesty of any user-facing or documentation claims. Security-sensitive changes (auth, session handling, role boundaries, audit) require a maintainer who owns the security surface.
5. Squash-merge unless history preservation matters; the squash commit message must follow Conventional Commits.

## Code Standards

- **TypeScript strict.** `tsc --noEmit` must be clean. Note: `next.config.ts` sets `typescript.ignoreBuildErrors: true`, so the build alone does not catch type errors — `bun run typecheck` is mandatory.
- **ESLint clean.** No suppressed rules without a written justification in the PR.
- **No secrets, ever.** Never commit `.env`, credentials, tokens or real customer data. Fixtures must remain synthetic demo data. Secrets belong in GitHub Actions Secrets or the deployment secret store.
- **Keep the design system consistent.** Use the existing shadcn/ui primitives and Qubit components (`primitives.tsx`, `page-header.tsx`, `data-table.tsx`, drawers/dialogs); follow the established tokens (navy sidebar, enterprise blue, 8px radius, status badges with dot+label). Do not introduce a parallel component style.
- **Server-side role checks are mandatory.** Any new backend mutation must (a) resolve identity via `requireIdentity`, (b) enforce role/scope checks in the server store function — never trust the client, (c) validate input with bounded guards, and (d) write an audit event via `writeAudit` from `security-server.ts`. Denials return structured `{ code, message }` errors (`400/401/403/404/409/413/422/429`), never raw exceptions.
- **New screens** must be registered in `src/lib/qubit/screens.ts` (id, roadmap number, title, module) and wired in `screen-registry.tsx`. Do not create new routes; screens switch client-side via the registry.
- **Server-only boundaries.** `*-server.ts` modules and `ai-engine.ts` must never be imported from client components. AI stays behind the server abstraction.

## Testing Expectations

Be aware, and be honest in PRs: **there is no automated test suite yet** — no test runner is configured. This means:

- The three gates (`lint`, `typecheck`, `build`) are the only automated verification; CI runs exactly these.
- You must verify behavior manually and describe it in the PR's "Tests performed" section. For API changes, include the actual probes (e.g. curl with a session cookie via `POST /api/auth/session`) covering the happy path **and** the denial paths (401 without session, 403 for wrong role, 409 for conflicts).
- For UI changes, walk the affected screens in at least two roles where role behavior differs.
- Do not claim coverage that does not exist. Adding a real test suite is a roadmap item; a PR that introduces one is welcome and should wire it into CI.

## Documentation Requirements

- User-visible or behavioral changes update the relevant docs (`README.md`, `docs/*.md`) in the same PR.
- **Never overstate status.** If a module is fixture-backed, partial or absent, it is documented that way (see the status legend in [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)). Do not describe Qubit One as production ready or fully functional.
- New environment variables are added to `.env.example` (names only, never values).
- API changes are reflected in the API surface list in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Reporting Issues

- Bugs and feature requests: use the issue templates.
- Security vulnerabilities: **never** in a public issue — follow [SECURITY.md](SECURITY.md) (private disclosure).

## License

By contributing, you agree that your contributions are governed by the repository's proprietary license ([LICENSE](LICENSE)).
