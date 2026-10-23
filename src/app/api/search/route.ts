// ============================================================
// Qubit One — Phase 20 §17 · Global record search
// GET /api/search?q=<query>
// ============================================================
// Server-side aggregation over AUTHORIZED sources only. This route
// never touches raw fixtures for authorization decisions — every
// source is read through the same server surfaces the screens use
// (workspace-server / sales-server), so a record a role cannot
// access can never appear here merely because it exists.
//
// AUDIT DECISION: searches are read-only and high-frequency, so NO
// audit event is written per search — matching the read path of
// every other /api GET surface. `tookMs` is returned instead.
// Note: denied access inside shared boundaries still audits itself
// (e.g. requireSalesAccess writes "Sales access denied" for roles
// without sales authorization). That is the boundary's own policy,
// not a search event, and it is why salesGet is called even for
// roles expected to be denied — the boundary, not this route,
// decides who may see Sales records.
//
// Isolation (Phase 20 §21/§26): every source is wrapped in its own
// try/catch — one failing source never fails the whole response.
// Sources that cannot be searched are listed in `omitted` with an
// honest reason instead of faking empty results.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_PROFILES, requireIdentity, tooManyRequests } from "@/lib/qubit/auth-server";
import {
  SESSION_USER_ID,
  listApprovals,
  listMail,
  listMeetings,
  listTasks,
  type WorkspaceRole,
} from "@/lib/qubit/workspace-server";
import { salesGet, type SalesSection } from "@/lib/qubit/sales-server";
import { employees } from "@/lib/qubit/data";
import type { MailMessage } from "@/lib/qubit/workspace-data";
import { SCREENS } from "@/lib/qubit/screens";
import { obsSearchSnapshot } from "@/lib/qubit/obs-server";
// Phase 25: request metering (real telemetry, failure-isolated).
import { withMeter } from "@/lib/qubit/telemetry-server";

// ---------- response contract ----------

type SearchRecordType =
  | "lead" | "opportunity" | "customer" | "quotation" | "employee"
  | "task" | "meeting" | "mail" | "approval" | "document";

interface SearchItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Verified screen id for deep-linking; "" means non-navigable row. */
  screen: string;
  params?: Record<string, string>;
}

interface SearchGroup {
  type: SearchRecordType;
  label: string;
  items: SearchItem[];
  note?: string;
}

interface OmittedSource {
  type: SearchRecordType;
  reason: string;
}

const CAP = 5; // max items per group — bounded work per source

// Phase 21: the acting role is derived from the signed session cookie
// (server-verified) — a client-declared role header is never trusted.
// Fail-closed: requests without a valid session receive 401.
async function identityFrom(req: NextRequest): Promise<{ ok: true; role: WorkspaceRole; userId: string } | { ok: false; response: NextResponse }> {
  const auth = await requireIdentity(req);
  return auth.ok
    ? { ok: true, role: auth.identity.role as WorkspaceRole, userId: auth.identity.userId }
    : { ok: false, response: auth.response };
}

// Screen-id guard — every emitted screen id must exist in screens.ts.
// An unknown id degrades to a non-navigable row instead of a broken link.
const SCREEN_IDS = new Set<string>(SCREENS.map((s) => s.id));
const screenIdOf = (id: string): string => (SCREEN_IDS.has(id) ? id : "");

// ---------- safe field access for salesGet's Record<string, unknown> rows ----------

const str = (row: Record<string, unknown>, key: string): string =>
  typeof row[key] === "string" ? (row[key] as string) : "";

const nested = (row: Record<string, unknown>, key: string): Record<string, unknown> | null => {
  const v = row[key];
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
};

const rowsOf = (payload: Record<string, unknown>): Record<string, unknown>[] => {
  const rows = payload.rows;
  return Array.isArray(rows) ? rows.filter((r): r is Record<string, unknown> => !!r && typeof r === "object") : [];
};

// ---------- bounded matching ----------

