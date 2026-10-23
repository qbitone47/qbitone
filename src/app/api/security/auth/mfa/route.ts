import { NextRequest, NextResponse } from "next/server";
import { verifyMfa } from "@/lib/qubit/security-server";
// Phase 25: request metering (real telemetry, failure-isolated).
import { withMeter } from "@/lib/qubit/telemetry-server";

// POST /api/security/auth/mfa — second authentication factor.
// Attempts are counted server-side; three failures invalidate the
// challenge so MFA cannot be brute-forced from the client.
export async function POST(req: NextRequest) {
  return withMeter(req, "POST /api/security/auth/mfa", async () => {
    let body: { challengeId?: string; code?: string; method?: string; simulate?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
    }

    const result = verifyMfa(body.challengeId ?? "", (body.code ?? "").trim(), body.method ?? "authenticator-app", body.simulate);
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    return NextResponse.json(result);
  });
}
