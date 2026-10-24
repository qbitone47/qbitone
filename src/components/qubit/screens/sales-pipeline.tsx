"use client";

import * as React from "react";
import { AlertTriangle, Coins, Handshake, Layers, TrendingUp, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard, StatTile } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { PeriodChip } from "../executive/parts";
import { cn } from "@/lib/utils";
import {
  EntityLink,
  fmtCr,
  fmtDate,
  ProbabilityBar,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  ScopeNote,
  useSalesSection,
} from "../sales/parts";

// ============================================================
// Screen 80 · Sales Pipeline — the enterprise Kanban board.
// Open opportunities by stage; closed outcomes (Won/Lost) ride
// alongside as summary columns. There is NO drag-and-drop:
// stage transitions are governed by server-side business rules
// and happen from the opportunity workspace, audited.
// All data from /api/sales?section=pipeline (scoped server-side).
// ============================================================

// ---------- payload shapes (server contract, client mirrors) ----------

interface PipelineCard {
  id: string;
  name: string;
  accountId: string;
  accountName: string;
  ownerName: string;
  ownerId: string;
  valueCr: number;
  probability: number;
  expectedClose: string;
  nextAction?: string;
  riskNote?: string;
  isMine: boolean;
}

interface PipelineColumn {
  stage: string;
  count: number;
  value: number;
  weighted: number;
  cards: PipelineCard[];
}

interface WonCard {
  id: string;
  name: string;
  accountName: string;
  valueCr: number;
  closedAt?: number;
  ownerName: string;
}

interface LostCard {
  id: string;
  name: string;
  lossReason: string;
  ownerName: string;
}

interface PipelinePayload {
  period: { label: string; window: string; asOfLabel: string };
  columns: PipelineColumn[];
  won: { count: number; value: number; cards: WonCard[] };
  lost: { count: number; cards: LostCard[] };
  totals: { gross: number; weighted: number; count: number };
}

// ---------- board pieces ----------

const COLUMN_TONE: Record<string, string> = {
  Won: "border-t-emerald-300",
  Lost: "border-t-red-200",
};

function RiskChip({ note }: { note: string }) {
  return (
    <span
      title={note}
      className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-px text-[10.5px] font-medium text-amber-700"
    >
      <AlertTriangle className="h-3 w-3" aria-hidden />
      Risk
      <span className="sr-only"> — {note}</span>
    </span>
  );
}

function MineChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-px text-[10.5px] font-medium text-blue-700">
      <User className="h-3 w-3" aria-hidden />
      Mine
    </span>
  );
}

function OpenCard({ card }: { card: PipelineCard }) {
  return (
    <article className="qubit-card p-3">
      <div className="min-w-0">
        <EntityLink screen="opportunity-detail" id={card.id} label={card.name} kind="opportunity" />
      </div>
      <p className="mt-0.5 truncate text-[11px] text-slate-400">
        {card.accountName} · {card.ownerName}
      </p>
      <p className="mt-1.5 text-[15px] font-semibold tabular-nums text-slate-900">{fmtCr(card.valueCr)}</p>
      <div className="mt-1.5">
        <ProbabilityBar probability={card.probability} />
      </div>
      <p className="mt-1.5 text-[11px] tabular-nums text-slate-400">Close {card.expectedClose}</p>
      {card.nextAction && <p className="mt-1 line-clamp-1 text-[11.5px] leading-relaxed text-slate-500">{card.nextAction}</p>}
      {(card.riskNote || card.isMine) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {card.riskNote && <RiskChip note={card.riskNote} />}
          {card.isMine && <MineChip />}
        </div>
      )}
    </article>
  );
}

function BoardColumn({
  stage,
  count,
  value,
  weighted,
  serverCount,
  filtersActive,
  children,
}: {
  stage: string;
  count: number;
  /** gross value for the header line — omitted for columns without server-side value data (Lost) */
  value?: number;
  weighted?: number;
  serverCount?: number;
  filtersActive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={`${stage} column — ${count} deals`}
      className={cn(
        "flex w-[280px] min-w-[280px] shrink-0 flex-col rounded-xl border border-t-2 border-slate-200/80 bg-slate-50/50",
        COLUMN_TONE[stage] ?? "border-t-blue-200",
      )}
    >
      <header className="px-3.5 pb-2.5 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold tracking-tight text-slate-800">{stage}</h3>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] tabular-nums text-slate-600">
            {count}
            {filtersActive && serverCount !== undefined && serverCount !== count ? ` of ${serverCount}` : ""}
          </span>
        </div>
        {value !== undefined && (
          <p className="mt-1 text-[11px] tabular-nums text-slate-400">
            {fmtCr(value)} gross
            {weighted !== undefined && (
              <>
                {" · "}
                <span className="text-slate-400/90">{fmtCr(weighted)} weighted</span>
              </>
            )}
          </p>
        )}
      </header>
      <div className="flex-1 space-y-2 px-2.5 pb-2.5">{children}</div>
    </section>
  );
}

