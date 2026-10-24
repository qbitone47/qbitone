// ============================================================
// Qubit One — IAM · Password change (self-service)
// POST /api/iam/password  { currentPassword, newPassword }
// ============================================================
// Re-authenticates with the current password, enforces the
// organization password policy server-side (12+ chars, mixed case,
// digit, different from current), stores ONLY a fresh scrypt hash,
// revokes every OTHER session of the user, and audits the change.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireIdentity, rateLimit, RATE_PROFILES, tooManyRequests, revokeAuthSessions, bodyTooLarge, boundedString } from "@/lib/qubit/auth-server";
import { verifyUserPassword, setUserPassword } from "@/lib/qubit/iam";
import { writeAudit } from "@/lib/qubit/security-server";
import { withMeter } from "@/lib/qubit/telemetry-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return withMeter(req, "POST /api/iam/password", async () => {
    const auth = await requireIdentity(req);
    if (!auth.ok) return auth.response;

    const gate = rateLimit(`iam-pw:${auth.identity.userId}`, RATE_PROFILES.genericWrite.limit, RATE_PROFILES.genericWrite.windowMs);
    if (!gate.allowed) return tooManyRequests(gate.retryAfterSec);
    if (bodyTooLarge(req)) {
      return NextResponse.json({ code: "bad_request", message: "Request body too large." }, { status: 413 });
    }

    let body: { currentPassword?: unknown; newPassword?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ code: "bad_request", message: "Invalid request body." }, { status: 400 });
    }

    const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const next = boundedString(body.newPassword, 128) ?? "";
    if (!current) {
      return NextResponse.json({ code: "reauth_required", message: "Confirm your current password to continue." }, { status: 401 });
    }
    if (!(await verifyUserPassword(auth.identity.userId, current))) {
      writeAudit({
        actor: auth.identity.name,
        actorId: auth.identity.userId,
        action: "Password change denied",
        resource: "Account credentials",
        result: "Blocked",
        severity: "Warning",
        context: "Current-password reauthentication failed",
      });
      return NextResponse.json({ code: "reauth_failed", message: "That current password doesn't match." }, { status: 401 });
    }
    if (!next || next === current) {
      return NextResponse.json({ code: "password_reused", message: "Your new password must be different from your current password." }, { status: 422 });
    }
    if (next.length < 12 || !/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/\d/.test(next)) {
      return NextResponse.json(
        { code: "password_policy", message: "Password doesn't meet the organization policy yet (12+ characters, mixed case and a number)." },
        { status: 422 },
      );
    }

    await setUserPassword(auth.identity.userId, next);
    const revoked = revokeAuthSessions({ allForUser: auth.identity.userId, except: auth.identity.sessionId });
    writeAudit({
      actor: auth.identity.name,
      actorId: auth.identity.userId,
      action: "Password changed",
      resource: "Account credentials",
      result: "Success",
      severity: "High",
      context: `Changed after reauthentication · ${revoked} other session${revoked === 1 ? "" : "s"} signed out`,
    });
    return NextResponse.json({ ok: true, otherSessionsRevoked: revoked });
  });
}
