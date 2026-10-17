import { NextRequest, NextResponse } from "next/server";
import { changePassword } from "@/lib/qubit/security-server";

// POST /api/security/password — change password.
// The server re-checks the organization password policy and the
// current-password challenge; success signs out other sessions.
export async function POST(req: NextRequest) {
  let body: { current?: string; next?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
  }

  const result = changePassword(body.current ?? "", body.next ?? "");
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    message: "Your password was changed successfully. Other sessions were signed out.",
  });
}