/** Early-exits once `cap` matches are found; fixture-scale worst case stays bounded. */
function matchCap<T>(
  rows: T[],
  q: string,
  haystack: (row: T) => string,
  build: (row: T) => SearchItem,
  cap: number = CAP,
): SearchItem[] {
  const items: SearchItem[] = [];
  for (const row of rows) {
    if (items.length >= cap) break;
    if (haystack(row).toLowerCase().includes(q)) items.push(build(row));
  }
  return items;
}

/** Wraps one source in its own try/catch — one failing source never fails the response. */
function safeGroup(
  type: SearchRecordType,
  label: string,
  omitted: OmittedSource[],
  reason: string,
  build: () => { items: SearchItem[]; note?: string },
): SearchGroup | null {
  try {
    const { items, note } = build();
    if (items.length === 0) return null;
    return note ? { type, label, items, note } : { type, label, items };
  } catch {
    omitted.push({ type, reason });
    return null;
  }
}

const mailFrom = (m: MailMessage): string => {
  if (m.fromId) return employees.find((e) => e.id === m.fromId)?.name ?? m.fromId;
  return m.fromExternal?.name ?? "External sender";
};

// ---------- sales source (Result-shaped, 403 → omitted, not faked emptiness) ----------

function salesGroup(
  role: WorkspaceRole,
  section: Extract<SalesSection, "leads" | "opportunities" | "accounts" | "quotations">,
  type: SearchRecordType,
  label: string,
  q: string,
  omitted: OmittedSource[],
  haystack: (row: Record<string, unknown>) => string,
  build: (row: Record<string, unknown>) => SearchItem,
): SearchGroup | null {
  try {
    const result = salesGet(role, section, new URLSearchParams());
    if (!result.ok) {
      omitted.push({
        type,
        reason: result.status === 403 ? "Sales access required" : `Sales source unavailable (HTTP ${result.status})`,
      });
      return null;
    }
    const items = matchCap(rowsOf(result.data), q, haystack, build);
    return items.length > 0 ? { type, label, items } : null;
  } catch {
    omitted.push({ type, reason: "Sales source unavailable" });
    return null;
  }
}

