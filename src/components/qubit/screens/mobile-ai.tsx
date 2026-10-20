"use client";

import * as React from "react";
import { Eraser, Send } from "lucide-react";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  MobileCard,
  MobileErrorBanner,
  MobileFrame,
  MobileSection,
  MobileSkeleton,
  SourceNote,
  mobilePost,
  useMobileSection,
} from "../mobile/parts";

// ============================================================
// Screen 300 · Mobile AI — a mobile interface to the existing
// Qubit AI Platform. The server composes the authorized context
// per question (tasks, meetings, approvals, sales follow-ups —
// only what the caller's role may read); the AI can never reach
// the database directly, never bypass authorization, and never
// performs consequential actions itself (spec §21, §41).
// ============================================================

interface AiPayload {
  prompts: { id: string; label: string }[];
  conversation: { role: "user" | "assistant"; content: string; basis?: string }[];
  conversationId: string | null;
  governance: { permissionNote: string; approvalNote: string; provider: string };
  recentContextNote: string;
  sourceNote: string;
}

export function MobileAiScreen() {
  const { role } = useRole();
  const { data, loading, error, reload } = useMobileSection<AiPayload>("ai");
  const [busy, setBusy] = React.useState(false);
  const [question, setQuestion] = React.useState("");

  const ask = async (q: string) => {
    if (q.trim().length < 3) return;
    setBusy(true);
    setQuestion("");
    try {
      const res = await mobilePost<{ message: string; mode: string }>("ai.ask", { question: q }, role);
      if (res.mode === "deterministic") {
        toast({ title: "Answered from your data", description: "AI runtime unavailable — grounded summary provided instead." });
      }
      reload();
    } catch (e) {
      toast({ title: "AI unavailable", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await mobilePost("ai.clear", {}, role);
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileFrame
      title="Qubit AI"
      activeTab="ai"
      right={
        data && data.conversation.length > 0 ? (
          <button type="button" onClick={clear} disabled={busy} aria-label="Clear conversation"
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <Eraser className="h-4 w-4" aria-hidden />
          </button>
        ) : undefined
      }
    >
      {loading && <MobileSkeleton rows={2} />}
      {error && !loading && <MobileErrorBanner message={error} onRetry={reload} />}
      {data && !loading && (
        <>
          {/* Quick prompts */}
          {data.conversation.length === 0 && (
            <MobileSection title="Start with a question">
              <div className="flex flex-wrap gap-2">
                {data.prompts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={busy}
                    onClick={() => ask(p.label)}
                    className="min-h-[44px] rounded-full border border-slate-200 bg-white px-3.5 text-[12.5px] font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50/50 disabled:opacity-40"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </MobileSection>
          )}

          {/* Conversation */}
          {data.conversation.length > 0 && (
            <div className="space-y-2.5 px-3 pt-4" aria-label="Conversation" role="log">
              {data.conversation.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-3.5 py-2.5 text-[13px] leading-snug text-white shadow-sm"
                        : "max-w-[90%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-800 shadow-sm"
                    }
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.role === "assistant" && m.basis?.startsWith("mode:") && (
                      <p className="mt-1.5 text-[9.5px] uppercase tracking-wide opacity-60">
                        {m.basis.includes("mode:ai") ? "LLM · grounded in your authorized context" : "Deterministic fallback · your authorized data"}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Composer */}
          <div className="sticky bottom-24 z-10 mx-3 mt-4 flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
            <label htmlFor="ai-q" className="sr-only">Ask Qubit AI</label>
            <textarea
              id="ai-q"
              rows={1}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(question);
                }
              }}
              placeholder="Ask about your day, approvals, leads…"
              className="max-h-24 min-h-[44px] w-full resize-none bg-transparent px-1.5 py-2 text-[13px] outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => ask(question)}
              disabled={busy || question.trim().length < 3}
              aria-label="Send question"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* Governance */}
          <MobileSection title="How this AI is governed">
            <MobileCard className="border-slate-200 bg-slate-50/60">
              <ul className="space-y-2 text-[11.5px] leading-snug text-slate-600">
                <li><span className="font-semibold text-slate-800">Permissions:</span> {data.governance.permissionNote}</li>
                <li><span className="font-semibold text-slate-800">Actions:</span> {data.governance.approvalNote}</li>
                <li><span className="font-semibold text-slate-800">Runtime:</span> {data.governance.provider} · every answer audited</li>
              </ul>
              <p className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-500">{data.recentContextNote}</p>
            </MobileCard>
          </MobileSection>

          <SourceNote>{data.sourceNote}</SourceNote>
          <p className="px-3 pb-2 text-[10px] text-slate-300">Screen 300 · Mobile AI</p>
        </>
      )}
    </MobileFrame>
  );
}
