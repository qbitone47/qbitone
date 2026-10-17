import { NextRequest, NextResponse } from "next/server";
import { createTask, listTasks, updateTask, type WorkspaceRole } from "@/lib/qubit/workspace-server";

const roleFrom = (req: NextRequest): WorkspaceRole =>
  (req.headers.get("X-Qubit-Role") as WorkspaceRole) ?? "administrator";

// GET /api/workspace/tasks — the session user's assigned tasks.
export async function GET() {
  return NextResponse.json({ tasks: listTasks() });
}

// POST /api/workspace/tasks — create a task (server-validated).
export async function POST(req: NextRequest) {
  let body: { title?: string; detail?: string; priority?: string; due?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
  }
  const result = createTask(roleFrom(req), {
    title: body.title ?? "",
    detail: body.detail,
    priority: (body.priority as "High" | "Medium" | "Low") ?? "Medium",
    due: body.due ?? null,
  });
  return result.ok ? NextResponse.json(result) : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
}

// PATCH /api/workspace/tasks — transition status (server-validated transitions).
export async function PATCH(req: NextRequest) {
  let body: { id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
  }
  if (!body.id || !body.status) {
    return NextResponse.json({ code: "bad_request", message: "Provide a task id and status." }, { status: 400 });
  }
  const result = updateTask(roleFrom(req), { id: body.id, status: body.status as never });
  return result.ok ? NextResponse.json(result) : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
}
