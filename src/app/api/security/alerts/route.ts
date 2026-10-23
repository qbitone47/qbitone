import { NextRequest, NextResponse } from "next/server";
import { requireIdentity, type QubitIdentity } from "@/lib/qubit/auth-server";
import { listAlerts, updateAlert } from "@/lib/qubit/security-server";
// Phase 25: request metering (real telemetry, failure-isolated).
import { withMeter } from "@/lib/qubit/telemetry-server";

// Phase 21: identity comes from the signed session — never a client header.
async function identityFrom(req: NextRequest): Promise<{ ok: true; identity: QubitIdentity } | { ok: false; response: NextResponse }> {
  const auth = await requireIdentity(req);
  return auth.ok ? { ok: true, identity: auth.identity } : { ok: false, response: auth.response };
}

// GET /api/security/alerts — personal alerts; organization-scope
// alerts are only included for the security administrator boundary.
export async function GET(req: NextRequest) {
  return withMeter(req, "GET /api/security/alerts", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    return NextResponse.json({ alerts: listAlerts(actor.identity.role) });
  });
}

// POST /api/security/alerts — acknowledge or resolve an alert.
// Phase 21 (audit M2): mutations are restricted to the security
// administrator boundary — the GET scoping must not be the only gate
// (hiding a button is not authorization).
export async function POST(req: NextRequest) {
  return withMeter(req, "POST /api/security/alerts", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;

    if (actor.identity.role !== "administrator") {
      return NextResponse.json(
        { code: "permission_denied", message: "Updating security alerts requires Security administrator access." },
        { status: 403 },
      );
    }

    let body: { id?: string; action?: "acknowledge" | "resolve" };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
    }
    if (!body.id || (body.action !== "acknowledge" && body.action !== "resolve")) {
      return NextResponse.json({ code: "bad_request", message: "Specify an alert and an action." }, { status: 400 });
    }

    const result = updateAlert(body.id, body.action, actor.identity.name);
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    return NextResponse.json({ ok: true, alert: result.alert });
  });
}
