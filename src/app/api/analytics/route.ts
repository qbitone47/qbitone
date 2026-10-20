import { NextRequest, NextResponse } from "next/server";
import { analyticsGet, analyticsPost, sectionFor, type AnalyticsAction } from "@/lib/qubit/analytics-server";
import type { WorkspaceRole } from "@/lib/qubit/workspace-server";

const roleFrom = (req: NextRequest): WorkspaceRole =>
  (req.headers.get("X-Qubit-Role") as WorkspaceRole) ?? "administrator";

// GET /api/analytics?section=…&id=…&q=… — one centralized analytics
// endpoint over the authoritative existing systems. Scoping (company
// / department / own), dataset permissions, sensitive-field policies
// and audit-visibility rules are enforced server-side in
// analytics-server — never frontend-only.
export async function GET(req: NextRequest) {
  const section = req.nextUrl.searchParams.get("section");
  const resolved = sectionFor(section);
  if (!resolved) {
    return NextResponse.json({ code: "bad_section", message: "Unknown analytics section." }, { status: 400 });
  }
  const result = await analyticsGet(roleFrom(req), resolved, req.nextUrl.searchParams);
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
  const result = await analyticsPost(roleFrom(req), { type, input } as unknown as AnalyticsAction);
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  // Flatten to the established Qubit response shape: { ok, message, ...payload }
  return NextResponse.json({ ok: true, message: result.message, ...result.data });
}
