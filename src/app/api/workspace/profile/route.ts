import { NextRequest, NextResponse } from "next/server";
import { updateProfile, type WorkspaceRole } from "@/lib/qubit/workspace-server";

const roleFrom = (req: NextRequest): WorkspaceRole =>
  (req.headers.get("X-Qubit-Role") as WorkspaceRole) ?? "administrator";

// PATCH /api/workspace/profile — self-service fields only.
// Company-controlled fields (employee ID, department, manager,
// designation, employment status) are rejected server-side.
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
  }
  const result = updateProfile(roleFrom(req), body);
  return result.ok ? NextResponse.json(result) : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
}
