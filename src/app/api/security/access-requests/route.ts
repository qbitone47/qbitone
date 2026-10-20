import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/qubit/auth-server";
import { listAccessRequests, submitAccessRequest } from "@/lib/qubit/security-server";
import { REQUESTABLE_ROLES } from "@/lib/qubit/security-data";

// Phase 21: identity from the signed session; the client never declares a role.
async function identityFrom(req: NextRequest) {
  const auth = await requireIdentity(req);
  return auth.ok
    ? { ok: true as const, identity: auth.identity }
    : { ok: false as const, response: auth.response };
}

// GET /api/security/access-requests — role-access requests. The full
// queue (with justifications) is approver-boundary data; the server
// returns it only to the administrator boundary. A per-requester
// self-view requires a requester field on the record and lands with
// the security data pass — never faked in the meantime.
export async function GET(req: NextRequest) {
  const actor = await identityFrom(req);
  if (!actor.ok) return actor.response;
  if (actor.identity.role !== "administrator") {
    return NextResponse.json(
      { code: "permission_denied", message: "Access requests are visible to approvers only." },
      { status: 403 },
    );
  }
  return NextResponse.json({ requests: listAccessRequests() });
}

// POST /api/security/access-requests — submit a request.
// Access is never granted here: requests only create a Pending
// Approval record evaluated along the reporting line, server-side.
export async function POST(req: NextRequest) {
  const actor = await identityFrom(req);
  if (!actor.ok) return actor.response;

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
    actor: actor.identity.name,
  });
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  return NextResponse.json({ ok: true, request: result.request });
}
