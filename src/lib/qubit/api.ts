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
// IAM: sessions are issued ONLY through the credential login flow
// (/api/iam/login → MFA). There is no credential-free bootstrap: the
// client merely CHECKS whether a valid session exists. When a call comes
// back 401 session_required the registered unauthorized handler fires
// (the shell drops to the anonymous state and routes to the sign-in
// screen) — the client never mints or repairs sessions itself.
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void): void {
  unauthorizedHandler = fn;
}

let sessionCheck: Promise<boolean> | null = null;

/**
 * Check that a valid session cookie exists. Idempotent — the server, not
 * this helper, decides what is valid. (Optional arg retained for legacy
 * call-site compatibility; role is derived from the session server-side.)
 */
export async function ensureSession(_legacyRole?: string): Promise<boolean> {
  if (!sessionCheck) {
    sessionCheck = (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        return res.ok;
      } catch {
        return false;
      }
    })();
  }
  const ok = await sessionCheck;
  if (!ok) unauthorizedHandler?.();
  return ok;
}

/** Force a fresh session check on the next call (after logout/401). */
export function invalidateSession() {
  sessionCheck = null;
}

function headers(role?: string): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (role) h["X-Qubit-Role"] = role; // display hint only — authorization is cookie-derived server-side
  return h;
}

function isSessionRequired(status: number, code?: string): boolean {
  return status === 401 && (code === "session_required" || code === "login_required");
}

async function request<T>(path: string, init: RequestInit, basePath: string, role?: string, isRetry = false): Promise<T> {
  try {
    await ensureSession();
  } catch {
    /* fall through — the API call will surface a structured 401 that triggers the handler */
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
    // Session expired or revoked server-side — drop to the anonymous state
    // (the shell routes to sign-in). The client never re-issues sessions.
    if (isSessionRequired(res.status, code)) {
      invalidateSession();
      unauthorizedHandler?.();
      throw new ApiError(res.status, code, "Your session has ended. Sign in to continue.");
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
export async function authedFetch(input: string, init?: RequestInit, _legacyRole?: string): Promise<Response> {
  try {
    await ensureSession(_legacyRole);
  } catch {
    /* the caller inspects the response — a 401 triggers the handler */
  }
  return fetch(input, { ...init, cache: "no-store" });
}
