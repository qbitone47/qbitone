"use client";

// ============================================================
// Qubit One — Phase 25 · Global client telemetry collector.
//
// Mounted once in the app shell. Collects REAL browser
// observations and ships them to POST /api/telemetry:
//   · Web vitals — LCP / CLS / FCP / TTFB (PerformanceObserver)
//     plus an INP approximation (Event Timing API, longest
//     interaction duration — labeled as an approximation).
//   · JavaScript failures — window error + unhandledrejection.
//   · Screen transitions — Qubit One workspace navigation.
//   · Client-observed API requests — same-origin /api/* fetches
//     (status + duration + request id from the response header),
//     which give every API call client-perceived timing.
//
// RULES: nothing simulated; no identifiers collected (the server
// ignores identity fields by construction); every send is
// fire-and-forget with bounded queues — telemetry can never break
// the UI (spec §14/§15). Disabled instances simply queue nothing.
// ============================================================

import * as React from "react";

interface ClientEvent {
  kind: "vital" | "js-error" | "route-transition" | "client-request";
  [key: string]: unknown;
}

const QUEUE_MAX = 60;
const BATCH_MAX = 25;
const FLUSH_INTERVAL_MS = 12_000;
const ERROR_SESSION_CAP = 20;

export function TelemetryReporter({ screen }: { screen: string }) {
  const queueRef = React.useRef<ClientEvent[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorsSentRef = React.useRef(0);
  const screenRef = React.useRef(screen);
  const vitalSentRef = React.useRef<string | null>(null);
  const inpRef = React.useRef<number | null>(null);
  const vitalBufRef = React.useRef<{ lcp?: number; cls?: number; ttfb?: number; fcp?: number }>({});

  const push = React.useCallback((event: ClientEvent) => {
    const q = queueRef.current;
    if (q.length >= QUEUE_MAX) q.shift(); // bounded — drop oldest under pressure
    q.push(event);
  }, []);

  const flush = React.useCallback((viaBeacon = false) => {
    const q = queueRef.current;
    if (q.length === 0) return;
    const batch = q.slice(0, BATCH_MAX);
    queueRef.current = q.slice(BATCH_MAX);
    const body = JSON.stringify({ events: batch });
    try {
      if (viaBeacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        navigator.sendBeacon("/api/telemetry", new Blob([body], { type: "application/json" }));
        return;
      }
      void fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        cache: "no-store",
      }).catch(() => undefined);
    } catch {
      /* telemetry must never surface in the UI */
    }
  }, []);

  // ---- boot: vitals + JS errors + fetch patch + flush loop (once) ----
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // -- web vitals (real PerformanceObserver values) --
    if ("PerformanceObserver" in window) {
      const observers: PerformanceObserver[] = [];
      try {
        const po = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            const entry = e as PerformanceEntry & { value?: number; name?: string };
            if (entry.name === "largest-contentful-paint" && typeof entry.value === "number") vitalBufRef.current.lcp = Math.round(entry.value);
            if (entry.name === "first-contentful-paint" && typeof entry.startTime === "number") vitalBufRef.current.fcp = Math.round(entry.startTime);
            if (entry.name === "layout-shift" && typeof entry.value === "number" && (entry as unknown as { hadRecentInput?: boolean }).hadRecentInput !== true) {
              vitalBufRef.current.cls = (vitalBufRef.current.cls ?? 0) + entry.value;
            }
          }
        });
        po.observe({ type: "largest-contentful-paint", buffered: true } as PerformanceObserverInit);
        po.observe({ type: "layout-shift", buffered: true } as PerformanceObserverInit);
        po.observe({ type: "paint", buffered: true } as PerformanceObserverInit);
        observers.push(po);
        // INP approximation: Event Timing entries ≥16ms — track the longest interaction.
        try {
          const inpPo = new PerformanceObserver((list) => {
            for (const e of list.getEntries()) {
              const dur = (e as PerformanceEntry & { duration?: number }).duration;
              if (typeof dur === "number") inpRef.current = Math.max(inpRef.current ?? 0, Math.round(dur));
            }
          });
          inpPo.observe({ type: "event", durationThreshold: 16 } as PerformanceObserverInit);
          observers.push(inpPo);
        } catch {
          /* Event Timing unsupported — INP stays absent, honestly */
        }
      } catch {
        /* observer types unsupported — those metrics simply never report */
      }
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (nav) vitalBufRef.current.ttfb = Math.round(nav.responseStart);
      const cleanupVitals = () => observers.forEach((o) => o.disconnect());
      window.addEventListener("pagehide", cleanupVitals, { once: true });
    }

    // -- JavaScript error pipeline (bounded per session) --
    const onError = (evt: ErrorEvent) => {
      if (errorsSentRef.current >= ERROR_SESSION_CAP) return;
      errorsSentRef.current += 1;
      push({
        kind: "js-error",
        message: String(evt.message ?? "Script error").slice(0, 400),
        errorCode: evt.error?.name ? String(evt.error.name).slice(0, 60) : "WindowError",
        stack: typeof evt.error?.stack === "string" ? evt.error.stack.slice(0, 600) : undefined,
        screen: screenRef.current,
      });
    };
    const onRejection = (evt: PromiseRejectionEvent) => {
      if (errorsSentRef.current >= ERROR_SESSION_CAP) return;
      errorsSentRef.current += 1;
      const reason = evt.reason as { message?: string; name?: string } | null;
      push({
        kind: "js-error",
        message: String(reason?.message ?? "Unhandled promise rejection").slice(0, 400),
        errorCode: reason?.name ? String(reason.name).slice(0, 60) : "UnhandledRejection",
        screen: screenRef.current,
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    // -- client-observed API requests (same-origin /api/* fetch patch) --
    const origFetch = window.fetch.bind(window);
    if (!(window as unknown as { __qubitTelemetryFetchPatched?: boolean }).__qubitTelemetryFetchPatched) {
      (window as unknown as { __qubitTelemetryFetchPatched?: boolean }).__qubitTelemetryFetchPatched = true;
      const patchedFetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const isApi = url.startsWith("/api/") || (typeof location !== "undefined" && url.startsWith(`${location.origin}/api/`));
        const path = isApi ? (url.startsWith("/api/") ? url : url.slice(location.origin.length)) : url;
        const skip = isApi && path.startsWith("/api/telemetry"); // never meter the meter
        const started = isApi && !skip ? Date.now() : 0;
        try {
          const res = await origFetch(input as RequestInfo, init);
          if (isApi && !skip) {
            push({
              kind: "client-request",
              route: path.split("?")[0].slice(0, 120) || path.slice(0, 120),
              method: (init?.method ?? "GET").toUpperCase().slice(0, 10),
              status: res.status,
              durationMs: Date.now() - started,
              requestId: res.headers.get("x-request-id") ?? undefined,
            });
          }
          return res;
        } catch (err) {
          if (isApi && !skip) {
            push({
              kind: "client-request",
              route: path.split("?")[0].slice(0, 120) || path.slice(0, 120),
              method: (init?.method ?? "GET").toUpperCase().slice(0, 10),
              status: 0,
              durationMs: Date.now() - started,
              errorCode: err instanceof Error ? err.name : "NetworkError",
            });
          }
          throw err;
        }
      }) as unknown as typeof fetch;
      // pass through fetch.preconnect so patched fetch stays spec-shaped
      (patchedFetch as unknown as { preconnect: (input: string | URL, init?: unknown) => void }).preconnect =
        (input, init) => (origFetch as unknown as { preconnect: (i: string | URL, o?: unknown) => void }).preconnect(input, init);
      window.fetch = patchedFetch;
    }

    // -- flush loop + pagehide beacon --
    timerRef.current = setInterval(() => flush(false), FLUSH_INTERVAL_MS);
    const onHide = () => flush(true);
    window.addEventListener("pagehide", onHide);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("pagehide", onHide);
      if (timerRef.current) clearInterval(timerRef.current);
      flush(false);
    };
  }, [flush, push]);

  // ---- per-screen: route transition + vital report (once per screen) ----
  React.useEffect(() => {
    screenRef.current = screen;
    if (!screen) return;
    push({ kind: "route-transition", screen });
    if (vitalSentRef.current === screen) return;
    const t = setTimeout(() => {
      vitalSentRef.current = screen;
      const buf = vitalBufRef.current;
      push({
        kind: "vital",
        screen,
        ...(buf.lcp != null ? { lcpMs: buf.lcp } : {}),
        ...(buf.cls != null ? { cls: Math.round((buf.cls as number) * 1000) / 1000 } : {}),
        ...(buf.ttfb != null ? { ttfbMs: buf.ttfb } : {}),
        ...(buf.fcp != null ? { fcpMs: buf.fcp } : {}),
        ...(inpRef.current != null ? { inpMs: inpRef.current } : {}),
      });
    }, 4_000);
    return () => clearTimeout(t);
  }, [screen, push]);

  return null; // headless collector
}
