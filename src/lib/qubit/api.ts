// ============================================================
// Qubit One — typed client for /api/security endpoints.
// Security decisions always come from the server; this helper
// only carries intent and surfaces structured failures.
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

function headers(role?: string): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (role) h["X-Qubit-Role"] = role; // demo boundary hint; production derives role from the session
  return h;
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
  const res = await fetch(`${basePath}${path}${qs ? `?${qs}` : ""}`, { headers: headers(role), cache: "no-store" });
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
    throw new ApiError(res.status, code, message, conflicts);
  }
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown, role?: string): Promise<T> {
  const res = await fetch(`/api/security${path}`, {
    method: "POST",
    headers: headers(role),
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    let code: string | undefined;
    let message = `Request failed (${res.status}).`;
    let conflicts: string[] | undefined;
    try {
      const json = await res.json();
      code = json?.code;
      message = json?.message ?? message;
      conflicts = json?.conflicts;
    } catch {
      /* non-JSON failure — keep generic message */
    }
    throw new ApiError(res.status, code, message, conflicts);
  }
  return (await res.json()) as T;
}

export async function apiPatch<T>(path: string, body: unknown, role?: string): Promise<T> {
  const res = await fetch(`/api/security${path}`, {
    method: "PATCH",
    headers: headers(role),
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    let code: string | undefined;
    let message = `Request failed (${res.status}).`;
    try {
      const json = await res.json();
      code = json?.code;
      message = json?.message ?? message;
    } catch {
      /* non-JSON failure — keep generic message */
    }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}
