"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { IamEntitlements } from "@/lib/qubit/iam";
import { setUnauthorizedHandler } from "@/lib/qubit/api";

/**
 * IAM identity context (client mirror of the server's decision).
 *
 * The server derives the acting identity from the signed session cookie —
 * this context only DISPLAYS what the server already decided:
 *   · identity  — who is signed in (userId, name, role, department)
 *   · entitlements — home screen, allowed screens/modules, permissions
 *   · authState — loading | authenticated | anonymous
 *
 * The old role-preview model is gone: a session is bound to one person's
 * own role, so there is nothing to switch. `can()` still gates governance
 * UI affordances; the server re-checks everything independently.
 */
export type ViewAsRole = "administrator" | "dept-head" | "sales-exec" | "hr-manager" | "employee";

export const VIEW_AS_ROLES: { id: ViewAsRole; label: string; hint: string }[] = [
  { id: "administrator", label: "Administrator", hint: "Full governance access" },
  { id: "dept-head", label: "Department Head", hint: "Manages own department" },
  { id: "sales-exec", label: "Sales Executive", hint: "Field sales access only" },
  { id: "hr-manager", label: "HR Manager", hint: "People operations access" },
  { id: "employee", label: "Employee", hint: "Read-only self-service" },
];

/** Capabilities used across the governance screens (display affordances). */
export type Capability =
  | "governance.edit"
  | "structure.edit"
  | "workflows.edit"
  | "navigation.edit"
  | "notifications.edit"
  | "integrations.manage"
  | "security.admin"
  | "audit.export";

export interface IamIdentityView {
  userId: string;
  name: string;
  email: string;
  title: string;
  role: ViewAsRole;
  department: string;
  sessionId: string;
}

/** Capabilities per session role — mirrors the server's governance model. */
const ROLE_CAPABILITIES: Record<ViewAsRole, Capability[]> = {
  administrator: ["governance.edit", "structure.edit", "workflows.edit", "navigation.edit", "notifications.edit", "integrations.manage", "security.admin", "audit.export"],
  "dept-head": ["structure.edit", "workflows.edit", "notifications.edit"],
  "sales-exec": [],
  "hr-manager": ["structure.edit", "notifications.edit"],
  employee: [],
};

type AuthState = "loading" | "authenticated" | "anonymous";

interface RoleContextValue {
  role: ViewAsRole;
  /** no-op retained for API compatibility — role preview was removed with IAM. */
  setRole: (r: ViewAsRole) => void;
  can: (c: Capability) => boolean;
  hasPermission: (p: string) => boolean;
  isAdmin: boolean;
  authState: AuthState;
  identity: IamIdentityView | null;
  entitlements: IamEntitlements | null;
  refreshIdentity: () => Promise<void>;
  signOut: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [identity, setIdentity] = useState<IamIdentityView | null>(null);
  const [entitlements, setEntitlements] = useState<IamEntitlements | null>(null);

  const loadIdentity = useCallback(async (): Promise<IamIdentityView | null> => {
    try {
      const res = await fetch("/api/iam/me", { cache: "no-store" });
      if (!res.ok) {
        setIdentity(null);
        setEntitlements(null);
        setAuthState("anonymous");
        return null;
      }
      const body = (await res.json()) as { identity: IamIdentityView; entitlements: IamEntitlements };
      setIdentity(body.identity);
      setEntitlements(body.entitlements);
      setAuthState("authenticated");
      return body.identity;
    } catch {
      setIdentity(null);
      setEntitlements(null);
      setAuthState("anonymous");
      return null;
    }
  }, []);

  const refreshIdentity = useCallback(async () => {
    await loadIdentity();
  }, [loadIdentity]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/iam/logout", { method: "POST", cache: "no-store" });
    } catch {
      /* the cookie is cleared server-side; local state resets regardless */
    }
    setIdentity(null);
    setEntitlements(null);
    setAuthState("anonymous");
  }, []);

  // Boot: resolve the session once. No credential-free bootstrap exists —
  // an anonymous visitor stays anonymous until they sign in.
  useEffect(() => {
    void loadIdentity();
  }, [loadIdentity]);

  // Any API call that comes back 401 session_required drops the shell into
  // the anonymous state (the shell then routes to the login screen).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setIdentity(null);
      setEntitlements(null);
      setAuthState("anonymous");
    });
  }, []);

  const role = (identity?.role ?? "employee") as ViewAsRole;
  const roleForCaps = identity ? role : "employee";
  const can = useCallback((c: Capability) => identity !== null && ROLE_CAPABILITIES[roleForCaps].includes(c), [identity, roleForCaps]);
  const permissions = entitlements?.permissions ?? [];
  const hasPermission = useCallback((p: string) => permissions.includes(p), [permissions]);

  const setRole = useCallback((_r: ViewAsRole) => {
    // Role preview is disabled under IAM — a session is bound to one person.
    // Kept as a no-op so legacy call sites (access-denied gates) remain valid.
  }, []);

  const value = useMemo(
    () => ({
      role,
      setRole,
      can,
      hasPermission,
      isAdmin: identity !== null && role === "administrator",
      authState,
      identity,
      entitlements,
      refreshIdentity,
      signOut,
    }),
    [role, setRole, can, hasPermission, identity, authState, entitlements, refreshIdentity, signOut],
  );
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
