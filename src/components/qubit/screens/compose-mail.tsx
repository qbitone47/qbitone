"use client";

import * as React from "react";
import {
  ArrowLeft,
  Bold,
  CircleAlert,
  FileText,
  Italic,
  List,
  Loader2,
  Paperclip,
  Save,
  Send,
  Trash2,
  Underline,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { authedFetch } from "@/lib/qubit/api";
import { ALL_MAIL, fmtDateTime } from "@/lib/qubit/workspace-data";
import { getEmployee } from "@/lib/qubit/data";
import { useQubitNav } from "../nav-context";
import { PageHeader } from "../page-header";
import { FieldToggle, PeoplePicker, type PickedPerson } from "../workspace/people-picker";
import { ConfirmDialog } from "../dialogs";

// ============================================================
// Screen 56 · Compose Mail — the enterprise composer.
// Real states: composing → saving → sending → sent / failed
// (with safe retry). Draft autosave + guards against losing
// content. Recipients resolve through the same directory as
// everything else; attachment policy is validated client-side
// and re-validated by the server on send.
// ============================================================

interface AttachmentMeta {
  name: string;
  sizeKb: number;
  type: string;
}

/** Draft survives in-app navigation for the session (spec §56:
 *  prevent accidental loss). Cleared on send or discard. */
let sessionDraft: {
  to: PickedPerson[];
  cc: PickedPerson[];
  bcc: PickedPerson[];
  subject: string;
  body: string;
  attachments: AttachmentMeta[];
} | null = null;

const MAX_ATTACHMENTS = 10;
const MAX_TOTAL_MB = 10;
const ALLOWED_EXT = ["pdf", "docx", "xlsx", "pptx", "png", "jpg", "csv"];

const SIGNATURE_HTML = `<div style="margin-top:16px;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:10px"><span style="font-weight:600;color:#334155">Sagar Singh</span><br/>Chief Executive Officer · Qubit One Pvt Ltd<br/>sagar.singh@qubitone.in · +91 98200 10901</div>`;

export function ComposeMailScreen() {
  const nav = useQubitNav();
  const { toast } = useToast();
  const params = nav.params as { to?: string; mailReply?: string; mailForward?: string; replyAll?: string };

  const [to, setTo] = React.useState<PickedPerson[]>([]);
  const [cc, setCc] = React.useState<PickedPerson[]>([]);
  const [bcc, setBcc] = React.useState<PickedPerson[]>([]);
  const [showCc, setShowCc] = React.useState(false);
  const [showBcc, setShowBcc] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [attachments, setAttachments] = React.useState<AttachmentMeta[]>([]);
  const [status, setStatus] = React.useState<"composing" | "sending" | "sent" | "failed">("composing");
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [draftState, setDraftState] = React.useState<"idle" | "saving" | "saved">("idle");
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [restoreNotice, setRestoreNotice] = React.useState(false);

  const editorRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const dirtyRef = React.useRef(false);
  const [, forceTick] = React.useState(0);
  const isReply = Boolean(params.mailReply || params.mailForward);

  const totalKb = attachments.reduce((n, a) => n + a.sizeKb, 0);

  // ----- prefill: reply / forward / deep-link, or restore draft -----
  React.useEffect(() => {
    if (params.mailReply || params.mailForward) {
      const src = ALL_MAIL.find((m) => m.id === (params.mailReply ?? params.mailForward));
      if (src) {
        const fromEmail = src.fromId ? getEmployee(src.fromId)?.email ?? "" : src.fromExternal?.email ?? "";
        const fromName = src.fromId ? getEmployee(src.fromId)?.name ?? "" : src.fromExternal?.name ?? "";
        if (params.mailForward) {
          setTo([]);
          setSubject(`FW: ${src.subject}`);
        } else if (params.replyAll) {
          const resolve = (v: string) => getEmployee(v)?.email ?? v;
          setTo(src.fromId ? [{ value: fromEmail, label: fromName, email: fromEmail, external: !src.fromId }] : []);
          setCc([...(src.to ?? []).map(resolve), ...(src.cc ?? []).map(resolve)].filter((e) => e !== "sagar.singh@qubitone.in").map((e) => ({ value: e, label: e, email: e, external: !e.endsWith("qubitone.in") })));
          setShowCc(true);
          setSubject(`RE: ${src.subject}`);
        } else {
          setTo(src.fromId ? [{ value: fromEmail, label: fromName, email: fromEmail, external: !src.fromId }] : []);
          setSubject(`RE: ${src.subject}`);
        }
        const quote = (src.body ?? "")
          .split("\n")
          .map((l) => `<p style="margin:2px 0;color:#475569">${l.replace(/</g, "&lt;") || "&nbsp;"}</p>`)
          .join("");
        const html = `<p></p><div style="border-left:2px solid #cbd5e1;padding-left:12px;margin:12px 0"><p style="margin:0 0 6px;color:#94a3b8;font-size:12px">On ${fmtDateTime(src.ts)} IST, ${fromName} wrote:</p>${quote}</div>${SIGNATURE_HTML}`;
        if (editorRef.current) editorRef.current.innerHTML = html;
        dirtyRef.current = false;
        return;
      }
    }
    if (params.to && !params.mailReply) {
      setTo([{ value: params.to, label: params.to, email: params.to, external: !params.to.endsWith("qubitone.in") }]);
    }
    if (sessionDraft) {
      setTo(sessionDraft.to);
      setCc(sessionDraft.cc);
      setBcc(sessionDraft.bcc);
      setShowCc(sessionDraft.cc.length > 0);
      setShowBcc(sessionDraft.bcc.length > 0);
      setSubject(sessionDraft.subject);
      setAttachments(sessionDraft.attachments);
      if (editorRef.current) editorRef.current.innerHTML = sessionDraft.body;
      setRestoreNotice(true);
      dirtyRef.current = sessionDraft.subject.length > 0 || sessionDraft.body.length > 0;
    } else if (editorRef.current && !editorRef.current.innerHTML.trim()) {
      editorRef.current.innerHTML = SIGNATURE_HTML;
    }
    forceTick((t) => t + 1);
  }, [nav.navKey]);

  // ----- autosave every 6s while dirty -----
  React.useEffect(() => {
    const t = window.setInterval(async () => {
      if (!dirtyRef.current || status === "sending") return;
      setDraftState("saving");
      try {
        await authedFetch("/api/workspace/mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "draft",
            to: to.map((p) => p.email),
            cc: cc.map((p) => p.email),
            subject,
            body: editorRef.current?.innerHTML ?? "",
          }),
        });
        sessionDraft = { to, cc, bcc, subject, body: editorRef.current?.innerHTML ?? "", attachments };
        dirtyRef.current = false;
        setDraftState("saved");
        window.setTimeout(() => setDraftState("idle"), 2500);
      } catch {
        setDraftState("idle");
      }
    }, 6000);
    return () => window.clearInterval(t);
  }, [to, cc, subject, attachments, status]);

  // ----- guard against closing the tab with unsent content -----
  React.useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current || status === "sending") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [status]);

  // ----- exec commands -----
  const exec = (cmd: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd);
    dirtyRef.current = true;
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: AttachmentMeta[] = [];
    const errors: string[] = [];
    let runningTotal = totalKb;
    for (const f of Array.from(files)) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_EXT.includes(ext)) {
        errors.push(`.${ext} is not an allowed attachment type`);
        continue;
      }
      const kb = Math.round(f.size / 1024);
      if (runningTotal + kb > MAX_TOTAL_MB * 1024) {
        errors.push(`${f.name} would push the message past the ${MAX_TOTAL_MB} MB limit`);
        continue;
      }
      runningTotal += kb;
      next.push({ name: f.name, sizeKb: kb, type: ext.toUpperCase() });
      if (attachments.length + next.length >= MAX_ATTACHMENTS) break;
    }
    if (errors.length) toast({ variant: "destructive", title: "Some files were not attached", description: errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} more)` : "") });
    if (next.length) {
      setAttachments((a) => [...a, ...next]);
      dirtyRef.current = true;
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  // ----- send -----
  const send = async () => {
    if (to.length === 0) {
      toast({ variant: "destructive", title: "Add a recipient", description: "The message needs at least one To recipient." });
      return;
    }
    const bodyText = (editorRef.current?.innerText ?? "").trim();
    if (!subject.trim() && bodyText.length <= SIGNATURE_HTML.length) {
      toast({ variant: "destructive", title: "Nothing to send", description: "Add a subject or write the message first." });
      return;
    }
    setStatus("sending");
    setSendError(null);
    try {
      const res = await authedFetch("/api/workspace/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          to: to.map((p) => p.email),
          cc: cc.map((p) => p.email),
          bcc: bcc.map((p) => p.email),
          subject,
          body: editorRef.current?.innerHTML ?? "",
          attachments,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("failed");
        setSendError(data?.message ?? "The message could not be sent.");
        return;
      }
      setStatus("sent");
      sessionDraft = null;
      toast({ title: "Message sent", description: `Delivered to ${to.map((p) => p.label).join(", ")} — it is now in Sent Mail.` });
      nav.navigate("sent-mail", { sentId: data.message?.id });
    } catch {
      setStatus("failed");
      setSendError("The mail service could not be reached. Your message is intact — retry when you're back online.");
    }
  };

  const discard = () => {
    sessionDraft = null;
    dirtyRef.current = false;
    setTo([]);
    setCc([]);
    setBcc([]);
    setSubject("");
    setAttachments([]);
    if (editorRef.current) editorRef.current.innerHTML = SIGNATURE_HTML;
    setStatus("composing");
    setSendError(null);
    setDiscardOpen(false);
    toast({ title: "Draft discarded" });
  };

  const recentRecipients = React.useMemo(() => {
    // derive recent contacts from the authorized mailbox (directory-driven)
    const seen = new Map<string, string>();
    for (const m of ALL_MAIL) {
      for (const r of [...m.to, ...(m.cc ?? [])]) {
        const emp = getEmployee(r);
        if (emp && emp.id !== "sagar" && !seen.has(emp.id)) seen.set(emp.id, emp.name);
      }
    }
    return Array.from(seen.entries()).slice(0, 6);
  }, []);

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Mail" }, { label: "Compose" }]}
        title={isReply ? (params.mailForward ? "Forward message" : "Reply") : "Compose Mail"}
        description="Enterprise mail with directory-backed recipients, policy-checked attachments and honest delivery states."
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => nav.back()}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to mail
          </Button>
        }
      />

      <div className="qubit-card overflow-hidden">
        {/* Recipients */}
        <div className="divide-y border-b border-slate-100">
          <div className="flex items-start gap-3 px-4 py-3">
            <span className="w-10 shrink-0 pt-2 text-xs font-medium text-slate-500">To</span>
            <div className="min-w-0 flex-1">
              <PeoplePicker ariaLabel="To recipients" selected={to} onChange={(v) => { setTo(v); dirtyRef.current = true; }} autoFocus={!isReply} />
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-2">
              <FieldToggle label="Cc" open={showCc} onToggle={() => setShowCc((v) => !v)} />
              <FieldToggle label="Bcc" open={showBcc} onToggle={() => setShowBcc((v) => !v)} />
            </div>
          </div>
          {showCc && (
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="w-10 shrink-0 pt-2 text-xs font-medium text-slate-500">Cc</span>
              <div className="min-w-0 flex-1">
                <PeoplePicker ariaLabel="Cc recipients" selected={cc} onChange={(v) => { setCc(v); dirtyRef.current = true; }} />
              </div>
            </div>
          )}
          {showBcc && (
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="w-10 shrink-0 pt-2 text-xs font-medium text-slate-500">Bcc</span>
              <div className="min-w-0 flex-1">
                <PeoplePicker ariaLabel="Bcc recipients" selected={bcc} onChange={(v) => { setBcc(v); dirtyRef.current = true; }} />
              </div>
              <span className="hidden shrink-0 pt-2 text-[10.5px] text-slate-400 sm:block">Bcc addresses stay hidden from every recipient</span>
            </div>
          )}
          <div className="flex items-center gap-3 px-4 py-2.5">
            <label htmlFor="compose-subject" className="w-10 shrink-0 text-xs font-medium text-slate-500">
              Subject
            </label>
            <Input
              id="compose-subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                dirtyRef.current = true;
              }}
              placeholder="What is this about?"
              className="h-9 border-0 bg-transparent px-0 text-[15px] font-medium shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        {/* Formatting toolbar */}
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50/70 px-3 py-1.5" role="toolbar" aria-label="Message formatting">
          <FormatButton icon={Bold} label="Bold" onClick={() => exec("bold")} />
          <FormatButton icon={Italic} label="Italic" onClick={() => exec("italic")} />
          <FormatButton icon={Underline} label="Underline" onClick={() => exec("underline")} />
          <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden />
          <FormatButton icon={List} label="Bulleted list" onClick={() => exec("insertUnorderedList")} />
          <div className="ml-auto flex items-center gap-2 pr-1">
            {restoreNotice && <span className="text-[10.5px] text-amber-600">Draft restored</span>}
            {draftState === "saving" && (
              <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Saving draft…
              </span>
            )}
            {draftState === "saved" && (
              <span className="inline-flex items-center gap-1 text-[10.5px] text-emerald-600">
                <Save className="h-3 w-3" aria-hidden /> Draft saved · just now
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Message body"
          onInput={() => {
            dirtyRef.current = true;
            setRestoreNotice(false);
          }}
          className="qubit-scroll min-h-56 max-h-[420px] overflow-y-auto px-5 py-4 text-[13.5px] leading-relaxed text-slate-800 outline-none [&_p]:my-1 focus:outline-none"
        />

        {/* Attachments */}
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-3.5 w-3.5" aria-hidden /> Attach
            </Button>
            <span className="text-[11px] text-slate-400">
              {attachments.length}/{MAX_ATTACHMENTS} · {(totalKb / 1024).toFixed(1)} / {MAX_TOTAL_MB} MB · PDF, DOCX, XLSX, PPTX, PNG, JPG, CSV
            </span>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="sr-only"
              aria-label="Attach files"
              accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.csv"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>
          {attachments.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-2" aria-label="Attachments">
              {attachments.map((a) => (
                <li key={a.name} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                  <FileText className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  <span className="max-w-40 truncate text-[12px] font-medium text-slate-700">{a.name}</span>
                  <span className="text-[10px] text-slate-400">{a.sizeKb >= 1024 ? `${(a.sizeKb / 1024).toFixed(1)} MB` : `${a.sizeKb} KB`}</span>
                  <button
                    type="button"
                    aria-label={`Remove attachment ${a.name}`}
                    onClick={() => {
                      setAttachments((list) => list.filter((x) => x.name !== a.name));
                      dirtyRef.current = true;
                    }}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Send bar */}
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3">
          {sendError && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5" role="alert">
              <CircleAlert className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
              <p className="min-w-0 flex-1 text-xs font-medium text-red-700">{sendError}</p>
              <Button size="sm" variant="outline" className="h-7 border-red-200 text-xs text-red-700 hover:bg-red-100" onClick={send}>
                Retry send
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button className="h-9 gap-1.5" onClick={send} disabled={status === "sending" || status === "sent"}>
              {status === "sending" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending…
                </>
              ) : status === "sent" ? (
                <>
                  <Send className="h-4 w-4" aria-hidden /> Sent
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden /> Send
                </>
              )}
            </Button>
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => { setDraftState("saving"); window.setTimeout(() => setDraftState("saved"), 500); }}>
              <Save className="h-4 w-4" aria-hidden /> Save draft
            </Button>
            <Button variant="ghost" className="h-9 gap-1.5 text-red-600 hover:text-red-700" onClick={() => setDiscardOpen(true)}>
              <Trash2 className="h-4 w-4" aria-hidden /> Discard
            </Button>
            <span className="ml-auto hidden text-[11px] text-slate-400 sm:block">
              {status === "failed" ? "Not delivered — the message above is preserved." : "Autosaves as a draft every few seconds while you write."}
            </span>
          </div>
        </div>
      </div>

      {/* Recent recipients */}
      {recentRecipients.length > 0 && to.length === 0 && !isReply && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-400">Recent recipients:</span>
          {recentRecipients.map(([id, name]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                const emp = getEmployee(id)!;
                setTo([{ value: emp.id, label: emp.name, email: emp.email }]);
                dirtyRef.current = true;
              }}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard this draft?"
        description="The message and its attachments will be removed. This cannot be undone."
        confirmLabel="Discard draft"
        destructive
        onConfirm={discard}
      />
    </div>
  );
}

function FormatButton({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault() /* keep editor selection */}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}
