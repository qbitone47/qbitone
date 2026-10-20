// ============================================================
// Qubit One — Session identity plane (SERVER ONLY, Phase 21)
// ============================================================
// Security does not depend on the frontend. API routes NEVER
// trust a client-declared role: the acting identity is derived
// from a signed, expiring, revocable session token issued by
// POST /api/auth/session and carried in an httpOnly cookie
// (Authorization: Bearer is accepted for service/probe clients).
//
// Demo boundary (documented, not hidden): this deployment runs
// the product's role-preview model — the demo identity "sagar"
// may assume the five product roles through the authenticated
// session endpoint. Role membership is validated SERVER-SIDE
// against this directory on every issue and every resolve.
//
// Import ONLY from route handlers / server modules — never from
// client components. Uses WebCrypto so the same code can run in
// any server runtime; no secret is ever hardcoded in source.
// ============================================================

import { NextRequest, NextResponse } from "next/server";

// ---------- Role model (mirrors the product's role registry) ----------
export type QubitRole = "administrator" | "dept-head" | "sales-exec" | "hr-manager" | "employee";

export const QUBIT_ROLES: QubitRole[] = [
  "administrator",
  "dept-head",
  "sales-exec",
  "hr-manager",
  "employee",
];

/** Server-side identity directory: which roles each principal may hold. */
const IDENTITY_DIRECTORY: Record<string, { name: string; email: string; roles: QubitRole[] }> = {
  sagar: {
    name: "Sagar Singh",
    email: "sagar@qubitone.in",
    roles: QUBIT_ROLES,
  },
};

export const SESSION_USER_ID = "sagar";

export interface QubitIdentity {
  userId: string;
  name: string;
  email: string;
  role: QubitRole;
  sessionId: string;
}

// ---------- Token cryptography (WebCrypto, no hardcoded secrets) ----------
const TOKEN_VERSION = "v1";
export const SESSION_COOKIE = "qubit_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h absolute timeout (§4)

const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(text: string): Uint8Array {
  const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * Signing secret: taken from QUBIT_AUTH_SECRET when the deployment
 * provides one; otherwise generated once with a CSPRNG and persisted
 * to db/.auth-secret (gitignored, outside source control, readable
 * only by the server process). Never committed, never shipped to the
 * browser (§18 Secrets Management).
 */
async function getSigningSecret(): Promise<string> {
  const g = globalThis as unknown as { __qubitAuthSecret?: string };
  if (g.__qubitAuthSecret) return g.__qubitAuthSecret;

  let secret: string | undefined;
  if (process.env.QUBIT_AUTH_SECRET && process.env.QUBIT_AUTH_SECRET.length >= 32) {
    secret = process.env.QUBIT_AUTH_SECRET;
  } else {
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const file = path.join(process.cwd(), "db", ".auth-secret");
      if (fs.existsSync(file)) {
        const stored = fs.readFileSync(file, "utf8").trim();
        if (stored.length >= 32) secret = stored;
      }
      if (!secret) {
        const raw = new Uint8Array(32);
        crypto.getRandomValues(raw);
        secret = Array.from(raw)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, secret, { mode: 0o600 });
      }
    } catch {
      // Filesystem unavailable — fall back to a per-process CSPRNG secret.
      const raw = new Uint8Array(32);
      crypto.getRandomValues(raw);
      secret = Array.from(raw)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  }
  g.__qubitAuthSecret = secret;
  return secret;
}

// ---------- Session registry (revocation-aware, process-local) ----------
interface SessionRecord {
  sessionId: string;
  userId: string;
  role: QubitRole;
  issuedAt: number;
  expiresAt: number;
  lastSeen: number;
  revoked: boolean;
  source: string;
}

const g = globalThis as unknown as { __qubitAuthSessions?: Map<string, SessionRecord> };

function sessions(): Map<string, SessionRecord> {
  if (!g.__qubitAuthSessions) g.__qubitAuthSessions = new Map();
  return g.__qubitAuthSessions;
}

function pruneSessions() {
  const now = Date.now();
  const map = sessions();
  for (const [sid, rec] of map) {
    if (rec.expiresAt < now || (rec.revoked && now - rec.lastSeen > 60 * 60 * 1000)) map.delete(sid);
  }
}

export interface IssuedSession {
  token: string;
  identity: QubitIdentity;
  expiresAt: number;
}

