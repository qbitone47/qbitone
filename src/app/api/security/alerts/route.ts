import { NextRequest, NextResponse } from "next/server";
import { listAlerts, updateAlert } from "@/lib/qubit/security-server";

const roleOf = (req: NextRequest) => req.headers.get("x-qubit-role") ?? "employee";

// GET /api/security/alerts — personal alerts; organization-scope
// alerts are only included for the security administrator boundary.
export async function GET(req: NextRequest) {
  return NextResponse.json({ alerts: listAlerts(roleOf(req)) });
}

// POST /api/security/alerts — acknowledge or resolve an alert.
export async function POST(req: NextRequest) {
  let body: { id?: string; action?: "acknowledge" | "resolve" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
  }
  if (!body.id || (body.action !== "acknowledge" && body.action !== "resolve")) {
    return NextResponse.json({ code: "bad_request", message: "Specify an alert and an action." }, { status: 400 });
  }

  const result = updateAlert(body.id, body.action, "Sagar Singh");
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  return NextResponse.json({ ok: true, alert: result.alert });
}
