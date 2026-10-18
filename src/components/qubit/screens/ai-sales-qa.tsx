"use client";

import * as React from "react";
import { ArrowUpRight, CornerDownLeft, MessagesSquare, Plus, RotateCcw, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "../page-header";
import { SectionCard, StatTile } from "../primitives";
import { useToast } from "@/hooks/use-toast";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { cn } from "@/lib/utils";
import {
  AiConfidenceBadge,
  AiGovernanceStrip,
  AiScopeNote,
  AiSourceList,
  AiTag,
  AiThinking,
  SalesAiGate,
  aiPost,
  useSalesAiSection,
} from "../ai/parts";
import { QA_SUGGESTED_QUESTIONS, type QaAnswer, type AiSourceRef } from "@/lib/qubit/sales-ai-data";

// ============================================================
// Screen 110 · AI Sales Q&A — the most conversational surface in
// Phase 7, but still a professional enterprise workspace: no
// chat bubbles, no fake streaming. Every answer follows
// ANSWER → KEY NUMBERS → REASONING → SOURCES → ACTIONS.
// Retrieval happens server-side under the user's authorization;
// the model cannot see what the user cannot. Insufficient data
// is stated plainly — never guessed.
// ============================================================

interface Turn {
  id: string;
  question: string;
  answer: QaAnswer | null;
  note?: string;
  modelLabel: string;
  generatedAt: number;
  cached?: boolean;
}

interface AskResponse {
  ok: boolean;
  message: string;
  answer: QaAnswer;
  sessionId: string;
  generatedAt: number;
  modelLabel: string;
  cached?: boolean;
}

let turnSeq = 0;

export function AiSalesQaScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { toast } = useToast();
  const { data: suggestions, scope: qaScope } = useSalesAiSection<{ questions: string[] }>("qa-suggestions");
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState("");
  const [asking, setAsking] = React.useState(false);
  const [lastSources, setLastSources] = React.useState<AiSourceRef[]>([]);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!sessionId && !asking) {
      // a session id is minted server-side on first ask; client keeps a placeholder
      setSessionId(`sess-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`);
    }
  }, [sessionId, asking]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, asking]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setInput("");
    const turnId = `t-${++turnSeq}`;
    setTurns((prev) => [...prev, { id: turnId, question: q, answer: null, modelLabel: "…", generatedAt: Date.now() }]);
    try {
      const res = await aiPost<AskResponse>("qa.ask", { sessionId: sessionId ?? `sess-${Math.random().toString(36).slice(2, 10)}`, question: q }, role);
      if (res.sessionId && res.sessionId !== sessionId) setSessionId(res.sessionId);
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, answer: res.answer, note: res.cached ? "Answered from a recent identical question (cached, cost control)." : undefined, modelLabel: res.modelLabel, generatedAt: res.generatedAt } : t)));
      setLastSources(res.answer.sources ?? []);
      if (res.answer.insufficient) {
        toast({ title: "Not enough authorized data", description: res.answer.insufficientNote ?? "Try one of the suggested questions." });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sales AI is temporarily unavailable. Your Sales workspace is still fully available.";
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, answer: null, note: message, modelLabel: "Unavailable", generatedAt: Date.now() } : t)));
    } finally {
      setAsking(false);
    }
  };

  const newConversation = () => {
    setTurns([]);
    setLastSources([]);
    setSessionId(`sess-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`);
  };

  const questions = suggestions?.questions ?? QA_SUGGESTED_QUESTIONS;

  return (
    <SalesAiGate screenName="AI Sales Q&A">
      <div>
        <PageHeader
          crumbs={[{ label: "Sales" }, { label: "Sales AI" }, { label: "Sales Q&A" }]}
          title="AI Sales Q&A"
          description="Ask about your authorized sales data — answers carry key numbers, reasoning, sources and recommended actions. If the data cannot answer it, Sales AI says so instead of guessing."
          actions={
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={newConversation}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> New conversation
            </Button>
          }
        />

        <AiGovernanceStrip
          note="Authorization is enforced before every retrieval — the AI inherits exactly your permissions and cannot bypass them. Customer content inside records is treated as untrusted data and is never followed as instructions. Nothing here executes an action; answers only recommend."
          meta="Qubit AI runtime · grounded answers over scoped sales data"
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
          {/* conversation area — enterprise Q&A cards, not chat bubbles */}
          <div className="space-y-3">
            <div ref={scrollRef} className="qubit-scroll max-h-[62vh] min-h-[320px] space-y-3 overflow-y-auto rounded-xl border border-slate-200/70 bg-slate-50/40 p-3">
              {turns.length === 0 && !asking && (
                <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
                  <MessagesSquare className="h-8 w-8 text-slate-300" aria-hidden />
                  <p className="mt-3 text-[14px] font-semibold text-slate-700">Ask your sales data a question</p>
                  <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-slate-500">
                    Answers are grounded in the records your role can see — leads, opportunities, quotations, follow-ups, targets and activity. Start with a suggested question below.
                  </p>
                </div>
              )}

              {turns.map((t) => (
                <div key={t.id} className="space-y-2">
                  {/* question */}
                  <div className="flex justify-end">
                    <p className="max-w-[85%] rounded-xl rounded-br-sm border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-slate-800">{t.question}</p>
                  </div>
                  {/* answer */}
                  {t.answer === null && !t.note ? (
                    <div className="qubit-card px-4 py-4">
                      <AiThinking label="Reading your authorized sales data…" />
                    </div>
                  ) : t.answer ? (
                    <article className="qubit-card px-4 py-4" aria-label="AI answer">
                      <div className="flex flex-wrap items-center gap-2">
                        <AiTag label="AI answer" />
                        <AiConfidenceBadge confidence={t.answer.confidence} />
                        {t.cached === true && <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10.5px] text-slate-500">cached</span>}
                      </div>
                      <p className="mt-2.5 text-[13.5px] leading-relaxed text-slate-800">{t.answer.answer}</p>

                      {t.answer.keyNumbers.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Key numbers</p>
                          <div className="flex flex-wrap gap-2">
                            {t.answer.keyNumbers.map((k, i) => (
                              <span key={i} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] text-slate-700">
                                <span className="text-slate-400">{k.label}:</span> <span className="font-semibold tabular-nums">{k.value}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {t.answer.reasoning.length > 0 && (
                        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                          <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Reasoning / context</p>
                          <ul className="space-y-1">
                            {t.answer.reasoning.map((r, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-slate-600">
                                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden />{r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <AiSourceList sources={t.answer.sources} title="Sources — open the records (if authorized)" />

                      {t.answer.actions.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Recommended actions</p>
                          <div className="flex flex-wrap gap-2">
                            {t.answer.actions.map((a, i) => (
                              <Button key={i} size="sm" variant="outline" className="h-7 gap-1 text-[12px]" onClick={() => a.id && nav.navigate(a.screen as never, { [a.param ?? "id"]: a.id } as never)}>
                                {a.label} <ArrowUpRight className="h-3 w-3" aria-hidden />
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {t.answer.insufficient && (
                        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12.5px] leading-relaxed text-amber-800" role="status">
                          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                          {t.answer.insufficientNote ?? "I don't have enough authorized data to answer that reliably."}
                        </p>
                      )}

                      <p className="mt-2.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                        <Sparkles className="h-3 w-3" aria-hidden /> {t.modelLabel} · {new Date(t.generatedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                        {t.note && <span>· {t.note}</span>}
                      </p>
                    </article>
                  ) : (
                    <div className="qubit-card border-red-200 bg-red-50/50 px-4 py-3 text-[13px] text-red-700" role="alert">
                      {t.note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* input */}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask(input);
                  }
                }}
                rows={2}
                placeholder="Ask about leads, pipeline, quotations, follow-ups, targets…"
                aria-label="Ask Sales AI"
                className="min-h-[52px] flex-1"
                maxLength={500}
              />
              <Button type="submit" size="lg" className="h-[52px] gap-1.5 px-4" disabled={asking || input.trim().length < 3}>
                <CornerDownLeft className="h-4 w-4" aria-hidden /> Ask
              </Button>
            </form>
            <p className="text-[11px] text-slate-400">Enter to ask · Shift+Enter for a new line · questions stay within your session and are not permanently retained.</p>
          </div>

          {/* side rail — suggestions & sources */}
          <div className="space-y-4">
            <SectionCard title="Suggested questions" description="Calibrated to what the data can answer">
              <ul className="space-y-1.5">
                {questions.slice(0, 8).map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => ask(q)}
                      disabled={asking}
                      className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-left text-[12.5px] leading-snug text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50/50 disabled:opacity-50"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Evidence panel" description="Records behind the latest answer">
              {lastSources.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-muted-foreground">
                  Ask a question — every answer lists the exact records it was grounded in.
                </p>
              ) : (
                <AiSourceList sources={lastSources} title="From your latest answer" />
              )}
            </SectionCard>

            <div className="grid grid-cols-2 gap-3">
              <StatTile icon={<RotateCcw />} value="10 min" label="Answer cache lifetime — cost control, refreshable" />
              <StatTile icon={<ShieldAlert />} value="Scoped" label="Retrieval happens after authorization, never before" />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <AiScopeNote scope={qaScope} what="the records behind every answer" />
        </div>
      </div>
    </SalesAiGate>
  );
}
