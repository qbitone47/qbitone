"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ensureSession } from "@/lib/qubit/api";

/**
 * Permission-aware UX: the signed-in administrator can preview the product
 * boundaries of other roles. Screens consult `can()` to hide governance
 * actions, show read-only states, or explain restrictions.
 */
export type ViewAsRole = "administrator" | "dept-head" | "sales-exec" | "hr-manager" | "employee";

export const VIEW_AS_ROLES: { id: ViewAsRole; label: string; hint: string }[] = [
  { id: "administrator", label: "Administrator", hint: "Full governance access" },
  { id: "dept-head", label: "Department Head", hint: "Manages own department" },
  { id: "sales-exec", label: "Sales Executive", hint: "Field sales access only" },
  { id: "hr-manager", label: "HR Manager", hint: "People operations access" },
  { id: "employee", label: "Employee", hint: "Read-only self-service" },
];

/** Capabilities used across Phase 1 screens */
export type Capability =
  | "governance.edit" // edit permission matrix, approval matrix, data ownership
  | "structure.edit" // add/edit departments, org structure
  | "workflows.edit" // create/disable workflows
  | "navigation.edit" // edit enterprise navigation
  | "notifications.edit"
  | "integrations.manage"
  | "security.admin" // network policies, privileged security controls (Phase 3)
  | "audit.export"; // export audit records (Phase 3)

const ROLE_CAPABILITIES: Record<ViewAsRole, Capability[]> = {
  administrator: ["governance.edit", "structure.edit", "workflows.edit", "navigation.edit", "notifications.edit", "integrations.manage", "security.admin", "audit.export"],
  "dept-head": ["structure.edit", "workflows.edit", "notifications.edit"],
  "sales-exec": [],
  "hr-manager": ["structure.edit", "notifications.edit"],
  employee: [],
};

interface RoleContextValue {
  role: ViewAsRole;
  setRole: (r: ViewAsRole) => void;
  can: (c: Capability) => boolean;
  isAdmin: boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<ViewAsRole>("administrator");

  // Phase 21: the role preview is backed by a server-issued session.
  // Bootstrap the session on mount and re-issue it on every role switch
  // (the server validates role membership; the client never declares it).
  useEffect(() => {
    ensureSession(role).catch(() => undefined);
  }, [role]);

  const setRole = useCallback((r: ViewAsRole) => setRoleState(r), []);
  const can = useCallback((c: Capability) => ROLE_CAPABILITIES[role].includes(c), [role]);
  const value = useMemo(
    () => ({ role, setRole, can, isAdmin: role === "administrator" }),
    [role, setRole, can],
  );
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
