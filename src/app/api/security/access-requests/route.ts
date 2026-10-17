import { NextRequest, NextResponse } from "next/server";
import { listAccessRequests, submitAccessRequest } from "@/lib/qubit/security-server";
import { REQUESTABLE_ROLES } from "@/lib/qubit/security-data";

// GET /api/security/access-requests — the requester's own requests.
export async function GET() {
  return NextResponse.json({ requests: listAccessRequests() });
}

// POST /api/security/access-requests — submit a request.
// Access is never granted here: requests only create a Pending
// Approval record evaluated along the reporting line, server-side.
export async function POST(req: NextRequest) {
  let body: { roleId?: string; justification?: string; duration?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
  }

  const role = REQUESTABLE_ROLES.find((r) => r.id === body.roleId);
  if (!role) {
    return NextResponse.json({ code: "unknown_role", message: "Select a role to request." }, { status: 422 });
  }

  const result = submitAccessRequest({
    roleId: role.id,
    roleName: role.name,
    justification: body.justification ?? "",
    duration: body.duration ?? "30 days",
    risk: role.risk,
    actor: "Sagar Singh",
  });
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  return NextResponse.json({ ok: true, request: result.request });
}
