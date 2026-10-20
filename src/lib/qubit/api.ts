// ============================================================
// Qubit One — typed client for /api/security endpoints.
// Security decisions always come from the server; this helper
// only carries intent and surfaces structured failures.
//
// Phase 21: every call is gated by a server-issued session.
// The browser holds an httpOnly, SameSite=Strict session cookie
// signed by the server — API routes derive the acting identity
// from that cookie and NEVER from a client-declared role. The
// X-Qubit-Role header is retained only as a display hint for
// demo tooling; the server ignores it for authorization.
// ============================================================

export class ApiError extends Error {
  status: number;
  code?: string;
  conflicts?: string[];

  constructor(status: number, code: string | undefined, message: string, conflicts?: string[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.conflicts = conflicts;
  }
}

// ---------- Session plane (client gate) ----------
let issuedRole: string | null = null;
let issuing: Promise<void> | null = null;

/**
 * Ensure a valid session cookie exists for the given role. Idempotent;
 * re-issues only when the requested role differs from the last issued
 * one (the role switcher is the single place that changes identity).
 * Non-browser callers and the very first call in a fresh tab bootstrap
 * the default administrator preview, matching the product's initial
 * role context.
 */
export async function ensureSession(role: string = "administrator"): Promise<void> {
  if (issuedRole === role) {
    if (issuing) await issuing;
    return;
  }
  if (!issuing || issuedRole === null) {
    issuing = (async () => {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
        cache: "no-store",
      });
      if (!res.ok) {
        // Leave issuedRole untouched so the next call can retry.
        issuing = null;
        throw new ApiError(res.status, "session_issue_failed", "Could not establish a session.");
      }
      issuedRole = role;
    })();
  }
  try {
    await issuing;
  } finally {
    // Keep the in-flight promise until it settles; reset on failure so
    // the next call re-attempts issuance.
    if (issuing) {
      const settled = issuing;
      issuing = null;
      void settled.catch(() => undefined);
    }
  }
}

/** Force re-issuance on the next call (used after a 401 session_required). */
function invalidateSession() {
  issuedRole = null;
}

function headers(role?: string): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (role) h["X-Qubit-Role"] = role; // display hint only — authorization is cookie-derived server-side
  return h;
}

function isSessionRequired(status: number, code?: string): boolean {
  return status === 401 && (code === "session_required" || code === "session_issue_failed");
}

async function request<T>(path: string, init: RequestInit, basePath: string, role?: string, isRetry = false): Promise<T> {
  try {
    await ensureSession(role ?? (issuedRole ?? undefined) ?? undefined);
  } catch {
    /* fall through — the API call will surface a structured 401 that triggers the heal path */
  }
  const res = await fetch(`${basePath}${path}`, { ...init, cache: "no-store" });
  if (!res.ok) {
    let code: string | undefined;
    let message = `Request failed (${res.status}).`;
    let conflicts: string[] | undefined;
    try {
      const body = await res.json();
      code = body?.code;
      message = body?.message ?? message;
      conflicts = body?.conflicts;
    } catch {
      /* non-JSON failure — keep generic message */
    }
    // Auto-heal: the cookie expired or was revoked server-side — re-issue
    // once and retry once, so an idle tab recovers transparently (§4).
    if (!isRetry && isSessionRequired(res.status, code)) {
      invalidateSession();
      try {
        await ensureSession(role ?? issuedRole ?? "administrator");
      } catch {
        /* rethrow as the original error below */
      }
      return request<T>(path, init, basePath, role, true);
    }
    throw new ApiError(res.status, code, message, conflicts);
  }
  return (await res.json()) as T;
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
  role?: string,
  basePath: string = "/api/security",
): Promise<T> {
  const qs = params
    ? Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  return request<T>(
    `${path}${qs ? `?${qs}` : ""}`,
    { headers: headers(role) },
    basePath,
    role,
  );
}

export function apiPost<T>(path: string, body: unknown, role?: string): Promise<T> {
  return request<T>(
    path,
    { method: "POST", headers: headers(role), body: JSON.stringify(body ?? {}) },
    "/api/security",
    role,
  );
}

export function apiPatch<T>(path: string, body: unknown, role?: string): Promise<T> {
  return request<T>(
    path,
    { method: "PATCH", headers: headers(role), body: JSON.stringify(body ?? {}) },
    "/api/security",
    role,
  );
}

// ---------- authedFetch: session-gated fetch for components that ----------
// ---------- build requests directly (mail, palette, mobile parts) ---------
/**
 * Same-origin fetch with the session gate applied. Use for the handful
 * of components that compose their own request — authorization remains
 * a server-side decision from the session cookie.
 */
export async function authedFetch(input: string, init?: RequestInit, role?: string): Promise<Response> {
  try {
    await ensureSession(role ?? issuedRole ?? undefined);
  } catch {
    /* the caller inspects the response — a 401 heals on the next attempt */
  }
  return fetch(input, { ...init, cache: "no-store" });
}
