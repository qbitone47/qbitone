"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, useObsSection } from "../obs/parts";

// ============================================================
// P23-05 · Service Map — CSS-only topology (no canvas/svg art):
// nodes as status cards grouped by kind, edges as a plain
// relation table. Every status measured at request time.
// ============================================================

interface MapNode {
  id: string;
  label: string;
  kind: string;
  status: string;
  note: string;
}

interface MapEdge {
  from: string;
  to: string;
  relation: string;
}

interface ServiceMapPayload {
  nodes: MapNode[];
  edges: MapEdge[];
  drawnFrom: string;
  sourceNote: string;
}

const KIND_ORDER = ["application", "api", "service", "database", "auth", "integration", "infrastructure"] as const;

function kindLabel(kind: string): string {
  switch (kind) {
    case "api":
      return "API";
    case "auth":
      return "Auth";
    default:
      return kind.charAt(0).toUpperCase() + kind.slice(1);
  }
}

export function P23ServiceMapScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<ServiceMapPayload>("service-map");

  const labelOf = React.useCallback(
    (id: string) => data?.nodes.find((n) => n.id === id)?.label ?? id,
    [data],
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Service Map"
        description="The real topology of this deployment — architecture constants verified in the repository, node statuses measured live at request time. Rendered as cards and relations, not decorative art."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-5">
            {/* Nodes — grouped by kind */}
            <div className="space-y-5 lg:col-span-3" aria-label="Service nodes grouped by kind">
              {KIND_ORDER.map((kind) => {
                const group = data.nodes.filter((n) => n.kind === kind);
                if (group.length === 0) return null;
                return (
                  <section key={kind} aria-label={`${kindLabel(kind)} nodes`}>
                    <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      {kindLabel(kind)} <span className="font-medium normal-case tracking-normal text-slate-300">· {group.length}</span>
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {group.map((n) => (
                        <div key={n.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]" role="status" aria-label={`${n.label} node`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 text-[12.5px] font-semibold text-slate-800">{n.label}</p>
                            <OpsHealthBadge health={n.status} className="shrink-0" />
                          </div>
                          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{n.note}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
              {data.nodes.length === 0 && (
                <p className="text-[12.5px] text-slate-500" role="status">No service nodes are defined for this deployment.</p>
              )}
            </div>

            {/* Edges — relation table */}
            <div className="lg:col-span-2">
              <SectionCard title="Relations" description="Directed dependencies between the nodes.">
                {data.edges.length === 0 ? (
                  <p className="text-[12.5px] text-slate-500" role="status">No relations are recorded for this topology.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-[12.5px]" aria-label="Service relations">
                      <thead>
                        <tr>
                          <th scope="col" className="border-b border-slate-200 px-3 py-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500">Direction</th>
                          <th scope="col" className="border-b border-slate-200 px-3 py-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500">Relation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.edges.map((e, i) => (
                          <tr key={i} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                            <td className="px-3 py-2.5">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <span className="font-medium text-slate-800">{labelOf(e.from)}</span>
                                <ArrowRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span className="font-medium text-slate-800">{labelOf(e.to)}</span>
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-slate-500">{e.relation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" role="note">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Drawn from</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{data.drawnFrom}</p>
          </div>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
