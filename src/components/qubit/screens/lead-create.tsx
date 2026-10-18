"use client";

import * as React from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import {
  AuditedHint,
  SalesApiError,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  salesPost,
  useSalesSection,
} from "../sales/parts";
import { ConfirmDialog, Field } from "../dialogs";

// ============================================================
// Screen 76 · Lead Creation — clean enterprise lead form.
// Client validation is a courtesy; the SERVER is authoritative:
// it re-validates, runs duplicate detection (409 possible_duplicates
// must be reviewed — never silently bypassed) and on success creates
// the initial activity, optional follow-up and owner notification.
// ============================================================

interface FormRefsPayload {
  owners: { id: string; name: string; title: string }[];
  sources: string[];
  industries: string[];
  products: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  contacts: { id: string; name: string }[];
}

interface Match {
  kind: string;
  id: string;
  label: string;
  reason: string;
}

interface FormState {
  name: string;
  company: string;
  contactPerson: string;
  phone: string;
  email: string;
  source: string;
  industry: string;
  location: string;
  priority: "Hot" | "Warm" | "Cold";
  valueCr: string;
  expectedClose: string;
  notes: string;
  nextFollowUp: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  company: "",
  contactPerson: "",
  phone: "",
  email: "",
  source: "",
  industry: "",
  location: "",
  priority: "Warm",
  valueCr: "",
  expectedClose: "",
  notes: "",
  nextFollowUp: "",
};

const PRIORITIES: FormState["priority"][] = ["Hot", "Warm", "Cold"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ()-]{8,18}$/; // mirrors the server-side rule

const PRIORITY_TONE: Record<FormState["priority"], string> = {
  Hot: "border-red-200 bg-red-50 text-red-700",
  Warm: "border-amber-200 bg-amber-50 text-amber-700",
  Cold: "border-slate-200 bg-slate-50 text-slate-600",
};

