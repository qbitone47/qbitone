import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/qubit/auth-server";
import { platformGet, platformPost, sectionFor, type PlatformAction } from "@/lib/qubit/platform-server";
import type { WorkspaceRole } from "@/lib/qubit/workspace-server";
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

// GET /api/platform?section=… — the enterprise hardening endpoint.
// Sections 301–307 are administrator-only (server-enforced, denials
// audited); system-status is readable by every signed-in role.
// All telemetry is measured live or honestly labeled unavailable.
export async function GET(req: NextRequest) {
  return withMeter(req, "GET /api/platform", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    const section = req.nextUrl.searchParams.get("section");
    const resolved = sectionFor(section);
    if (!resolved) {
      return NextResponse.json({ code: "bad_section", message: "Unknown platform section." }, { status: 400 });
    }
    const result = await platformGet(actor.role, resolved);
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    return NextResponse.json(result.data);
  });
}

// POST /api/platform — backup/verify/restore-test (real file
// operations over the platform database), high-risk restore
// REQUESTS (never automatic production restores), QA + a11y
// governance records and the browser-vitals telemetry receiver.
export async function POST(req: NextRequest) {
  return withMeter(req, "POST /api/platform", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
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
    const result = await platformPost(actor.role, { type, input, confirm: body.confirm === true } as unknown as PlatformAction);
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    // platformPost already returns the flattened Qubit shape: { ok, message, ...payload }
    return NextResponse.json(result);
  });
}
