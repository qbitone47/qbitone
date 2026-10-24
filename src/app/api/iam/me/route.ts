// ============================================================
// Qubit One — IAM · Current identity + entitlements
// GET /api/iam/me
// ============================================================
// Returns the server-derived identity of the signed-in employee and
// their ENTITLEMENTS: home screen, allowed screens, allowed modules
// and granular permissions — all computed from the IAM matrices on
// the server. The UI consumes this to render personalized,
// permission-aware navigation; the backend independently enforces
// the same boundaries on every API call (UI hiding is not security).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/qubit/auth-server";
import { entitlementsFor } from "@/lib/qubit/iam";
import { withMeter } from "@/lib/qubit/telemetry-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return withMeter(req, "GET /api/iam/me", async () => {
    const auth = await requireIdentity(req);
    if (!auth.ok) return auth.response;

    const entitlements = entitlementsFor(auth.identity.userId);
    if (!entitlements) {
      return NextResponse.json({ code: "unknown_identity", message: "Identity no longer exists." }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      identity: {
        userId: auth.identity.userId,
        name: auth.identity.name,
        email: auth.identity.email,
        title: auth.identity.title,
        role: auth.identity.role,
        department: entitlements.departmentLabel,
        sessionId: auth.identity.sessionId,
      },
      entitlements,
    });
  });
}
