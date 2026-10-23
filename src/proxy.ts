import { NextRequest, NextResponse } from "next/server";

// ============================================================
// Qubit One — edge proxy (Phase 21: §12 CSRF, §31 security headers,
// §9 request-size guard). Runs on the default edge runtime and is
// deliberately crypto-free: all session cryptography lives in the
// Node route handlers (auth-server.ts).
// ============================================================

const MAX_API_BODY_BYTES = 1_048_576; // 1 MiB — API payloads here are JSON documents, not uploads

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api");
  const mutating = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";

  if (isApi && mutating) {
    // CSRF defense-in-depth: browsers advertise the request's site;
    // cross-site state-changing calls are rejected outright (the
    // session cookie is SameSite=Strict as the primary control).
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "same-site" && site !== "none") {
      return NextResponse.json(
        { code: "origin_rejected", message: "Cross-site state-changing requests are not allowed." },
        { status: 403 },
      );
    }
    const origin = req.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.get("host")) {
          return NextResponse.json(
            { code: "origin_rejected", message: "Request origin does not match the serving host." },
            { status: 403 },
          );
        }
      } catch {
        return NextResponse.json(
          { code: "origin_rejected", message: "Malformed Origin header." },
          { status: 403 },
        );
      }
    }
    // Request-size guard for JSON APIs (uploads do not exist yet —
    // metadata-only, verified by the Phase 21 audit).
    const len = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(len) && len > MAX_API_BODY_BYTES) {
      return NextResponse.json(
        { code: "payload_too_large", message: "Request body exceeds the 1 MiB limit." },
        { status: 413 },
      );
    }
  }

  // Phase 25 (§10 correlation): assign a request id to EVERY request
  // (honouring an inbound one), propagate it to route handlers via the
  // request headers and echo it on the response. API metering reads the
  // same id so error → request → deployment correlation is possible.
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("x-request-id", requestId);

  // Security headers on every response (§31). Chosen to be compatible
  // with the Next.js runtime — no script-src/style-src restrictions that
  // would break the framework's inline bootstrap in dev.
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), payment=(), usb=(), interest-cohort=()");
  res.headers.set("Content-Security-Policy", "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'");
  if (req.headers.get("x-forwarded-proto") === "https") {
    // Only meaningful (and only sent) on HTTPS transports — never breaks the http sandbox.
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
