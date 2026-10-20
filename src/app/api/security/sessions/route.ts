import { NextRequest, NextResponse } from "next/server";
import {
  listAuthSessions,
  requireIdentity,
  revokeAuthSessions,
  withCurrentFlag,
} from "@/lib/qubit/auth-server";
import { listSessions, revokeSession } from "@/lib/qubit/security-server";

// Phase 21: identity from the signed session; the client never declares a role.
async function identityFrom(req: NextRequest) {
  const auth = await requireIdentity(req);
  return auth.ok
    ? { ok: true as const, identity: auth.identity }
    : { ok: false as const, response: auth.response };
}

// GET /api/security/sessions — the session user's device sessions.
// `accountSessions` are the live Phase 21 server-side sessions
// (signed tokens, revocation enforced at the identity plane).
export async function GET(req: NextRequest) {
  const actor = await identityFrom(req);
  if (!actor.ok) return actor.response;
  return NextResponse.json({
    sessions: listSessions(),
    accountSessions: await withCurrentFlag(req, listAuthSessions(actor.identity.userId)),
  });
}

// POST /api/security/sessions — revoke one session, or all others.
// Revocation is a server-side decision; the client only expresses intent.
// Phase 21: "revoke all" also revokes live account sessions (except the
// current one), and `qubs-*` ids revoke at the identity plane directly.
export async function POST(req: NextRequest) {
  const actor = await identityFrom(req);
  if (!actor.ok) return actor.response;

  let body: { sessionId?: string; all?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
  }

  const result = revokeSession(body.sessionId ?? null, Boolean(body.all), actor.identity.name);
  let authRevoked = 0;
  if (body.all) {
    authRevoked = revokeAuthSessions({ allForUser: actor.identity.userId, except: actor.identity.sessionId });
  } else if (body.sessionId?.startsWith("qubs-")) {
    authRevoked = revokeAuthSessions({ sessionId: body.sessionId });
  }
  return NextResponse.json({ ...result, accountSessionsRevoked: authRevoked });
}
