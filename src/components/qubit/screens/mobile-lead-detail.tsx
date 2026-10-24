"use client";

import * as React from "react";
import { Phone, Mail, MessageCircle } from "lucide-react";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  MobileBadge,
  MobileCard,
  MobileErrorBanner,
  MobileFrame,
  MobileSection,
  MobileSkeleton,
  MobileRow,
  SourceNote,
  mobilePost,
  useMobileSection,
} from "../mobile/parts";

// ============================================================
// Screen 287 · Mobile Lead Detail — the lead workspace in the
// field. The record is read through the Sales OS gate; Call /
// WhatsApp / Email are legitimate device and integration handoffs
// (tel:, wa.me, mailto) — never a simulated channel. Notes and
// follow-ups ride the existing Sales actions.
// ============================================================

interface LeadPayload {
  lead: {
    id: string; name: string; company: string; contactPerson: string; phone: string; email: string;
    source: string; status: string; priority: string; score: number; estimatedValueCr: number;
    ownerName?: string; notes?: string | null; nextFollowUpAt?: number | null; location: string; industry: string;
  };
  scope: string;
  recentActivity: { id: string; type: string; summary: string; at: number; source: string }[];
  channels: { call: string; whatsapp: string; email: string };
  channelNote: string;
  sourceNote: string;
}

