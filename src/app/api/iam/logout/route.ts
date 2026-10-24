// ============================================================
// Qubit One — IAM · Sign out
// POST /api/iam/logout
// ============================================================
// Revokes the current session server-side (revocation is enforced
// on every later verify), clears the session cookie, and writes a
// real "Sign out" audit event with the acting identity.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireIdentity, SESSION_COOKIE, revokeAuthSessions } from "@/lib/qubit/auth-server";
import { writeAudit } from "@/lib/qubit/security-server";
import { withMeter } from "@/lib/qubit/telemetry-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return withMeter(req, "POST /api/iam/logout", async () => {
    const auth = await requireIdentity(req);
    if (auth.ok) {
      revokeAuthSessions({ sessionId: auth.identity.sessionId });
      writeAudit({
        actor: auth.identity.name,
        actorId: auth.identity.userId,
        action: "Sign out",
        resource: "Qubit One workspace",
        result: "Success",
        severity: "Info",
        context: `Session ${auth.identity.sessionId.slice(0, 12)}… revoked by user`,
      });
    }
    const res = NextResponse.json({ ok: true });
    // Clear the cookie regardless (defense-in-depth for stale cookies).
    res.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "strict",
      secure: req.headers.get("x-forwarded-proto") === "https",
      path: "/",
      maxAge: 0,
    });
    return res;
  });
}
