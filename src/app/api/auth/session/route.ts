import { NextRequest, NextResponse } from "next/server";
import {
  issueSession,
  rateLimit,
  RATE_PROFILES,
  resolveIdentity,
  SESSION_COOKIE,
  sessionCookieParams,
  tooManyRequests,
  QUBIT_ROLES,
  type QubitRole,
} from "@/lib/qubit/auth-server";
import { writeAudit } from "@/lib/qubit/security-server";

export const runtime = "nodejs";

const SESSION_USER_ID = "sagar";

// POST /api/auth/session — issue an authenticated session.
// The role is validated SERVER-SIDE against the identity directory;
// a client-declared role is never trusted (§1/§6). This is the only
// bootstrap endpoint reachable without a prior session, so it is
// rate-limited per client (§22).
export async function POST(req: NextRequest) {
  const clientKey = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const gate = rateLimit(`session-issue:${clientKey}`, RATE_PROFILES.sessionIssue.limit, RATE_PROFILES.sessionIssue.windowMs);
  if (!gate.allowed) return tooManyRequests(gate.retryAfterSec);

  let body: { role?: unknown } = {};
  try {
    if ((req.headers.get("content-length") ?? "0") !== "0") body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Invalid request body." }, { status: 400 });
  }

  // Absent role = bootstrap the signed-in demo identity's default view
  // (administrator), matching the product's initial role context.
  const requested = body.role ?? "administrator";
  if (typeof requested !== "string" || !(QUBIT_ROLES as string[]).includes(requested)) {
    return NextResponse.json(
      { code: "unknown_role", message: "The requested role is not in the identity directory." },
      { status: 403 },
    );
  }
  const role = requested as QubitRole;

  const issued = await issueSession(SESSION_USER_ID, role, "Web");
  if ("error" in issued) {
    return NextResponse.json(
      { code: "role_not_allowed", message: "This identity may not hold the requested role." },
      { status: 403 },
    );
  }

  // Audit meaningful session events on role CHANGE only — the audit
  // trail must not become noisy (§20/§21).
  const prev = await resolveIdentity(req);
  if (!prev || prev.role !== issued.identity.role) {
    writeAudit({
      action: prev ? "Session role switched" : "Session issued",
      resource: "Qubit One workspace",
      result: "Success",
      severity: "Info",
      context: `Role: ${issued.identity.role}${prev ? ` (from ${prev.role})` : ""} · Session ${issued.identity.sessionId.slice(0, 12)}…`,
    });
  }

  const res = NextResponse.json({
    ok: true,
    userId: issued.identity.userId,
    name: issued.identity.name,
    role: issued.identity.role,
    expiresAt: issued.expiresAt,
  });
  res.cookies.set(SESSION_COOKIE, issued.token, sessionCookieParams(issued.expiresAt, req));
  return res;
}

// GET /api/auth/session — identity diagnostic for the current session.
// Returns the server-derived identity; 401 when no valid session exists.
export async function GET(req: NextRequest) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ code: "session_required", message: "No valid session." }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    userId: identity.userId,
    name: identity.name,
    email: identity.email,
    role: identity.role,
    sessionId: identity.sessionId,
  });
}
