"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, BarChart3, Check, X } from "lucide-react";
import { PageHeader } from "../page-header";
import {
  DSCaption,
  DSExample,
  DSGuidance,
  DSScreenNav,
  DSSection,
  DSSpec,
  DSVar,
} from "../ds/doc";
import { EmptyState } from "../primitives";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useToast } from "@/hooks/use-toast";
import { formatCount } from "@/lib/qubit/data";
import { cn } from "@/lib/utils";

// ============================================================
// Screen 20 — Charts. The data-visualization language:
// a five-color series palette, the four chart archetypes
// (trend / comparison / composition / volume), progress and
// funnel patterns, and every governed chart state.
// ============================================================

const SERIES = [
  {
    name: "Primary series",
    hex: "#2563EB",
    token: "blue-600",
    usage: "First and most important series. Every chart starts here.",
  },
  {
    name: "Secondary series",
    hex: "#0D9488",
    token: "teal-600",
    usage: "Second series, or a distinct sub-state (onboarding, health).",
  },
  {
    name: "Tertiary series",
    hex: "#7C3AED",
    token: "violet-600",
    usage: "Third series — compositions only, rarely for trends.",
  },
  {
    name: "Warning series",
    hex: "#F59E0B",
    token: "amber-500",
    usage: "Contrast series — rejections, risk, breached thresholds.",
  },
  {
    name: "Context series",
    hex: "#94A3B8",
    token: "slate-400",
    usage: "Deactivated or context data that must visually recede.",
  },
];

const APPROVALS = [
  { week: "W1", approved: 86, rejected: 44 },
  { week: "W2", approved: 92, rejected: 48 },
  { week: "W3", approved: 78, rejected: 52 },
  { week: "W4", approved: 105, rejected: 47 },
  { week: "W5", approved: 98, rejected: 55 },
  { week: "W6", approved: 112, rejected: 49 },
  { week: "W7", approved: 88, rejected: 61 },
  { week: "W8", approved: 120, rejected: 57 },
  { week: "W9", approved: 96, rejected: 63 },
  { week: "W10", approved: 104, rejected: 52 },
  { week: "W11", approved: 110, rejected: 58 },
  { week: "W12", approved: 118, rejected: 46 },
];

const approvalsConfig = {
  approved: { label: "Approved", color: "#2563EB" },
  rejected: { label: "Rejected", color: "#F59E0B" },
} satisfies ChartConfig;

const HEADCOUNT = [
  { dept: "Eng", headcount: 342 },
  { dept: "Sales", headcount: 287 },
  { dept: "Support", headcount: 176 },
  { dept: "Mktg", headcount: 132 },
  { dept: "Fin", headcount: 126 },
  { dept: "HR", headcount: 84 },
];

const headcountConfig = {
  headcount: { label: "Headcount", color: "#2563EB" },
  Eng: { label: "Engineering" },
  Sales: { label: "Sales" },
  Support: { label: "Support" },
  Mktg: { label: "Marketing" },
  Fin: { label: "Finance" },
  HR: { label: "HR" },
} satisfies ChartConfig;

const PIPELINE = [
  { stage: "Discovery", value: 128, fill: "#2563EB" },
  { stage: "Qualified", value: 92, fill: "#0D9488" },
  { stage: "Proposal", value: 56, fill: "#7C3AED" },
  { stage: "Negotiation", value: 36, fill: "#94A3B8" },
];
const PIPELINE_TOTAL = PIPELINE.reduce((sum, s) => sum + s.value, 0); // 312

const pipelineConfig = {
  discovery: { label: "Discovery", color: "#2563EB" },
  qualified: { label: "Qualified", color: "#0D9488" },
  proposal: { label: "Proposal", color: "#7C3AED" },
  negotiation: { label: "Negotiation", color: "#94A3B8" },
} satisfies ChartConfig;

const REVENUE = [
  { month: "Apr", revenue: 42 },
  { month: "May", revenue: 45 },
  { month: "Jun", revenue: 44 },
  { month: "Jul", revenue: 51 },
  { month: "Aug", revenue: 56 },
  { month: "Sep", revenue: 54 },
  { month: "Oct", revenue: 61 },
  { month: "Nov", revenue: 66 },
  { month: "Dec", revenue: 64 },
  { month: "Jan", revenue: 71 },
  { month: "Feb", revenue: 76 },
  { month: "Mar", revenue: 82 },
];

const revenueConfig = {
  revenue: { label: "Revenue (₹ Cr)", color: "#2563EB" },
} satisfies ChartConfig;

const PROGRESS_ROWS = [
  { label: "Quota attainment — Sales", value: 72, bar: "[&>div]:bg-blue-600", tone: "text-blue-700" },
  { label: "Onboarding completion — new hires", value: 45, bar: "[&>div]:bg-teal-600", tone: "text-teal-700" },
  { label: "CSAT — Support", value: 88, bar: "[&>div]:bg-emerald-600", tone: "text-emerald-700" },
];

