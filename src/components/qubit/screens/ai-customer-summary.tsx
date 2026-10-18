"use client";

import * as React from "react";
import { CalendarCheck, Check, Copy, RefreshCw, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard } from "../primitives";
import { useToast } from "@/hooks/use-toast";
import { useQubitNav } from "../nav-context";
import { cn } from "@/lib/utils";
import {
  AiConfidenceBadge,
  AiGovernanceStrip,
  AiMetaLine,
  AiScopeNote,
  AiSkeleton,
  AiSourceList,
  AiTag,
  AiUnavailableBanner,
  SalesAiGate,
  useSalesAiSection,
} from "../ai/parts";
import { EntityLink, ScopeNote, useSalesSection } from "../sales/parts";
import type { AiSourceRef } from "@/lib/qubit/sales-ai-data";

// ============================================================
// Screen 106 · AI Customer Summary — a structured, evidence-based
// Customer 360. Sections are composed from the authorized account
// record; nothing is inferred beyond it. Clearly labeled
// "AI-generated summary"; refresh, copy, meeting preparation and
// evidence inspection are first-class actions.
// ============================================================

interface SummarySection {
  lines: string[];
  evidence: AiSourceRef[];
  confidence?: string;
  emptyNote?: string;
}

interface SummaryPayload {
  scope: "company" | "team" | "own";
  accountId: string;
  accountName: string;
  generatedAt: number;
  modelLabel: string;
  freshnessLabel: string;
  stats: { openOpps: number; openValueCr: number; orders: number; quotations: number; lastTouchDays: number | null };
  sections: {
    overview: SummarySection;
    currentBusiness: SummarySection;
    relationship: SummarySection;
    recentActivity: SummarySection;
    openOpportunities: SummarySection;
    risks: SummarySection;
    importantContext: SummarySection;
  };
  nextAction: { line: string; reason: string; confidence: string; evidence: AiSourceRef[] };
  meetingPrep: string[];
}

const SECTION_META: { key: keyof SummaryPayload["sections"]; title: string; ladder: "FACT" | "INFERENCE" }[] = [
  { key: "overview", title: "Customer overview", ladder: "FACT" },
  { key: "currentBusiness", title: "Current business", ladder: "FACT" },
  { key: "relationship", title: "Relationship", ladder: "FACT" },
  { key: "recentActivity", title: "Recent activity", ladder: "FACT" },
  { key: "openOpportunities", title: "Open opportunities", ladder: "FACT" },
  { key: "risks", title: "Risks", ladder: "INFERENCE" },
  { key: "importantContext", title: "Important context", ladder: "FACT" },
];

function SectionBlock({ meta, section }: { meta: (typeof SECTION_META)[number]; section: SummarySection }) {
  const [openEvidence, setOpenEvidence] = React.useState(false);
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
          {meta.title}
          <span
            className={cn(
              "inline-flex items-center rounded border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider",
              meta.ladder === "FACT" ? "border-slate-200 bg-slate-50 text-slate-600" : "border-violet-200 bg-violet-50 text-violet-700",
            )}
          >
            {meta.ladder}
          </span>
        </h3>
        {section.evidence.length > 0 && (
          <button
            type="button"
            onClick={() => setOpenEvidence((v) => !v)}
            aria-expanded={openEvidence}
            className="text-[11.5px] font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            {openEvidence ? "Hide evidence" : `Evidence (${section.evidence.length})`}
          </button>
        )}
      </div>
      {section.lines.length === 0 ? (
        <p className="mt-2 text-[12.5px] italic leading-relaxed text-slate-400">{section.emptyNote ?? "Nothing to summarize for this section."}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {section.lines.map((l, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[13px] leading-relaxed text-slate-600">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden />
              {l}
            </li>
          ))}
        </ul>
      )}
      {section.confidence && <AiConfidenceBadge confidence={section.confidence as never} compact />}
      {openEvidence && <AiSourceList sources={section.evidence} title="Supporting records" />}
    </div>
  );
}