const fmtDT = (ts: number) => new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export function MobileLeadDetailScreen() {
  const nav = useQubitNav();
  const { params } = nav;
  const { role } = useRole();
  const leadId = params.leadId ?? "";
  const { data, loading, error, reload } = useMobileSection<LeadPayload>("lead", { id: leadId });
  const [busy, setBusy] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [followOpen, setFollowOpen] = React.useState(false);
  const [noteText, setNoteText] = React.useState("");
  const [followText, setFollowText] = React.useState("");

  const act = async (fn: () => Promise<{ message?: string }>, done: string) => {
    setBusy(true);
    try {
      const res = await fn();
      toast({ title: done, description: res.message });
      setNoteOpen(false);
      setFollowOpen(false);
      setNoteText("");
      setFollowText("");
      reload();
    } catch (e) {
      toast({ title: "Action failed", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileFrame title={data?.lead.name ?? "Lead"} activeTab="business">
      {loading && <MobileSkeleton rows={3} />}
      {error && !loading && <MobileErrorBanner message={error} onRetry={reload} />}
      {data && !loading && (
        <>
          {/* Communication strip — legitimate handoffs */}
          <div className="grid grid-cols-3 gap-2 px-3 pt-3" role="group" aria-label="Contact actions">
            <a
              href={data.channels.call}
              className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50/40"
            >
              <Phone className="h-4 w-4 text-blue-600" aria-hidden />
              <span className="text-[11.5px] font-medium">Call</span>
            </a>
            <a
              href={data.channels.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50/40"
            >
              <MessageCircle className="h-4 w-4 text-blue-600" aria-hidden />
              <span className="text-[11.5px] font-medium">WhatsApp</span>
            </a>
            <a
              href={data.channels.email}
              className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50/40"
            >
              <Mail className="h-4 w-4 text-blue-600" aria-hidden />
              <span className="text-[11.5px] font-medium">Email</span>
            </a>
          </div>

          <MobileSection title="Lead">
            <MobileCard>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-slate-900">{data.lead.name}</p>
                  <p className="text-[12.5px] text-slate-500">{data.lead.company} · {data.lead.industry}</p>
                </div>
                <MobileBadge tone={data.lead.priority === "Hot" ? "red" : data.lead.priority === "Warm" ? "amber" : "slate"}>{data.lead.priority}</MobileBadge>
              </div>
              <dl className="mt-3 space-y-1.5 text-[12.5px]">
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Contact</dt><dd className="truncate font-medium text-slate-800">{data.lead.contactPerson}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Phone</dt><dd className="truncate font-medium tabular-nums text-slate-800">{data.lead.phone}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Email</dt><dd className="truncate font-medium text-slate-800">{data.lead.email}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Source</dt><dd className="font-medium text-slate-800">{data.lead.source}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Status</dt><dd><MobileBadge tone={data.lead.status === "Converted" ? "green" : "blue"}>{data.lead.status}</MobileBadge></dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Owner</dt><dd className="font-medium text-slate-800">{data.lead.ownerName ?? "Unassigned"}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Est. value</dt><dd className="font-semibold tabular-nums text-slate-900">₹{data.lead.estimatedValueCr} Cr</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Score</dt><dd className="font-semibold tabular-nums text-slate-900">{data.lead.score}/100</dd></div>
              </dl>
              {data.lead.notes && <p className="mt-3 rounded-lg bg-slate-50 p-2 text-[12px] leading-snug text-slate-600">{data.lead.notes}</p>}
            </MobileCard>
          </MobileSection>

          <MobileSection title="Field actions">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setNoteOpen((v) => !v)} className="min-h-[48px] rounded-xl border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:border-blue-300">Add note</button>
              <button type="button" onClick={() => setFollowOpen((v) => !v)} className="min-h-[48px] rounded-xl border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:border-blue-300">Schedule follow-up</button>
              <button type="button" onClick={() => nav.navigate("lead-detail", { leadId: data.lead.id })} className="min-h-[48px] rounded-xl border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:border-blue-300">Full workspace</button>
              <button
                type="button"
                onClick={() => act(() => mobilePost("lead.followup", { leadId: data.lead.id, subject: "Conversion review — from mobile", type: "Call" }, role), "Follow-up created")}
                disabled={busy || data.lead.status === "Converted"}
                className="min-h-[48px] rounded-xl border border-blue-600 bg-blue-600 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Convert path
              </button>
            </div>
            {noteOpen && (
              <MobileCard>
                <label htmlFor="lead-note" className="text-[12px] font-medium text-slate-600">Note (recorded on the lead)</label>
                <textarea
                  id="lead-note"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 p-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="What was discussed on the call?"
                />
                <button
                  type="button"
                  disabled={busy || noteText.trim().length < 3}
                  onClick={() => act(() => mobilePost("lead.note", { leadId: data.lead.id, note: noteText }, role), "Note recorded")}
                  className="mt-2 min-h-[44px] w-full rounded-lg bg-blue-600 text-[13px] font-semibold text-white disabled:opacity-40"
                >
                  Save note
                </button>
              </MobileCard>
            )}
            {followOpen && (
              <MobileCard>
                <label htmlFor="lead-followup" className="text-[12px] font-medium text-slate-600">Follow-up subject</label>
                <input
                  id="lead-followup"
                  value={followText}
                  onChange={(e) => setFollowText(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 p-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="e.g. Send revised quotation"
                />
                <button
                  type="button"
                  disabled={busy || followText.trim().length < 4}
                  onClick={() => act(() => mobilePost("lead.followup", { leadId: data.lead.id, subject: followText, type: "Call" }, role), "Follow-up scheduled")}
                  className="mt-2 min-h-[44px] w-full rounded-lg bg-blue-600 text-[13px] font-semibold text-white disabled:opacity-40"
                >
                  Schedule for tomorrow
                </button>
              </MobileCard>
            )}
          </MobileSection>

          <MobileSection title="Recent communication">
            {data.recentActivity.length ? (
              data.recentActivity.map((a) => (
                <MobileRow key={a.id} title={a.summary} detail={`${a.type} · ${a.source}`} meta={fmtDT(a.at)} />
              ))
            ) : (
              <MobileCard><p className="text-[12.5px] text-slate-500">No recorded communication yet on this lead.</p></MobileCard>
            )}
          </MobileSection>

          <SourceNote>{data.channelNote} {data.sourceNote}</SourceNote>
          <p className="px-3 pb-2 text-[10px] text-slate-300">Mobile Lead Detail</p>
        </>
      )}
    </MobileFrame>
  );
}
