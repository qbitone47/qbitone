import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/qubit/auth-server";
import { createPolicy, listPolicies, validatePolicy } from "@/lib/qubit/security-server";
// Phase 25: request metering (real telemetry, failure-isolated).
import { withMeter } from "@/lib/qubit/telemetry-server";

// Phase 21: identity from the signed session; the client never declares a role.
async function identityFrom(req: NextRequest) {
  const auth = await requireIdentity(req);
  return auth.ok
    ? { ok: true as const, identity: auth.identity }
    : { ok: false as const, response: auth.response };
}

const adminOnly = (role: string) =>
  role === "administrator"
    ? null
    : NextResponse.json(
        { code: "permission_denied", message: "Network policies are restricted to security administrators." },
        { status: 403 },
      );

// GET /api/security/policies — admin/security-admin only.
export async function GET(req: NextRequest) {
  return withMeter(req, "GET /api/security/policies", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    const denied = adminOnly(actor.identity.role);
    if (denied) return denied;
    return NextResponse.json({ policies: listPolicies() });
  });
}

// POST /api/security/policies — create a policy.
// Conflict detection, self-lockout protection and broad-range
// warnings are all evaluated on the server before anything applies.
export async function POST(req: NextRequest) {
  return withMeter(req, "POST /api/security/policies", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    const denied = adminOnly(actor.identity.role);
    if (denied) return denied;

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

    const result = createPolicy({ ...input, priority: body.priority ?? 60, actor: actor.identity.name });
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message, conflicts: "conflicts" in result ? result.conflicts : undefined }, { status: result.status });
    }
    return NextResponse.json({ ok: true, policy: result.policy });
  });
}

// PATCH /api/security/policies — dry-run validation for the form's
// live conflict preview (no side effects).
export async function PATCH(req: NextRequest) {
  return withMeter(req, "PATCH /api/security/policies", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    if (actor.identity.role !== "administrator") {
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
  });
}
