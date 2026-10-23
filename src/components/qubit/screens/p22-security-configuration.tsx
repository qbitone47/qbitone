"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, NotConfiguredCard, OpsError, OpsSkeleton, SourceLine, useOpsSection } from "../ops/parts";

// ============================================================
// P22-13 · Security Configuration
// Read-governance view of the security posture: what is really
// enforced (session plane, RBAC, rate limiting, audit trail),
// what is not (MFA, SSO, password policy, IP policy, alerts),
// and the security headers observed on a real response. Every
// 'configured' claim maps to a mechanism in this codebase.
// ============================================================

interface SecurityPayload {
  authentication: { configured: boolean; note: string };
  mfa: { configured: boolean; note: string };
  sso: { configured: boolean; note: string };
  sessionPolicy: { configured: boolean; ttlHours: number; rotationNote: string };
  passwordPolicy: { configured: boolean; note: string };
  rbac: { configured: boolean; roles: string[]; note: string };
  abac: { configured: boolean; note: string };
  rateLimiting: { configured: boolean; note: string };
  auditLogging: { configured: boolean; note: string; recentDenials: number };
  securityHeaders: { configured: boolean; headers: Record<string, string>; note: string };
  encryption: { configured: boolean; note: string };
  ipNetworkPolicy: { configured: boolean; note: string };
  alerts: { configured: boolean; note: string };
  sourceNote: string;
}

export function P22SecurityConfigurationScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<SecurityPayload>("security");
  const headerEntries = data ? Object.entries(data.securityHeaders.headers) : [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Security Configuration"
        description="Read-governance of the real security posture. Sensitive changes live in code and platform configuration — nothing here is editable by design."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {/* Step-up hint */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4" role="note">
            <p className="text-[12.5px] leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">Read-only by governance: </span>
              security posture is changed through code changes and platform configuration (Vercel environment variables, Supabase, Next.js middleware) — not through this screen. Any future mutating action here would require the high-risk confirm flow with server re-validation.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Authentication & session policy" description="The mechanisms actually enforced on every request.">
              <div>
                <FactRow label="Authentication" value="Session plane active" health={data.authentication.configured ? "healthy" : "not-configured"} note={data.authentication.note} />
                <FactRow label="Session TTL" value={`${data.sessionPolicy.ttlHours} h`} health={data.sessionPolicy.configured ? "healthy" : "not-configured"} note={data.sessionPolicy.rotationNote} />
                <FactRow label="Rate limiting" value="Enforced (in-process)" health={data.rateLimiting.configured ? "healthy" : "not-configured"} note={data.rateLimiting.note} />
              </div>
            </SectionCard>

            <SectionCard title="Access control" description="RBAC roles resolved server-side from the signed session.">
              <div>
                <FactRow label="RBAC" value={data.rbac.roles.join(", ")} health={data.rbac.configured ? "healthy" : "not-configured"} note={data.rbac.note} />
                <FactRow label="ABAC" value={data.abac.configured ? "Partial (real scopes)" : "Not configured"} health={data.abac.configured ? "healthy" : "not-configured"} note={data.abac.note} />
                <FactRow label="Audit logging" value={data.auditLogging.recentDenials > 0 ? `${data.auditLogging.recentDenials} recent denials` : "Active · no recent denials"} health={data.auditLogging.configured ? "healthy" : "not-configured"} note={data.auditLogging.note} />
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Security headers" description={data.securityHeaders.note}>
            {headerEntries.length ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[12.5px]">
                  <thead>
                    <tr className="bg-slate-50/95">
                      <th className="border-b border-slate-200 px-3 py-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500">Header</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500">Value observed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headerEntries.map(([name, value]) => (
                      <tr key={name} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                        <td className="px-3 py-2.5 font-mono text-[11.5px] font-semibold text-slate-800">{name}</td>
                        <td className="max-w-md break-words px-3 py-2.5 font-mono text-[11.5px] text-slate-600">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[10.5px] text-slate-400">Read from a live response of this deployment — truncated to 160 characters per header by the backend.</p>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-4 text-[12.5px] leading-relaxed text-slate-500">
                {data.securityHeaders.note}
              </p>
            )}
          </SectionCard>

          <SectionCard title="Encryption" description="Transport and at-rest reality.">
            <FactRow label="Encryption" value={data.encryption.configured ? "TLS + platform-managed at rest" : "Not configured"} health={data.encryption.configured ? "healthy" : "not-configured"} note={data.encryption.note} />
          </SectionCard>

          <div className="space-y-4">
            <NotConfiguredCard title="Multi-factor authentication (MFA)" note={data.mfa.note} recommendation="Integrate a real IdP (with TOTP/WebAuthn) before MFA can be honestly claimed." />
            <NotConfiguredCard title="Single sign-on (SSO)" note={data.sso.note} recommendation="Adopt an external identity provider (SAML/OIDC) when the organization requires federated login." />
            <NotConfiguredCard title="Password policy" note={data.passwordPolicy.note} recommendation="A real IdP will own password policy — define it there, not in demo bootstrap code." />
            <NotConfiguredCard title="IP & network policy enforcement" note={data.ipNetworkPolicy.note} recommendation="Wire enforcement behind the existing Phase 3 governance UI before relying on it." />
            <NotConfiguredCard title="Security alerting" note={data.alerts.note} recommendation="Connect an alerting pipeline (email/Slack webhook with server-only credentials) fed by the audit trail." />
          </div>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
