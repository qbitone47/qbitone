import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/qubit/auth-server";
import { registerPasskey } from "@/lib/qubit/security-server";

// POST /api/security/passkey — register a passkey factor (session required).
// In production the WebAuthn attestation is verified here; the
// factor change is audited server-side either way.
export async function POST(req: NextRequest) {
  const auth = await requireIdentity(req);
  if (!auth.ok) return auth.response;
  const result = registerPasskey(auth.identity.name);
  return NextResponse.json({ ok: true, alreadyRegistered: result.already });
}