const KIND_CHIP: Record<string, string> = {
  lead: "border-blue-200 bg-blue-50 text-blue-700",
  contact: "border-violet-200 bg-violet-50 text-violet-700",
  account: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const kindLabel = (kind: string) => kind.charAt(0).toUpperCase() + kind.slice(1);

/** "2026-12-20" → "20 Dec 2026" — matches the canonical fixture display format. */
const toDisplayDate = (iso: string): string | undefined => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export function LeadCreateScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { data: refs, loading, error, forbidden, reload } = useSalesSection<FormRefsPayload>("form-refs");
  // The leads payload carries server-computed `isMine` — the only honest
  // client-side way to resolve the sales-exec session identity for the owner lock.
  const { data: inbox } = useSalesSection<{ rows: { ownerId: string; isMine: boolean }[] }>("leads");
  const selfOwnerId = React.useMemo(() => inbox?.rows.find((r) => r.isMine)?.ownerId ?? null, [inbox]);
  const ownerLocked = role === "sales-exec" && selfOwnerId !== null;

  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [ownerId, setOwnerId] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [matches, setMatches] = React.useState<Match[] | null>(null);
  const [dupeMessage, setDupeMessage] = React.useState<string | null>(null);
  const [forceOpen, setForceOpen] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const defaultOwnerId = refs?.owners.find((o) => o.id === "pankaj")?.id ?? refs?.owners[0]?.id ?? "";
  const effectiveOwner = ownerLocked && selfOwnerId ? selfOwnerId : ownerId || defaultOwnerId;

  const update = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    // Identity fields drive server duplicate matching — a change invalidates a stale review card.
    if (Object.keys(patch).some((k) => ["name", "company", "phone", "email"].includes(k))) {
      setMatches(null);
      setDupeMessage(null);
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Lead name is required.";
    if (!form.company.trim()) e.company = "Company is required.";
    if (!form.contactPerson.trim()) e.contactPerson = "Contact person is required.";
    if (!form.phone.trim()) e.phone = "Phone is required.";
    else if (!PHONE_RE.test(form.phone.trim())) e.phone = "Enter a valid phone number (e.g. +91 98200 51001).";
    if (!form.email.trim()) e.email = "Email is required.";
    else if (!EMAIL_RE.test(form.email.trim())) e.email = "Enter a valid email address.";
    if (!effectiveOwner) e.owner = "Choose an owner — leads are never created unowned.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildInput = (force: boolean): Record<string, unknown> => {
    const value = Number(form.valueCr);
    const followUp = form.nextFollowUp ? new Date(form.nextFollowUp).getTime() : undefined;
    return {
      name: form.name.trim(),
      company: form.company.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      source: form.source || undefined,
      industry: form.industry || undefined,
      location: form.location.trim() || undefined,
      ownerId: effectiveOwner,
      priority: form.priority,
      estimatedValueCr: Number.isFinite(value) && form.valueCr.trim() !== "" ? value : undefined,
      expectedClose: form.expectedClose ? toDisplayDate(form.expectedClose) : undefined,
      notes: form.notes.trim() || undefined,
      nextFollowUpAt: Number.isFinite(followUp as number) ? followUp : undefined,
      ...(force ? { force: true } : {}),
    };
  };

  const submit = async (force: boolean) => {
    if (!force && !validate()) {
      toast({
        variant: "destructive",
        title: "Check the highlighted fields",
        description: "The server re-validates everything — this is just a first pass.",
      });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    if (force) {
      setMatches(null);
      setDupeMessage(null);
    }
    try {
      const res = await salesPost<{ ok: boolean; message: string; lead: { id: string } }>(
        "lead.create",
        buildInput(force),
        role,
      );
      toast({ title: "Lead created", description: res.message });
      nav.navigate("lead-detail", { leadId: res.lead.id });
    } catch (err) {
      if (err instanceof SalesApiError && err.status === 409 && err.code === "possible_duplicates" && err.matches?.length) {
        // Duplicate guard — rendered as a reviewable card, never silently bypassed.
        setMatches(err.matches);
        setDupeMessage(err.message);
        toast({ variant: "destructive", title: "Review possible duplicates", description: err.message });
      } else {
        const message = err instanceof SalesApiError ? err.message : "The server could not create this lead.";
        setSubmitError(message);
        toast({ variant: "destructive", title: "Lead not created", description: message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reviewExisting = () => {
    if (!matches?.length) return;
    const target = matches.find((m) => m.kind === "lead") ?? matches.find((m) => m.kind === "contact") ?? matches[0];
    if (target.kind === "lead") nav.navigate("lead-detail", { leadId: target.id });
    else if (target.kind === "contact") nav.navigate("contact-detail", { contactId: target.id });
    else nav.navigate("account-detail", { accountId: target.id });
  };

  if (forbidden) {
    return (
      <SalesGate screenName="Lead Creation">
        <></>
      </SalesGate>
    );
  }

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "New Lead" }]}
        title="New Lead"
        description="Capture the demand once, cleanly. The server checks for duplicates before anything is saved, so routing and timelines stay trustworthy."
      />

      {error && !forbidden && <SalesErrorBanner message={error} onRetry={reload} />}
      {loading && <SalesSkeleton rows={3} />}

      {refs && !loading && (
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Duplicate review — the server blocked the save; nothing was created */}
          {matches && matches.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" role="alert">
              <div className="flex items-start gap-2.5">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-amber-900">Possible duplicates — review before saving</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                    {dupeMessage} Nothing has been saved yet.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {matches.map((m, i) => (
                      <li
                        key={`${m.kind}-${m.id}-${i}`}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-200/70 bg-white/80 px-3 py-2"
                      >
                        <span className={cn("rounded border px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide", KIND_CHIP[m.kind] ?? "border-slate-200 bg-slate-50 text-slate-600")}>
                          {kindLabel(m.kind)}
                        </span>
                        <span className="text-[13px] font-medium text-slate-800">{m.label}</span>
                        <span className="text-xs text-slate-500">{m.reason}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="h-8 bg-white" onClick={reviewExisting}>
                      Review existing
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                      onClick={() => setForceOpen(true)}
                    >
                      Create anyway
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {submitError && (
            <div className="rounded-xl border border-red-200 bg-red-50/70 px-4 py-3" role="alert">
              <p className="text-sm font-medium text-red-700">{submitError}</p>
            </div>
          )}

          <SectionCard
            title="Lead details"
            description="Required fields are marked *. The server re-validates every field and runs duplicate detection before saving."
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(false);
              }}
              className="space-y-4"
              noValidate
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Lead name" required hint="e.g. Sunrise Packaging" className="sm:col-span-2">
                  <Input
                    value={form.name}
                    onChange={(e) => update({ name: e.target.value })}
                    aria-invalid={Boolean(errors.name)}
                    className="h-9 rounded-lg"
                  />
                  {errors.name && <p className="text-[11.5px] font-medium text-red-600">{errors.name}</p>}
                </Field>

                <Field label="Company" required>
                  <Input
                    value={form.company}
                    onChange={(e) => update({ company: e.target.value })}
                    aria-invalid={Boolean(errors.company)}
                    className="h-9 rounded-lg"
                  />
                  {errors.company && <p className="text-[11.5px] font-medium text-red-600">{errors.company}</p>}
                </Field>

                <Field label="Contact person" required>
                  <Input
                    value={form.contactPerson}
                    onChange={(e) => update({ contactPerson: e.target.value })}
                    aria-invalid={Boolean(errors.contactPerson)}
                    className="h-9 rounded-lg"
                  />
                  {errors.contactPerson && <p className="text-[11.5px] font-medium text-red-600">{errors.contactPerson}</p>}
                </Field>

                <Field label="Phone" required hint="Used for duplicate matching — the server compares the last 10 digits.">
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update({ phone: e.target.value })}
                    placeholder="+91 98200 51001"
                    aria-invalid={Boolean(errors.phone)}
                    className="h-9 rounded-lg"
                  />
                  {errors.phone && <p className="text-[11.5px] font-medium text-red-600">{errors.phone}</p>}
                </Field>

                <Field label="Email" required>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => update({ email: e.target.value })}
                    placeholder="name@company.example"
                    aria-invalid={Boolean(errors.email)}
                    className="h-9 rounded-lg"
                  />
                  {errors.email && <p className="text-[11.5px] font-medium text-red-600">{errors.email}</p>}
                </Field>

                <Field label="Source">
                  <Select value={form.source} onValueChange={(v) => update({ source: v })}>
                    <SelectTrigger className="h-9 w-full bg-white" aria-label="Lead source">
                      <SelectValue placeholder="Choose a source" />
                    </SelectTrigger>
                    <SelectContent>
                      {refs.sources.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Industry">
                  <Select value={form.industry} onValueChange={(v) => update({ industry: v })}>
                    <SelectTrigger className="h-9 w-full bg-white" aria-label="Industry">
                      <SelectValue placeholder="Choose an industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {refs.industries.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Location">
                  <Input
                    value={form.location}
                    onChange={(e) => update({ location: e.target.value })}
                    placeholder="e.g. Indore"
                    className="h-9 rounded-lg"
                  />
                </Field>

                <Field
                  label="Owner"
                  required
                  hint={ownerLocked ? "Assigned to you by your boundary" : "Leads are never created unowned — the server enforces an owner."}
                >
                  <Select
                    value={effectiveOwner}
                    onValueChange={setOwnerId}
                    disabled={ownerLocked}
                  >
                    <SelectTrigger className="h-9 w-full bg-white" aria-label="Lead owner">
                      <SelectValue placeholder="Choose an owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {refs.owners.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name} — {o.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.owner && <p className="text-[11.5px] font-medium text-red-600">{errors.owner}</p>}
                </Field>

                <Field label="Priority">
                  <div className="flex gap-2" aria-label="Lead priority">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={form.priority === p}
                        onClick={() => update({ priority: p })}
                        className={cn(
                          "h-9 flex-1 rounded-lg border text-[13px] font-medium transition-colors",
                          form.priority === p
                            ? PRIORITY_TONE[p]
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50",
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Estimated value" hint="₹ Cr — e.g. 0.14">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.valueCr}
                    onChange={(e) => update({ valueCr: e.target.value })}
                    placeholder="0.14"
                    className="h-9 rounded-lg tabular-nums"
                  />
                </Field>

                <Field label="Expected close">
                  <Input
                    type="date"
                    value={form.expectedClose}
                    onChange={(e) => update({ expectedClose: e.target.value })}
                    className="h-9 rounded-lg tabular-nums"
                  />
                </Field>

                <Field label="Notes" className="sm:col-span-2">
                  <Textarea
                    value={form.notes}
                    onChange={(e) => update({ notes: e.target.value })}
                    rows={3}
                    placeholder="Context that helps the owner take the first call — budget signals, plant count, timeline…"
                    className="resize-y rounded-lg"
                  />
                </Field>

                <Field
                  label="Next follow-up"
                  hint="Optional — the server schedules the first follow-up and notifies the owner."
                  className="sm:col-span-2"
                >
                  <Input
                    type="datetime-local"
                    value={form.nextFollowUp}
                    onChange={(e) => update({ nextFollowUp: e.target.value })}
                    className="h-9 rounded-lg tabular-nums"
                  />
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <Button type="submit" className="h-9 gap-1.5" disabled={submitting}>
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                  {submitting ? "Creating…" : "Create lead"}
                </Button>
                <Button type="button" variant="outline" className="h-9" disabled={submitting} onClick={() => nav.navigate("lead-inbox")}>
                  Cancel
                </Button>
              </div>

              <AuditedHint>
                On success the server records the initial activity, schedules the optional follow-up and notifies the new owner — one audit trail entry covers it all.
              </AuditedHint>
            </form>
          </SectionCard>
        </div>
      )}

      {!loading && !refs && !error && !forbidden && (
        <EmptyState
          title="The creation form could not load"
          message="Reference data (owners, sources, industries) did not arrive from the sales service."
          action={<Button size="sm" onClick={reload}>Retry</Button>}
        />
      )}

      <ConfirmDialog
        open={forceOpen}
        onOpenChange={setForceOpen}
        title="Create a possible duplicate?"
        description="Duplicates split the customer timeline, double-count routing and can send follow-ups to the wrong owner. Only continue if these matches are genuinely different records — the decision is recorded in the audit trail."
        confirmLabel="Create anyway"
        onConfirm={() => {
          setForceOpen(false);
          void submit(true);
        }}
      />
    </div>
  );
}
