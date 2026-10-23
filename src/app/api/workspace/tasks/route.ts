import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/qubit/auth-server";
import { createTask, listTasks, updateTask, type WorkspaceRole } from "@/lib/qubit/workspace-server";
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

// GET /api/workspace/tasks — the session user's assigned tasks.
export async function GET(req: NextRequest) {
  return withMeter(req, "GET /api/workspace/tasks", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    return NextResponse.json({ tasks: listTasks() });
  });
}

// POST /api/workspace/tasks — create a task (server-validated).
export async function POST(req: NextRequest) {
  return withMeter(req, "POST /api/workspace/tasks", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    let body: { title?: string; detail?: string; priority?: string; due?: number | null };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
    }
    const result = createTask(actor.role, {
      title: body.title ?? "",
      detail: body.detail,
      priority: (body.priority as "High" | "Medium" | "Low") ?? "Medium",
      due: body.due ?? null,
    });
    return result.ok ? NextResponse.json(result) : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  });
}

// PATCH /api/workspace/tasks — transition status (server-validated transitions).
export async function PATCH(req: NextRequest) {
  return withMeter(req, "PATCH /api/workspace/tasks", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    let body: { id?: string; status?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
    }
    if (!body.id || !body.status) {
      return NextResponse.json({ code: "bad_request", message: "Provide a task id and status." }, { status: 400 });
    }
    const result = updateTask(actor.role, { id: body.id, status: body.status as never });
    return result.ok ? NextResponse.json(result) : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  });
}
