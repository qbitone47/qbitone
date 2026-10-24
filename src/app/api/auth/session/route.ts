// ============================================================
// Qubit One — Session diagnostic plane
// POST /api/auth/session · GET /api/auth/session
// ============================================================
// IAM CHANGE: sessions are issued ONLY through the verified
// credential flow (POST /api/iam/login → MFA → POST /api/iam/mfa).
// The old unauthenticated role-preview bootstrap is DISABLED:
//
//   · POST now requires an already-valid session and simply returns
//     the acting identity (idempotent refresh — no role switching;
//     a session can never escalate beyond the person's own role).
//   · Without a valid session it returns 401 login_required.
//
// GET remains the identity diagnostic for the current session.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  rateLimit,
  RATE_PROFILES,
  requireIdentity,
  resolveIdentity,
  tooManyRequests,
} from "@/lib/qubit/auth-server";
import { entitlementsFor } from "@/lib/qubit/iam";
import { withMeter } from "@/lib/qubit/telemetry-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return withMeter(req, "POST /api/auth/session", async () => {
    const clientKey = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const gate = rateLimit(`session-issue:${clientKey}`, RATE_PROFILES.sessionIssue.limit, RATE_PROFILES.sessionIssue.windowMs);
    if (!gate.allowed) return tooManyRequests(gate.retryAfterSec);

    // Fail closed: no valid session → no issuance. Sign in via /api/iam/login.
    const identity = await requireIdentity(req);
    if (!identity.ok) return identity.response;

    const entitlements = entitlementsFor(identity.identity.userId);
    return NextResponse.json({
      ok: true,
      userId: identity.identity.userId,
      name: identity.identity.name,
      role: identity.identity.role,
      department: entitlements?.departmentLabel ?? identity.identity.department,
      sessionId: identity.identity.sessionId,
    });
  });
}

// GET /api/auth/session — identity diagnostic for the current session.
// Returns the server-derived identity; 401 when no valid session exists.
export async function GET(req: NextRequest) {
  return withMeter(req, "GET /api/auth/session", async () => {
    const identity = await resolveIdentity(req);
    if (!identity) {
      return NextResponse.json({ code: "session_required", message: "No valid session." }, { status: 401 });
    }
    const entitlements = entitlementsFor(identity.userId);
    return NextResponse.json({
      ok: true,
      userId: identity.userId,
      name: identity.name,
      email: identity.email,
      role: identity.role,
      department: entitlements?.departmentLabel ?? identity.department,
      sessionId: identity.sessionId,
    });
  });
}
