import { NextRequest, NextResponse } from "next/server";
import { salesGet, salesPost, sectionAllowed, type Action } from "@/lib/qubit/sales-server";
import type { WorkspaceRole } from "@/lib/qubit/workspace-server";

const roleFrom = (req: NextRequest): WorkspaceRole =>
  (req.headers.get("X-Qubit-Role") as WorkspaceRole) ?? "administrator";

// GET /api/sales?section=…&id=…&entityId=… — every Sales screen loads
// its own section; scoping (company / team / own) and record-level
// authorization are enforced server-side in sales-server.
export async function GET(req: NextRequest) {
  const section = req.nextUrl.searchParams.get("section");
  if (!sectionAllowed(section)) {
    return NextResponse.json({ code: "bad_section", message: "Unknown sales section." }, { status: 400 });
  }
  const result = salesGet(roleFrom(req), section, req.nextUrl.searchParams);
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

// POST /api/sales — every consequential Sales mutation. Validation,
// lifecycle rules, duplicate guards, approval routing and audit are
// enforced server-side; the UI never decides business rules.
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
  const result = salesPost(roleFrom(req), { type, input } as unknown as Action);
  if (!result.ok) {
    return NextResponse.json(
      { code: result.code, message: result.message, matches: "matches" in result ? result.matches : undefined },
      { status: result.status },
    );
  }
  const { ok: _ok, message: _message, ...rest } = result;
  return NextResponse.json({ ok: true, message: _message, ...rest });
}
