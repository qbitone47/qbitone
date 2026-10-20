import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_PROFILES, requireIdentity, tooManyRequests } from "@/lib/qubit/auth-server";
import { auditCsv, queryAudit } from "@/lib/qubit/security-server";

// Phase 21: identity from the signed session; the client never declares a role.
async function identityFrom(req: NextRequest) {
  const auth = await requireIdentity(req);
  return auth.ok
    ? { ok: true as const, identity: auth.identity }
    : { ok: false as const, response: auth.response };
}

// GET /api/security/audit — server-side filtered, paginated audit
// history. Non-admin viewers are scoped to their own events by the
// server; export is privileged, rate-limited and audited.
export async function GET(req: NextRequest) {
  const actor = await identityFrom(req);
  if (!actor.ok) return actor.response;
  const { role, userId } = actor.identity;
  const sp = req.nextUrl.searchParams;

  if (sp.get("export") === "csv") {
    const gate = rateLimit(`audit-export:${userId}`, RATE_PROFILES.export.limit, RATE_PROFILES.export.windowMs);
    if (!gate.allowed) return tooManyRequests(gate.retryAfterSec);
    const csv = auditCsv(role, userId); // §16: the export audit event carries the requesting identity
    if (csv === null) {
      return NextResponse.json(
        { code: "permission_denied", message: "Exporting audit records requires Security administrator access." },
        { status: 403 },
      );
    }
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="qubit-one-audit-${sp.get("range") ?? "90d"}.csv"`,
      },
    });
  }

  // Phase 21 (audit L2): paging parameters are validated — non-numeric
  // input is rejected instead of silently coercing to NaN pages.
  const pageRaw = Number(sp.get("page") ?? 1);
  const pageSizeRaw = Number(sp.get("pageSize") ?? 12);
  if (!Number.isInteger(pageRaw) || pageRaw < 1 || !Number.isInteger(pageSizeRaw) || pageSizeRaw < 1 || pageSizeRaw > 100) {
    return NextResponse.json(
      { code: "bad_request", message: "Provide numeric page (≥1) and pageSize (1–100)." },
      { status: 400 },
    );
  }

  const result = queryAudit(
    {
      query: sp.get("query") ?? undefined,
      severity: sp.get("severity") ?? undefined,
      result: sp.get("result") ?? undefined,
      action: sp.get("action") ?? undefined,
      actor: sp.get("actor") ?? undefined,
      range: sp.get("range") ?? undefined,
      page: pageRaw,
      pageSize: pageSizeRaw,
    },
    role,
    userId,
  );
  return NextResponse.json(result);
}
