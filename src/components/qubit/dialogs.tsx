"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================
// ConfirmDialog — only for destructive / high-impact actions
// ============================================================
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  children?: React.ReactNode;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(destructive && "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600")}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================
// FormDialog — shell for create/edit forms
// ============================================================
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Save",
  submitting,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  onSubmit?: () => void;
  submitLabel?: string;
  submitting?: boolean;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-md", wide && "sm:max-w-lg")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit?.();
          }}
          className="space-y-4"
        >
          {children}
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Field — labeled form row
// ============================================================
export function Field({
  label,
  children,
  hint,
  required,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
