import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/qubit/auth-server";
import { opsGet, opsPost, opsSectionFor } from "@/lib/qubit/ops-server";
import type { WorkspaceRole } from "@/lib/qubit/workspace-server";

// Phase 22 · Operations — the production hardening endpoint.
// Same enforcement model as /api/platform: the acting identity is
// derived from the signed session cookie (fail-closed 401), every
// section is administrator-only (403 audited), and all mutations
// run through opsPost which writes to the enterprise audit trail.
async function identityFrom(req: NextRequest): Promise<{ ok: true; role: WorkspaceRole } | { ok: false; response: NextResponse }> {
  const auth = await requireIdentity(req);
  return auth.ok
    ? { ok: true, role: auth.identity.role as WorkspaceRole }
    : { ok: false, response: auth.response };
}

// GET /api/ops?section=… — Phase 22 operational telemetry.
export async function GET(req: NextRequest) {
  const actor = await identityFrom(req);
  if (!actor.ok) return actor.response;
  const section = req.nextUrl.searchParams.get("section");
  const resolved = opsSectionFor(section);
  if (!resolved) {
    return NextResponse.json({ code: "bad_section", message: "Unknown operations section." }, { status: 400 });
  }
  const result = await opsGet(actor.role, resolved);
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

// POST /api/ops — audited governance mutations (flags, config,
// maintenance, incidents, release approvals, API probes, rollback).
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
  const result = await opsPost(actor.role, { type, input, confirm: body.confirm === true });
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  return NextResponse.json(result);
}
