"use client";

import * as React from "react";
import { format } from "date-fns";
import { AlertCircle, Calendar, Check, Eye, EyeOff, Loader2, Upload } from "lucide-react";
import { PageHeader } from "../page-header";
import {
  DSGuidance,
  DSScreenNav,
  DSSection,
  DSSpec,
  DSStage,
  DSExample,
  DSVar,
  DSTokenTable,
} from "../ds/doc";
import { Field, FormDialog } from "../dialogs";
import { SearchInput } from "../primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { departments } from "@/lib/qubit/data";

// ============================================================
// Screen 17 — Inputs & Forms
// Every field type, every state, the anatomy of a field and
// the layout rules that keep 1,200-employee forms consistent.
// ============================================================

// Shared control classes — the token rhythm every specimen below follows.
const inputCls = "h-10 rounded-lg border-slate-200 bg-white";
const selectCls = "h-10 w-full rounded-lg border-slate-200 bg-white";

/** Small numbered callout badge used in the anatomy diagram. */
function Callout({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white"
    >
      {n}
    </span>
  );
}

export function InputsFormsScreen() {
  const { toast } = useToast();

  // ——— Field types: live demo state ———
  const [showPassword, setShowPassword] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [department, setDepartment] = React.useState<string | undefined>("HR & People");
  const [channels, setChannels] = React.useState<string[]>(["In-App", "Email"]);
  const [dateOpen, setDateOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(new Date(2026, 9, 17));
  const [inviteEmail, setInviteEmail] = React.useState(true);
  const [cadence, setCadence] = React.useState("Monthly");
  const [autoAssign, setAutoAssign] = React.useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // ——— Anatomy: helper ↔ error toggle ———
  const [anatomyError, setAnatomyError] = React.useState(false);

  // ——— Realistic form: inline ———
  const [roleName, setRoleName] = React.useState("");
  const [roleDept, setRoleDept] = React.useState<string | undefined>(undefined);
  const [roleLevel, setRoleLevel] = React.useState("Level 3");
  const [creating, setCreating] = React.useState(false);

  // ——— Realistic form: dialog twin ———
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogName, setDialogName] = React.useState("");
  const [dialogDept, setDialogDept] = React.useState<string | undefined>(undefined);
  const [dialogCreating, setDialogCreating] = React.useState(false);

  const toggleChannel = (c: string) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const submitRole = () => {
    setCreating(true);
    window.setTimeout(() => {
      setCreating(false);
      toast({
        title: "Role created successfully.",
        description: `${roleName.trim()} was added to ${roleDept ?? "the organization"} (demo).`,
      });
      setRoleName("");
      setRoleDept(undefined);
      setRoleLevel("Level 3");
    }, 900);
  };

  const submitDialogRole = () => {
    setDialogCreating(true);
    window.setTimeout(() => {
      setDialogCreating(false);
      setDialogOpen(false);
      toast({
        title: "Role created successfully.",
        description: `${dialogName.trim()} was added to ${dialogDept ?? "the organization"} (demo).`,
      });
      setDialogName("");
      setDialogDept(undefined);
    }, 900);
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Inputs & Forms"
        description="Enterprise form system — fields, states, validation, layout."
      />

      <div className="space-y-6">
        {/* ————————————————— 1 · Field types ————————————————— */}
        <DSSection
          title="Field types"
          purpose="Every input the product ships — one control per data shape, never a hand-rolled variant."
        >
          <DSStage>
            <div className="grid w-full gap-x-6 gap-y-7 sm:grid-cols-2 xl:grid-cols-3">
              <DSExample label="Text — empty">
                <Field label="Department name" hint="Used in approvals and org charts.">
                  <Input
                    aria-label="Department name"
                    placeholder="e.g. Engineering"
                    className={inputCls}
                  />
                </Field>
              </DSExample>

              <DSExample label="Text — filled">
                <Field label="Department name" hint="Must be unique across the company.">
                  <Input
                    aria-label="Department name (filled)"
                    defaultValue="Engineering"
                    className={inputCls}
                  />
                </Field>
              </DSExample>

              <DSExample label="Password — visibility toggle">
                <Field label="Admin password" hint="Minimum 12 characters, rotated quarterly.">
                  <div className="relative">
                    <Input
                      aria-label="Admin password"
                      type={showPassword ? "text" : "password"}
                      defaultValue="qubit-2026-admin"
                      className="h-10 rounded-lg border-slate-200 bg-white pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                    </button>
                  </div>
                </Field>
              </DSExample>

              <DSExample label="Search">
                <Field label="Find people" hint="Matches name, title and department.">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search employees…"
                    ariaLabel="Find people"
                  />
                </Field>
              </DSExample>

              <DSExample label="Select — single choice">
                <Field label="Department" hint="Roles inherit the department's data boundary.">
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger
                      aria-label="Department"
                      className={selectCls}
                    >
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.name}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </DSExample>

              <DSExample label="Multi-select — checkbox chips">
                <Field label="Notification channels" hint="Pick at least one channel.">
                  <div
                    role="group"
                    aria-label="Notification channels"
                    className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2"
                  >
                    {["In-App", "Email", "Push", "WhatsApp"].map((c) => {
                      const on = channels.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleChannel(c)}
                          className={
                            "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors duration-150 " +
                            (on
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
                          }
                        >
                          {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </DSExample>

              <DSExample label="Date — popover calendar">
                <Field label="Effective from" hint="Backdating requires HR approval.">
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label="Effective from — open calendar"
                        className="h-10 w-full justify-between rounded-lg border-slate-200 bg-white px-3 font-normal"
                      >
                        {date ? format(date, "d MMM yyyy") : "Pick a date"}
                        <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <DatePicker
                        mode="single"
                        selected={date}
                        onSelect={(d) => {
                          setDate(d);
                          setDateOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </Field>
              </DSExample>

              <DSExample label="Date range — From / To">
                <Field label="Review window" hint="Both ends are inclusive.">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-400">From</span>
                      <Input
                        aria-label="Review window from"
                        type="date"
                        defaultValue="2026-10-01"
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-400">To</span>
                      <Input
                        aria-label="Review window to"
                        type="date"
                        defaultValue="2026-12-31"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </Field>
              </DSExample>

              <DSExample label="Time">
                <Field label="Daily standup" hint="Times are stored in IST (Asia/Kolkata).">
                  <Input
                    aria-label="Daily standup time"
                    type="time"
                    defaultValue="14:30"
                    className={inputCls}
                  />
                </Field>
              </DSExample>

              <DSExample label="Number">
                <Field label="Team size" hint="Whole seats, 1–999.">
                  <Input
                    aria-label="Team size"
                    type="number"
                    min={1}
                    defaultValue={24}
                    className={inputCls}
                  />
                </Field>
              </DSExample>

              <DSExample label="Currency — prefix">
                <Field label="Annual budget" hint="INR, Indian lakh/crore grouping.">
                  <div className="relative">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400"
                    >
                      ₹
                    </span>
                    <Input
                      aria-label="Annual budget in rupees"
                      defaultValue="12,50,000"
                      className="h-10 rounded-lg border-slate-200 bg-white pl-8"
                    />
                  </div>
                </Field>
              </DSExample>

              <DSExample label="Textarea">
                <Field label="Supporting notes" hint="Visible to approvers and HR.">
                  <Textarea
                    aria-label="Supporting notes"
                    rows={2}
                    placeholder="Add context for approvers…"
                    className="rounded-lg border-slate-200 bg-white"
                  />
                </Field>
              </DSExample>

              <DSExample label="File upload — dropzone" className="sm:col-span-2 xl:col-span-1">
                <Field label="Attachments" hint="PDF, DOCX up to 10 MB.">
                  <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-5 text-center">
                    <span className="qubit-icon-tile qubit-icon-tile-accent mx-auto flex h-10 w-10 items-center justify-center">
                      <Upload className="h-4 w-4" aria-hidden />
                    </span>
                    <p className="mt-2 text-sm font-medium text-slate-700">Drop files or browse</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">PDF, DOCX up to 10 MB</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 h-8"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse files
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx"
                      multiple
                      className="hidden"
                      aria-label="Browse files"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          toast({
                            title: "File attached",
                            description: `${file.name} is ready to upload (demo).`,
                          });
                        }
                        e.target.value = "";
                      }}
                    />
                  </div>
                </Field>
              </DSExample>

              <DSExample label="Checkbox">
                <Field label="Delivery options">
                  <div className="flex h-10 items-center gap-2">
                    <Checkbox
                      id="invite-email"
                      checked={inviteEmail}
                      onCheckedChange={(c) => setInviteEmail(c === true)}
                    />
                    <label htmlFor="invite-email" className="text-sm text-slate-700">
                      Send invitation email
                    </label>
                  </div>
                </Field>
              </DSExample>

              <DSExample label="Radio — one of many">
                <Field label="Review cadence" hint="Applies to every member of the role.">
                  <RadioGroup
                    value={cadence}
                    onValueChange={setCadence}
                    aria-label="Review cadence"
                    className="flex h-10 flex-wrap items-center gap-x-5 gap-y-1"
                  >
                    {["Monthly", "Quarterly", "Annually"].map((opt) => (
                      <span key={opt} className="flex items-center gap-2">
                        <RadioGroupItem value={opt} id={`cadence-${opt.toLowerCase()}`} />
                        <label htmlFor={`cadence-${opt.toLowerCase()}`} className="text-sm text-slate-700">
                          {opt}
                        </label>
                      </span>
                    ))}
                  </RadioGroup>
                </Field>
              </DSExample>

              <DSExample label="Toggle — switch">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">Auto-assign approvals</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Route new requests to the least-loaded approver.
                    </p>
                  </div>
                  <Switch checked={autoAssign} onCheckedChange={setAutoAssign} aria-label="Auto-assign approvals" />
                </div>
              </DSExample>
            </div>
          </DSStage>
        </DSSection>

        {/* ————————————————— 2 · Field states ————————————————— */}
        <DSSection
          title="Field states"
          purpose="One visual per state — a field is always in exactly one of these eight."
        >
          <DSStage>
            <div className="grid w-full gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
              <DSExample label="Default">
                <span className="block text-xs font-medium text-slate-700">Department name</span>
                <Input
                  aria-label="Department name — default state"
                  placeholder="Enter a name"
                  className="mt-1.5 h-10 rounded-lg border-slate-200 bg-white"
                />
              </DSExample>

              <DSExample label="Focus — Tab into the field to see the live ring">
                <span className="block text-xs font-medium text-slate-700">Department name</span>
                <Input
                  aria-label="Department name — focus state"
                  placeholder="Enter a name"
                  className="mt-1.5 h-10 rounded-lg border-ring bg-white ring-[3px] ring-ring/50"
                />
              </DSExample>

              <DSExample label="Filled">
                <span className="block text-xs font-medium text-slate-700">Department name</span>
                <Input
                  aria-label="Department name — filled state"
                  defaultValue="Engineering"
                  className="mt-1.5 h-10 rounded-lg border-slate-200 bg-white"
                />
              </DSExample>

              <DSExample label="Error">
                <span className="block text-xs font-medium text-slate-700">Department name</span>
                <Input
                  aria-label="Department name — error state"
                  aria-invalid
                  placeholder="Enter a name"
                  className="mt-1.5 h-10 rounded-lg border-red-400 bg-white focus-visible:ring-red-200"
                />
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600" role="alert">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Department name is required.
                </p>
              </DSExample>

              <DSExample label="Warning">
                <span className="block text-xs font-medium text-slate-700">Department name</span>
                <Input
                  aria-label="Department name — warning state"
                  defaultValue="Operations"
                  className="mt-1.5 h-10 rounded-lg border-amber-300 bg-white focus-visible:ring-amber-200"
                />
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Name matches an archived department.
                </p>
              </DSExample>

              <DSExample label="Disabled">
                <span className="block text-xs font-medium text-slate-700">Department name</span>
                <Input
                  aria-label="Department name — disabled state"
                  disabled
                  placeholder="Enter a name"
                  className="mt-1.5 h-10 cursor-not-allowed rounded-lg border-slate-200 bg-white opacity-60"
                />
                <p className="mt-1.5 text-[11px] text-slate-400">Locked by policy</p>
              </DSExample>

              <DSExample label="Read-only">
                <span className="block text-xs font-medium text-slate-700">Department name</span>
                <Input
                  aria-label="Department name — read-only state"
                  readOnly
                  value="Engineering"
                  className="mt-1.5 h-10 rounded-lg border-slate-200 bg-slate-50 text-slate-600"
                />
              </DSExample>

              <DSExample label="Loading">
                <span className="block text-xs font-medium text-slate-700">Department name</span>
                <div className="relative mt-1.5">
                  <Input
                    aria-label="Department name — checking availability"
                    defaultValue="Engineering"
                    className="h-10 rounded-lg border-slate-200 bg-white pr-9"
                  />
                  <Loader2
                    aria-hidden
                    className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400" role="status">
                  Checking availability…
                </p>
              </DSExample>
            </div>
          </DSStage>
        </DSSection>

        {/* ————————————————— 3 · Anatomy ————————————————— */}
        <DSSection
          title="Anatomy"
          purpose="A field is a labeled unit — label, control, helper and error move as one."
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              aria-pressed={anatomyError}
              onClick={() => setAnatomyError((v) => !v)}
            >
              {anatomyError ? "Hide error state" : "Show error state"}
            </Button>
          }
        >
          <DSStage>
            <div className="mx-auto w-full max-w-md space-y-2.5">
              {/* 1 — Label */}
              <div className="flex items-center gap-3">
                <Callout n={1} />
                <span className="text-xs font-medium text-slate-700">
                  Department name
                  <span className="ml-0.5 text-red-500" aria-hidden>
                    *
                  </span>
                  <span className="sr-only">(required)</span>
                </span>
              </div>
              {/* 2 — Input */}
              <div className="flex items-center gap-3">
                <Callout n={2} />
                <Input
                  aria-label="Department name — anatomy demo"
                  aria-invalid={anatomyError || undefined}
                  aria-describedby={anatomyError ? "anatomy-error" : "anatomy-helper"}
                  placeholder="Enter a name"
                  className={
                    "h-11 flex-1 rounded-lg bg-white text-[15px] " +
                    (anatomyError ? "border-red-400 focus-visible:ring-red-200" : "border-slate-200")
                  }
                />
              </div>
              {/* 3 — Helper · 4 — Error */}
              <div className="flex items-start gap-3">
                {anatomyError ? <Callout n={4} /> : <Callout n={3} />}
                {anatomyError ? (
                  <p id="anatomy-error" className="flex items-center gap-1 text-xs text-red-600" role="alert">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Department name is required.
                  </p>
                ) : (
                  <p id="anatomy-helper" className="text-[11px] text-slate-400">
                    Shown on org charts and approval routing — keep it under 40 characters.
                  </p>
                )}
              </div>
            </div>
          </DSStage>
        </DSSection>

        {/* ————————————————— 4 · Realistic form ————————————————— */}
        <DSSection
          title="Realistic form"
          purpose="Create role — a production form with two-column layout, gating and async submit."
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setDialogOpen(true)}
            >
              Open in dialog
            </Button>
          }
        >
          <DSStage>
            <form
              className="w-full max-w-[560px] space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (roleName.trim() && !creating) submitRole();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Role name" required hint="Shown in permission and approval views.">
                  <Input
                    aria-label="Role name"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="e.g. Finance Manager"
                    className={inputCls}
                  />
                </Field>
                <Field label="Department" required hint="Inherits the department data boundary.">
                  <Select value={roleDept} onValueChange={setRoleDept}>
                    <SelectTrigger
                      aria-label="Department"
                      className={selectCls}
                    >
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.name}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Level" hint="Drives approval routing.">
                  <Select value={roleLevel} onValueChange={setRoleLevel}>
                    <SelectTrigger
                      aria-label="Level"
                      className={selectCls}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Level 2">Level 2 — Department head</SelectItem>
                      <SelectItem value="Level 3">Level 3 — Manager</SelectItem>
                      <SelectItem value="Level 4">Level 4 — Contributor</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="hidden items-end pb-0.5 sm:flex">
                  <p className="text-[11px] text-slate-400">Level and department can be changed later.</p>
                </div>
                <Field label="Description" className="sm:col-span-2">
                  <Textarea
                    aria-label="Description"
                    rows={3}
                    placeholder="What does this role own? Mention approval authority and data boundaries."
                    className="rounded-lg border-slate-200 bg-white"
                  />
                </Field>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => {
                    setRoleName("");
                    setRoleDept(undefined);
                    setRoleLevel("Level 3");
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="h-9" disabled={!roleName.trim() || creating}>
                  {creating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {creating ? "Creating…" : "Create role"}
                </Button>
              </div>
            </form>
          </DSStage>

          {/* Dialog twin of the same form */}
          <FormDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Create role"
            description="Roles group permissions and approval authority."
            submitLabel="Create role"
            submitting={dialogCreating}
            onSubmit={() => {
              if (dialogName.trim() && !dialogCreating) submitDialogRole();
            }}
          >
            <Field label="Role name" required hint="Shown in permission and approval views.">
              <Input
                aria-label="Role name (dialog)"
                value={dialogName}
                onChange={(e) => setDialogName(e.target.value)}
                placeholder="e.g. Finance Manager"
                className={inputCls}
              />
            </Field>
            <Field label="Department" required hint="Inherits the department data boundary.">
              <Select value={dialogDept} onValueChange={setDialogDept}>
                <SelectTrigger
                  aria-label="Department (dialog)"
                  className={selectCls}
                >
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormDialog>
        </DSSection>

        {/* ————————————————— 5 · Form layout rules ————————————————— */}
        <DSSection title="Form layout rules" purpose="Hard-coded rhythm — forms should feel identical in every module.">
          <DSTokenTable
            head={["Token", "Value", "Notes"]}
            rows={[
              ["form.field-gap", "16px", "Vertical gap between fields — space-y-4"],
              ["form.label-gap", "6px", "Label to control spacing — space-y-1.5"],
              ["form.section-gap", "24px", "Gap between grouped sections — space-y-6"],
              ["form.max-width", "560px", "Maximum form width; keeps line lengths readable"],
              ["form.columns", "1 → 2 on sm+", "Single column on mobile, two from sm — sm:grid-cols-2"],
              ["form.actions", "right-aligned", "Cancel then primary; primary action is always last"],
              ["form.destructive", "separated", "Destructive actions sit apart with extra margin"],
            ]}
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <DSGuidance kind="do" title="compact, comfortable forms">
              <ul className="list-disc space-y-1 pl-4">
                <li>Ask only for what the workflow needs — every extra field costs completion.</li>
                <li>Validate on submit, then inline as the user fixes each field.</li>
                <li>Keep labels always visible above the control.</li>
              </ul>
            </DSGuidance>
            <DSGuidance kind="dont" title="common form anti-patterns">
              <ul className="list-disc space-y-1 pl-4">
                <li>No 3+ columns of inputs — scanning beats density here.</li>
                <li>Never use a placeholder as the label — it vanishes on type.</li>
                <li>Don't disable submit without explaining what is missing.</li>
              </ul>
            </DSGuidance>
          </div>
        </DSSection>

        {/* ————————————————— Specification ————————————————— */}
        <DSSection title="Specification">
          <DSSpec
            rows={[
              {
                label: "Purpose",
                value: "The complete input vocabulary — every field type, state and layout rule for enterprise forms.",
              },
              {
                label: "Use when",
                value: "Creating or editing records, filtering data, configuring rules — any typed user input.",
              },
              {
                label: "Avoid when",
                value: "The surface is read-only — prefer text, KV rows or badges over disabled inputs.",
              },
              {
                label: "States",
                value: "Default, focus, filled, error, warning, disabled, read-only, loading — one visual per state, never invented per screen.",
              },
              {
                label: "Responsive",
                value: "Single column on mobile, two columns from sm; forms never exceed 560px; touch targets stay ≥ 44px on mobile.",
              },
              {
                label: "Accessibility",
                value: (
                  <>
                    Label always visible; hint and error wired via <DSVar>aria-describedby</DSVar>;{" "}
                    <DSVar>aria-invalid</DSVar> on error; errors announced on submit (<DSVar>role=&quot;alert&quot;</DSVar>).
                  </>
                ),
              },
            ]}
          />
        </DSSection>

        <DSScreenNav id="inputs-forms" />
      </div>
    </>
  );
}
