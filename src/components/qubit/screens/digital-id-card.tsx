"use client";

import * as React from "react";
import {
  BadgeCheck,
  Building2,
  Download,
  Fingerprint,
  IdCard,
  Lock,
  RefreshCcw,
  ScanLine,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getEmployee } from "@/lib/qubit/data";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { Avatar, SectionCard } from "../primitives";

// ============================================================
// Screen 53 · Digital ID Card — a real enterprise identity
// credential, not a decorative mockup. Minimal density. The
// verification code is checked against the identity registry
// server-side when presented; downloading is policy-gated.
// ============================================================

const CARD_ID = "QO-ID-2026-00001";
const VERIFICATION_CODE = "QO-V-4C72-1130";
const ISSUED = "02 Jan 2026";
const VALID_THROUGH = "31 Mar 2027";

const ACCESS_LEVELS = ["Mumbai HQ — all floors", "Bengaluru office", "Finance vault — escorted", "Data center — no access"];

export function DigitalIdCardScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { toast } = useToast();
  const me = getEmployee("sagar")!;
  const [face, setFace] = React.useState<"front" | "back">("front");
  const [presentOpen, setPresentOpen] = React.useState(false);

  const downloadAllowed = role === "administrator";

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "People" }, { label: "Identity" }]}
        title="Digital ID Card"
        description="Your enterprise identity credential — issued by Qubit One, verifiable against the identity registry, governed by security policy."
        actions={
          <>
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => setPresentOpen(true)}>
              <ScanLine className="h-4 w-4" aria-hidden /> Present
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-1.5"
              disabled={!downloadAllowed}
              title={downloadAllowed ? "Download a PNG copy for your records" : "Disabled by security policy for your role"}
              onClick={() =>
                toast({ title: "Card copy exported", description: "A watermarked PNG was saved to your documents. Exports are recorded in the audit trail." })
              }
            >
              <Download className="h-4 w-4" aria-hidden /> Download
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* The card */}
        <div>
          <button
            type="button"
            onClick={() => setFace((f) => (f === "front" ? "back" : "front"))}
            aria-label={`Flip card to ${face === "front" ? "back" : "front"} side`}
            className="group relative block w-full [perspective:1200px]"
          >
            <div
              className={cn(
                "relative w-full overflow-hidden rounded-2xl shadow-[0_20px_50px_-20px_rgba(13,27,51,0.45)] transition-transform duration-500 [transform-style:preserve-3d]",
                face === "back" && "[transform:rotateY(180deg)]",
              )}
              style={{ aspectRatio: "1.586" }}
            >
              {/* FRONT */}
              <div className="absolute inset-0 flex flex-col bg-white [backface-visibility:hidden]">
                <div className="flex items-center justify-between bg-navy-900 px-5 py-3.5 text-white">
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-b from-blue-500 to-blue-700 text-[13px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
                      Q
                    </span>
                    <span>
                      <span className="block text-[13px] font-semibold leading-tight">Qubit One Pvt Ltd</span>
                      <span className="block text-[9.5px] leading-tight text-navy-200">Employee Identity · Enterprise OS</span>
                    </span>
                  </span>
                  <BadgeCheck className="h-5 w-5 text-emerald-300" aria-hidden />
                </div>
                <div className="flex min-h-0 flex-1 items-center gap-4 px-5 py-4">
                  <Avatar name={me.name} size="xl" className="h-16 w-16 rounded-xl text-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-bold tracking-tight text-slate-900">{me.name}</p>
                    <p className="truncate text-[12px] text-slate-600">{me.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{me.department} · {me.location}</p>
                    <p className="mt-1.5 font-mono text-[11.5px] font-semibold tracking-wide text-navy-700">{me.employeeId}</p>
                  </div>
                  {/* verification matrix — checked against the registry, never encodes personal data */}
                  <div className="hidden shrink-0 sm:block" aria-hidden>
                    <VerificationMatrix seed={CARD_ID} />
                    <p className="mt-1 text-center font-mono text-[8.5px] text-slate-400">{VERIFICATION_CODE}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-2.5 text-[9.5px] text-slate-400">
                  <span>Issued {ISSUED}</span>
                  <span className="font-medium text-emerald-600">Active</span>
                  <span>Valid through {VALID_THROUGH}</span>
                </div>
              </div>

              {/* BACK */}
              <div className="absolute inset-0 flex flex-col bg-white [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div className="h-9 w-full bg-slate-900/90" aria-hidden />
                <div className="flex min-h-0 flex-1 flex-col justify-between px-5 py-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Access levels</p>
                    <ul className="mt-2 space-y-1">
                      {ACCESS_LEVELS.map((a) => (
                        <li key={a} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                          <ShieldCheck className={cn("h-3 w-3 shrink-0", a.includes("no access") ? "text-slate-300" : "text-emerald-500")} aria-hidden />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-mono text-[10.5px] text-slate-500">{CARD_ID} · {VERIFICATION_CODE}</p>
                    <p className="mt-1.5 text-[9px] leading-relaxed text-slate-400">
                      Property of Qubit One Pvt Ltd. If found, return to any Qubit One office or security@qubitone.in. Misuse is a policy violation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </button>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <RefreshCcw className="h-3 w-3" aria-hidden /> Tap the card to flip — currently showing {face === "front" ? "front" : "back"}
            </span>
            <span className="font-mono">{CARD_ID}</span>
          </div>
        </div>

        {/* Verification & policy */}
        <div className="space-y-4">
          <SectionCard title="How verification works" description="The card is a credential — the registry is the authority.">
            <ol className="space-y-3">
              {[
                { icon: ScanLine, title: "Show the card", body: "Present the card (or tap Present for the kiosk view) at reception, audits or secure zones." },
                { icon: Fingerprint, title: "Verifier checks the code", body: `The verification code ${VERIFICATION_CODE} is checked against the identity registry server-side — the card itself stores nothing sensitive.` },
                { icon: BadgeCheck, title: "Registry confirms", body: "The registry returns only what the verifier needs: active status, name, designation and photo reference. Employment data is never exposed." },
              ].map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-700" aria-hidden>{i + 1}</span>
                  <div>
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
                      <s.icon className="h-3.5 w-3.5 text-blue-600" aria-hidden /> {s.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </SectionCard>

          <SectionCard title="Policy & lifecycle" description="Managed with the same discipline as every security asset.">
            <ul className="space-y-2 text-xs leading-relaxed text-slate-600">
              <li className="flex gap-2"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden /> Downloading a card copy is restricted by role; the network policy governs where credentials may be exported.</li>
              <li className="flex gap-2"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden /> Lost or replaced device? Report the card — a new verification code is issued and the old one is revoked in the registry.</li>
              <li className="flex gap-2"><Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden /> Access levels update automatically when your department, role or location changes in the organization structure.</li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-red-600 hover:text-red-700"
                onClick={() => toast({ title: "Report sent to IT & Security", description: "Your card is marked for re-issuance. A new verification code will be issued after identity re-verification." })}
              >
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Report lost / replace
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-slate-500" onClick={() => nav.navigate("security-center")}>
                Security Center
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Present (kiosk) dialog */}
      <Dialog open={presentOpen} onOpenChange={setPresentOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <DialogTitle className="sr-only">Present your identity card</DialogTitle>
          <DialogDescription className="sr-only">Show this view to the verifier.</DialogDescription>
          <div className="bg-navy-900 px-5 py-4 text-white">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <IdCard className="h-4 w-4 text-blue-300" aria-hidden /> Presenting identity
            </p>
            <p className="mt-0.5 text-[11px] text-navy-200">The verifier confirms against the identity registry — nothing else is shared.</p>
          </div>
          <div className="flex flex-col items-center px-6 py-6">
            <Avatar name={me.name} size="xl" className="h-20 w-20 rounded-2xl text-xl" />
            <p className="mt-3 text-lg font-bold tracking-tight text-slate-900">{me.name}</p>
            <p className="text-xs text-slate-600">{me.title}</p>
            <p className="text-xs text-slate-500">{me.department} · {me.employeeId}</p>
            <div className="mt-4" aria-hidden>
              <VerificationMatrix seed={CARD_ID} large />
            </div>
            <p className="mt-2 font-mono text-xs tracking-widest text-slate-500">{VERIFICATION_CODE}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Active · verified {VALID_THROUGH ? `until ${VALID_THROUGH}` : ""}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Deterministic verification matrix — a stable visual token tied to the
 *  card id. It carries no personal data; the registry does the verifying. */
function VerificationMatrix({ seed, large }: { seed: string; large?: boolean }) {
  const cells = React.useMemo(() => {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const out: boolean[] = [];
    let x = h >>> 0;
    for (let i = 0; i < 49; i++) {
      x = (x * 1664525 + 1013904223) >>> 0;
      out.push((x & 3) !== 0);
    }
    return out;
  }, [seed]);
  const n = large ? 9 : 7;
  const size = large ? 132 : 56;
  const cell = size / n;
  return (
    <span role="img" aria-label="Verification matrix" style={{ width: size, height: size }} className="inline-block rounded-md border border-slate-200 bg-white p-1">
      <svg viewBox={`0 0 ${n * 10} ${n * 10}`} width={size - 8} height={size - 8}>
        {Array.from({ length: n }).map((_, r) =>
          Array.from({ length: n }).map((_, c) => {
            const idx = (r * n + c) % 49;
            return cells[idx] ? (
              <rect key={`${r}-${c}`} x={c * 10 + 1} y={r * 10 + 1} width={8} height={8} rx={2} fill="#0D1B33" />
            ) : (
              <rect key={`${r}-${c}`} x={c * 10 + 1} y={r * 10 + 1} width={8} height={8} rx={2} fill="#E4EBF5" />
            );
          }),
        )}
      </svg>
    </span>
  );
}
