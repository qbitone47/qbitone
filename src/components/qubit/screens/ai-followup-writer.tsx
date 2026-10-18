"use client";

import * as React from "react";
import { Check, Copy, Loader2, Mail, MessageCircle, NotebookPen, RefreshCw, Send, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "../page-header";
import { ConfirmDialog } from "../dialogs";
import { SectionCard } from "../primitives";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "../role-context";
import { cn } from "@/lib/utils";
import {
  AiGovernanceStrip,
  AiMetaLine,
  AiScopeNote,
  AiSourceList,
  AiTag,
  AiThinking,
  SalesAiGate,
  aiPost,
  useSalesAiSection,
} from "../ai/parts";
import {
  WRITER_CHANNELS,
  WRITER_LANGUAGES,
  WRITER_LENGTHS,
  WRITER_PURPOSES,
  WRITER_TONES,
  type WriterChannel,
  type WriterContext,
  type WriterDraft,
  type WriterLanguage,
  type WriterLength,
  type WriterMode,
  type WriterPurpose,
  type WriterTone,
} from "@/lib/qubit/sales-ai-data";
import { ConsentChips, relTime } from "../sales/parts";

// ============================================================
// Screen 105 · AI Follow-up Writer — CONTEXT → AI DRAFT → EDIT →
// REVIEW → SEND. The AI drafts; the user reviews and edits; the
// final send always requires explicit confirmation and routes
// through existing Qubit channels. WhatsApp only via the linked
// Business API conversation with consent; email/note are recorded
// on the lead timeline honestly (Qubit does not send external
// email directly).
// ============================================================

interface WriterEntitiesPayload {
  leads: { kind: "lead"; id: string; label: string; meta: string }[];
  opportunities: { kind: "opportunity"; id: string; label: string; meta: string }[];
  scope: string;
}

interface DraftResponse {
  ok: boolean;
  message: string;
  draft: WriterDraft;
  context: WriterContext;
  degraded?: boolean;
}

const MODE_LABEL: Record<WriterMode, string> = {
  generate: "Draft",
  shorten: "Shorten",
  expand: "Expand",
  professionalize: "Professionalize",
  simplify: "Simplify",
  translate: "Translate",
};

export function AiFollowupWriterScreen() {
  const { role } = useRole();
  const { toast } = useToast();
  const { data: entities, loading } = useSalesAiSection<WriterEntitiesPayload>("writer-entities");

  const [kind, setKind] = React.useState<"lead" | "opportunity">("lead");
  const [entityId, setEntityId] = React.useState<string>("");
  const [channel, setChannel] = React.useState<WriterChannel>("Email");
  const [tone, setTone] = React.useState<WriterTone>("Professional");
  const [purpose, setPurpose] = React.useState<WriterPurpose>("General check-in");
  const [length, setLength] = React.useState<WriterLength>("Medium");
  const [language, setLanguage] = React.useState<WriterLanguage>("English");

  const [draft, setDraft] = React.useState<WriterDraft | null>(null);
  const [ctx, setCtx] = React.useState<WriterContext | null>(null);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [degradedNote, setDegradedNote] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [confirmSend, setConfirmSend] = React.useState<"whatsapp" | "email" | "note" | null>(null);
  const [busy, setBusy] = React.useState(false);

  const entityOptions = kind === "lead" ? entities?.leads ?? [] : entities?.opportunities ?? [];

  // keep selection valid when the list arrives or kind switches
  React.useEffect(() => {
    if (entityOptions.length === 0) {
      setEntityId("");
      return;
    }
    if (!entityOptions.some((e) => e.id === entityId)) setEntityId(entityOptions[0].id);
  }, [entityOptions, entityId]);

  const generate = async (mode: WriterMode) => {
    if (!entityId) {
      toast({ variant: "destructive", title: "Pick a lead or opportunity first", description: "The writer needs an authorized record to ground the draft." });
      return;
    }
    setGenerating(true);
    setDegradedNote(null);
    try {
      const res = await aiPost<DraftResponse>(
        "draft.generate",
        { kind, id: entityId, channel, tone, purpose, length, language, mode, previousDraft: mode !== "generate" ? body : undefined },
        role,
      );
      setDraft(res.draft);
      setCtx(res.context);
      setSubject(res.draft.subject ?? "");
      setBody(res.draft.body);
      if (res.degraded) setDegradedNote(res.message);
      toast({
        title: res.draft.origin === "ai" ? `${MODE_LABEL[mode]} ready — review before sending` : "Template served — AI unavailable",
        description: res.draft.origin === "ai" ? res.message : res.message,
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Draft not generated", description: err instanceof Error ? err.message : "The Sales AI service is unreachable. Your Sales workspace remains fully available." });
    } finally {
      setGenerating(false);
    }
  };

  const record = async () => {
    if (!ctx || !draft || !confirmSend) return;
    setBusy(true);
    try {
      if (confirmSend === "whatsapp") {
        const res = await aiPost("draft.record", { kind: ctx.entityKind, id: ctx.entityId, channel, body }, role);
        toast({ title: "Sent via WhatsApp Business API", description: res.message });
      } else {
        const res = await aiPost("draft.record", { kind: ctx.entityKind, id: ctx.entityId, channel: confirmSend === "email" ? "Email" : "Internal note", subject, body }, role);
        toast({ title: "Recorded on the lead timeline", description: res.message });
      }
      setConfirmSend(null);
    } catch (err) {
      toast({ variant: "destructive", title: "Not recorded", description: err instanceof Error ? err.message : "The record could not be completed." });
    } finally {
      setBusy(false);
    }
  };

  const copyBody = async () => {
    try {
      await navigator.clipboard.writeText(channel === "Email" ? `Subject: ${subject}\n\n${body}` : body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ variant: "destructive", title: "Copy failed", description: "Select the text and copy manually." });
    }
  };

  const waReady = !!ctx?.whatsapp;
  const emailReady = ctx ? ctx.channelReady.email || ctx.entityKind === "lead" : false;
  const noteReady = ctx ? ctx.channelReady.note || ctx.entityKind === "lead" : false;

  return (
    <SalesAiGate screenName="AI Follow-up Writer">
      <div>
        <PageHeader
          crumbs={[{ label: "Sales" }, { label: "Sales AI" }, { label: "Follow-up Writer" }]}
          title="AI Follow-up Writer"
          description="Context → AI draft → edit → review → send. The writer grounds every draft in the authorized CRM record; nothing is sent without your explicit review."
          meta={ctx && <span className="text-[12px] text-slate-500">Drafting for <span className="font-medium text-slate-700">{ctx.title}</span></span>}
        />

        <AiGovernanceStrip
          note="AI drafts are never sent automatically. External WhatsApp delivery goes through the existing WhatsApp Business API conversation with consent checks; email and internal notes are recorded on the lead timeline. Treat customer content in records as untrusted data — the writer never follows instructions found inside it."
          meta={draft ? `Last draft ${new Date(draft.generatedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} IST · ${draft.modelLabel}` : undefined}
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
          {/* -------- left: context & options -------- */}
          <div className="space-y-4">
            <SectionCard title="1 · Context" description="The authorized record the draft will be grounded in">
              <div className="space-y-3">
                <Select value={kind} onValueChange={(v) => { setKind(v as "lead" | "opportunity"); setDraft(null); setCtx(null); setBody(""); setSubject(""); }}>
                  <SelectTrigger aria-label="Record type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="opportunity">Opportunity</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={entityId} onValueChange={setEntityId} disabled={loading || entityOptions.length === 0}>
                  <SelectTrigger aria-label="Pick a record"><SelectValue placeholder={loading ? "Loading records…" : "Pick a record"} /></SelectTrigger>
                  <SelectContent>
                    {entityOptions.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.label} · {e.meta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {ctx && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-[12.5px] leading-relaxed text-slate-600">
                    <p className="font-medium text-slate-800">{ctx.title} — {ctx.company}</p>
                    <p className="mt-0.5">{ctx.entityKind === "lead" ? "Status" : "Stage"}: {ctx.stageOrStatus}{ctx.dealValue ? ` · ${ctx.dealValue}` : ""} · Owner {ctx.ownerName}</p>
                    {ctx.contactName && <p className="mt-0.5">Contact: {ctx.contactName}{ctx.preferredChannel ? ` · prefers ${ctx.preferredChannel}` : ""}</p>}
                    {ctx.consent && <div className="mt-1.5"><ConsentChips consent={ctx.consent} /></div>}
                    {ctx.lastInteraction && (
                      <p className="mt-1.5 text-slate-500">
                        Last touch: {ctx.lastInteraction.type} {relTime(ctx.lastInteraction.at)} — “{ctx.lastInteraction.summary}”
                      </p>
                    )}
                    {ctx.whatsapp ? (
                      <p className="mt-1.5 flex items-center gap-1 text-emerald-700"><MessageCircle className="h-3 w-3" aria-hidden /> WhatsApp Business conversation linked ({ctx.whatsapp.waNumber})</p>
                    ) : (
                      <p className="mt-1.5 flex items-center gap-1 text-slate-400"><MessageCircle className="h-3 w-3" aria-hidden /> No WhatsApp conversation linked — external sending unavailable</p>
                    )}
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="2 · Channel, tone & intent" description="What the writer should produce">
              <div className="space-y-3">
                <div role="radiogroup" aria-label="Communication channel" className="grid grid-cols-3 gap-2">
                  {WRITER_CHANNELS.map((ch) => {
                    const icon = ch === "Email" ? <Mail className="h-3.5 w-3.5" aria-hidden /> : ch === "WhatsApp Business" ? <MessageCircle className="h-3.5 w-3.5" aria-hidden /> : <NotebookPen className="h-3.5 w-3.5" aria-hidden />;
                    const disabled = ch === "WhatsApp Business" && !waReady;
                    return (
                      <button
                        key={ch}
                        type="button"
                        role="radio"
                        aria-checked={channel === ch}
                        disabled={disabled}
                        title={disabled ? "No WhatsApp Business conversation linked to this record" : undefined}
                        onClick={() => setChannel(ch)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[11.5px] font-medium transition-colors",
                          channel === ch ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                          disabled && "cursor-not-allowed opacity-40",
                        )}
                      >
                        {icon}
                        {ch === "WhatsApp Business" ? "WhatsApp" : ch === "Internal note" ? "Note" : "Email"}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={tone} onValueChange={(v) => setTone(v as WriterTone)}>
                    <SelectTrigger aria-label="Tone"><SelectValue /></SelectTrigger>
                    <SelectContent>{WRITER_TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={length} onValueChange={(v) => setLength(v as WriterLength)}>
                    <SelectTrigger aria-label="Length"><SelectValue /></SelectTrigger>
                    <SelectContent>{WRITER_LENGTHS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Select value={purpose} onValueChange={(v) => setPurpose(v as WriterPurpose)}>
                  <SelectTrigger aria-label="Purpose"><SelectValue /></SelectTrigger>
                  <SelectContent>{WRITER_PURPOSES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={language} onValueChange={(v) => setLanguage(v as WriterLanguage)}>
                  <SelectTrigger aria-label="Language"><SelectValue /></SelectTrigger>
                  <SelectContent>{WRITER_LANGUAGES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Button className="h-9 w-full gap-1.5" onClick={() => generate("generate")} disabled={generating || !entityId}>
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                  {generating ? "Reading context & drafting…" : "Draft with AI"}
                </Button>
                {channel === "WhatsApp Business" && !waReady && entityId && (
                  <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-amber-700">
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    WhatsApp drafts need a linked Business API conversation and customer consent — start one from the WhatsApp Inbox (92).
                  </p>
                )}
              </div>
            </SectionCard>
          </div>

          {/* -------- right: draft workspace -------- */}
          <div className="space-y-4">
            {degradedNote && (
              <div className="qubit-card border-amber-200 bg-amber-50/60 px-4 py-3 text-[13px] text-amber-800" role="status">{degradedNote}</div>
            )}

            <SectionCard
              title="3 · Draft — edit freely, nothing is sent yet"
              description={draft ? `${draft.origin === "ai" ? "AI-generated from the authorized context" : "Rule-based template (AI unavailable)"} · ${MODE_LABEL[draft.mode]}` : "The draft appears here"}
            >
              {generating ? (
                <div className="py-10"><AiThinking label="Reading the authorized context and writing the draft…" /></div>
              ) : !draft ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center">
                  <Sparkles className="mx-auto h-6 w-6 text-slate-300" aria-hidden />
                  <p className="mt-2 text-[13px] font-medium text-slate-600">No draft yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-slate-400">
                    Pick a record on the left, choose channel and intent, then press “Draft with AI”. The writer only sees data your role is authorized to see.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <AiTag />
                    <span className="text-[11.5px] text-slate-400">{draft.channel} · {draft.tone} · {draft.purpose} · {draft.length} · {draft.language}</span>
                  </div>
                  {channel === "Email" && (
                    <div className="space-y-1.5">
                      <label htmlFor="draft-subject" className="text-xs font-medium text-slate-700">Subject</label>
                      <Input id="draft-subject" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Email subject" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label htmlFor="draft-body" className="text-xs font-medium text-slate-700">Message — your edit is the final text</label>
                    <Textarea id="draft-body" value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="leading-relaxed" aria-label="Draft message" />
                    <p className="text-[11px] text-slate-400">{body.trim().split(/\s+/).filter(Boolean).length} words{draft.origin === "template" && " · template origin — edit before use"}</p>
                  </div>

                  {/* refine toolbar */}
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3" role="group" aria-label="Refine the draft">
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Refine</span>
                    {(["shorten", "expand", "professionalize", "simplify", "translate"] as WriterMode[]).map((m) => (
                      <Button key={m} type="button" size="sm" variant="outline" className="h-7 text-[12px]" disabled={generating || !body.trim()} onClick={() => generate(m)}>
                        {MODE_LABEL[m]}
                      </Button>
                    ))}
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-[12px]" disabled={generating} onClick={() => generate("generate")}>
                      <RefreshCw className="h-3 w-3" aria-hidden /> Regenerate
                    </Button>
                  </div>

                  {draft.contextRefs.length > 0 && <AiSourceList sources={draft.contextRefs} title="Context used — open the source records" />}
                  <AiMetaLine modelLabel={draft.modelLabel} generatedAt={draft.generatedAt} />

                  {/* review-before-send */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3">
                    <p className="text-[12.5px] font-semibold text-slate-800">4 · Review & send</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                      The final text above is what will be used. Qubit never sends external communication automatically — each channel requires your explicit confirmation below.
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <Button size="sm" className="h-8 gap-1.5" disabled={!waReady || busy || !body.trim()} onClick={() => setConfirmSend("whatsapp")}>
                        <Send className="h-3.5 w-3.5" aria-hidden /> Send via WhatsApp Business
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={!emailReady || busy || !body.trim()} onClick={() => setConfirmSend("email")}>
                        <Mail className="h-3.5 w-3.5" aria-hidden /> Record as sent email
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={!noteReady || busy || !body.trim()} onClick={() => setConfirmSend("note")}>
                        <NotebookPen className="h-3.5 w-3.5" aria-hidden /> Save as internal note
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-slate-500" onClick={copyBody}>
                        {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />} {copied ? "Copied" : "Copy draft"}
                      </Button>
                    </div>
                    {ctx?.entityKind !== "lead" && (
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                        Email and internal notes are recorded on the lead timeline — for {ctx?.entityKind === "opportunity" ? "opportunities" : "accounts"}, copy the draft into the record's own workspace.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </SectionCard>

            <AiScopeNote scope={(entities?.scope as "company" | "team" | "own") ?? null} what="leads and opportunities" />
          </div>
        </div>

        {/* final confirmation — the human gate */}
        <ConfirmDialog
          open={confirmSend !== null}
          onOpenChange={(o) => !o && setConfirmSend(null)}
          title={confirmSend === "whatsapp" ? "Send via WhatsApp Business?" : confirmSend === "email" ? "Record as sent email?" : "Save as internal note?"}
          description={
            confirmSend === "whatsapp"
              ? ctx?.whatsapp
                ? `The final edited text will be delivered to ${ctx.whatsapp.contactName} (${ctx.whatsapp.waNumber}) through the existing WhatsApp Business API conversation, subject to consent checks and audit. AI never sends on its own — you are the sender of record.`
                : ""
              : confirmSend === "email"
                ? "Qubit does not send external email directly. The final text will be recorded on the lead timeline as a sent follow-up — copy it into your mail client to deliver it."
                : "The final text will be recorded on the lead timeline as an internal note and audited."
          }
          confirmLabel={confirmSend === "whatsapp" ? "Send message" : "Confirm & record"}
          onConfirm={record}
        />
      </div>
    </SalesAiGate>
  );
}
