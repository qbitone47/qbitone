// ============================================================
// Qubit One — Security enforcement store (SERVER ONLY)
// ============================================================
// The frontend is NOT the source of truth. This module is the
// server-side authority for Phase 3: authentication with rate
// limiting and lockout, MFA challenge verification, session
// revocation, policy conflict validation and audit creation.
//
// Import this file ONLY from /api/security route handlers —
// never from client components. State is process-local (demo
// enterprise fixture scale); every mutation writes an audit
// event here, independent of the UI.
// ============================================================

import { employees, employeeName } from "./data";
import {
  DEVICE_SESSIONS,
  NETWORK_POLICIES,
  SECURITY_ALERTS,
  ACCESS_REQUESTS,
  type AccessRequest,
  type NetworkPolicy,
  type PolicyAction,
  type SecurityAlert,
  type UserSession,
} from "./security-data";

// ---------- Deterministic clock (matches security-data) ----------
const NOW = new Date("2026-11-13T09:42:00+05:30").getTime();

// ---------- Seeded PRNG (stable dataset across requests) ----------
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Audit event model ----------
export type AuditResult = "Success" | "Failure" | "Blocked";
export type AuditSeverity = "Info" | "Warning" | "High" | "Critical";

export interface AuditEvent {
  id: string;
  ts: number; // epoch ms relative to demo clock
  time: string; // formatted
  actor: string;
  actorId: string;
  action: string;
  resource: string;
  result: AuditResult;
  severity: AuditSeverity;
  source: string;
  ipMasked: string;
  correlationId: string;
  context: string;
}