/** Issue a signed session for a validated (userId, role) pair. */
export async function issueSession(
  userId: string,
  role: QubitRole,
  source = "Web",
): Promise<IssuedSession | { error: "unknown_identity" | "role_not_allowed" }> {
  const dir = IDENTITY_DIRECTORY[userId];
  if (!dir) return { error: "unknown_identity" };
  if (!dir.roles.includes(role)) return { error: "role_not_allowed" };

  pruneSessions();
  const now = Date.now();
  const raw = new Uint8Array(12);
  crypto.getRandomValues(raw);
  const sessionId = `qubs-${Array.from(raw).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  const expiresAt = now + SESSION_TTL_MS;

  const record: SessionRecord = { sessionId, userId, role, issuedAt: now, expiresAt, lastSeen: now, revoked: false, source };
  sessions().set(sessionId, record);

  const payload = b64urlEncode(encoder.encode(JSON.stringify({ v: 1, sid: sessionId, uid: userId, r: role, iat: now, exp: expiresAt })));
  const key = await importHmacKey(await getSigningSecret());
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${TOKEN_VERSION}.${payload}`));

  return {
    token: `${TOKEN_VERSION}.${payload}.${b64urlEncode(new Uint8Array(sig))}`,
    identity: { userId, name: dir.name, email: dir.email, role, sessionId },
    expiresAt,
  };
}

/** Verify a token and resolve the acting identity. Returns null when untrusted. */
export async function verifySessionToken(token: string | undefined | null): Promise<QubitIdentity | null> {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;
  const [, payload, sig] = parts;

  let expected: ArrayBuffer;
  try {
    const key = await importHmacKey(await getSigningSecret());
    expected = await crypto.subtle.sign("HMAC", key, encoder.encode(`${TOKEN_VERSION}.${payload}`));
  } catch {
    return null;
  }
  const given = b64urlDecode(sig);
  const want = new Uint8Array(expected);
  if (given.length !== want.length) return null;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= given[i] ^ want[i]; // constant-time-ish compare
  if (diff !== 0) return null;

  let parsed: { sid?: string; uid?: string; r?: string; exp?: number };
  try {
    parsed = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  } catch {
    return null;
  }
  if (!parsed.sid || !parsed.uid || !parsed.r || typeof parsed.exp !== "number") return null;
  if (parsed.exp < Date.now()) return null; // expired-token reuse blocked (§4)

  const rec = sessions().get(parsed.sid);
  if (!rec || rec.revoked) return null; // revocation is enforced, not cosmetic
  if (rec.expiresAt < Date.now()) return null;

  const dir = IDENTITY_DIRECTORY[parsed.uid];
  if (!dir) return null;
  const role = parsed.r as QubitRole;
  if (!dir.roles.includes(role) || rec.role !== role) return null; // server directory is authoritative

  rec.lastSeen = Date.now();
  return { userId: parsed.uid, name: dir.name, email: dir.email, role, sessionId: parsed.sid };
}

/** Extract the presented token from cookie or Authorization header. */
export function presentedToken(req: NextRequest): string | null {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie) return cookie;
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  return null;
}

/** Resolve the acting identity for an API request, or null when unauthenticated. */
export function resolveIdentity(req: NextRequest): Promise<QubitIdentity | null> {
  return verifySessionToken(presentedToken(req));
}

/**
 * Fail-closed identity gate for route handlers:
 *   const auth = requireIdentity(req);
 *   if (!auth.ok) return auth.response;   // 401 — structured, no internals
 *   const role = auth.identity.role;      // server-derived, never client-sent
 */
export async function requireIdentity(
  req: NextRequest,
): Promise<{ ok: true; identity: QubitIdentity } | { ok: false; response: NextResponse }> {
  const token = presentedToken(req);
  const identity = await verifySessionToken(token);
  if (identity) return { ok: true, identity };

  // Present-but-untrusted tokens are worth one throttled audit line; an
  // absent cookie on first load is normal and is NOT an alarm (§21).
  if (token) {
    const gate = rateLimit(`audit:badtoken:${identity_rate_key(req)}`, 10, 60_000);
    if (gate.allowed) {
      const { writeAudit } = await import("./security-server");
      writeAudit({
        actor: "Unknown",
        actorId: "unauthenticated",
        action: "Invalid session token",
        resource: "API access",
        result: "Blocked",
        severity: "Warning",
        context: "Signature/expiry/revocation check failed — request rejected",
      });
    }
  }
  return {
    ok: false,
    response: NextResponse.json(
      { code: "session_required", message: "No valid session. Sign in or issue a session first." },
      { status: 401 },
    ),
  };
}

