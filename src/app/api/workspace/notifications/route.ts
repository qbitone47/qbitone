import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/qubit/auth-server";
import { listNotifications, type WorkspaceRole } from "@/lib/qubit/workspace-server";
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

// GET /api/workspace/notifications — the ONE centralized notification feed
// (fixture seed + live meeting invites/cancellations) from the shared
// workspace store, so the desktop notification center and the mobile
// notification screen render the same server-side state.
export async function GET(req: NextRequest) {
  return withMeter(req, "GET /api/workspace/notifications", async () => {
    const actor = await identityFrom(req);
    if (!actor.ok) return actor.response;
    return NextResponse.json(listNotifications(actor.role));
  });
}
