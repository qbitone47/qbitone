import { NextRequest, NextResponse } from "next/server";
import { decideApproval, listApprovals, type WorkspaceRole } from "@/lib/qubit/workspace-server";

const roleFrom = (req: NextRequest): WorkspaceRole =>
  (req.headers.get("X-Qubit-Role") as WorkspaceRole) ?? "administrator";

// GET /api/workspace/approvals — the approver's queue, scoped server-side.
export async function GET(req: NextRequest) {
  return NextResponse.json(listApprovals(roleFrom(req)));
}

// POST /api/workspace/approvals — record a decision.
// Authorization, step-up and note rules are enforced by the server.
export async function POST(req: NextRequest) {
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
  const result = decideApproval(roleFrom(req), { id: body.id, decision, note: body.note, stepUpPassword: body.stepUpPassword });
  return result.ok ? NextResponse.json(result) : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
}