function identity_rate_key(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

// ---------- Revocation (§4 — sessions are enforceable, not cosmetic) ----------
export function revokeAuthSessions(opts: { sessionId?: string | null; allForUser?: string; except?: string }): number {
  const map = sessions();
  let n = 0;
  for (const [sid, rec] of map) {
    if (rec.revoked) continue;
    if (opts.except && sid === opts.except) continue;
    if ((opts.sessionId && sid === opts.sessionId) || (opts.allForUser && rec.userId === opts.allForUser)) {
      rec.revoked = true;
      rec.lastSeen = Date.now();
      n += 1;
    }
  }
  return n;
}

export function listAuthSessions(userId?: string): Array<{
  sessionId: string;
  role: QubitRole;
  issuedAt: number;
  expiresAt: number;
  lastSeen: number;
  source: string;
  current: boolean;
}> {
  pruneSessions();
  const now = Date.now();
  const out: Array<{ sessionId: string; role: QubitRole; issuedAt: number; expiresAt: number; lastSeen: number; source: string; current: boolean }> = [];
  for (const rec of sessions().values()) {
    if (rec.revoked || rec.expiresAt < now) continue;
    if (userId && rec.userId !== userId) continue;
    out.push({ sessionId: rec.sessionId, role: rec.role, issuedAt: rec.issuedAt, expiresAt: rec.expiresAt, lastSeen: rec.lastSeen, source: rec.source, current: false });
  }
  return out.sort((a, b) => b.issuedAt - a.issuedAt);
}

/** Mark which of the listed sessions matches the presented token (for UIs). */
export async function withCurrentFlag(req: NextRequest, list: ReturnType<typeof listAuthSessions>) {
  const identity = await resolveIdentity(req);
  if (!identity) return list;
  return list.map((s) => (s.sessionId === identity.sessionId ? { ...s, current: true } : s));
}

// ---------- Rate limiting (§22) ----------
interface RateEntry {
  count: number;
  windowStart: number;
}
const gRate = globalThis as unknown as { __qubitRateLimiter?: Map<string, RateEntry> };

function rateMap(): Map<string, RateEntry> {
  if (!gRate.__qubitRateLimiter) gRate.__qubitRateLimiter = new Map();
  return gRate.__qubitRateLimiter;
}

/**
 * Fixed-window limiter. Generous by design — it must not break normal
 * enterprise workflows (§22); it exists to blunt abuse of expensive or
 * enumeration-prone endpoints (AI, search, exports, session issuance).
 */
export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const map = rateMap();
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    map.set(key, { count: 1, windowStart: now });
    if (map.size > 5000) {
      for (const [k, v] of map) if (now - v.windowStart >= windowMs) map.delete(k);
    }
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  entry.count += 1;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((entry.windowStart + windowMs - now) / 1000)) };
  }
  return { allowed: true, remaining: Math.max(0, limit - entry.count), retryAfterSec: 0 };
}

/** Named limit profiles used by routes (single place to tune). */
export const RATE_PROFILES = {
  sessionIssue: { limit: 60, windowMs: 60_000 },
  search: { limit: 90, windowMs: 60_000 },
  ai: { limit: 30, windowMs: 60_000 },
  export: { limit: 12, windowMs: 60_000 },
  genericWrite: { limit: 240, windowMs: 60_000 },
} as const;

/** Standard 429 response with Retry-After (no internals leaked, §33). */
export function tooManyRequests(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { code: "rate_limited", message: `Too many requests. Try again in ${retryAfterSec} second${retryAfterSec === 1 ? "" : "s"}.` },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

// ---------- CSRF / origin checks (§12) ----------
/**
 * For cookie-authenticated state-changing requests, verify the request
 * origin when the browser provides one. Non-browser clients (curl,
 * service accounts) send no Origin and are unaffected. SameSite=Strict
 * on the session cookie is the primary control; this is defense-in-depth.
 */
export function originAllowed(req: NextRequest): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "same-site" && site !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const host = req.headers.get("host");
    return !!host && originHost === host;
  } catch {
    return false;
  }
}

export function forbiddenOriginResponse(): NextResponse {
  return NextResponse.json(
    { code: "origin_rejected", message: "Request origin is not allowed for this operation." },
    { status: 403 },
  );
}

// ---------- Session cookie composition ----------
export function sessionCookieParams(expiresAt: number, req: NextRequest) {
  const isHttps = req.headers.get("x-forwarded-proto") === "https";
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: isHttps, // over plain-http sandbox transport the cookie must still work; HTTPS deployments get Secure automatically
    path: "/",
    maxAge: Math.max(60, Math.floor((expiresAt - Date.now()) / 1000)),
  };
}

// ---------- Shared input guards (§10) ----------
/** Reject oversized JSON payloads early (defense-in-depth; proxy enforces too). */
export function bodyTooLarge(req: NextRequest, maxBytes = 1_048_576): boolean {
  const len = Number(req.headers.get("content-length") ?? "0");
  return Number.isFinite(len) && len > maxBytes;
}

/** Bounded string: trims, enforces a max length, returns null when empty. */
export function boundedString(v: unknown, maxLen: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > maxLen) return null;
  return t;
}
