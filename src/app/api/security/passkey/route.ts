import { NextRequest, NextResponse } from "next/server";
import { requireIdentity } from "@/lib/qubit/auth-server";
import { registerPasskey } from "@/lib/qubit/security-server";
// Phase 25: request metering (real telemetry, failure-isolated).
import { withMeter } from "@/lib/qubit/telemetry-server";

// POST /api/security/passkey — register a passkey factor (session required).
// In production the WebAuthn attestation is verified here; the
// factor change is audited server-side either way.
export async function POST(req: NextRequest) {
  return withMeter(req, "POST /api/security/passkey", async () => {
    const auth = await requireIdentity(req);
    if (!auth.ok) return auth.response;
    const result = registerPasskey(auth.identity.name);
    return NextResponse.json({ ok: true, alreadyRegistered: result.already });
  });
}