export function AiCustomerSummaryScreen() {
  const nav = useQubitNav();
  const { toast } = useToast();
  const { data: accountsData, scope: accountsScope } = useSalesSection<{ rows: { id: string; name: string; status: string; industry: string; ownerName?: string }[] }>("accounts");
  const [accountId, setAccountId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [prepOpen, setPrepOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const { data, loading, error, forbidden, reload } = useSalesAiSection<SummaryPayload>(accountId ? "customer-summary" : "", accountId ? { accountId } : undefined);

  const accounts = accountsData?.rows ?? [];
  const filtered = React.useMemo(
    () => (search.trim() ? accounts.filter((a) => a.name.toLowerCase().includes(search.trim().toLowerCase())) : accounts).slice(0, 12),
    [accounts, search],
  );

  React.useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const summaryText = React.useMemo(() => {
    if (!data) return "";
    const s = data.sections;
    const block = (title: string, sec: SummarySection) => `${title.toUpperCase()}\n${sec.lines.length ? sec.lines.map((l) => `- ${l}`).join("\n") : "- (nothing on record)"}`;
    return [
      `AI-generated customer summary — ${data.accountName}`,
      block("Customer overview", s.overview),
      block("Current business", s.currentBusiness),
      block("Relationship", s.relationship),
      block("Recent activity", s.recentActivity),
      block("Open opportunities", s.openOpportunities),
      block("Risks", s.risks),
      block("Important context", s.importantContext),
      `RECOMMENDED NEXT ACTION\n- ${data.nextAction.line} (${data.nextAction.reason})`,
    ].join("\n\n");
  }, [data]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast({ title: "Summary copied", description: "Paste it into mail, notes or the CRM — it carries the structure and the facts." });
    } catch {
      toast({ variant: "destructive", title: "Copy failed", description: "Your browser blocked clipboard access." });
    }
  };

  if (forbidden) {
    return (
      <SalesAiGate screenName="AI Customer Summary">
        <></>
      </SalesAiGate>
    );
  }

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Sales AI" }, { label: "Customer Summary" }]}
        title="AI Customer Summary"
        description="A structured Customer 360, composed only from the authorized account record — overview, business, relationship, activity, opportunities, risks and the recommended next action."
        actions={
          data && (
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setPrepOpen(true)}>
                <CalendarCheck className="h-3.5 w-3.5" aria-hidden /> Meeting preparation
              </Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={reload} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5${loading ? " animate-spin" : ""}`} aria-hidden /> Refresh summary
              </Button>
            </>
          )
        }
      />

      <AiGovernanceStrip
        note="Every line below is composed from the account's authorized records — where data does not exist, the summary says so instead of inferring. Open any evidence link to verify. The summary respects your permissions; restricted fields never appear."
        meta={data ? `AI-generated summary · ${data.modelLabel} · generated ${fmtTimeOf(data.generatedAt)}` : undefined}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_1fr]">
        {/* account picker */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts…" className="pl-9" aria-label="Search accounts" />
          </div>
          <div className="qubit-scroll max-h-[560px] space-y-1.5 overflow-y-auto pr-1" role="listbox" aria-label="Accounts in your scope">
            {filtered.length === 0 && <p className="px-1 py-6 text-center text-xs text-slate-400">No accounts match in your scope.</p>}
            {filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                role="option"
                aria-selected={accountId === a.id}
                onClick={() => setAccountId(a.id)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                  accountId === a.id ? "border-blue-300 bg-blue-50" : "border-slate-200/80 bg-white hover:bg-slate-50",
                )}
              >
                <span className="block truncate text-[13px] font-medium text-slate-800">{a.name}</span>
                <span className="mt-0.5 block text-[11.5px] text-slate-500">
                  {a.industry} · {a.status}
                  {a.ownerName ? ` · ${a.ownerName}` : ""}
                </span>
              </button>
            ))}
          </div>
          <ScopeNote scope={accountsScope} what="accounts" />
        </div>

        {/* summary */}
        <div className="space-y-4">
          {error && <AiUnavailableBanner message={error} onRetry={reload} />}
          {loading && <AiSkeleton rows={3} />}

          {!loading && !data && !error && (
            <EmptyState icon={<UserRound />} title="Pick an account" message="Choose an account on the left — the summary is generated from its authorized records." />
          )}

          {data && !loading && (
            <div className="space-y-3">
              {/* header card */}
              <div className="qubit-card px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <AiTag label="AI-generated summary" />
                    <h2 className="truncate text-[15px] font-semibold text-slate-900">{data.accountName}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-[12px]" onClick={copySummary}>
                      {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />} {copied ? "Copied" : "Copy summary"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-[12px]" onClick={() => nav.navigate("account-detail", { accountId: data.accountId })}>
                      Open account
                    </Button>
                  </div>
                </div>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500">
                  <span>{data.stats.openOpps} open opportunit{data.stats.openOpps === 1 ? "y" : "ies"} · ₹{data.stats.openValueCr.toFixed(2)} Cr</span>
                  <span>{data.stats.orders} orders · {data.stats.quotations} quotations</span>
                  <span>{data.stats.lastTouchDays == null ? "No recorded activity" : `Last touch ${data.stats.lastTouchDays}d ago`}</span>
                </p>
                <AiMetaLine modelLabel={data.modelLabel} generatedAt={data.generatedAt} freshnessLabel={data.freshnessLabel} className="mt-1.5" />
              </div>

              {/* structured sections */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {SECTION_META.slice(0, 4).map((m) => (
                  <SectionBlock key={m.key} meta={m} section={data.sections[m.key]} />
                ))}
                <div className="lg:col-span-2">
                  <SectionBlock meta={SECTION_META[4]} section={data.sections.openOpportunities} />
                </div>
                <SectionBlock meta={SECTION_META[5]} section={data.sections.risks} />
                <SectionBlock meta={SECTION_META[6]} section={data.sections.importantContext} />
              </div>

              {/* recommended next action */}
              <div className="qubit-card border-blue-200/70 bg-blue-50/40 px-4 py-3.5">
                <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-slate-900">
                  Recommended next action
                  <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider text-blue-700">Recommendation</span>
                  <AiConfidenceBadge confidence={data.nextAction.confidence as never} compact />
                </p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-800">{data.nextAction.line}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                  <span className="font-medium text-slate-600">Why:</span> {data.nextAction.reason}
                </p>
                {data.nextAction.evidence.length > 0 && <AiSourceList sources={data.nextAction.evidence} title="Evidence" />}
              </div>

              <AiScopeNote scope={data.scope} what="this account's records" />
            </div>
          )}
        </div>
      </div>

      {/* meeting preparation */}
      <Dialog open={prepOpen} onOpenChange={setPrepOpen}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Meeting preparation — {data?.accountName}</DialogTitle>
            <DialogDescription>
              A checklist derived from the same authorized records as the summary. It prepares you; it does not contact anyone.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-2">
            {(data?.meetingPrep ?? []).map((p, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-[13px] leading-relaxed text-slate-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold tabular-nums text-slate-500">{i + 1}</span>
                {p}
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fmtTimeOf(ts: number) {
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}
