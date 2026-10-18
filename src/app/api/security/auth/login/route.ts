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

  const result = authenticatePassword((body.email ?? "").trim().toLowerCase(), body.password ?? "", body.simulate);
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  return NextResponse.json(result);
}
