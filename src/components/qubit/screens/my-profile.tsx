"use client";

import * as React from "react";
import {
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  FileText,
  IdCard,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getEmployee } from "@/lib/qubit/data";
import { DOCUMENTS, fmtDate, relTime } from "@/lib/qubit/workspace-data";
import { useQubitNav } from "../nav-context";
import { PageHeader } from "../page-header";
import { Avatar, KV, SectionCard, StatusBadge } from "../primitives";
import { LockedFieldHint } from "../workspace/parts";
import { ArrowLink } from "../primitives";

// ============================================================
// Screen 42 · My Profile — the employee's enterprise identity.
// Self-service fields are editable; company-controlled fields
// are never editable here (server rejects them too).
// ============================================================

const MY_SKILLS = ["Strategic planning", "Board reporting", "Enterprise SaaS", "Negotiation", "Team leadership", "Finance review"];

export function MyProfileScreen() {
  const nav = useQubitNav();
  const { toast } = useToast();
  const me = getEmployee("sagar")!;

  // Editable self-service fields (persisted through the profile API,
  // which rejects company-controlled fields server-side).
  const [phone, setPhone] = React.useState(me.phone);
  const [editingPhone, setEditingPhone] = React.useState(false);
  const [about, setAbout] = React.useState(
    "Chief Executive Officer since 2019. Led Qubit One from 40 to 1,245 people across eight departments, with offices in Mumbai, Bengaluru, Pune and Delhi NCR.",
  );
  const [editingAbout, setEditingAbout] = React.useState(false);
  const [skills, setSkills] = React.useState<string[]>(MY_SKILLS);
  const [newSkill, setNewSkill] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const manager = getEmployee(me.managerId);
  const reports = ["rahul", "priya", "neha", "amit", "vikramj", "karan", "arjun", "sanjay"].map(getEmployee);
  const recentDocs = DOCUMENTS.filter((d) => d.ownerId === "sagar" || d.category === "HR").slice(0, 4);

  const saveProfile = async (fields: Record<string, unknown>, onDone: () => void) => {
    setSaving(true);
    try {
      const res = await fetch("/api/workspace/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "Change not saved", description: data?.message ?? "The profile service rejected this change." });
        return;
      }
      toast({ title: "Profile updated", description: "Your change is recorded in your activity." });
      onDone();
    } catch {
      toast({ variant: "destructive", title: "Change not saved", description: "The profile service is unreachable. Retry in a moment." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Workspace" }, { label: "Identity" }]}
        title="My Profile"
        description="Your enterprise identity — the same record used by the directory, organization chart, mail and every access decision."
        actions={
          <>
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => nav.navigate("digital-id-card")}>
              <IdCard className="h-4 w-4" aria-hidden /> Digital ID card
            </Button>
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => nav.navigate("digital-visiting-card")}>
              <Star className="h-4 w-4" aria-hidden /> Visiting card
            </Button>
          </>
        }
      />

      {/* Identity header */}
      <section className="qubit-card mb-4 flex flex-col gap-5 p-5 md:flex-row md:items-center md:p-6" aria-label="Identity summary">
        <Avatar name={me.name} size="xl" className="h-20 w-20 rounded-2xl text-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{me.name}</h2>
            <StatusBadge status={me.status} size="sm" />
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{me.employeeId}</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {me.title} · {me.department}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" aria-hidden /> {me.location} · with Qubit One since {me.since}
          </p>
        </div>
        <dl className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-1">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Manager</dt>
            <dd className="font-medium text-slate-800">{manager?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Direct reports</dt>
            <dd className="font-medium text-slate-800">{reports.length} department heads</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Overview / About */}
          <SectionCard
            title="About"
            description="Shown to colleagues in the Company Directory and Employee 360."
            actions={
              !editingAbout && (
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setEditingAbout(true)}>
                  <Pencil className="h-3 w-3" aria-hidden /> Edit
                </Button>
              )
            }
          >
            {editingAbout ? (
              <div className="space-y-3">
                <Textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={280} className="min-h-24" aria-label="About you" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">{about.length}/280</span>
                  <span className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-8" onClick={() => { setEditingAbout(false); }}>
                      Cancel
                    </Button>
                    <Button size="sm" className="h-8" disabled={saving} onClick={() => saveProfile({ about }, () => setEditingAbout(false))}>
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[13.5px] leading-relaxed text-slate-700">{about}</p>
            )}
          </SectionCard>

          {/* Contact — self-service */}
          <SectionCard title="Contact" description="Work contact details. You can update your work phone; your Qubit One mailbox is provisioned by IT.">
            <dl className="divide-y">
              <KV label="Work email">
                <span className="inline-flex items-center gap-1.5">
                  <MailIcon aria-hidden /> {me.email}
                </span>
              </KV>
              <KV label="Work phone">
                {editingPhone ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-8 w-48"
                      aria-label="Work phone"
                      autoFocus
                    />
                    <Button size="sm" className="h-8" disabled={saving} onClick={() => saveProfile({ phone }, () => setEditingPhone(false))}>
                      {saving ? "Saving…" : "Save"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => { setPhone(me.phone); setEditingPhone(false); }}>
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" aria-hidden /> {phone}
                    </span>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => setEditingPhone(true)}>
                      <Pencil className="h-3 w-3" aria-hidden /> Edit
                    </Button>
                  </span>
                )}
              </KV>
              <KV label="Location">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden /> {me.location}
                </span>
              </KV>
              <KV label="Personal contact details">
                <span className="text-xs text-muted-foreground">Not stored in Qubit One. HR maintains emergency contacts separately.</span>
              </KV>
            </dl>
          </SectionCard>

          {/* Employment — company-controlled */}
          <SectionCard title="Employment" description="Company-controlled record. Changes flow through authorized HR workflows (Employee Lifecycle).">
            <dl className="divide-y">
              <KV label="Employee ID">
                <span className="font-mono text-[13px]">{me.employeeId}</span> <LockedFieldHint />
              </KV>
              <KV label="Designation">
                {me.title} <LockedFieldHint />
              </KV>
              <KV label="Department">
                {me.department} <LockedFieldHint />
              </KV>
              <KV label="Employment status">
                <StatusBadge status={me.status} size="sm" /> <LockedFieldHint />
              </KV>
              <KV label="Reporting level">
                Executive — reports to {manager?.name ?? "the Board"} <LockedFieldHint label="Managed by the organization structure" />
              </KV>
              <KV label="Joining date">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-400" aria-hidden /> {me.since}
                </span>{" "}
                <LockedFieldHint />
              </KV>
            </dl>
          </SectionCard>

          {/* Skills — self-service */}
          <SectionCard title="Skills" description="Help colleagues find you in the Company Directory.">
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1.5 text-xs font-medium text-slate-700">
                  {s}
                  <button
                    type="button"
                    aria-label={`Remove skill ${s}`}
                    onClick={() => setSkills((sk) => sk.filter((x) => x !== s))}
                    className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              ))}
              <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 pr-1.5">
                <input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSkill.trim().length >= 2) {
                      setSkills((sk) => [...sk, newSkill.trim()]);
                      setNewSkill("");
                    }
                  }}
                  placeholder="Add skill + Enter"
                  aria-label="Add a skill"
                  className="w-36 bg-transparent py-1 pl-2.5 text-xs outline-none placeholder:text-slate-400"
                />
                <Plus className="h-3 w-3 text-slate-400" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">Skill changes sync with your directory entry and are validated server-side.</p>
          </SectionCard>
        </div>

        {/* Right column: organization + documents + preferences */}
        <div className="space-y-4">
          <SectionCard title="Organization" description="Your place in the structure — one system, no copies.">
            <ul className="space-y-2">
              <OrgLink icon={<Building2 />} label="Organization Chart" hint="Explore the full hierarchy" onClick={() => nav.navigate("organization-chart")} />
              <OrgLink icon={<Users />} label="Company Directory" hint="How colleagues see you" onClick={() => nav.navigate("company-directory")} />
              <OrgLink icon={<UserRound />} label="Employee 360" hint="Your connected overview" onClick={() => nav.navigate("employee-360")} />
              <OrgLink icon={<Briefcase />} label="Reporting Lines" hint="Formal reporting structure" onClick={() => nav.navigate("reporting-lines")} />
              <OrgLink icon={<ShieldCheck />} label="My Activity" hint="Your personal timeline" onClick={() => nav.navigate("my-activity")} />
            </ul>
          </SectionCard>

          <SectionCard
            title="Your documents"
            description="Recent and HR-issued records"
            actions={<ArrowLink onClick={() => nav.navigate("my-documents")}>Open</ArrowLink>}
          >
            <ul className="space-y-2">
              {recentDocs.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => nav.navigate("my-documents")}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-slate-200 hover:bg-slate-50"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-slate-800">{d.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {d.category} · {relTime(d.modified)}
                      </span>
                    </span>
                    <StatusBadge status={d.sensitivity} size="sm" />
                  </button>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Preferences" description="How Qubit One works for you.">
            <ul className="divide-y">
              <KV label="Language">English (India)</KV>
              <KV label="Time zone">Asia/Kolkata (IST)</KV>
              <KV label="Notifications">
                <ArrowLink onClick={() => nav.navigate("my-notifications")}>Notification center & channels</ArrowLink>
              </KV>
              <KV label="Security">
                <ArrowLink onClick={() => nav.navigate("security-center")}>Security Center · MFA & sessions</ArrowLink>
              </KV>
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function OrgLink({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint: string; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2.5 rounded-lg border border-slate-200/70 bg-white px-3 py-2.5 text-left transition-all duration-150 hover:border-blue-200 hover:bg-blue-50/40"
      >
        <span className="qubit-icon-tile qubit-icon-tile-accent h-8 w-8">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-slate-800">{label}</span>
          <span className="block text-[11px] text-muted-foreground">{hint}</span>
        </span>
        <Check className="h-3.5 w-3.5 text-slate-300" aria-hidden />
      </button>
    </li>
  );
}

function MailIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-slate-400" aria-hidden {...props}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
