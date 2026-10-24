// ============================================================
// Qubit One — IAM · MFA verification → session issuance (second factor)
// POST /api/iam/mfa  { challengeId, code, method }
// ============================================================
// Verifies the second factor through the EXISTING MFA engine
// (CSPRNG 6-digit code, 5-min expiry, 3-attempt budget) and, only
// on success, issues the individual's session: the token is bound
// to the person's own userId and their single allowed role. The
// response carries the server-computed entitlements so the shell
// can route to the personalized home screen.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { issueSession, rateLimit, RATE_PROFILES, SESSION_COOKIE, sessionCookieParams, tooManyRequests, bodyTooLarge, boundedString } from "@/lib/qubit/auth-server";
import { iamUserByEmail, entitlementsForUser, IAM_ROLES } from "@/lib/qubit/iam";
import { verifyMfa, writeAudit } from "@/lib/qubit/security-server";
import { withMeter } from "@/lib/qubit/telemetry-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return withMeter(req, "POST /api/iam/mfa", async () => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const gate = rateLimit(`iam-mfa:${ip}`, RATE_PROFILES.sessionIssue.limit, RATE_PROFILES.sessionIssue.windowMs);
    if (!gate.allowed) return tooManyRequests(gate.retryAfterSec);
    if (bodyTooLarge(req)) {
      return NextResponse.json({ code: "bad_request", message: "Request body too large." }, { status: 413 });
    }

    let body: { challengeId?: unknown; code?: unknown; method?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ code: "bad_request", message: "Invalid request body." }, { status: 400 });
    }

    const challengeId = boundedString(body.challengeId, 40);
    const code = boundedString(body.code, 12) ?? "";
    const method = boundedString(body.method, 24) ?? "authenticator-app";
    if (!challengeId) {
      return NextResponse.json({ code: "challenge_missing", message: "Start again from sign-in." }, { status: 400 });
    }

    const result = verifyMfa(challengeId, code, method);
    if (!result.ok) {
      return NextResponse.json(
        { code: result.code, message: result.message, ...(result.code === "invalid_code" ? { attemptsRemaining: 3 } : {}) },
        { status: result.status },
      );
    }

    // Second factor verified — resolve the individual and issue THEIR session.
    const user = iamUserByEmail(result.email);
    if (!user || user.status !== "active") {
      return NextResponse.json(
        { code: "account_unavailable", message: "This account is not available. Contact IT support." },
        { status: 403 },
      );
    }

    const issued = await issueSession(user.userId, IAM_ROLES[user.role].sessionRole, "Web");
    // issueSession validates the (userId, role) pair against the directory;
    // the only allowed role for this user is their own sessionRole.
    if ("error" in issued) {
      return NextResponse.json(
        { code: "session_issue_failed", message: "Could not establish a session. Try again." },
        { status: 403 },
      );
    }

    const entitlements = entitlementsForUser(user);
    writeAudit({
      actor: user.name,
      actorId: user.userId,
      action: "Session issued",
      resource: "Qubit One workspace",
      result: "Success",
      severity: "Info",
      context: `Signed in via credentials + MFA · ${entitlements.roleLabel} · ${entitlements.departmentLabel} · Session ${issued.identity.sessionId.slice(0, 12)}…`,
    });

    const res = NextResponse.json({
      ok: true,
      userId: issued.identity.userId,
      name: issued.identity.name,
      role: issued.identity.role,
      department: entitlements.departmentLabel,
      title: entitlements.title,
      homeScreen: entitlements.homeScreen,
      expiresAt: issued.expiresAt,
    });
    res.cookies.set(SESSION_COOKIE, issued.token, sessionCookieParams(issued.expiresAt, req));
    return res;
  });
}
