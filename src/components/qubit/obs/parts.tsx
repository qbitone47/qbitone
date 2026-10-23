"use client";

// ============================================================
// Qubit One — Phase 23 · Observability client primitives.
// Reuses every shared primitive from ops/parts.tsx (Phase 22)
// and adds the /api/obs client — one design language, one
// vocabulary, zero duplicated UI systems.
// ============================================================

import * as React from "react";
import { ensureSession } from "@/lib/qubit/api";
import { useRole } from "../role-context";
import { OpsApiError } from "../ops/parts";

export {
  OpsHealthBadge, EnvBadge, NotConfiguredCard, OpsSkeleton, OpsError,
  FactRow, SourceLine, OpsTable, timeAgo, fmtIST,
  type OpsHealth,
} from "../ops/parts";

export async function obsGet<T>(section: string, role: string): Promise<T> {
  await ensureSession(role);
  const res = await fetch(`/api/obs?section=${encodeURIComponent(section)}`, {
    headers: { "Content-Type": "application/json", "X-Qubit-Role": role },
    cache: "no-store",
  });
  if (!res.ok) {
    let code: string | undefined;
    let message = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      code = body?.code;
      message = body?.message ?? message;
    } catch { /* keep generic */ }
    throw new OpsApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export async function obsPost<T = { ok: boolean; message?: string }>(
  type: string,
  input?: Record<string, unknown>,
  role?: string,
  confirm?: boolean,
): Promise<T> {
  await ensureSession(role ?? "administrator");
  const res = await fetch("/api/obs", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Qubit-Role": role ?? "administrator" },
    body: JSON.stringify({ type, input: input ?? {}, confirm }),
  });
  if (!res.ok) {
    let code: string | undefined;
    let message = `Request failed (${res.status}).`;
    try {
      const json = await res.json();
      code = json?.code;
      message = json?.message ?? message;
    } catch { /* keep generic */ }
    throw new OpsApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export interface ObsSectionState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  forbidden: boolean;
  reload: () => void;
}

export function useObsSection<T>(section: string): ObsSectionState<T> {
  const { role } = useRole();
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [forbidden, setForbidden] = React.useState(false);
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setForbidden(false);
    obsGet<T>(section, role)
      .then((d) => { if (alive) setData(d); })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof OpsApiError) {
          setError(e.message);
          setForbidden(e.status === 403);
        } else {
          setError("The observability endpoint could not be reached.");
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [section, role, tick]);

  return { data, loading, error, forbidden, reload };
}
