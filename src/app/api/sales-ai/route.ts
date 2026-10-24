import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_PROFILES, requireIdentity, tooManyRequests } from "@/lib/qubit/auth-server";
import { salesAiGet, salesAiPost, salesAiSectionAllowed } from "@/lib/qubit/sales-ai-server";
import type { WorkspaceRole } from "@/lib/qubit/workspace-server";
// Phase 25: request metering (real telemetry, failure-isolated).
import { withMeter } from "@/lib/qubit/telemetry-server";

// Phase 21: the acting role is derived from the signed session cookie
// (server-verified) — a client-declared role header is never trusted.
// Fail-closed: requests without a valid session receive 401.
async function identityFrom(req: NextRequest): Promise<{ ok: true; role: WorkspaceRole; userId: string } | { ok: false; response: NextResponse }> {
  const auth = await requireIdentity(req);
  return auth.ok
    ? { ok: true, role: auth.identity.role as WorkspaceRole, userId: auth.identity.userId }
    : { ok: false, response: auth.response };
}

// GET /api/sales-ai?section=… — every Sales AI surface loads its own
// section. Authorization is enforced INSIDE the orchestration layer
// through the same sales-server enforcement the Sales screens use:
// the AI inherits exactly the user's effective permissions.
export async function GET(req: NextRequest) {
  return withMeter(req, "GET /api/sales-ai", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    const section = req.nextUrl.searchParams.get("section");
    if (!salesAiSectionAllowed(section)) {
      return NextResponse.json({ code: "bad_section", message: "Unknown Sales AI section." }, { status: 400 });
    }
    const result = salesAiGet(actor.role, section, req.nextUrl.searchParams, actor.userId);
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    return NextResponse.json(result.data);
  });
}

// POST /api/sales-ai — AI actions. Consequential mutations are routed
// through the existing sales-server workflows and are never executed
// without an explicit confirm flag from the user.
export async function POST(req: NextRequest) {
  return withMeter(req, "POST /api/sales-ai", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    // Phase 21 (§22): AI requests are rate-limited — LLM calls are a
    // cost/abuse surface; generous enough to never block normal work.
    const gate = rateLimit(`sales-ai:${actor.userId}`, RATE_PROFILES.ai.limit, RATE_PROFILES.ai.windowMs);
    if (!gate.allowed) return tooManyRequests(gate.retryAfterSec);
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
    const result = await salesAiPost(actor.role, type, input, actor.userId);
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    const { ok: _ok, message: _message, ...rest } = result;
    return NextResponse.json({ ok: true, message: _message, ...rest });
  });
}
