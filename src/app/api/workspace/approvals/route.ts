import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/qubit/auth-server";
import { decideApproval, listApprovals, type WorkspaceRole } from "@/lib/qubit/workspace-server";
// Phase 25: request metering (real telemetry, failure-isolated).
import { withMeter } from "@/lib/qubit/telemetry-server";

// Phase 21: the acting role is derived from the signed session cookie
// (server-verified) — a client-declared role header is never trusted.
// Fail-closed: requests without a valid session receive 401.
async function identityFrom(req: NextRequest): Promise<{ ok: true; role: WorkspaceRole } | { ok: false; response: NextResponse }> {
  const auth = await requireIdentity(req);
  return auth.ok
    ? { ok: true, role: auth.identity.role as WorkspaceRole }
    : { ok: false, response: auth.response };
}

// GET /api/workspace/approvals — the approver's queue, scoped server-side.
export async function GET(req: NextRequest) {
  return withMeter(req, "GET /api/workspace/approvals", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    return NextResponse.json(listApprovals(actor.role));
  });
}

// POST /api/workspace/approvals — record a decision.
// Authorization, step-up and note rules are enforced by the server.
export async function POST(req: NextRequest) {
  return withMeter(req, "POST /api/workspace/approvals", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    let body: { id?: string; decision?: string; note?: string; stepUpPassword?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
    }
    const decision = body.decision as "Approved" | "Rejected" | "Changes requested" | undefined;
    if (!body.id || !decision || !["Approved", "Rejected", "Changes requested"].includes(decision)) {
      return NextResponse.json({ code: "bad_request", message: "Provide a request id and a valid decision." }, { status: 400 });
    }
    const result = decideApproval(actor.role, { id: body.id, decision, note: body.note, stepUpPassword: body.stepUpPassword });
    return result.ok ? NextResponse.json(result) : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  });
}
