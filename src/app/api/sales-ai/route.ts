import { NextRequest, NextResponse } from "next/server";
import { salesAiGet, salesAiPost, salesAiSectionAllowed } from "@/lib/qubit/sales-ai-server";
import type { WorkspaceRole } from "@/lib/qubit/workspace-server";

const roleFrom = (req: NextRequest): WorkspaceRole =>
  (req.headers.get("X-Qubit-Role") as WorkspaceRole) ?? "administrator";

// GET /api/sales-ai?section=… — every Sales AI surface loads its own
// section. Authorization is enforced INSIDE the orchestration layer
// through the same sales-server enforcement the Sales screens use:
// the AI inherits exactly the user's effective permissions.
export async function GET(req: NextRequest) {
  const section = req.nextUrl.searchParams.get("section");
  if (!salesAiSectionAllowed(section)) {
    return NextResponse.json({ code: "bad_section", message: "Unknown Sales AI section." }, { status: 400 });
  }
  const result = salesAiGet(roleFrom(req), section, req.nextUrl.searchParams);
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

// POST /api/sales-ai — AI actions. Consequential mutations are routed
// through the existing sales-server workflows and are never executed
// without an explicit confirm flag from the user.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
  }
  const type = typeof body.type === "string" ? body.type : undefined;
  if (!type) {
    return NextResponse.json({ code: "bad_request", message: "Provide the action type." }, { status: 400 });
  }
  const input = (body.input ?? {}) as Record<string, unknown>;
  const result = await salesAiPost(roleFrom(req), type, input);
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  const { ok: _ok, message: _message, ...rest } = result;
  return NextResponse.json({ ok: true, message: _message, ...rest });
}
