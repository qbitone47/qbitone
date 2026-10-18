"use client";

import * as React from "react";
import {
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  FolderClosed,
  Lock,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Share2,
  Star,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getEmployee } from "@/lib/qubit/data";
import { relTime, DOCUMENTS as DOCUMENTS_SNAPSHOT, type WorkspaceDoc } from "@/lib/qubit/workspace-data";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { SearchInput, SectionCard, StatTile, StatusBadge } from "../primitives";
import { DataTable, type Column } from "../data-table";
import { DetailDrawer } from "../drawers";
import { FormDialog } from "../dialogs";
import { PeoplePicker, type PickedPerson } from "../workspace/people-picker";

// ============================================================
// Screen 47 · My Documents — the authorized document workspace.
// Access is enforced server-side: restricted documents refuse
// download/share regardless of what the UI renders, and every
// action lands in the audit trail.
// ============================================================

const DOC_ICONS: Record<string, React.ElementType> = {
  PDF: FileText,
  DOCX: FileText,
  XLSX: FileSpreadsheet,
  PPTX: FileType2,
  PNG: FileImage,
};

const sizeLabel = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);

export function MyDocumentsScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { toast } = useToast();

  const [docs, setDocs] = React.useState<WorkspaceDoc[] | null>(null);
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [starredOnly, setStarredOnly] = React.useState(false);
  const [detail, setDetail] = React.useState<WorkspaceDoc | null>(null);
  const [shareTarget, setShareTarget] = React.useState<WorkspaceDoc | null>(null);
  const [renameTarget, setRenameTarget] = React.useState<WorkspaceDoc | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [moveTarget, setMoveTarget] = React.useState<WorkspaceDoc | null>(null);
  const [moveValue, setMoveValue] = React.useState<string>("");
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [sharePerson, setSharePerson] = React.useState<PickedPerson | null>(null);

  React.useEffect(() => {
    if (shareTarget) setSharePerson(null);
  }, [shareTarget]);

  const load = React.useCallback(async () => {
    // The document registry is served with the workspace bundle in the
    // demo; mutations still round-trip the enforcement API below.
    setDocs(DOCUMENTS_SNAPSHOT.map((d) => ({ ...d })));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const call = async (body: Record<string, unknown>): Promise<{ ok: boolean; message?: string; doc?: WorkspaceDoc }> => {
    try {
      const res = await fetch("/api/workspace/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Qubit-Role": role },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data?.message ?? "The document service rejected this action." };
      return { ok: true, doc: data.doc };
    } catch {
      return { ok: false, message: "The document service is unreachable. Nothing was changed." };
    }
  };

  const doDownload = async (d: WorkspaceDoc) => {
    setBusyId(d.id);
    const result = await call({ action: "download", docId: d.id });
    setBusyId(null);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Download blocked", description: result.message });
      return;
    }
    toast({ title: "Preparing download", description: `${d.name} · ${sizeLabel(d.sizeKb)} — file content stays in your enterprise storage vault.` });
  };

  const doShare = async (d: WorkspaceDoc, person: PickedPerson) => {
    setBusyId(d.id);
    const result = await call({ action: "share", docId: d.id, toEmployeeId: person.external ? undefined : person.value });
    setBusyId(null);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Share blocked", description: result.message });
      return false;
    }
    toast({ title: "Shared", description: `${d.name} is now shared with ${person.label}.` });
    return true;
  };

  const doRename = async () => {
    if (!renameTarget) return;
    setBusyId(renameTarget.id);
    const result = await call({ action: "rename", docId: renameTarget.id, name: renameValue });
    setBusyId(null);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Rename failed", description: result.message });
      return;
    }
    setDocs((ds) => (ds ? ds.map((d) => (d.id === renameTarget.id ? { ...d, name: renameValue.trim() } : d)) : ds));
    setRenameTarget(null);
    toast({ title: "Document renamed" });
  };

  const doMove = async () => {
    if (!moveTarget || !moveValue) return;
    setBusyId(moveTarget.id);
    const result = await call({ action: "move", docId: moveTarget.id, category: moveValue });
    setBusyId(null);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Move failed", description: result.message });
      return;
    }
    setDocs((ds) => (ds ? ds.map((d) => (d.id === moveTarget.id ? { ...d, category: moveValue as WorkspaceDoc["category"] } : d)) : ds));
    setMoveTarget(null);
    toast({ title: "Document moved", description: `Now filed under ${moveValue}.` });
  };

  const filtered = React.useMemo(() => {
    let list = docs ?? [];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((d) => `${d.name} ${d.description ?? ""} ${getEmployee(d.ownerId)?.name ?? ""}`.toLowerCase().includes(q));
    if (category !== "all") list = list.filter((d) => d.category === category);
    if (type !== "all") list = list.filter((d) => d.type === type);
    if (starredOnly) list = list.filter((d) => d.starred);
    return list;
  }, [docs, search, category, type, starredOnly]);

  const toggleStar = (id: string) => setDocs((ds) => (ds ? ds.map((d) => (d.id === id ? { ...d, starred: !d.starred } : d)) : ds));

  const columns: Column<WorkspaceDoc>[] = [
    {
      key: "name",
      header: "Document",
      minWidth: 260,
      sortValue: (d) => d.name,
      render: (d) => {
        const Icon = DOC_ICONS[d.type] ?? FileText;
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="qubit-icon-tile qubit-icon-tile-accent h-9 w-9 shrink-0 rounded-lg">
              <Icon />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-medium text-slate-800">{d.name}</span>
                {d.starred && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" aria-label="Starred" />}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">{d.type} · {sizeLabel(d.sizeKb)}</span>
            </span>
          </div>
        );
      },
    },
    { key: "category", header: "Category", sortValue: (d) => d.category, render: (d) => <span className="text-[13px] text-slate-600">{d.category}</span> },
    { key: "owner", header: "Owner", hideBelow: "lg", render: (d) => <span className="text-[13px] text-slate-600">{d.ownerId === "sagar" ? "You" : getEmployee(d.ownerId)?.name ?? "—"}</span> },
    { key: "modified", header: "Modified", sortValue: (d) => d.modified, render: (d) => <span className="whitespace-nowrap text-[13px] text-slate-600">{relTime(d.modified)}</span> },
    { key: "sensitivity", header: "Sensitivity", render: (d) => <StatusBadge status={d.sensitivity} size="sm" /> },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (d) => (
        <span className="inline-flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-slate-500" onClick={() => setDetail(d)}>
            Open
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`More actions for ${d.name}`}>
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="gap-2" onClick={() => setShareTarget(d)}>
                <Share2 className="h-3.5 w-3.5 text-slate-400" aria-hidden /> Share…
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => doDownload(d)}>
                <Download className="h-3.5 w-3.5 text-slate-400" aria-hidden /> Download
              </DropdownMenuItem>
              {d.ownerId === "sagar" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2" onClick={() => { setRenameTarget(d); setRenameValue(d.name); }}>
                    <Pencil className="h-3.5 w-3.5 text-slate-400" aria-hidden /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" onClick={() => { setMoveTarget(d); setMoveValue(d.category); }}>
                    <FolderClosed className="h-3.5 w-3.5 text-slate-400" aria-hidden /> Move to…
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      ),
    },
  ];

  const counts = {
    total: (docs ?? []).length,
    shared: (docs ?? []).filter((d) => d.category === "Shared with me").length,
    hr: (docs ?? []).filter((d) => d.category === "HR").length,
    confidential: (docs ?? []).filter((d) => d.sensitivity === "Confidential" || d.sensitivity === "Restricted").length,
  };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Workspace" }, { label: "Documents" }]}
        title="My Documents"
        description="The documents you own, are shared, or are authorized to see — access decisions are enforced by the server, not the interface."
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={load} aria-label="Reload documents">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
            </Button>
            <Button className="h-9 gap-1.5" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" aria-hidden /> Upload
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={<FolderClosed />} value={counts.total} label="Documents in scope" />
        <StatTile icon={<Share2 />} value={counts.shared} label="Shared with you" />
        <StatTile icon={<FileText />} value={counts.hr} label="HR records" />
        <StatTile icon={<Lock />} value={counts.confidential} label="Confidential or restricted" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search documents, owners…" className="w-full sm:w-72" ariaLabel="Search documents" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-10 w-44 bg-white" aria-label="Filter by category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {["Personal", "Shared with me", "HR", "Company", "Workflow"].map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-10 w-32 bg-white" aria-label="Filter by file type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {["PDF", "DOCX", "XLSX", "PPTX", "PNG"].map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={starredOnly ? "secondary" : "outline"}
          size="sm"
          className="h-10 gap-1.5"
          aria-pressed={starredOnly}
          onClick={() => setStarredOnly((v) => !v)}
        >
          <Star className={cn("h-3.5 w-3.5", starredOnly && "fill-amber-400 text-amber-400")} aria-hidden /> Starred
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(d) => d.id}
        onRowClick={(d) => setDetail(d)}
        pageSize={10}
        emptyTitle="No documents match"
        emptyMessage="Try a different search or clear a filter — you will only ever see documents your role can access."
        caption="My document workspace"
        mobileCard={(d) => {
          const Icon = DOC_ICONS[d.type] ?? FileText;
          return (
            <div className="flex items-start gap-2.5">
              <span className="qubit-icon-tile qubit-icon-tile-accent h-9 w-9 shrink-0 rounded-lg">
                <Icon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-800">{d.name}</p>
                <p className="text-[11px] text-muted-foreground">{d.category} · {relTime(d.modified)}</p>
                <div className="mt-1"><StatusBadge status={d.sensitivity} size="sm" /></div>
              </div>
            </div>
          );
        }}
      />

      {/* Detail drawer */}
      <DetailDrawer
        open={Boolean(detail)}
        onOpenChange={(o) => !o && setDetail(null)}
        wide
        title={detail?.name ?? ""}
        subtitle={detail ? `${detail.type} · ${sizeLabel(detail.sizeKb)} · owner ${detail.ownerId === "sagar" ? "you" : getEmployee(detail.ownerId)?.name ?? "—"}` : undefined}
        icon={<FileText />}
        footer={
          detail && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="h-8 gap-1.5" disabled={busyId === detail.id} onClick={() => doDownload(detail)}>
                <Download className="h-3.5 w-3.5" aria-hidden /> Download
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setShareTarget(detail)}>
                <Share2 className="h-3.5 w-3.5" aria-hidden /> Share
              </Button>
              {detail.linked && (
                <Button size="sm" variant="ghost" className="h-8 text-blue-600" onClick={() => nav.navigate(detail.linked![0].screen)}>
                  {detail.linked[0].label}
                </Button>
              )}
            </div>
          )
        }
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.sensitivity} size="sm" />
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{detail.category}</span>
            </div>
            {detail.description && <p className="text-[13.5px] leading-relaxed text-slate-700">{detail.description}</p>}
            {(detail.sensitivity === "Confidential" || detail.sensitivity === "Restricted") && (
              <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
                <Lock className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                {detail.sensitivity === "Restricted"
                  ? "Restricted document — access is managed by HR. Downloads and shares are refused by the server for anyone outside the HR scope."
                  : "Confidential — sharing is limited by role. Every view and share attempt is recorded in the audit trail."}
              </p>
            )}
            <dl className="divide-y rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Modified</dt>
                <dd className="text-[13px] font-medium text-slate-800">{relTime(detail.modified)}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Size</dt>
                <dd className="text-[13px] font-medium text-slate-800">{sizeLabel(detail.sizeKb)}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">File type</dt>
                <dd className="text-[13px] font-medium text-slate-800">{detail.type}</dd>
              </div>
            </dl>
          </div>
        )}
      </DetailDrawer>

      {/* Share dialog */}
      <FormDialog
        open={Boolean(shareTarget)}
        onOpenChange={(o) => !o && setShareTarget(null)}
        title="Share document"
        description={shareTarget ? `${shareTarget.name} · sensitivity: ${shareTarget.sensitivity}. Server-side policy applies.` : ""}
        submitLabel={busyId === shareTarget?.id ? "Sharing…" : "Share"}
        submitting={busyId === shareTarget?.id}
        onSubmit={async () => {
          if (shareTarget && sharePerson && (await doShare(shareTarget, sharePerson))) setShareTarget(null);
        }}
      >
        <PeoplePicker
          ariaLabel="Choose a colleague"
          selected={sharePerson ? [sharePerson] : []}
          onChange={(next) => setSharePerson(next[next.length - 1] ?? null)}
          placeholder="Search the directory…"
        />
        <p className="text-[11px] leading-relaxed text-slate-400">
          Sharing respects the document's sensitivity. Confidential documents cannot be shared from restricted roles, and every share attempt is audited.
        </p>
      </FormDialog>

      {/* Rename dialog */}
      <FormDialog
        open={Boolean(renameTarget)}
        onOpenChange={(o) => !o && setRenameTarget(null)}
        title="Rename document"
        submitLabel={busyId === renameTarget?.id ? "Saving…" : "Rename"}
        submitting={busyId === renameTarget?.id}
        onSubmit={doRename}
      >
        <div className="space-y-1.5">
          <Label htmlFor="doc-rename" className="text-xs font-medium text-slate-700">Document name</Label>
          <Input id="doc-rename" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
        </div>
      </FormDialog>

      {/* Move dialog */}
      <FormDialog
        open={Boolean(moveTarget)}
        onOpenChange={(o) => !o && setMoveTarget(null)}
        title="Move document"
        description={moveTarget ? `Currently filed under ${moveTarget.category}.` : ""}
        submitLabel={busyId === moveTarget?.id ? "Moving…" : "Move"}
        submitting={busyId === moveTarget?.id}
        onSubmit={doMove}
      >
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">Category</Label>
          <Select value={moveValue} onValueChange={setMoveValue}>
            <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Personal", "Shared with me", "HR", "Company", "Workflow"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FormDialog>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUpload={async (fileMeta) => {
          const result = await call({ action: "upload", fileMeta });
          if (!result.ok) {
            toast({ variant: "destructive", title: "Upload refused", description: result.message });
            return false;
          }
          if (result.doc) setDocs((ds) => (ds ? [result.doc!, ...(ds ?? [])] : ds));
          toast({ title: "Document registered", description: `${result.doc?.name} — the file itself stays in your enterprise storage; Qubit One holds the record.` });
          return true;
        }}
      />
    </div>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  onUpload,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUpload: (meta: { name: string; sizeKb: number; type: string }) => Promise<boolean>;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setFile(null);
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const ALLOWED = ["pdf", "docx", "xlsx", "pptx", "png", "jpg", "csv"];
  const MAX_MB = 10;

  const validate = (f: File): string | null => {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED.includes(ext)) return `.${ext} files are not accepted. Allowed: ${ALLOWED.map((a) => `.${a}`).join(", ")}`;
    if (f.size > MAX_MB * 1024 * 1024) return `Files above ${MAX_MB} MB must go through the enterprise storage vault.`;
    return null;
  };

  const submit = async () => {
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    const problem = validate(file);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    const ok = await onUpload({ name: file.name, sizeKb: Math.round(file.size / 1024), type: file.name.split(".").pop()?.toUpperCase() ?? "DOCX" });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upload document"
      description="Registers the document record. Content itself remains in your enterprise storage."
      submitLabel={busy ? "Uploading…" : "Upload"}
      submitting={busy}
      onSubmit={submit}
    >
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 transition-colors",
            file ? "border-emerald-300 bg-emerald-50/40" : "border-slate-300 bg-slate-50/50 hover:border-blue-300 hover:bg-blue-50/30",
          )}
        >
          <Upload className="h-6 w-6 text-slate-400" aria-hidden />
          {file ? (
            <>
              <p className="text-[13px] font-medium text-slate-800">{file.name}</p>
              <p className="text-[11px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB · click to choose a different file</p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-medium text-slate-700">Choose a file</p>
              <p className="text-[11px] text-slate-400">PDF, DOCX, XLSX, PPTX, PNG · up to 10 MB</p>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          aria-label="Choose file to upload"
          accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.csv"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setError(f ? validate(f) : null);
          }}
        />
        {error && (
          <p role="alert" className="text-[11.5px] font-medium text-red-600">{error}</p>
        )}
      </div>
    </FormDialog>
  );
}
