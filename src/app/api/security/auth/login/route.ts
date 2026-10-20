import { NextRequest, NextResponse } from "next/server";
import { authenticatePassword } from "@/lib/qubit/security-server";

// POST /api/security/auth/login — first authentication factor.
// The server owns validation, lockout and rate limiting; the login
// form is treated as untrusted input.
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; simulate?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
  }

  // Phase 21 (audit M4): the lockout plane also tracks a coarse per-source
  // key (first x-forwarded-for hop) so one client cannot lock out arbitrary
  // victim emails or flood the per-email tracker. No message changes —
  // identical 429 text regardless of which dimension tripped.
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const sourceKey = fwd.split(",")[0]?.trim() || "direct";

  const result = authenticatePassword((body.email ?? "").trim().toLowerCase(), body.password ?? "", body.simulate, sourceKey);
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  return NextResponse.json(result);
}