const fmt = (ts: number) => {
  const d = new Date(ts);
  const date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date}, ${time}`;
};

const SOURCES = ["Web · Mumbai", "Web · Pune", "SSO · Entra ID", "Mobile app · iOS", "Admin console", "API · service account"];
const IPS = ["103.25.128.•••", "115.240.94.•••", "49.36.180.•••", "157.32.9.•••", "106.201.22.•••"];

interface ActionDef {
  action: string;
  resource: (i: number) => string;
  weight: number; // relative frequency
  result: AuditResult | "mixed";
  severity: (r: AuditResult) => AuditSeverity;
  context: (i: number) => string;
}

const ACTION_DEFS: ActionDef[] = [
  {
    action: "Sign in",
    resource: () => "Qubit One workspace",
    weight: 26,
    result: "mixed",
    severity: (r) => (r === "Success" ? "Info" : "Warning"),
    context: (i) => (i % 3 === 0 ? "Password + authenticator app" : i % 3 === 1 ? "SSO via Microsoft Entra ID" : "Passkey"),
  },
  {
    action: "Sign out",
    resource: () => "Qubit One workspace",
    weight: 12,
    result: "Success",
    severity: () => "Info",
    context: () => "User initiated",
  },
  {
    action: "Failed sign-in",
    resource: () => "Qubit One workspace",
    weight: 9,
    result: "Failure",
    severity: () => "Warning",
    context: (i) => (i % 2 === 0 ? "Incorrect password" : "MFA code rejected"),
  },
  {
    action: "MFA verification",
    resource: () => "Authenticator app",
    weight: 14,
    result: "mixed",
    severity: (r) => (r === "Success" ? "Info" : "Warning"),
    context: (i) => (i % 2 === 0 ? "TOTP code" : "Push approval accepted"),
  },
  {
    action: "MFA factor changed",
    resource: (i) => (i % 2 === 0 ? "Authenticator app" : "Push approval"),
    weight: 3,
    result: "Success",
    severity: () => "High",
    context: () => "Reauthentication required before the change",
  },
  {
    action: "Password changed",
    resource: () => "Account credentials",
    weight: 3,
    result: "Success",
    severity: () => "High",
    context: () => "Other sessions signed out automatically",
  },
  {
    action: "Role changed",
    resource: (i) => `${["Sales Executive", "Accountant", "HR Executive", "Finance Analyst"][i % 4]} assignment`,
    weight: 4,
    result: "Success",
    severity: () => "High",
    context: () => "Approved along reporting line",
  },
  {
    action: "Permission updated",
    resource: (i) => `${["Sales", "Finance", "HR & People", "Inventory"][i % 4]} · ${["Approve", "Export", "Manage"][i % 3]}`,
    weight: 4,
    result: "Success",
    severity: () => "High",
    context: () => "Permission matrix change",
  },
  {
    action: "Access request submitted",
    resource: (i) => `Request req-${110 + (i % 40)}`,
    weight: 6,
    result: "Success",
    severity: () => "Info",
    context: () => "Awaiting approval",
  },
  {
    action: "Access request approved",
    resource: (i) => `Request req-${110 + (i % 40)}`,
    weight: 5,
    result: "Success",
    severity: () => "Info",
    context: () => "Grant expires automatically",
  },
  {
    action: "Access request rejected",
    resource: (i) => `Request req-${110 + (i % 40)}`,
    weight: 3,
    result: "Success",
    severity: () => "Info",
    context: () => "Decision recorded with note",
  },
  {
    action: "Session revoked",
    resource: (i) => `Session ${["sess-21", "sess-34", "sess-08", "sess-16"][i % 4]}`,
    weight: 4,
    result: "Success",
    severity: () => "Warning",
    context: (i) => (i % 2 === 0 ? "Signed out by user" : "Signed out by administrator"),
  },
  {
    action: "Network policy changed",
    resource: (i) => `Policy pol-${String((i % 6) + 1).padStart(2, "0")}`,
    weight: 3,
    result: "Success",
    severity: () => "Critical",
    context: () => "Staged application with conflict check",
  },
  {
    action: "Security setting changed",
    resource: (i) => ["Session lifetime", "MFA enforcement", "Password policy", "Recovery rules"][i % 4],
    weight: 2,
    result: "Success",
    severity: () => "High",
    context: () => "Organization security configuration",
  },
  {
    action: "Sign-in blocked",
    resource: () => "Network policy pol-05",
    weight: 5,
    result: "Blocked",
    severity: () => "Warning",
    context: () => "Source range denied by policy",
  },
  {
    action: "AI query denied",
    resource: () => "Qubit AI · restricted data",
    weight: 4,
    result: "Blocked",
    severity: () => "High",
    context: () => "AI inherits caller permissions — access outside scope denied",
  },
  {
    action: "Sensitive AI action requested",
    resource: (i) => `AI proposal ${["AP-12", "AP-18", "AP-07"][i % 3]}`,
    weight: 2,
    result: "mixed",
    severity: () => "High",
    context: () => "Human approval required before applying",
  },
  {
    action: "Export audit log",
    resource: () => "Audit records (CSV)",
    weight: 2,
    result: "Success",
    severity: () => "Warning",
    context: () => "Export authorized for Security administrator",
  },
];

const TOTAL_WEIGHT = ACTION_DEFS.reduce((s, a) => s + a.weight, 0);
const SPAN_DAYS = 90;
const SEED_TOTAL = 1240;

function buildSeedEvents(): AuditEvent[] {
  const rnd = mulberry32(20261113);
  const events: AuditEvent[] = [];
  let seq = 1000;

  for (let i = 0; i < SEED_TOTAL; i++) {
    // weighted action pick
    let roll = rnd() * TOTAL_WEIGHT;
    let def = ACTION_DEFS[0];
    for (const a of ACTION_DEFS) {
      if (roll < a.weight) {
        def = a;
        break;
      }
      roll -= a.weight;
    }

    // recent events are denser (recency bias)
    const recency = Math.pow(rnd(), 1.6);
    const ts = NOW - Math.floor(recency * SPAN_DAYS * 24 * 3600 * 1000) - Math.floor(rnd() * 3600 * 1000);

    const result: AuditResult = def.result === "mixed" ? (rnd() < 0.82 ? "Success" : "Failure") : def.result;
    const actor = employees[Math.floor(rnd() * employees.length)];

    events.push({
      id: `evt-${seq}`,
      ts,
      time: fmt(ts),
      actor: actor.name,
      actorId: actor.id,
      action: def.action,
      resource: def.resource(i),
      result,
      severity: def.severity(result),
      source: SOURCES[Math.floor(rnd() * SOURCES.length)],
      ipMasked: IPS[Math.floor(rnd() * IPS.length)],
      correlationId: `QB-AUD-2026-${seq}`,
      context: def.context(i),
    });
    seq++;
  }

  events.sort((a, b) => b.ts - a.ts);
  return events;
}

// ---------- Store (process-local singleton) ----------
interface Challenge {
  id: string;
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
  method?: string;
}

interface LoginAttempt {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

interface StoreState {
  seed: AuditEvent[];
  live: AuditEvent[];
  seq: number;
  challenges: Map<string, Challenge>;
  loginAttempts: Map<string, LoginAttempt>;
  lastAuditAccess: number;
  revokedSessions: Set<string>;
  policies: NetworkPolicy[];
  alerts: SecurityAlert[];
  requests: AccessRequest[];
  passkeyAdded: boolean;
}

const g = globalThis as unknown as { __qubitSecurityStore?: StoreState };

function store(): StoreState {
  if (!g.__qubitSecurityStore) {
    g.__qubitSecurityStore = {
      seed: buildSeedEvents(),
      live: [],
      seq: 2000,
      challenges: new Map(),
      loginAttempts: new Map(),
      lastAuditAccess: 0,
      revokedSessions: new Set(),
      policies: NETWORK_POLICIES.map((p) => ({ ...p })),
      alerts: SECURITY_ALERTS.map((a) => ({ ...a })),
      requests: ACCESS_REQUESTS.map((r) => ({ ...r })),
      passkeyAdded: false,
    };
  }
  return g.__qubitSecurityStore;
}

// ---------- Audit writer ----------
export function writeAudit(input: {
  actor?: string;
  actorId?: string;
  action: string;
  resource: string;
  result?: AuditResult;
  severity?: AuditSeverity;
  source?: string;
  context: string;
}): AuditEvent {
  const s = store();
  s.seq += 1;
  const evt: AuditEvent = {
    id: `evt-${s.seq}`,
    ts: Date.now(),
    time: fmt(Date.now()),
    actor: input.actor ?? "Sagar Singh",
    actorId: input.actorId ?? "sagar",
    action: input.action,
    resource: input.resource,
    result: input.result ?? "Success",
    severity: input.severity ?? "Info",
    source: input.source ?? "Web · Mumbai",
    ipMasked: "103.25.128.•••",
    correlationId: `QB-AUD-2026-${s.seq}`,
    context: input.context,
  };
  s.live.unshift(evt);
  if (s.live.length > 200) s.live.pop();
  return evt;
}

// ---------- Rate limiting / lockout ----------
const MAX_FAILURES = 5;
const WINDOW_MS = 10 * 60 * 1000;
const LOCK_MS = 10 * 60 * 1000;

export function checkLockout(email: string): { locked: boolean; retryAfterSec: number } {
  const rec = store().loginAttempts.get(email);
  if (!rec) return { locked: false, retryAfterSec: 0 };
  if (rec.lockedUntil > Date.now()) {
    return { locked: true, retryAfterSec: Math.ceil((rec.lockedUntil - Date.now()) / 1000) };
  }
  return { locked: false, retryAfterSec: 0 };
}

export function recordAuthFailure(email: string): { lockedNow: boolean; remaining: number } {
  const s = store();
  const rec = s.loginAttempts.get(email) ?? { failures: 0, windowStart: Date.now(), lockedUntil: 0 };
  if (Date.now() - rec.windowStart > WINDOW_MS) {
    rec.failures = 0;
    rec.windowStart = Date.now();
  }
  rec.failures += 1;
  let lockedNow = false;
  if (rec.failures >= MAX_FAILURES) {
    rec.lockedUntil = Date.now() + LOCK_MS;
    lockedNow = true;
  }
  s.loginAttempts.set(email, rec);
  return { lockedNow, remaining: Math.max(0, MAX_FAILURES - rec.failures) };
}

export function clearAuthFailures(email: string) {
  store().loginAttempts.delete(email);
}

// ---------- Authentication (password first factor) ----------
export function authenticatePassword(email: string, password: string, simulate?: string) {
  // Server-side validation — never trust the client form.
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) return { ok: false as const, status: 400, code: "invalid_email", message: "Enter a valid work email address." };
  if (!password || password.length < 1)
    return { ok: false as const, status: 400, code: "invalid_password", message: "Enter your password to continue." };

  const lock = checkLockout(email);
  if (lock.locked)
    return {
      ok: false as const,
      status: 429,
      code: "rate_limited",
      message: `Too many attempts. Try again in ${Math.ceil(lock.retryAfterSec / 60)} minutes.`,
      retryAfterSec: lock.retryAfterSec,
    };

  // Demo failure simulations (real deployments derive these from the identity store)
  if (simulate === "invalid-credentials" || (!simulate && password.length < 6 && email.endsWith("@qubitone.in") === false)) {
    const f = recordAuthFailure(email);
    writeAudit({ actor: maskEmail(email), action: "Failed sign-in", resource: "Qubit One workspace", result: "Failure", severity: "Warning", context: "Incorrect password" });
    if (f.lockedNow)
      return { ok: false as const, status: 429, code: "rate_limited", message: "Too many failed attempts. Sign-in is temporarily locked for 10 minutes." };
    return { ok: false as const, status: 401, code: "invalid_credentials", message: "That email or password doesn't match our records." };
  }
  if (simulate === "account-locked")
    return { ok: false as const, status: 423, code: "account_locked", message: "This account is locked. Contact your administrator to restore access." };
  if (simulate === "account-disabled")
    return { ok: false as const, status: 403, code: "account_disabled", message: "This account is no longer active. Contact IT support for help." };
  if (simulate === "rate-limited") {
    recordAuthFailure(email);
    return { ok: false as const, status: 429, code: "rate_limited", message: "Too many attempts. Try again in 10 minutes." };
  }
  if (simulate === "network-failure")
    return { ok: false as const, status: 503, code: "network", message: "You appear to be offline. Check your connection and try again." };
  if (simulate === "service-unavailable")
    return { ok: false as const, status: 503, code: "auth_service_unavailable", message: "The authentication service is temporarily unavailable. Your credentials were not verified — please try again." };

  // Success → MFA challenge
  clearAuthFailures(email);
  const s = store();
  const challengeId = `chl-${s.seq + 1}`;
  const code = String(Math.floor(100000 + Math.random() * 900000));
  s.challenges.set(challengeId, {
    id: challengeId,
    email,
    code,
    expiresAt: Date.now() + 5 * 60 * 1000,
    attempts: 0,
  });
  writeAudit({
    actor: resolveActorName(email),
    action: "Sign in",
    resource: "Qubit One workspace",
    result: "Success",
    severity: "Info",
    context: "Password + MFA challenge issued",
  });
  return {
    ok: true as const,
    next: "mfa" as const,
    challengeId,
    maskedEmail: maskEmail(email),
    expiresInSeconds: 300,
    methods: ["authenticator-app", "push", "passkey", "recovery-code"],
  };
}

function resolveActorName(email: string): string {
  const emp = employees.find((e) => e.email === email);
  return emp?.name ?? maskEmail(email);
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const maskedUser = user.length <= 2 ? `${user[0] ?? ""}•••` : `${user[0]}•••${user[user.length - 1]}`;
  return `${maskedUser}@${domain}`;
}

// ---------- MFA verification ----------
export function verifyMfa(challengeId: string, code: string, method: string, simulate?: string) {
  const s = store();
  const ch = s.challenges.get(challengeId);
  if (!ch) return { ok: false as const, status: 410, code: "challenge_missing", message: "This verification request no longer exists. Start again from sign-in." };
  if (simulate === "expired" || ch.expiresAt < Date.now()) {
    s.challenges.delete(challengeId);
    writeAudit({ actor: resolveActorName(ch.email), action: "MFA verification", resource: "Verification challenge", result: "Failure", severity: "Warning", context: "Challenge expired before completion" });
    return { ok: false as const, status: 410, code: "expired", message: "This verification request expired. Request a new one to continue." };
  }
  if (simulate === "too-many-attempts" || ch.attempts >= 2) {
    s.challenges.delete(challengeId);
    writeAudit({ actor: resolveActorName(ch.email), action: "MFA verification", resource: "Verification challenge", result: "Blocked", severity: "High", context: "Too many failed attempts — challenge invalidated" });
    return { ok: false as const, status: 429, code: "too_many_attempts", message: "Too many incorrect attempts. For safety, start the sign-in again." };
  }

  const codeOk = simulate === "invalid-code" || code === "000000" ? false : /^\d{6}$/.test(code) || /^[A-Z0-9-]{6,}$/i.test(code);
  if (!codeOk) {
    ch.attempts += 1;
    writeAudit({ actor: resolveActorName(ch.email), action: "MFA verification", resource: "Verification challenge", result: "Failure", severity: "Warning", context: "Invalid verification code" });
    const remaining = Math.max(0, 3 - ch.attempts);
    return { ok: false as const, status: 401, code: "invalid_code", message: "That code isn't correct. Check your authenticator and try again.", attemptsRemaining: remaining };
  }

  s.challenges.delete(challengeId);
  writeAudit({
    actor: resolveActorName(ch.email),
    action: "MFA verification",
    resource: method === "recovery-code" ? "Recovery code" : method === "push" ? "Push approval" : "Authenticator app",
    result: "Success",
    severity: "Info",
    context: method === "recovery-code" ? "Single-use recovery code consumed" : "Second factor verified",
  });
  return { ok: true as const, maskedEmail: maskEmail(ch.email) };
}

// ---------- Sessions ----------
export function listSessions(): UserSession[] {
  const s = store();
  return DEVICE_SESSIONS.map((sess) =>
    s.revokedSessions.has(sess.id) && sess.status === "Active" ? { ...sess, status: "Revoked" as const, note: "Signed out by you just now" } : { ...sess },
  );
}

export function revokeSession(sessionId: string | null, all: boolean, actor: string) {
  const s = store();
  const sessions = DEVICE_SESSIONS;
  let count = 0;
  for (const sess of sessions) {
    if (sess.current) continue;
    if (all && sess.status === "Active") {
      s.revokedSessions.add(sess.id);
      count++;
    } else if (!all && sess.id === sessionId && sess.status === "Active") {
      s.revokedSessions.add(sess.id);
      count++;
    }
  }
  if (count > 0) {
    writeAudit({
      actor,
      action: "Session revoked",
      resource: all ? "All other sessions" : `Session ${sessionId}`,
      result: "Success",
      severity: "Warning",
      context: all ? "Sign out everywhere initiated by user" : "Signed out by user after review",
    });
  }
  return { ok: true as const, revoked: count };
}

// ---------- Password ----------
export function changePassword(current: string, next: string) {
  if (!current) return { ok: false as const, status: 401, code: "reauth_required", message: "Confirm your current password to continue." };
  if (next === current) return { ok: false as const, status: 422, code: "password_reused", message: "Your new password must be different from your current password." };
  if (next.length < 12 || !/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/\d/.test(next))
    return {
      ok: false as const,
      status: 422,
      code: "password_policy",
      message: "Password doesn't meet the organization policy yet (12+ characters, mixed case and a number).",
    };
  writeAudit({
    action: "Password changed",
    resource: "Account credentials",
    result: "Success",
    severity: "High",
    context: "Changed after reauthentication · other sessions signed out",
  });
  return { ok: true as const };
}

// ---------- Access requests ----------
export function submitAccessRequest(input: { roleId: string; roleName: string; justification: string; duration: string; risk: string; actor: string }) {
  if (input.justification.trim().length < 30)
    return { ok: false as const, status: 422, code: "justification_too_short", message: "Add a business justification of at least 30 characters — approvers rely on it." };
  const s = store();
  s.seq += 1;
  const req: AccessRequest = {
    id: `req-${120 + s.requests.length}`,
    requestedRole: input.roleName,
    department: "Requested grant",
    permissions: [],
    justification: input.justification.trim(),
    approver: "Role owner",
    approverTitle: "Approval per matrix",
    approvalPath: ["Requester", "Reporting manager", "Role owner", ...(input.risk === "High" ? ["Security review (high risk)"] : [])],
    risk: (input.risk as AccessRequest["risk"]) ?? "Medium",
    status: "Pending Approval",
    submitted: fmt(Date.now()),
    reviewBy: fmt(Date.now() + 2 * 24 * 3600 * 1000).split(",")[0],
    duration: input.duration,
  };
  s.requests.unshift(req);
  writeAudit({
    actor: input.actor,
    action: "Access request submitted",
    resource: `Request ${req.id} · ${input.roleName}`,
    result: "Success",
    severity: input.risk === "High" ? "Warning" : "Info",
    context: `Evaluated server-side · duration ${input.duration}`,
  });
  return { ok: true as const, request: req };
}

export function listAccessRequests(): AccessRequest[] {
  return store().requests.map((r) => ({ ...r }));
}

// ---------- Network policies ----------
const CIDR_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;

function cidrRange(cidr: string): { start: number; end: number; bits: number } | null {
  const m = CIDR_RE.exec(cidr.trim());
  if (!m) return null;
  const octets = [1, 2, 3, 4].map((i) => Number(m[i]));
  if (octets.some((o) => o > 255)) return null;
  const bits = Number(m[5]);
  if (bits > 32) return null;
  const ip = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  const start = (ip & mask) >>> 0;
  const end = (start | (~mask >>> 0)) >>> 0;
  return { start, end, bits };
}

export function validatePolicy(input: { name: string; cidr: string; action: PolicyAction; scope: string; environment: string }) {
  if (!input.name.trim()) return { ok: false as const, status: 422, code: "name_required", message: "Give the policy a descriptive name." };
  const range = cidrRange(input.cidr);
  if (!range) return { ok: false as const, status: 422, code: "invalid_cidr", message: "Enter a valid IPv4 range in CIDR notation, e.g. 103.25.128.0/22." };

  const conflicts: string[] = [];
  for (const p of store().policies) {
    if (p.status === "Disabled" || p.status === "Draft") continue;
    const other = cidrRange(p.cidr);
    if (!other) continue;
    const overlaps = range.start <= other.end && other.start <= range.end;
    if (overlaps && p.action !== input.action) {
      conflicts.push(`${p.name} (${p.cidr}) — ${p.action} at priority ${p.priority}`);
    }
  }

  const broad = range.bits <= 8;
  const selfLockout = input.action === "Deny" && range.start <= (cidrRange("103.25.128.0/22")!.start) && (cidrRange("103.25.128.0/22")!.end) <= range.end;
  return { ok: true as const, conflicts, broad, selfLockout, bits: range.bits };
}

export function createPolicy(input: { name: string; cidr: string; action: PolicyAction; scope: string; environment: string; priority: number; actor: string }) {
  const v = validatePolicy(input);
  if (!v.ok) return v;
  if (v.selfLockout)
    return { ok: false as const, status: 409, code: "self_lockout", message: "This rule would deny your own office range and lock out your session. Add an Allow rule for the office first." };
  if (v.conflicts.length > 0)
    return { ok: false as const, status: 409, code: "conflicts", message: "This range overlaps existing policies with different actions.", conflicts: v.conflicts };

  const s = store();
  const policy: NetworkPolicy = {
    id: `pol-${String(s.policies.length + 1).padStart(2, "0")}`,
    name: input.name.trim(),
    scope: input.scope,
    cidr: input.cidr.trim(),
    environment: (input.environment as NetworkPolicy["environment"]) ?? "Production",
    affected: input.action === "Deny" ? "0 users" : "All users in scope",
    action: input.action,
    priority: input.priority,
    status: "Active",
    createdBy: input.actor,
    lastModified: fmt(Date.now()).split(",")[0],
    effective: fmt(Date.now()).split(",")[0],
    note: "Staged, conflict-checked and applied with full audit trail.",
  };
  s.policies.unshift(policy);
  writeAudit({
    actor: input.actor,
    action: "Network policy changed",
    resource: `Policy ${policy.id} · ${policy.name}`,
    result: "Success",
    severity: "Critical",
    context: `${input.action} ${input.cidr} · conflict check passed · staged & applied`,
  });
  return { ok: true as const, policy };
}

export function listPolicies(): NetworkPolicy[] {
  return store().policies.map((p) => ({ ...p }));
}

// ---------- Alerts ----------
export function listAlerts(role: string): SecurityAlert[] {
  const s = store();
  // Organization-scope alerts require the security administrator boundary.
  return s.alerts.filter((a) => a.scope === "personal" || role === "administrator");
}

export function updateAlert(id: string, action: "acknowledge" | "resolve", actor: string) {
  const s = store();
  const alert = s.alerts.find((a) => a.id === id);
  if (!alert) return { ok: false as const, status: 404, code: "not_found", message: "That alert no longer exists." };
  alert.status = action === "resolve" ? "Resolved" : "Acknowledged";
  writeAudit({
    actor,
    action: "Security setting changed",
    resource: `Alert ${alert.id} · ${alert.title}`,
    result: "Success",
    severity: "Info",
    context: `Alert ${action === "resolve" ? "resolved" : "acknowledged"} by ${actor}`,
  });
  return { ok: true as const, alert };
}

// ---------- Audit log access ----------
export interface AuditQuery {
  query?: string;
  severity?: string;
  result?: string;
  action?: string;
  actor?: string;
  range?: string;
  page?: number;
  pageSize?: number;
}

export function queryAudit(q: AuditQuery, viewerRole: string, viewerId: string) {
  const s = store();
  const all = [...s.live, ...s.seed];

  // Non-admin viewers are restricted to their own activity (server-enforced).
  const scoped = viewerRole === "administrator" ? all : all.filter((e) => e.actorId === viewerId);

  // Viewing audit records is itself audited — debounced to one event per 5 minutes.
  if (Date.now() - s.lastAuditAccess > 5 * 60 * 1000) {
    s.lastAuditAccess = Date.now();
    writeAudit({
      actor: employeeName(viewerId) || "Sagar Singh",
      action: "Security setting changed",
      resource: "Audit log accessed",
      result: "Success",
      severity: "Info",
      context: viewerRole === "administrator" ? "Organization-wide audit view" : "Personal activity view",
    });
  }

  const query = (q.query ?? "").trim().toLowerCase();
  const rangeMs = q.range === "24h" ? 24 * 3600e3 : q.range === "7d" ? 7 * 864e5 : q.range === "30d" ? 30 * 864e5 : q.range === "90d" ? 90 * 864e5 : 0;

  const filtered = scoped.filter((e) => {
    if (q.severity && q.severity !== "all" && e.severity !== q.severity) return false;
    if (q.result && q.result !== "all" && e.result !== q.result) return false;
    if (q.action && q.action !== "all" && e.action !== q.action) return false;
    if (q.actor && q.actor !== "all" && e.actor !== q.actor) return false;
    if (rangeMs && e.ts < NOW - rangeMs) return false;
    if (query) {
      const hay = `${e.actor} ${e.action} ${e.resource} ${e.correlationId} ${e.source} ${e.context}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, q.pageSize ?? 12));
  const total = filtered.length;
  const events = filtered.slice((page - 1) * pageSize, page * pageSize);

  return {
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    restricted: viewerRole !== "administrator",
    events,
  };
}

export function auditCsv(viewerRole: string): string | null {
  if (viewerRole !== "administrator") return null; // export is privileged
  const s = store();
  const all = [...s.live, ...s.seed].slice(0, 400);
  const header = "timestamp,actor,action,resource,result,severity,source,ip,correlation_id";
  const rows = all.map((e) => [e.time, e.actor, e.action, e.resource, e.result, e.severity, e.source, e.ipMasked, e.correlationId].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  writeAudit({ action: "Export audit log", resource: "Audit records (CSV)", result: "Success", severity: "Warning", context: `Exported ${all.length} records` });
  return [header, ...rows].join("\n");
}

// ---------- Passkey registration (Security Center) ----------
export function registerPasskey(actor: string) {
  const s = store();
  if (s.passkeyAdded) return { ok: true as const, already: true };
  s.passkeyAdded = true;
  writeAudit({ actor, action: "MFA factor changed", resource: "Passkey", result: "Success", severity: "High", context: "Passkey registered after reauthentication" });
  return { ok: true as const, already: false };
}
