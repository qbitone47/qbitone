import { NextRequest, NextResponse } from "next/server";
import { createPolicy, listPolicies, validatePolicy } from "@/lib/qubit/security-server";

const roleOf = (req: NextRequest) => req.headers.get("x-qubit-role") ?? "employee";

// GET /api/security/policies — admin/security-admin only.
export async function GET(req: NextRequest) {
  if (roleOf(req) !== "administrator") {
    return NextResponse.json(
      { code: "permission_denied", message: "Network policies are restricted to security administrators." },
      { status: 403 },
    );
  }
  return NextResponse.json({ policies: listPolicies() });
}

// POST /api/security/policies — create a policy.
// Conflict detection, self-lockout protection and broad-range
// warnings are all evaluated on the server before anything applies.
export async function POST(req: NextRequest) {
  if (roleOf(req) !== "administrator") {
    return NextResponse.json(
      { code: "permission_denied", message: "Network policies are restricted to security administrators." },
      { status: 403 },
    );
  }

  let body: { name?: string; cidr?: string; action?: string; scope?: string; environment?: string; priority?: number; confirmBroad?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
  }

  const input = {
    name: body.name ?? "",
    cidr: body.cidr ?? "",
    action: (body.action ?? "Allow") as "Allow" | "Restrict" | "Require Verification" | "Deny",
    scope: body.scope ?? "All members",
    environment: body.environment ?? "Production",
  };

  const result = createPolicy({ ...input, priority: body.priority ?? 60, actor: "Sagar Singh" });
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message, conflicts: "conflicts" in result ? result.conflicts : undefined }, { status: result.status });
  }
  return NextResponse.json({ ok: true, policy: result.policy });
}

// PATCH /api/security/policies — dry-run validation for the form's
// live conflict preview (no side effects).
export async function PATCH(req: NextRequest) {
  if (roleOf(req) !== "administrator") {
    return NextResponse.json({ code: "permission_denied", message: "Restricted to security administrators." }, { status: 403 });
  }
  let body: { name?: string; cidr?: string; action?: string; scope?: string; environment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
  }
  const v = validatePolicy({
    name: body.name ?? "",
    cidr: body.cidr ?? "",
    action: (body.action ?? "Allow") as "Allow" | "Restrict" | "Require Verification" | "Deny",
    scope: body.scope ?? "All members",
    environment: body.environment ?? "Production",
  });
  return NextResponse.json(v);
}
