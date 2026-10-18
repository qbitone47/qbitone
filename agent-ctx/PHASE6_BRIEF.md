# PHASE 6 — SALES OS · SHARED AGENT BRIEF

Read this file FIRST, then `/home/z/my-project/worklog.md` (Foundation entry, Task ID 1). Then implement ONLY the screens assigned to you.

## Project
Qubit One Enterprise OS — Next.js 16 App Router, TypeScript, Tailwind 4, shadcn/ui (New York), single visible route `src/app/page.tsx`; screens switch via `useQubitNav()` from `src/components/qubit/nav-context.tsx`. **Never create routes or pages.** Visual language: deep navy sidebar (already exists), light workspace, white `qubit-card` surfaces, enterprise blue #2563EB, dot+label `StatusBadge` (never color-only), Geist, tabular-nums, 8px radius, thin borders.

## Read before coding (in this order)
1. `/home/z/my-project/src/lib/qubit/sales-data.ts` — canonical types + fixture data (ids, statuses, money conventions: opportunities in ₹ Cr numbers; quotations/orders/expenses in whole ₹).
2. `/home/z/my-project/src/lib/qubit/sales-server.ts` — the API contract: `salesGet` sections and `salesPost` actions, validation rules, error codes (409 duplicates/invalid transitions, 422 validation, 403 scope, 401 step-up). The SERVER enforces everything; your UI only renders honest states.
3. `/home/z/my-project/src/components/qubit/sales/parts.tsx` — shared components you MUST reuse: `useSalesSection<T>(section, params?)`, `SalesGate`, `SalesErrorBanner`, `SalesSkeleton`, `SalesAsOf`, `ScopeNote`, `EntityLink`, `ActivityTimeline`, `StageFlow`, `PriorityBadge`, `ScoreBar`, `ProbabilityBar`, `ConsentChips`, `AuditedHint`, fmt helpers `fmtCr/fmtRupees/fmtDate/fmtDateTime/fmtTime/relTime`.
4. `/home/z/my-project/src/components/qubit/screens/sales-home.tsx` — **THE EXEMPLAR**. Match its structure exactly: PageHeader (crumbs `[{label:"Sales"},{label:"<Title>"}]`), `if (forbidden) return <SalesGate…>`, error banner, skeleton, data sections, `SalesAsOf` footer.
5. Shared components: `page-header.tsx`, `primitives.tsx` (StatusBadge, SectionCard, KV, EmptyState, StatTile, Avatar, SearchInput, FilterBar, ArrowLink), `data-table.tsx`, `drawers.tsx` (DetailDrawer), `dialogs.tsx` (ConfirmDialog, FormDialog, StepUpDialog, Field), `../role-context` (useRole → capability gating).

## Screen contract (every screen)
- `"use client";` first line. File: `src/components/qubit/screens/<file>.tsx`. Export: exactly the assigned name.
- Data ONLY from `/api/sales` via `useSalesSection` — never invent or hardcode business data. Mutations via `salesPost(type, input, role)`; surface server error `message` verbatim in toasts/inline errors; `SalesApiError.matches` (duplicate guard) must be rendered as reviewable matches.
- States: loading (`SalesSkeleton`), error (`SalesErrorBanner` + retry), empty (`EmptyState`), forbidden (`SalesGate`), success (toast + refetch via `reload()`).
- Role awareness via `useRole().role`: `administrator` = company scope / Sales Admin; `dept-head` = manager (team scope, approvals authority); `sales-exec` = own records; `employee`/`hr-manager` → SalesGate. Manager/admin-only controls: show for administrator + dept-head, hide or read-only for sales-exec, and ALWAYS rely on the server (403s are surfaced honestly, never pre-hidden as the only control).
- Cross-links: `EntityLink` to `lead-detail`, `contact-detail`, `account-detail`, `opportunity-detail`, `quotation-detail`, `order-detail`, `visit-detail`, `whatsapp-conversation` with the right param (`leadId`, `contactId`, `accountId`, `opportunityId`, `quotationId`, `orderId`, `waId`, `visitId` — from `useQubitNav().params`).
- Money: Cr values → `fmtCr` (₹x.xx Cr / ₹xx L); rupee documents → `fmtRupees`. tabular-nums on all figures.
- Responsive: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-N`; tables get `min-w-[...]` + `overflow-x-auto` wrapper (or `DataTable` with `mobileCard`); actions wrap on mobile; no horizontal page overflow at 390px.
- Accessibility: semantic h1/h2/h3 (PageHeader renders h1), aria-labels on icon-only buttons, `role="img"` + aria-label on bars, `StatusBadge` everywhere for status (never color-only), keyboard-reachable actions.
- Density: enterprise tables/lists, restrained white cards, `gap-4`/`p-4 md:p-5`, generous but not marketing-y whitespace. NO dashboards-with-20-widgets, NO neon/orange, NO gamification.
- Toasts via `import { toast } from "@/hooks/use-toast"`; destructive/confirm flows via `ConfirmDialog`; forms via `FormDialog` + `Field`; sensitive approvals via `StepUpDialog` (server sends 401 step_up_required → open StepUpDialog, resubmit with password).

## Deep-link params (from `useQubitNav().params`)
`leadId? contactId? accountId? opportunityId? quotationId? orderId? waId? visitId? expenseId? travelId? filter?` — detail screens: read the id param; if absent, show a friendly "open a record from the Inbox/Queue" empty state (no fake data).

## API quick reference
GET sections (all scoped server-side): `home, leads, lead(id), contacts, contact(id), accounts, account(id), opportunities, opportunity(id), pipeline, forecast, targets, leaderboard, followups, meetings, quotations, quotation(id), orders, order(id), activity(entityId?), whatsapp, whatsapp-conversation(id), visits, visit(id), travel, expenses, reports, team, settings, form-refs`.
POST `type`s: `lead.create, lead.assign, lead.status, lead.note, lead.followup, lead.convert, opportunity.stage, opportunity.update, followup.complete, followup.reschedule, meeting.create, meeting.reschedule, meeting.cancel, meeting.notes, quotation.create, quotation.update, quotation.submit, quotation.decide, quotation.send, quotation.cancel, quotation.revise, order.create, order.update, order.cancel, expense.create, expense.submit, expense.delete, visit.create, visit.reschedule, visit.cancel, visit.start, visit.complete, travel.create, travel.cancel, whatsapp.assign, whatsapp.link, whatsapp.reply, whatsapp.note, whatsapp.lead, settings.update, target.update` — each `{ type, input }`.

## Verify (before appending worklog)
`bunx tsc --noEmit 2>&1 | rg "<your files>"` → clean (pre-existing examples/skills + screen-registry errors are NOT yours; ignore lines mentioning `screen-registry.tsx`, `examples/`, `skills/`). Then `bunx eslint <your files>` → clean. Do NOT run the dev server, do NOT edit any file outside your assigned screens (shared fixes go in your worklog notes).

## Worklog protocol
Append to `/home/z/my-project/worklog.md` (never overwrite): a section starting with `---`, then `Task ID: <given>`, `Agent: <name>`, `Task: <one line>`, `Work Log:` bullets (files created + key decisions), `Stage Summary:` bullets.
