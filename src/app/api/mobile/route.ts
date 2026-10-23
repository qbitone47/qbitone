import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_PROFILES, requireIdentity, tooManyRequests } from "@/lib/qubit/auth-server";
import { mobileGet, mobilePost, sectionFor, type MobileAction } from "@/lib/qubit/mobile-server";
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

// GET /api/mobile?section=…&id=… — one composed mobile endpoint over
// the authoritative existing Qubit One systems. Scoping (sales own/
// team/company), approval authority, mailbox scope and participant
// checks are enforced server-side in mobile-server — never the UI.
export async function GET(req: NextRequest) {
  return withMeter(req, "GET /api/mobile", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    const section = req.nextUrl.searchParams.get("section");
    const resolved = sectionFor(section);
    if (!resolved) {
      return NextResponse.json({ code: "bad_section", message: "Unknown mobile section." }, { status: 400 });
    }
    const result = await mobileGet(actor.role, resolved, req.nextUrl.searchParams);
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    return NextResponse.json(result.data);
  });
}

// POST /api/mobile — every consequential mobile action (task and
// approval decisions, attendance punches, visit execution, WhatsApp
// replies, mail, profile, card share, mobile AI). Validation,
// permissions, transitions and audit are enforced server-side;
// delegated actions ride the existing systems' own enforcement.
export async function POST(req: NextRequest) {
  return withMeter(req, "POST /api/mobile", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    // Phase 21 (§22): mobile actions include the AI ask surface — the
    // identity-scoped limit blunts abuse without touching normal field use.
    const gate = rateLimit(`mobile-post:${actor.userId}`, RATE_PROFILES.genericWrite.limit, RATE_PROFILES.genericWrite.windowMs);
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
    const result = await mobilePost(actor.role, { type, input } as unknown as MobileAction);
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    // mobilePost already returns the flattened Qubit shape: { ok, message, ...payload }
    return NextResponse.json(result);
  });
}