function ColumnEmpty({ message = "No deals in this stage" }: { message?: string }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-[11px] text-slate-400">{message}</p>
  );
}

// ============================================================
// Screen
// ============================================================

export function SalesPipelineScreen() {
  const { role } = useRole();
  const nav = useQubitNav();
  const { data, loading, error, forbidden, reload } = useSalesSection<PipelinePayload>("pipeline");

  // ---------- client-side filters (server already scoped the rows) ----------
  const [owner, setOwner] = React.useState("all");
  const [onlyMine, setOnlyMine] = React.useState(false);
  const [riskOnly, setRiskOnly] = React.useState(false);

  const owners = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const col of data?.columns ?? []) {
      for (const c of col.cards) {
        if (!map.has(c.ownerId)) map.set(c.ownerId, c.ownerName);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const filtersActive = owner !== "all" || onlyMine || riskOnly;

  const passes = React.useCallback(
    (c: PipelineCard) =>
      (owner === "all" || c.ownerId === owner) && (!onlyMine || c.isMine) && (!riskOnly || Boolean(c.riskNote)),
    [owner, onlyMine, riskOnly],
  );

  const view = React.useMemo(() => {
    if (!data) return null;
    const columns = data.columns.map((col) => {
      const cards = col.cards.filter(passes);
      return {
        ...col,
        cards,
        count: cards.length,
        value: cards.reduce((sum, c) => sum + c.valueCr, 0),
        weighted: cards.reduce((sum, c) => sum + (c.valueCr * c.probability) / 100, 0),
      };
    });
    const shown = columns.reduce((sum, c) => sum + c.count, 0);
    return { columns, shown };
  }, [data, passes]);

  // display-only mirror of the server's role→scope mapping (the pipeline payload carries no scope field)
  const scope = role === "sales-exec" ? "own" : role === "dept-head" ? "team" : "company";

  if (forbidden) {
    return (
      <SalesGate screenName="Sales Pipeline">
        <></>
      </SalesGate>
    );
  }

  const totals = data?.totals;
  const period = data?.period;
  const emptyBoard = Boolean(totals && totals.count === 0);

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Sales Pipeline" }]}
        title="Sales Pipeline"
        description="Open opportunities by stage — stage transitions are governed by server-side business rules, not by where a card is dropped."
        meta={period && <PeriodChip label={period.label} window={period.window} />}
      />

      {error && <SalesErrorBanner message={error} onRetry={reload} />}
      {loading && <SalesSkeleton rows={4} />}

      {data && view && totals && period && !loading && (
        <div className="space-y-4">
          {/* ---------- summary band ---------- */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile icon={<Layers />} value={<span className="tabular-nums">{fmtCr(totals.gross)}</span>} label="Gross pipeline" />
            <StatTile icon={<Coins />} value={<span className="tabular-nums">{fmtCr(totals.weighted)}</span>} label="Weighted pipeline" />
            <StatTile icon={<Handshake />} value={<span className="tabular-nums">{String(totals.count)}</span>} label="Open deals in scope" />
          </div>
          <div className="space-y-1 px-1">
            <p className="text-[11px] text-slate-400">
              Counting {totals.count} opportunities in your current scope — the company-wide aggregate lives in the Sales Command
              Center.
            </p>
            <ScopeNote scope={scope} what="opportunities" />
          </div>

          {/* ---------- filters ---------- */}
          <div className="qubit-card px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
              <Select
                value={owner}
                onValueChange={(v) => setOwner(v || "all")}
              >
                <SelectTrigger className="h-9 w-[190px]" aria-label="Filter by owner">
                  <SelectValue placeholder="All owners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All owners</SelectItem>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pipe-only-mine"
                  checked={onlyMine}
                  onCheckedChange={(v) => setOnlyMine(v === true)}
                  aria-label="Only my deals"
                />
                <Label htmlFor="pipe-only-mine" className="text-[13px] font-normal text-slate-600">
                  Only mine
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pipe-risk-only"
                  checked={riskOnly}
                  onCheckedChange={(v) => setRiskOnly(v === true)}
                  aria-label="Only deals flagged at risk"
                />
                <Label htmlFor="pipe-risk-only" className="text-[13px] font-normal text-slate-600">
                  Risk-only
                </Label>
              </div>
              {filtersActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 text-xs text-blue-600"
                  onClick={() => {
                    setOwner("all");
                    setOnlyMine(false);
                    setRiskOnly(false);
                  }}
                >
                  Clear filters
                </Button>
              )}
              <p className="ml-auto text-[11px] tabular-nums text-slate-400" role="status">
                {filtersActive ? `${view.shown} of ${totals.count} open deals shown` : `${totals.count} open deals in scope`}
              </p>
            </div>
          </div>

          {/* ---------- board ---------- */}
          <SectionCard
            title="Board"
            description="Six governed open stages, then the closed outcomes. Cards open the opportunity workspace."
          >
            {emptyBoard ? (
              <EmptyState
                icon={<TrendingUp />}
                title="No open deals in the pipeline"
                message="Every open opportunity has converted, closed or moved on. Start from the Lead Inbox to create the next one."
                action={
                  <Button size="sm" className="h-9 gap-1.5" onClick={() => nav.navigate("lead-inbox")}>
                    <Users className="h-4 w-4" aria-hidden /> Open Lead Inbox
                  </Button>
                }
              />
            ) : (
              <>
                {/* text summary for screen readers — the board itself is a horizontal scroll surface.
                    Kept inside a relative box so the absolute sr-only positioning never escapes
                    the board's overflow clipping and widens the page on mobile. */}
                <div className="relative">
                  <p className="sr-only">
                  Pipeline board summary:{" "}
                  {view.columns.map((c) => `${c.count} deals in ${c.stage} worth ${fmtCr(c.value)}`).join("; ")}. Also{" "}
                  {data.won.count} won deals worth {fmtCr(data.won.value)} and {data.lost.count} lost deals.
                </p>
                <div className="qubit-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                  {view.columns.map((col) => (
                    <BoardColumn
                      key={col.stage}
                      stage={col.stage}
                      count={col.count}
                      value={col.value}
                      weighted={col.weighted}
                      serverCount={data.columns.find((c) => c.stage === col.stage)?.count}
                      filtersActive={filtersActive}
                    >
                      {col.cards.length === 0 ? (
                        <ColumnEmpty />
                      ) : (
                        col.cards.map((card) => <OpenCard key={card.id} card={card} />)
                      )}
                    </BoardColumn>
                  ))}

                  {/* closed outcomes — compact summary columns, never re-opened here */}
                  <BoardColumn stage="Won" count={data.won.count} value={data.won.value}>
                    {data.won.cards.length === 0 ? (
                      <ColumnEmpty message="No won deals yet" />
                    ) : (
                      data.won.cards.map((w) => (
                        <article key={w.id} className="qubit-card p-3">
                          <div className="min-w-0">
                            <EntityLink screen="opportunity-detail" id={w.id} label={w.name} kind="opportunity" />
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-slate-400">
                            {w.accountName} · {w.ownerName}
                          </p>
                          <p className="mt-1.5 text-[15px] font-semibold tabular-nums text-emerald-700">{fmtCr(w.valueCr)}</p>
                          {w.closedAt && <p className="mt-1 text-[11px] tabular-nums text-slate-400">Closed {fmtDate(w.closedAt)}</p>}
                        </article>
                      ))
                    )}
                  </BoardColumn>
                  <BoardColumn stage="Lost" count={data.lost.count}>
                    {data.lost.cards.length === 0 ? (
                      <ColumnEmpty message="Nothing lost" />
                    ) : (
                      data.lost.cards.map((l) => (
                        <article key={l.id} className="qubit-card p-3">
                          <div className="min-w-0">
                            <EntityLink screen="opportunity-detail" id={l.id} label={l.name} kind="opportunity" />
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-slate-500">{l.lossReason}</p>
                          <p className="mt-1 truncate text-[11px] text-slate-400">{l.ownerName}</p>
                        </article>
                      ))
                    )}
                  </BoardColumn>
                </div>
                </div>
                <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-400">
                  Stage changes happen from the opportunity workspace so every transition passes the business rules and is audited.
                  Filters narrow the open stages; the Won and Lost columns always show their full summary.
                </p>
              </>
            )}
          </SectionCard>

          <SalesAsOf asOfLabel={period.asOfLabel} note="Values are gross deal values; weighted = value × probability, computed server-side." />
        </div>
      )}

      {!loading && !data && !error && (
        <div className="qubit-card">
          <EmptyState
            icon={<TrendingUp />}
            title="Pipeline could not load"
            message="The sales service returned no data. Retry, or check the service status."
            action={
              <Button size="sm" onClick={reload}>
                Retry
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
