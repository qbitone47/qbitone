import { NextRequest, NextResponse } from "next/server";
import { auditCsv, queryAudit } from "@/lib/qubit/security-server";

const roleOf = (req: NextRequest) => req.headers.get("x-qubit-role") ?? "employee";

// GET /api/security/audit — server-side filtered, paginated audit
// history. Non-admin viewers are scoped to their own events by the
// server; export is privileged and audited.
export async function GET(req: NextRequest) {
  const role = roleOf(req);
  const sp = req.nextUrl.searchParams;

  if (sp.get("export") === "csv") {
    const csv = auditCsv(role);
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

  const result = queryAudit(
    {
      query: sp.get("query") ?? undefined,
      severity: sp.get("severity") ?? undefined,
      result: sp.get("result") ?? undefined,
      action: sp.get("action") ?? undefined,
      actor: sp.get("actor") ?? undefined,
      range: sp.get("range") ?? undefined,
      page: Number(sp.get("page") ?? 1),
      pageSize: Number(sp.get("pageSize") ?? 12),
    },
    role,
    "sagar",
  );
  return NextResponse.json(result);
}
