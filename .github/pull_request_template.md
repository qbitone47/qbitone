# Summary

<!-- One or two sentences: what does this PR do? -->

# Changes

<!-- Bullet list of the concrete changes (files/areas). -->

-

# Reason

<!-- Why: the problem, issue link, or requirement driving this change. -->

# Screens / Modules Affected

<!-- Screens (roadmap numbers or ids) and modules touched, e.g. "Sales 73–102", "Workspace /api/workspace/meetings". If none, state "None". -->

# Database Changes

<!-- Prisma schema changes, db:push implications, or "None". Remember: never run db:reset against production data. -->

# API Changes

<!-- New/changed endpoints or action types; request/response shape changes; error codes introduced. State "None" if not applicable. -->

# Security Impact

<!-- Role/scope enforcement, session handling, audit events, secrets, headers. New backend mutations require server-side role checks + writeAudit. State "None" if genuinely not applicable. -->

# Tests Performed

<!-- Be honest: there is no automated test suite. Describe manual verification: gates run (lint/typecheck/build), curl probes with session cookies (including 401/403/409 denial paths), browser walkthroughs and roles used. -->

- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run build` passes
- Manual verification:

# Deployment Impact

<!-- Build/deploy considerations: env vars, db:push needs, restart requirements, gateway/proxy behavior. -->

# Rollback Considerations

<!-- How to revert safely; state or data implications. -->

# Checklist

- [ ] Lint, typecheck and build all pass locally
- [ ] No secrets, credentials or real customer data committed (fixtures remain synthetic)
- [ ] Documentation updated where behavior or status changed (and claims match reality)
- [ ] New backend mutations enforce server-side role checks and write audit events
- [ ] New environment variables added to `.env.example` (names only)
