import { NextRequest, NextResponse } from "next/server";
import { listSessions, revokeSession } from "@/lib/qubit/security-server";

// GET /api/security/sessions — active sessions for the signed-in user.
export async function GET() {
  return NextResponse.json({ sessions: listSessions() });
}

// POST /api/security/sessions — revoke one session, or all others.
// Revocation is a server-side decision; the client only expresses intent.
export async function POST(req: NextRequest) {
  let body: { sessionId?: string; all?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
  }

  const result = revokeSession(body.sessionId ?? null, Boolean(body.all), "Sagar Singh");
  return NextResponse.json(result);
}
