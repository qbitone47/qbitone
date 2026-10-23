// ============================================================
// Qubit One — Phase 25 · Next.js instrumentation hooks.
//
// register(): telemetry is lazy — nothing to warm here.
// onRequestError(): every UNHANDLED server error becomes a real
// telemetry event (kind "error") with route + request-id context.
// This is the server-side error-tracking pipeline (spec §8) and it
// is failure-isolated: an error inside the telemetry path can
// never affect the application's own error handling.
// ============================================================

export async function register(): Promise<void> {
  /* telemetry-server initialises lazily on first event — intentional */
}

interface InstrumentationRequest {
  path?: string;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}

interface InstrumentationContext {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
}

export async function onRequestError(err: unknown, request: InstrumentationRequest, context: InstrumentationContext): Promise<void> {
  try {
    const { recordServerError } = await import("@/lib/qubit/telemetry-server");
    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(request?.headers ?? {})) {
      headers[k] = Array.isArray(v) ? v[0] : v;
    }
    recordServerError(
      err,
      { path: request?.path, method: request?.method, headers },
      { routerKind: context?.routerKind, routePath: context?.routePath, routeType: context?.routeType },
    );
  } catch {
    /* telemetry failure must never alter application behaviour (spec §15) */
  }
}
