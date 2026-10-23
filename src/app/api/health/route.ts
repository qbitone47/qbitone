import { NextResponse } from "next/server";
import { withMeter } from "@/lib/qubit/telemetry-server";

// ============================================================
// Qubit One — deployment health probe (Phase 24, spec §23).
//
// Public, unauthenticated and deliberately NON-SENSITIVE. It reports
// only process liveness and an anonymous reachability bit for the
// database connection. It never returns credentials, connection
// strings, host names, environment variable values, error text or
// stack traces — the database probe discards every error detail.
//
// Machine-consumed by:
//   - scripts/deploy/smoke-test.ts (CI + post-deployment smoke tests)
//   - the production deployment verification procedure (docs/DEPLOYMENT.md)
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROCESS_STARTED_AT = Date.now();
// Generous on purpose: a serverless cold connect to the Supabase
// pooler can take several seconds. The probe still discards all
// error detail (§23).
const DB_PROBE_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("probe timeout")), ms)),
  ]);
}

async function databaseCheck(): Promise<{
  status: "connected" | "unavailable";
  latencyMs: number | null;
}> {
  const started = Date.now();
  try {
    const { db } = await import("@/lib/db");
    await withTimeout(db.$queryRaw`SELECT 1`, DB_PROBE_TIMEOUT_MS);
    return { status: "connected", latencyMs: Date.now() - started };
  } catch {
    // Error details are intentionally discarded (§23 — no internal info).
    return { status: "unavailable", latencyMs: null };
  }
}

export async function GET() {
  // Phase 25: request metering (real telemetry, failure-isolated). The health
  // handler is parameterless, so a minimal synthetic Request supplies the
  // metering context — every health probe invocation becomes a real
  // availability signal in the telemetry store.
  return withMeter(new Request("http://localhost/api/health", { method: "GET" }), "GET /api/health", async () => {
    const database = await databaseCheck();
    return NextResponse.json(
      {
        // The runtime answering this request IS the application
        // liveness signal; per-dependency state lives under checks.
        status: "ok",
        service: "qubit-one",
        checks: {
          application: "pass",
          database,
        },
        // Vercel injects the deployed commit SHA at runtime; on
        // self-hosted runs there is no such variable and it stays null.
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        uptimeSec: Math.round((Date.now() - PROCESS_STARTED_AT) / 1000),
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