const FUNNEL = [
  { stage: "Leads", count: 1240, tint: "bg-blue-600" },
  { stage: "Qualified", count: 620, tint: "bg-blue-600/80" },
  { stage: "Proposal", count: 280, tint: "bg-blue-600/60" },
  { stage: "Won", count: 96, tint: "bg-blue-600/40" },
];
const FUNNEL_TOP = FUNNEL[0]?.count ?? 1;

const TICK_OVERRIDE = "[&_.recharts-cartesian-axis-tick_text]:fill-slate-400";

export function ChartsScreen() {
  const { toast } = useToast();

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Charts"
        description="Data-visualization language that communicates, not decorates."
      />

      <div className="space-y-6">
        {/* ── 1. Chart palette & rules ───────────────────────── */}
        <DSSection
          title="Chart palette & rules"
          purpose="Five series colors. No exceptions. The palette is the system — a chart that needs a sixth color needs a redesign."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SERIES.map((s) => (
              <div key={s.hex} className="rounded-xl border border-slate-200/80 bg-white p-3.5">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden className="h-7 w-7 shrink-0 rounded-md ring-1 ring-inset ring-black/5" style={{ backgroundColor: s.hex }} />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[12px] font-medium text-slate-800">{s.hex}</p>
                    <p className="truncate text-[11px] text-slate-400">{s.token}</p>
                  </div>
                </div>
                <p className="mt-2 text-[12px] font-medium text-slate-700">{s.name}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{s.usage}</p>
              </div>
            ))}
          </div>

          <ul className="mt-5 space-y-2 border-t border-slate-100 pt-4">
            <li className="flex items-start gap-2 text-[13px] text-slate-600">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              Maximum 5 series per chart — beyond that, split the chart or the question.
            </li>
            <li className="flex items-start gap-2 text-[13px] text-slate-600">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              Blue goes first — the primary series is always <DSVar>blue-600</DSVar>; series order is fixed.
            </li>
            <li className="flex items-start gap-2 text-[13px] text-slate-600">
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden />
              No rainbow palettes, no 3D, no gradients, no purely decorative charts.
            </li>
            <li className="flex items-start gap-2 text-[13px] text-slate-600">
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden />
              Never encode meaning in color alone — every series carries a direct label.
            </li>
          </ul>
        </DSSection>

        {/* ── 2. Trend — line chart ──────────────────────────── */}
        <DSSection
          title="Trend — line chart"
          purpose="How a metric moves over time. Two to three series maximum; each line is labeled, never color-only."
        >
          <ChartContainer
            config={approvalsConfig}
            role="img"
            aria-label="Line chart: approvals processed over the last 12 weeks — approved versus rejected"
            className={cn("h-56 w-full md:h-64", TICK_OVERRIDE)}
          >
            <LineChart data={APPROVALS} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} width={32} tick={{ fontSize: 11 }} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend verticalAlign="bottom" content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="approved" stroke="var(--color-approved)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="rejected" stroke="var(--color-rejected)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ChartContainer>
          <DSCaption>
            Axis ticks 11px slate-400, no axis lines · gridlines dashed <DSVar>&quot;3 3&quot;</DSVar> slate-200,
            horizontal only · tooltip: white, border, soft shadow · legend below the plot.
          </DSCaption>
        </DSSection>

        {/* ── 3. Comparison — bar chart ──────────────────────── */}
        <DSSection
          title="Comparison — bar chart"
          purpose="Ranking across categories. Sort descending, label every bar, one color — emphasis comes from order, not hue."
        >
          <ChartContainer
            config={headcountConfig}
            role="img"
            aria-label="Bar chart: headcount by department, sorted descending — Engineering 342, Sales 287, Support 176, Marketing 132, Finance 126, HR 84"
            className={cn("h-56 w-full md:h-64", TICK_OVERRIDE)}
          >
            <BarChart data={HEADCOUNT} margin={{ top: 20, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="dept" tickLine={false} axisLine={false} tickMargin={8} interval={0} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} width={32} tick={{ fontSize: 11 }} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="headcount" fill="var(--color-headcount)" radius={[4, 4, 0, 0]} maxBarSize={44}>
                <LabelList dataKey="headcount" position="top" fontSize={11} fill="#64748B" />
              </Bar>
            </BarChart>
          </ChartContainer>
          <DSCaption>
            Six bars, one color (<DSVar>blue-600</DSVar>), rounded tops <DSVar>radius [4,4,0,0]</DSVar>, sorted
            descending, value on every bar. Full department names live in the tooltip. Top six departments shown — 1,147
            of 1,245 employees.
          </DSCaption>
        </DSSection>

        {/* ── 4. Composition — donut chart ───────────────────── */}
        <DSSection
          title="Composition — donut chart"
          purpose="Share of a whole, four slices maximum, starting at 12 o'clock. The center carries the total — the legend carries the numbers."
        >
          <div className="flex flex-col items-center gap-8 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <ChartContainer
                config={pipelineConfig}
                role="img"
                aria-label="Donut chart: sales pipeline by stage — 312 open deals total"
                className="h-64 w-full"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie
                    data={PIPELINE}
                    dataKey="value"
                    nameKey="stage"
                    innerRadius={60}
                    outerRadius={80}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={2}
                    strokeWidth={2}
                    stroke="#ffffff"
                    cornerRadius={3}
                  >
                    {PIPELINE.map((slice) => (
                      <Cell key={slice.stage} fill={slice.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-semibold tracking-tight text-slate-900">{PIPELINE_TOTAL}</p>
                <p className="text-xs text-slate-500">open deals</p>
              </div>
            </div>

            <ul aria-label="Pipeline stages" className="w-full shrink-0 space-y-2.5 lg:w-56">
              {PIPELINE.map((slice) => (
                <li key={slice.stage} className="flex items-center gap-2.5 text-[13px]">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: slice.fill }} />
                  <span className="min-w-0 flex-1 truncate text-slate-600">{slice.stage}</span>
                  <span className="tabular-nums font-medium text-slate-900">{slice.value}</span>
                  <span className="w-9 text-right text-xs tabular-nums text-slate-400">
                    {Math.round((slice.value / PIPELINE_TOTAL) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <DSCaption>
            Starts at 12 o&apos;clock, reads clockwise in palette order. Legend sits right with values and shares — the
            donut itself never wears labels.
          </DSCaption>
        </DSSection>

        {/* ── 5. Volume over time — area chart ───────────────── */}
        <DSSection
          title="Volume over time — area chart"
          purpose="A single series where the shape of the volume matters. One color, whisper-quiet fill."
        >
          <ChartContainer
            config={revenueConfig}
            role="img"
            aria-label="Area chart: revenue across FY2026, April 2025 to March 2026, rising from 42 to 82 crore rupees"
            className={cn("h-56 w-full md:h-64", TICK_OVERRIDE)}
          >
            <AreaChart data={REVENUE} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} tick={{ fontSize: 11 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                tickFormatter={(v: number) => `₹${v}`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-revenue)"
                strokeWidth={2}
                fill="var(--color-revenue)"
                fillOpacity={0.08}
              />
            </AreaChart>
          </ChartContainer>
          <DSCaption>
            <DSVar>fillOpacity 0.08</DSVar> — the maximum subtlety allowed for area fills. Area communicates volume; when
            precision matters, a line chart is the honest choice.
          </DSCaption>
        </DSSection>

        {/* ── 6. Progress & funnel ───────────────────────────── */}
        <DSSection
          title="Progress & funnel"
          purpose="Charts without axes: progress bars for targets, funnels for conversion. Both are labeled in text, not decoded from color."
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-5">
              {PROGRESS_ROWS.map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-slate-700">{row.label}</span>
                    <span className={cn("tabular-nums font-semibold", row.tone)}>{row.value}%</span>
                  </div>
                  <Progress
                    value={row.value}
                    aria-label={row.label}
                    className={cn("mt-2 h-2 bg-slate-100", row.bar)}
                  />
                </div>
              ))}
              <DSCaption>Value labels sit outside the bar; color reinforces, text decides.</DSCaption>
            </div>

            <div className="space-y-4">
              {FUNNEL.map((row) => {
                const pct = Math.round((row.count / FUNNEL_TOP) * 1000) / 10;
                return (
                  <div key={row.stage}>
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="font-medium text-slate-800">{row.stage}</span>
                      <span className="tabular-nums text-slate-500">
                        {formatCount(row.count)} <span className="text-slate-400">· {pct}%</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-3 rounded-full bg-slate-100">
                      <div className={cn("h-full rounded-full duration-200 transition-all", row.tint)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <DSCaption>
                Funnel = conversion story: bar width encodes share of top-of-funnel volume (1,240 leads). End-to-end: 96
                won of 1,240 leads — 7.7%.
              </DSCaption>
            </div>
          </div>
        </DSSection>

        {/* ── 7. Chart states ────────────────────────────────── */}
        <DSSection
          title="Chart states"
          purpose="A chart is a component — it loads, empties, fails and hits zero. Each state has governed copy."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <DSExample label="Loading — skeleton holds the chart's footprint">
              <div className="qubit-card p-4">
                <div className="mb-3 h-3 w-32 animate-pulse rounded bg-slate-200" aria-hidden />
                <div className="h-40 animate-pulse rounded-lg bg-slate-100" aria-hidden />
                <p className="sr-only" role="status">
                  Loading chart…
                </p>
              </div>
            </DSExample>

            <DSExample label="Empty — say what period, offer a way out">
              <div className="qubit-card p-4">
                <EmptyState
                  icon={<BarChart3 />}
                  title="No data for this period"
                  message="Try widening the date range or selecting another team."
                  className="py-8"
                />
              </div>
            </DSExample>

            <DSExample label="Error — one banner, one retry">
              <div className="qubit-card p-4">
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
                  <p className="min-w-0 flex-1 text-[13px] font-medium text-red-700">Chart failed to load</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => toast({ title: "Retrying…", description: "Re-fetching chart data." })}
                  >
                    Retry
                  </Button>
                </div>
                <div className="flex items-center justify-center py-8 text-xs text-slate-400">No chart to display</div>
              </div>
            </DSExample>

            <DSExample label="No-data vs zero — two different sentences, on purpose">
              <div className="qubit-card space-y-3 p-4">
                <div className="rounded-lg border border-slate-200/80 p-3">
                  <p className="text-xs font-semibold text-slate-900">
                    No data <span className="font-normal text-slate-400">— the selection returned nothing</span>
                  </p>
                  <p className="mt-1 text-[13px] text-slate-500">&quot;No data for this period.&quot;</p>
                </div>
                <div className="rounded-lg border border-slate-200/80 p-3">
                  <p className="text-xs font-semibold text-slate-900">
                    Zero <span className="font-normal text-slate-400">— data exists and is genuinely 0</span>
                  </p>
                  <p className="mt-1 text-[13px] text-slate-500">&quot;0 approvals this week — inbox is clear.&quot;</p>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">
                  Governed copy: &quot;No data&quot; means the query found nothing; &quot;Zero&quot; means it found zeros.
                </p>
              </div>
            </DSExample>
          </div>
        </DSSection>

        {/* ── 8. Guidance ────────────────────────────────────── */}
        <DSSection title="Guidance" purpose="What keeps two hundred charts reading as one system.">
          <div className="grid gap-4 md:grid-cols-2">
            <DSGuidance kind="do" title="communicate, don't decorate">
              <ul className="list-inside space-y-1.5">
                <li>Label axes with units — numbers without units are trivia.</li>
                <li>Legends sit directly on the chart; blue-first palette, five series maximum.</li>
                <li>Tooltips carry precision; the chart carries the shape of the story.</li>
                <li>Sort comparisons deliberately (descending by default) and label every bar.</li>
              </ul>
            </DSGuidance>
            <DSGuidance kind="dont" title="dress data up as decoration">
              <ul className="list-inside space-y-1.5">
                <li>3D, perspective, shadows on bars, or gradient fills.</li>
                <li>Rainbow palettes — color must map to meaning, not variety.</li>
                <li>Charts without axes or units, or pies with more than 5 slices.</li>
                <li>Charts that answer no question anyone asked — if in doubt, show the number.</li>
              </ul>
            </DSGuidance>
          </div>
        </DSSection>

        {/* ── Specification ──────────────────────────────────── */}
        <DSSection title="Specification" purpose="The contract every Qubit One chart follows.">
          <DSSpec
            rows={[
              {
                label: "Purpose",
                value: (
                  <>Turn numbers into decisions — trend (line), comparison (bar), composition (donut) and progress (bars, funnel) in one visual language.</>
                ),
              },
              {
                label: "Use when",
                value: (
                  <>The story is a shape: movement over time, a ranking, a share of whole, or progress toward a target. A single KPI is a StatTile, not a chart.</>
                ),
              },
              {
                label: "Avoid when",
                value: (
                  <>Row-level precision or export matters (table — Screen 18), or no question exists the chart answers.</>
                ),
              },
              {
                label: "States",
                value: (
                  <>
                    Loading (skeleton block), empty (<DSVar>&quot;No data for this period&quot;</DSVar>), error (inline
                    banner + Retry), zero (governed copy — data exists and is 0).
                  </>
                ),
              },
              {
                label: "Responsive",
                value: (
                  <>
                    <DSVar>h-56</DSVar> on mobile → <DSVar>h-64</DSVar> on desktop; legends wrap below the plot; x-axis
                    labels thin out via <DSVar>minTickGap</DSVar>, never overlap.
                  </>
                ),
              },
              {
                label: "Accessibility",
                value: (
                  <>
                    Every chart carries <DSVar>role=&quot;img&quot;</DSVar> with a text alternative via{" "}
                    <DSVar>aria-label</DSVar>; series differ by label as well as color; exact values remain available in
                    tooltips and, where precision matters, in an adjacent table.
                  </>
                ),
              },
            ]}
          />
        </DSSection>

        <DSScreenNav id="charts" />
      </div>
    </>
  );
}
