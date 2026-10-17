"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FormDialog } from "../dialogs";
import { apiPost, ApiError } from "@/lib/qubit/api";

// ============================================================
// CreateTaskDialog — shared quick-task composer (Employee Home
// quick action + My Tasks toolbar). Creation is server-validated.
// ============================================================

export function CreateTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const [title, setTitle] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const [priority, setPriority] = React.useState("Medium");
  const [due, setDue] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setDetail("");
      setPriority("Medium");
      setDue("");
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (title.trim().length < 4) {
      setError("Give the task a title (at least 4 characters).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiPost("/tasks", {
        title,
        detail,
        priority,
        due: due ? Date.parse(`${due}T17:00:00+05:30`) : null,
      });
      toast({ title: "Task created", description: `"${title.trim()}" is now in My Tasks.` });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The task could not be created. Retry in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create task"
      description="A quick task for yourself. Team assignments and workflow-generated work live in their own modules."
      submitLabel={submitting ? "Creating…" : "Create task"}
      submitting={submitting}
      onSubmit={submit}
    >
      <div className="space-y-1.5">
        <Label htmlFor="task-title" className="text-xs font-medium text-slate-700">
          Title <span className="text-red-500" aria-hidden>*</span>
        </Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          placeholder="e.g. Review the Q4 hiring plan"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "task-title-error" : undefined}
          autoFocus
        />
        {error && (
          <p id="task-title-error" role="alert" className="text-[11.5px] font-medium text-red-600">
            {error}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="task-detail" className="text-xs font-medium text-slate-700">
          Notes
        </Label>
        <Textarea id="task-detail" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Context, links, acceptance…" className="min-h-20" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="task-priority" className="text-xs font-medium text-slate-700">
            Priority
          </Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger id="task-priority" aria-label="Priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="task-due" className="text-xs font-medium text-slate-700">
            Due date
          </Label>
          <Input id="task-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} min="2026-11-13" />
        </div>
      </div>
    </FormDialog>
  );
}
