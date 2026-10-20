import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/qubit/auth-server";
import { analyticsGet, analyticsPost, sectionFor, type AnalyticsAction } from "@/lib/qubit/analytics-server";
import type { WorkspaceRole } from "@/lib/qubit/workspace-server";

// Phase 21: the acting role is derived from the signed session cookie
// (server-verified) — a client-declared role header is never trusted.
// Fail-closed: requests without a valid session receive 401.
async function identityFrom(req: NextRequest): Promise<{ ok: true; role: WorkspaceRole } | { ok: false; response: NextResponse }> {
  const auth = await requireIdentity(req);
  return auth.ok
    ? { ok: true, role: auth.identity.role as WorkspaceRole }
    : { ok: false, response: auth.response };
}

// GET /api/analytics?section=…&id=…&q=… — one centralized analytics
// endpoint over the authoritative existing systems. Scoping (company
// / department / own), dataset permissions, sensitive-field policies
// and audit-visibility rules are enforced server-side in
// analytics-server — never frontend-only.
export async function GET(req: NextRequest) {
  const actor = await identityFrom(req);
  if (!actor.ok) return actor.response;
  const section = req.nextUrl.searchParams.get("section");
  const resolved = sectionFor(section);
  if (!resolved) {
    return NextResponse.json({ code: "bad_section", message: "Unknown analytics section." }, { status: 400 });
  }
  const result = await analyticsGet(actor.role, resolved, req.nextUrl.searchParams);
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

// POST /api/analytics — every consequential analytics action: report
// create/edit/delete/favorite/run, dataset previews through the
// controlled semantic layer, exports, schedules, settings changes,
// AI explanations and audit CSV export. Validation, permissions,
// duplicate-prevention and audit are enforced server-side.
export async function POST(req: NextRequest) {
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
  const result = await analyticsPost(actor.role, { type, input } as unknown as AnalyticsAction);
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  // Flatten to the established Qubit response shape: { ok, message, ...payload }
  return NextResponse.json({ ok: true, message: result.message, ...result.data });
}
