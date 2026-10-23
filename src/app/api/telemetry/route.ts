import { NextRequest, NextResponse } from "next/server";
import { ingestClientEvents } from "@/lib/qubit/telemetry-server";

// ============================================================
// Qubit One — Phase 25 · Client telemetry ingestion (POST /api/telemetry).
//
// Receives REAL browser observations from the Qubit One client
// collector: web vitals (LCP/CLS/TTFB/FCP/INP approximation),
// JavaScript errors, screen transitions and client-observed API
// request outcomes. Nothing here is simulated; the server-side
// validator enforces the field allowlist, numeric ranges, batch
// caps and per-client rate limits — identity-bearing fields are
// ignored BY CONSTRUCTION (spec §18 privacy: no PII accepted).
//
// Deliberately session-free (login screens also report), defended
// by: strict shape validation, hard size caps, per-client rate
// limiting, server-side sampling and the same origin checks the
// proxy applies to every mutating API call.
// ============================================================

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Body must be JSON." }, { status: 400 });
  }
  const events = (body as { events?: unknown } | null)?.events;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const clientKey = `${ip}:${req.headers.get("user-agent")?.slice(0, 40) ?? "unknown"}`;
  const result = ingestClientEvents(events, clientKey);
  if (result.reason === "Rate limited.") {
    return NextResponse.json({ code: "rate_limited", message: "Too many telemetry batches from this client." }, { status: 429 });
  }
  return NextResponse.json({ ok: true, ...result }, { status: 202 });
}

export function GET() {
  return NextResponse.json({ code: "method_not_allowed", message: "POST a { events: [...] } batch." }, { status: 405 });
}
