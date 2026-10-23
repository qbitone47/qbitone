#!/usr/bin/env bun
// ============================================================
// Qubit One — post-deployment smoke tests (Phase 24, spec §22/§35).
//
// Exercises the critical flows against a RUNNING deployment using
// the application's real routes only (no invented endpoints):
//   home · liveness · health · session bootstrap · authorization
//   enforcement · authenticated API · security headers · 404
//   handling · static assets · secret-leakage scan.
//
// Usage:
//   bun scripts/deploy/smoke-test.ts [BASE_URL] [--strict-db]
//     BASE_URL    default http://localhost:3000
//     --strict-db additionally FAIL if /api/health reports the
//                 database as not connected (used in CI and for
//                 production verification where the DB must be up)
//
// Every check asserts observed HTTP behavior. A check that cannot
// run reports FAIL with the reason — never a fabricated PASS (§37).
// Exit codes: 0 = all PASS · 1 = at least one FAIL.
// ============================================================

// Module marker: keeps top-level await valid under the project's
// strict TypeScript configuration (this file is run by Bun, not imported).
export {};

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const STRICT_DB = process.argv.includes("--strict-db");
const REQUEST_TIMEOUT_MS = 15_000;

const SECRET_MARKERS =
  /sbp_[a-f0-9]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|InNlcnZpY2Vfcm9sZSI6|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{22,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----/g;

let sessionCookie: string | null = null;

interface Result {
  id: string;
  name: string;
  status: "PASS" | "FAIL";
  detail: string;
}

const results: Result[] = [];

async function req(path: string, init?: RequestInit): Promise<Response> {
  return fetch(BASE + path, {
    ...init,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function check(id: string, name: string, fn: () => Promise<string>): Promise<void> {
  try {
    const detail = await fn();
    results.push({ id, name, status: "PASS", detail });
  } catch (err) {
    results.push({ id, name, status: "FAIL", detail: err instanceof Error ? err.message : String(err) });
  }
}

const bodies = new Map<string, string>(); // path → response body (for the leak scan)

await check("home", "Application loads (GET /)", async () => {
  const res = await req("/");
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const body = await res.text();
  bodies.set("/", body);
  assert(body.includes("Qubit One"), "server-rendered markup does not contain the application marker");
  return `HTTP 200, ${body.length} bytes`;
});

await check("liveness", "API liveness (GET /api)", async () => {
  const res = await req("/api");
  assert(res.status === 200, `expected 200, got ${res.status}`);
  bodies.set("/api", await res.text());
  return "HTTP 200";
});

await check("health", "Health endpoint (GET /api/health)", async () => {
  const res = await req("/api/health");
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const body = await res.text();
  bodies.set("/api/health", body);
  const json = JSON.parse(body) as {
    status?: string;
    checks?: { application?: string; database?: { status?: string } };
  };
  assert(json.status === "ok", `health status is "${json.status}"`);
  assert(json.checks?.application === "pass", "application check is not pass");
  const dbStatus = json.checks?.database?.status ?? "missing";
  if (STRICT_DB) {
    assert(dbStatus === "connected", `database check is "${dbStatus}" but --strict-db requires "connected"`);
  }
  return `database=${dbStatus}${STRICT_DB ? " (strict)" : " (reported only)"}`;
});

await check("session-issue", "Session bootstrap (POST /api/auth/session)", async () => {
  const res = await req("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "administrator" }),
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const setCookies = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie") ?? ""].filter(Boolean);
  const cookieLine = setCookies.find((c) => c.startsWith("qubit_session="));
  assert(cookieLine, "no qubit_session cookie was issued");
  sessionCookie = cookieLine!.split(";")[0];
  return "signed session cookie issued";
});

await check("authz-enforced", "Authorization enforced (GET /api/platform without session)", async () => {
  const res = await req("/api/platform");
  assert(res.status === 401, `expected 401 for an unauthenticated protected API, got ${res.status}`);
  return "protected API answered 401 without a session (healthy behavior)";
});

await check("authenticated-api", "Authenticated API round-trip (GET /api/platform?section=status)", async () => {
  const cookie = sessionCookie;
  if (!cookie) throw new Error("no session cookie from the bootstrap step — cannot test the authenticated path");
  const res = await req("/api/platform?section=status", { headers: { Cookie: cookie } });
  assert(res.status === 200, `expected 200 with a session, got ${res.status}`);
  const body = await res.text();
  assert(body.trim().startsWith("{"), "response is not a JSON payload");
  return "live payload returned with the session cookie";
});

await check("security-headers", "Security headers on GET /", async () => {
  const res = await req("/");
  const xfo = res.headers.get("x-frame-options");
  const xcto = res.headers.get("x-content-type-options");
  assert(xfo === "DENY", `x-frame-options is "${xfo}", expected DENY`);
  assert(xcto === "nosniff", `x-content-type-options is "${xcto}", expected nosniff`);
  return `x-frame-options=${xfo}, x-content-type-options=${xcto}`;
});

await check("not-found", "404 handling (GET /qubit-nonexistent-route)", async () => {
  const res = await req("/qubit-nonexistent-route");
  assert(res.status === 404, `expected 404 for an unknown route, got ${res.status}`);
  return "unknown routes answer 404";
});

await check("static-asset", "Static assets served (GET /logo.svg)", async () => {
  const res = await req("/logo.svg");
  assert(res.status === 200, `expected 200, got ${res.status}`);
  return "HTTP 200";
});

await check("no-secret-leakage", "No secret markers in served content", async () => {
  assert(bodies.size > 0, "no responses captured — earlier checks failed");
  const dbUrl = process.env.DATABASE_URL;
  const offenders: string[] = [];
  for (const [path, body] of bodies) {
    SECRET_MARKERS.lastIndex = 0;
    if (SECRET_MARKERS.test(body)) offenders.push(`${path} (credential-shaped marker)`);
    if (dbUrl && body.includes(dbUrl)) offenders.push(`${path} (DATABASE_URL value)`);
  }
  assert(offenders.length === 0, `secret markers found in: ${offenders.join(", ")}`);
  return `${bodies.size} response bodies scanned, none contain credential markers`;
});

const pass = results.filter((r) => r.status === "PASS").length;
const fail = results.length - pass;

const width = Math.max(...results.map((r) => r.name.length));
console.log(`\nSmoke tests → ${BASE}`);
for (const r of results) {
  const mark = r.status === "PASS" ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${r.name.padEnd(width)} — ${r.detail}`);
}
console.log(`\nSMOKE RESULT: ${pass} PASS / ${fail} FAIL${STRICT_DB ? " (strict-db)" : ""}`);
process.exit(fail > 0 ? 1 : 0);
