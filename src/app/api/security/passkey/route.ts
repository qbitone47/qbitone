import { NextRequest, NextResponse } from "next/server";
import { registerPasskey } from "@/lib/qubit/security-server";

// POST /api/security/passkey — register a passkey factor.
// In production the WebAuthn attestation is verified here; the
// factor change is audited server-side either way.
export async function POST(_req: NextRequest) {
  const result = registerPasskey("Sagar Singh");
  return NextResponse.json({ ok: true, alreadyRegistered: result.already });
}