// ============================================================
// GET /api/search — min query length 2, else 400 bad_query.
// ============================================================
export async function GET(req: NextRequest) {
  return withMeter(req, "GET /api/search", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    // Phase 21 (§22 / audit L3): search is high-frequency but still
    // bounded — a generous per-user limit plus a max query length.
    const gate = rateLimit(`search:${actor.userId}`, RATE_PROFILES.search.limit, RATE_PROFILES.search.windowMs);
    if (!gate.allowed) return tooManyRequests(gate.retryAfterSec);
    const started = Date.now();
    const role = actor.role;
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
    if (q.length < 2) {
      return NextResponse.json({ code: "bad_query", message: "Provide a search query of at least 2 characters." }, { status: 400 });
    }
    if (q.length > 120) {
      return NextResponse.json({ code: "bad_query", message: "Search queries are limited to 120 characters." }, { status: 400 });
    }

    const groups: SearchGroup[] = [];
    const omitted: OmittedSource[] = [];

    // employees — the canonical identity fixture; every role may search the directory.
    // Deep-link: employee-360 (screen 52) reads nav.params.employeeId and scopes content
    // by role; company-directory (screen 50) reads no params, so it cannot deep-link.
    const employeeGroup = safeGroup("employee", "Employees", omitted, "Employee source unavailable", () => ({
      items: matchCap(employees, q, (e) => `${e.name} ${e.title} ${e.department}`, (e) => ({
        id: e.id,
        title: e.name,
        subtitle: `${e.title} · ${e.department}`,
        screen: screenIdOf("employee-360"),
        params: { employeeId: e.id },
      })),
    }));
    if (employeeGroup) groups.push(employeeGroup);

    // tasks — listTasks() already scopes to the session user; the owner check is kept
    // per §17 ("assignee or owner is SESSION_USER_ID") as an explicit authorization guard.
    const taskGroup = safeGroup("task", "Tasks", omitted, "Task source unavailable", () => ({
      items: matchCap(
        listTasks().filter((t) => t.assigneeId === SESSION_USER_ID || t.ownerId === SESSION_USER_ID),
        q,
        (t) => `${t.title} ${t.detail}`,
        (t) => ({
          id: t.id,
          title: t.title,
          subtitle: `${t.status} · ${t.priority}`,
          screen: screenIdOf("my-tasks"),
          params: { taskId: t.id },
        }),
      ),
    }));
    if (taskGroup) groups.push(taskGroup);

    // meetings — listMeetings(role) is participation-scoped server-side (organizer or
    // invited participant); its scope note is surfaced verbatim on the group.
    const meetingGroup = safeGroup("meeting", "Meetings", omitted, "Meeting source unavailable", () => {
      const scoped = listMeetings(role);
      const items = matchCap(scoped.meetings, q, (m) => `${m.title} ${m.agenda ?? ""} ${m.location}`, (m) => ({
        id: m.id,
        title: m.title,
        subtitle: `${m.location} · ${m.status}`,
        screen: screenIdOf("my-meetings"),
        params: { meetingId: m.id },
      }));
      return { items, note: scoped.note ?? undefined };
    });
    if (meetingGroup) groups.push(meetingGroup);

    // mail — listMail(role, …) filters the session mailbox server-side. folder "all"
    // searches the whole authorized mailbox (inbox/sent/drafts/archive) — still the
    // session user's own store, never an authorization bypass. mail-inbox (screen 55)
    // reads no nav.params, so mail rows navigate without params (no fake deep-link).
    const mailGroup = safeGroup("mail", "Mail", omitted, "Mail source unavailable", () => ({
      items: listMail(role, { q, folder: "all", limit: CAP }).items.slice(0, CAP).map((m) => ({
        id: m.id,
        title: m.subject || "(no subject)",
        subtitle: `${mailFrom(m)} · ${m.folder}`,
        screen: screenIdOf("mail-inbox"),
      })),
    }));
    if (mailGroup) groups.push(mailGroup);

    // approvals — queue + (where the boundary exposes it) decision history.
    // For employee/sales-exec the boundary returns only their own submitted requests.
    const approvalGroup = safeGroup("approval", "Approvals", omitted, "Approval source unavailable", () => {
      const approvals = listApprovals(role);
      const history = "history" in approvals && approvals.history ? approvals.history : [];
      return {
        items: matchCap(
          [...approvals.queue, ...history],
          q,
          (a) => `${a.title} ${a.kind}`,
          (a) => ({
            id: a.id,
            title: a.title,
            subtitle: `${a.kind} · ${a.status}`,
            screen: screenIdOf("my-approvals"),
            params: { approvalId: a.id },
          }),
        ),
      };
    });
    if (approvalGroup) groups.push(approvalGroup);

    // sales — leads / opportunities / customers (accounts) / quotations via salesGet,
    // which enforces the sales boundary internally (403 for hr-manager/employee).
    // Row shapes are the WithRefs payloads documented in sales-server.ts
    // (leadWithRefs / oppWithRefs / accountWithRefs / quotationWithRefs).
    const leadGroup = salesGroup(
      role, "leads", "lead", "Leads", q, omitted,
      (r) => `${str(r, "name")} ${str(r, "company")} ${str(r, "contactPerson")} ${str(r, "industry")} ${str(r, "location")} ${str(r, "status")}`,
      (r) => ({
        id: str(r, "id"),
        title: str(r, "name"),
        subtitle: `${str(r, "company")} · ${str(r, "status")}`,
        screen: screenIdOf("lead-detail"),
        params: { leadId: str(r, "id") },
      }),
    );
    if (leadGroup) groups.push(leadGroup);

    const opportunityGroup = salesGroup(
      role, "opportunities", "opportunity", "Opportunities", q, omitted,
      (r) => {
        const account = nested(r, "account");
        return `${str(r, "name")} ${account ? str(account, "name") : ""} ${str(r, "stage")} ${str(r, "nextAction")}`;
      },
      (r) => {
        const account = nested(r, "account");
        return {
          id: str(r, "id"),
          title: str(r, "name"),
          subtitle: `${account ? str(account, "name") : "No account"} · ${str(r, "stage")}`,
          screen: screenIdOf("opportunity-detail"),
          params: { opportunityId: str(r, "id") },
        };
      },
    );
    if (opportunityGroup) groups.push(opportunityGroup);

    // customer → "account-detail" (screen 78, Customer 360) reads nav.params.accountId.
    const customerGroup = salesGroup(
      role, "accounts", "customer", "Customers", q, omitted,
      (r) => `${str(r, "name")} ${str(r, "industry")} ${str(r, "location")} ${str(r, "status")} ${str(r, "ownerName")}`,
      (r) => ({
        id: str(r, "id"),
        title: str(r, "name"),
        subtitle: `${str(r, "industry")} · ${str(r, "location")} · ${str(r, "status")}`,
        screen: screenIdOf("account-detail"),
        params: { accountId: str(r, "id") },
      }),
    );
    if (customerGroup) groups.push(customerGroup);

    const quotationGroup = salesGroup(
      role, "quotations", "quotation", "Quotations", q, omitted,
      (r) => {
        const account = nested(r, "account");
        return `${str(r, "number")} ${account ? str(account, "name") : ""} ${str(r, "status")}`;
      },
      (r) => {
        const account = nested(r, "account");
        return {
          id: str(r, "id"),
          title: `${str(r, "number")} — ${account ? str(account, "name") : "Quotation"}`,
          subtitle: str(r, "status"),
          screen: screenIdOf("quotation-detail"),
          params: { quotationId: str(r, "id") },
        };
      },
    );
    if (quotationGroup) groups.push(quotationGroup);

    // documents — the workspace store holds documents, but no list/read export exists
    // (workspace-server exposes only documentAction mutations). Honest omission — no
    // exports were added to shared server files for this route.
    omitted.push({ type: "document", reason: "Source not exposed for search" });

    // Phase 25 (§23): observability entities — administrators only (the role comes
    // from the signed session cookie, never a client header). All items map to
    // existing operational screens; nothing here duplicates their management UI.
    if (role === "administrator") {
      try {
        const obs = obsSearchSnapshot();
        const obsHits: SearchItem[] = [
          ...matchCap(obs.alerts, q, (a) => `${a.name} ${a.severity} ${a.status}`, (a) => ({ id: a.id, title: a.name, subtitle: `Alert · ${a.severity} · ${a.status}`, screen: screenIdOf("p23-alert-center") })),
          ...matchCap(obs.incidents, q, (i) => `${i.title} ${i.severity} ${i.status}`, (i) => ({ id: i.id, title: i.title, subtitle: `Incident · ${i.severity} · ${i.status}`, screen: screenIdOf("p22-incident-center") })),
          ...matchCap(obs.runbooks, q, (r) => `${r.title} ${r.incidentType}`, (r) => ({ id: r.id, title: r.title, subtitle: `Runbook · ${r.incidentType}`, screen: screenIdOf("p23-operational-runbooks") })),
          ...matchCap(obs.slos, q, (s) => `${s.name} ${s.kind}`, (s) => ({ id: s.id, title: s.name, subtitle: `SLO · ${s.kind} · target ${s.target}`, screen: screenIdOf("p23-slo-management") })),
          ...matchCap(obs.alertRules, q, (r) => `${r.name} ${r.metric}`, (r) => ({ id: r.id, title: r.name, subtitle: `Alert rule · ${r.metric}${r.enabled ? "" : " · disabled"}`, screen: screenIdOf("p23-alert-rules") })),
        ].slice(0, CAP);
        if (obsHits.length > 0) groups.push({ type: "task", label: "Observability", items: obsHits, note: "Operational records from the observability registries (administrator scope)." });
      } catch {
        omitted.push({ type: "task", reason: "Observability source unavailable" });
      }
    }

    return NextResponse.json({
      ok: true,
      q,
      groups,
      omitted,
      tookMs: Date.now() - started,
    });
  });
}
