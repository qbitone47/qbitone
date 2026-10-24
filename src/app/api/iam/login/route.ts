// ============================================================
// Qubit One — IAM · Credential login (first factor)
// POST /api/iam/login  { identifier, password }
// ============================================================
// Verifies the individual employee's User ID (or work email) and
// password against the scrypt-hashed credential store, then issues
// an MFA challenge. NO session is created here — the session is
// only issued by /api/iam/mfa after the second factor verifies.
//
// Security: rate-limited per client, per-account lockout (5 failures
// / 10 min → 10-min lock), per-source circuit breaker, identical
// error messaging for unknown accounts and wrong passwords (no
// enumeration), every outcome audited with the real actor.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_PROFILES, tooManyRequests, bodyTooLarge, boundedString } from "@/lib/qubit/auth-server";
import { iamUserByIdentifier, verifyUserPassword } from "@/lib/qubit/iam";
import { checkLockout, recordAuthFailure, createMfaChallenge, writeAudit } from "@/lib/qubit/security-server";
import { withMeter } from "@/lib/qubit/telemetry-server";

export const runtime = "nodejs";

function clientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export async function POST(req: NextRequest) {
  return withMeter(req, "POST /api/iam/login", async () => {
    const ip = clientKey(req);
    const gate = rateLimit(`iam-login:${ip}`, RATE_PROFILES.sessionIssue.limit, RATE_PROFILES.sessionIssue.windowMs);
    if (!gate.allowed) return tooManyRequests(gate.retryAfterSec);
    if (bodyTooLarge(req)) {
      return NextResponse.json({ code: "bad_request", message: "Request body too large." }, { status: 413 });
    }

    let body: { identifier?: unknown; password?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ code: "bad_request", message: "Invalid request body." }, { status: 400 });
    }

    const identifier = boundedString(body.identifier, 120);
    const password = typeof body.password === "string" ? body.password : "";
    if (!identifier) {
      return NextResponse.json({ code: "invalid_identifier", message: "Enter your User ID to continue." }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ code: "invalid_password", message: "Enter your password to continue." }, { status: 400 });
    }

    // Lockout (per-account + per-source) — same mechanics as the
    // security-screen flow, keyed by the submitted identifier.
    const lock = checkLockout(identifier, ip);
    if (lock.locked) {
      return NextResponse.json(
        { code: "rate_limited", message: `Too many attempts. Try again in ${Math.ceil(lock.retryAfterSec / 60)} minute${lock.retryAfterSec >= 120 ? "s" : ""}.`, retryAfterSec: lock.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(lock.retryAfterSec) } },
      );
    }

    const user = iamUserByIdentifier(identifier);
    const passwordOk = user ? await verifyUserPassword(user.userId, password) : false;

    if (!user || !passwordOk || user.status !== "active") {
      const f = recordAuthFailure(identifier, ip);
      writeAudit({
        actor: user ? user.name : identifier,
        actorId: user ? user.userId : "unknown",
        action: "Failed sign-in",
        resource: "Qubit One workspace",
        result: "Failure",
        severity: "Warning",
        context: user ? "Incorrect password" : "Unknown identifier",
      });
      if (f.lockedNow) {
        return NextResponse.json(
          { code: "rate_limited", message: "Too many failed attempts. Sign-in is temporarily locked for 10 minutes." },
          { status: 429 },
        );
      }
      // Identical message for unknown identifier and wrong password — no enumeration.
      return NextResponse.json(
        { code: "invalid_credentials", message: "That User ID or password doesn't match our records." },
        { status: 401 },
      );
    }

    const challenge = createMfaChallenge(user.email, user.name);
    return NextResponse.json({
      ok: true,
      next: "mfa" as const,
      challengeId: challenge.challengeId,
      maskedEmail: challenge.maskedEmail,
      expiresInSeconds: 300,
      methods: ["authenticator-app", "push", "passkey", "recovery-code"],
      // Demo authenticator surface: the simulated TOTP app displays the
      // real issued code so the strict server comparison is exercisable.
      demoAuthenticatorCode: challenge.code,
    });
  });
}
