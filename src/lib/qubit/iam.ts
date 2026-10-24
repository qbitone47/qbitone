// ============================================================
// Qubit One — Enterprise Identity & Access Management (SERVER ONLY)
// ============================================================
// Individual employee identities with their own credentials.
// Authentication answers WHO YOU ARE (this file + /api/iam/*);
// authorization answers WHAT YOU MAY ACCESS (department/permission
// matrices below + the existing per-module server gates).
//
// Design rules (IAM master spec):
//   · Every employee has an individual account — no shared logins.
//   · The session role is bound to the person's own role: the old
//     role-preview model is gone; a session can never escalate.
//   · Passwords are verified against scrypt hashes — plaintext is
//     never stored, logged, or committed. Demo passwords are derived
//     at runtime from the server signing secret (HMAC), so they are
//     unique per account and survive restarts WITHOUT being stored
//     in source code, env files, or Git.
//   · Navigation/entitlements are computed SERVER-SIDE from these
//     matrices and re-enforced by every API gate — UI hiding is
//     convenience, the backend is the boundary.
// ============================================================

import { screensByModule, type ScreenId, type ScreenModule } from "./screens";
import { getSigningSecret, secretEncoder } from "./secret-server";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

// ---------- Departments (verified against the existing application) ----------
// Mapping to the real product (screens.ts modules + sidebar):
//   executive → executive module (CEO Command Center)
//   sales     → sales + sales-ai modules
//   finance / inventory / marketing / service / hr → their analytics screens
//   Common tools (workspace my-*, mail, people directory, mobile) → everyone.
export type IamDepartment = "executive" | "sales" | "finance" | "hr" | "inventory" | "marketing" | "service";

export const IAM_DEPARTMENTS: { id: IamDepartment; label: string }[] = [
  { id: "executive", label: "Executive" },
  { id: "sales", label: "Sales" },
  { id: "finance", label: "Finance" },
  { id: "hr", label: "HR & People" },
  { id: "inventory", label: "Inventory" },
  { id: "marketing", label: "Digital Marketing" },
  { id: "service", label: "Service & Support" },
];

export function departmentLabel(id: IamDepartment): string {
  return IAM_DEPARTMENTS.find((d) => d.id === id)?.label ?? id;
}

// ---------- Roles (§16 — existing equivalents reused where possible) ----------
// sessionRole is the product's existing QubitRole consumed by the current
// server gates (requireExecutive / requireSalesAccess / requireAnalyticsAccess):
//   ceo                → administrator (executive + governance, unchanged)
//   sales-manager      → dept-head (the ONLY team-scope surface today is Sales)
//   sales-executive    → sales-exec
//   hr-manager         → hr-manager
//   every other dept   → employee (department gate below authorizes their dept)
export type IamRole =
  | "ceo"
  | "sales-manager"
  | "sales-executive"
  | "finance-manager"
  | "finance-executive"
  | "hr-manager"
  | "hr-executive"
  | "inventory-manager"
  | "inventory-executive"
  | "marketing-manager"
  | "marketing-executive"
  | "service-manager"
  | "service-engineer";

export type SessionRole = "administrator" | "dept-head" | "sales-exec" | "hr-manager" | "employee";

export const IAM_ROLES: Record<IamRole, { label: string; department: IamDepartment; sessionRole: SessionRole; manager: boolean }> = {
  ceo: { label: "CEO", department: "executive", sessionRole: "administrator", manager: false },
  "sales-manager": { label: "Sales Manager", department: "sales", sessionRole: "dept-head", manager: true },
  "sales-executive": { label: "Sales Executive", department: "sales", sessionRole: "sales-exec", manager: false },
  "finance-manager": { label: "Finance Manager", department: "finance", sessionRole: "employee", manager: true },
  "finance-executive": { label: "Finance Executive", department: "finance", sessionRole: "employee", manager: false },
  "hr-manager": { label: "HR Manager", department: "hr", sessionRole: "hr-manager", manager: true },
  "hr-executive": { label: "HR Executive", department: "hr", sessionRole: "employee", manager: false },
  "inventory-manager": { label: "Inventory Manager", department: "inventory", sessionRole: "employee", manager: true },
  "inventory-executive": { label: "Inventory Executive", department: "inventory", sessionRole: "employee", manager: false },
  "marketing-manager": { label: "Marketing Manager", department: "marketing", sessionRole: "employee", manager: true },
  "marketing-executive": { label: "Marketing Executive", department: "marketing", sessionRole: "employee", manager: false },
  "service-manager": { label: "Service Manager", department: "service", sessionRole: "employee", manager: true },
  "service-engineer": { label: "Service Engineer", department: "service", sessionRole: "employee", manager: false },
};

// ---------- User identity ----------
export interface IamUser {
  userId: string;
  name: string;
  email: string;
  department: IamDepartment;
  role: IamRole;
  title: string;
  employeeId: string;
  managerId: string | null;
  workLocation: string;
  status: "active";
  demo: boolean;
}

interface IamDirectoryEntry {
  name: string;
  email: string;
  roles: [SessionRole];
  department: IamDepartment;
  iamRole: IamRole;
  title: string;
}

// Individual accounts — each has exactly ONE allowed session role, so a
// session can never assume another role (the role-preview model is gone).
// `sagar` is the standing CEO/administrator principal that owns the seeded
// company data; the demo.* accounts are dedicated per-department identities.
const IAM_USERS: IamUser[] = [
  {
    userId: "sagar",
    name: "Sagar Singh",
    email: "sagar.singh@qubitone.in",
    department: "executive",
    role: "ceo",
    title: "Chief Executive Officer",
    employeeId: "QO-0001",
    managerId: null,
    workLocation: "Mumbai HQ",
    status: "active",
    demo: false,
  },
  {
    userId: "demo.ceo",
    name: "Demo CEO",
    email: "demo.ceo@qubitone.in",
    department: "executive",
    role: "ceo",
    title: "Chief Executive Officer (Demo)",
    employeeId: "QO-D001",
    managerId: null,
    workLocation: "Mumbai HQ",
    status: "active",
    demo: true,
  },
  {
    userId: "demo.sales",
    name: "Demo Sales",
    email: "demo.sales@qubitone.in",
    department: "sales",
    role: "sales-executive",
    title: "Sales Executive (Demo)",
    employeeId: "QO-D002",
    managerId: "demo.ceo",
    workLocation: "Mumbai HQ",
    status: "active",
    demo: true,
  },
  {
    userId: "demo.finance",
    name: "Demo Finance",
    email: "demo.finance@qubitone.in",
    department: "finance",
    role: "finance-executive",
    title: "Finance Executive (Demo)",
    employeeId: "QO-D003",
    managerId: "demo.ceo",
    workLocation: "Mumbai HQ",
    status: "active",
    demo: true,
  },
  {
    userId: "demo.hr",
    name: "Demo HR",
    email: "demo.hr@qubitone.in",
    department: "hr",
    role: "hr-manager",
    title: "HR Manager (Demo)",
    employeeId: "QO-D004",
    managerId: "demo.ceo",
    workLocation: "Mumbai HQ",
    status: "active",
    demo: true,
  },
  {
    userId: "demo.inventory",
    name: "Demo Inventory",
    email: "demo.inventory@qubitone.in",
    department: "inventory",
    role: "inventory-executive",
    title: "Inventory Executive (Demo)",
    employeeId: "QO-D005",
    managerId: "demo.ceo",
    workLocation: "Pune Warehouse",
    status: "active",
    demo: true,
  },
  {
    userId: "demo.marketing",
    name: "Demo Marketing",
    email: "demo.marketing@qubitone.in",
    department: "marketing",
    role: "marketing-executive",
    title: "Marketing Executive (Demo)",
    employeeId: "QO-D006",
    managerId: "demo.ceo",
    workLocation: "Mumbai HQ",
    status: "active",
    demo: true,
  },
  {
    userId: "demo.service",
    name: "Demo Service",
    email: "demo.service@qubitone.in",
    department: "service",
    role: "service-engineer",
    title: "Service Engineer (Demo)",
    employeeId: "QO-D007",
    managerId: "demo.ceo",
    workLocation: "Field · West Zone",
    status: "active",
    demo: true,
  },
];

/** Session-plane directory consumed by auth-server (single role per user). */
export const IAM_DIRECTORY: Record<string, IamDirectoryEntry> = Object.fromEntries(
  IAM_USERS.map((u) => [
    u.userId,
    {
      name: u.name,
      email: u.email,
      roles: [IAM_ROLES[u.role].sessionRole],
      department: u.department,
      iamRole: u.role,
      title: u.title,
    },
  ]),
);

export function iamUserById(userId: string): IamUser | null {
  return IAM_USERS.find((u) => u.userId === userId) ?? null;
}

export function iamUserByEmail(email: string): IamUser | null {
  const e = email.trim().toLowerCase();
  return IAM_USERS.find((u) => u.email.toLowerCase() === e) ?? null;
}

export function iamUserByIdentifier(idOrEmail: string): IamUser | null {
  return iamUserById(idOrEmail.trim()) ?? iamUserByEmail(idOrEmail);
}

// Employee-directory records for the demo identities live in data.ts
// (`employees`) as literal data — data.ts is imported by client components
// and must stay free of server-only imports.

// ---------- Password plane (§25/§27 — hashed, unique, never committed) ----------
interface CredentialRecord {
  userId: string;
  passwordHash: string; // scrypt$N$r$p$saltHex$hashHex
  updatedAt: number;
}

const gCred = globalThis as unknown as { __qubitIamCredentials?: Map<string, CredentialRecord> };

function credentialStore(): Map<string, CredentialRecord> {
  if (!gCred.__qubitIamCredentials) gCred.__qubitIamCredentials = new Map();
  return gCred.__qubitIamCredentials;
}

function scryptHash(password: string, saltHex?: string): string {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : randomBytes(16);
  const N = 16384, r = 8, p = 1;
  const hash = scryptSync(password, salt, 64, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function scryptVerify(password: string, stored: string): boolean {
  try {
    const [scheme, nStr, rStr, pStr, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const N = Number(nStr), r = Number(rStr), p = Number(pStr);
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, salt, expected.length, { N, r, p });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/**
 * Deterministic per-user demo password: HMAC-SHA256(serverSecret, userId),
 * base64url-encoded and policy-shaped. Derivation requires the server
 * secret — the password is NOT stored in source, env, Git, or logs, and
 * survives restarts/redeploys without any plaintext persistence.
 */
export async function deriveDemoPassword(userId: string): Promise<string> {
  const secret = await getSigningSecret();
  const enc = secretEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`qubit-demo-password-v1:${userId}`));
  let raw = Buffer.from(new Uint8Array(sig)).toString("base64url");
  // Policy shape (12+ chars, mixed case, digit) — deterministic substitution.
  raw = raw.slice(0, 22);
  if (!/\d/.test(raw)) raw = raw.slice(0, 10) + "7" + raw.slice(11);
  if (!/[A-Z]/.test(raw)) raw = "Q" + raw.slice(1);
  if (!/[a-z]/.test(raw)) raw = raw.slice(0, 1) + "q" + raw.slice(2);
  return raw;
}

/** Seed hashes for every account on first use (idempotent). */
export async function ensureCredentialsSeeded(): Promise<void> {
  const store = credentialStore();
  for (const u of IAM_USERS) {
    if (store.has(u.userId)) continue;
    const password = await deriveDemoPassword(u.userId);
    store.set(u.userId, { userId: u.userId, passwordHash: scryptHash(password), updatedAt: Date.now() });
  }
}

export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  await ensureCredentialsSeeded();
  const rec = credentialStore().get(userId);
  if (!rec) return false;
  return scryptVerify(password, rec.passwordHash);
}

export async function setUserPassword(userId: string, newPassword: string): Promise<boolean> {
  const user = iamUserById(userId);
  if (!user) return false;
  credentialStore().set(userId, {
    userId,
    passwordHash: scryptHash(newPassword),
    updatedAt: Date.now(),
  });
  return true;
}

// ---------- Permission model (§17 — granular, department-scoped) ----------
const COMMON_PERMISSIONS = [
  "task.read", "task.write",
  "mail.read", "mail.send",
  "meeting.read", "meeting.create",
  "calendar.read",
  "notification.read",
  "document.read",
  "approval.request",
  "profile.read", "profile.edit",
  "directory.read",
  "ai.assistant.use", // Mobile AI assistant — inherits these same permissions
];

const DEPARTMENT_PERMISSIONS: Record<IamDepartment, string[]> = {
  executive: [
    "executive.read", "company.kpi.read", "executive.approve", "executive.report",
    "company.analytics.read", "audit.read", "audit.export",
    "governance.edit", "structure.edit", "workflows.edit", "navigation.edit",
    "notifications.edit", "integrations.manage", "security.admin",
    // Company-wide summaries across departments (§14 — summaries, not private records)
    "sales.summary.read", "finance.summary.read", "people.summary.read",
    "inventory.summary.read", "marketing.summary.read", "service.summary.read",
  ],
  sales: [
    "lead.read", "lead.create", "lead.update",
    "contact.read", "contact.create", "contact.update",
    "account.read", "opportunity.read", "opportunity.update",
    "pipeline.read", "quotation.read", "quotation.create",
    "order.read", "followup.read", "activity.read",
    "sales.report.read", "ai.sales.use",
  ],
  finance: [
    "finance.dashboard.read", "invoice.read", "expense.read", "payment.read",
    "receivable.read", "budget.read", "finance.report.read",
  ],
  hr: [
    "hr.dashboard.read", "employee.read", "recruitment.read", "attendance.read",
    "leave.read", "policy.read", "hr.report.read", "payroll.read",
  ],
  inventory: [
    "inventory.dashboard.read", "product.read", "stock.read", "warehouse.read",
    "purchaseorder.read", "dispatch.read",
  ],
  marketing: [
    "marketing.dashboard.read", "social.read", "content.read", "seo.read",
    "campaign.read", "brandasset.read",
  ],
  service: [
    "service.dashboard.read", "ticket.read", "ticket.create", "visit.read",
    "sparepart.read",
  ],
};

/** Manager-level additions (team visibility inside their OWN department). */
const MANAGER_PERMISSIONS: Record<IamDepartment, string[]> = {
  executive: [],
  sales: ["sales.team.read", "sales.export", "lead.delete", "quotation.approve"],
  finance: ["finance.team.read", "invoice.approve", "expense.approve"],
  hr: ["hr.team.read", "offer.approve"],
  inventory: ["inventory.team.read", "stock.adjust"],
  marketing: ["marketing.team.read", "post.approve"],
  service: ["service.team.read", "ticket.assign"],
};

export function permissionsFor(user: IamUser): string[] {
  const perms = new Set<string>(COMMON_PERMISSIONS);
  for (const p of DEPARTMENT_PERMISSIONS[user.department]) perms.add(p);
  if (IAM_ROLES[user.role].manager) {
    for (const p of MANAGER_PERMISSIONS[user.department]) perms.add(p);
  }
  return Array.from(perms).sort();
}

// ---------- Module access matrix (§5–§11, §32–§34) ----------
// Registry modules every authenticated employee may open (common tools).
const COMMON_MODULES: ScreenModule[] = ["workspace", "mail", "people", "mobile"];

// Department-owned registry modules (operational surfaces).
const DEPARTMENT_MODULES: Record<IamDepartment, ScreenModule[]> = {
  executive: ["executive", "analytics", "enterprise", "security", "platform", "operations", "observability", "design-system"],
  sales: ["sales", "sales-ai"],
  finance: [],
  hr: [],
  inventory: [],
  marketing: [],
  service: [],
};

// Department-owned analytics screens (the analytics module is shared, but
// each department's dashboard screen belongs to that department only).
export const DEPARTMENT_ANALYTICS: Record<IamDepartment, ScreenId[]> = {
  executive: [],
  sales: ["sales-analytics"],
  finance: ["finance-analytics"],
  hr: ["hr-analytics"],
  inventory: ["inventory-analytics"],
  marketing: ["marketing-analytics"],
  service: ["service-analytics"],
};

/** screenId → owning department (cross-department isolation, §15/§30). */
const SCREEN_DEPARTMENT_OWNER: Partial<Record<ScreenId, IamDepartment>> = {};
for (const [dept, screens] of Object.entries(DEPARTMENT_ANALYTICS) as [IamDepartment, ScreenId[]][]) {
  for (const s of screens) SCREEN_DEPARTMENT_OWNER[s] = dept;
}

export function screenOwningDepartment(screen: ScreenId): IamDepartment | null {
  return SCREEN_DEPARTMENT_OWNER[screen] ?? null;
}

// ---------- Home screens (§12 — personalized, not generic) ----------
function homeScreenFor(user: IamUser): ScreenId {
  if (user.department === "executive") return "ceo-overview";
  if (user.department === "sales") return "sales-home";
  return "employee-home";
}

// ---------- Entitlements (server-computed, consumed by UI + APIs) ----------
export interface IamEntitlements {
  userId: string;
  name: string;
  email: string;
  title: string;
  department: IamDepartment;
  departmentLabel: string;
  role: IamRole;
  roleLabel: string;
  sessionRole: SessionRole;
  homeScreen: ScreenId;
  allowedScreens: ScreenId[];
  allowedModules: string[];
  permissions: string[];
}

export function entitlementsFor(userId: string): IamEntitlements | null {
  const user = iamUserById(userId);
  if (!user) return null;
  return entitlementsForUser(user);
}

export function entitlementsForUser(user: IamUser): IamEntitlements {
  const roleInfo = IAM_ROLES[user.role];
  const isCeo = user.department === "executive";
  const allowed = new Set<ScreenId>();

  if (isCeo) {
    // CEO/administrator: full organization-wide access (existing behavior —
    // private records remain governed by record-level rules, not by this).
    allowed.add("ceo-overview");
  }

  for (const m of COMMON_MODULES) moduleScreens(m, allowed);
  for (const m of DEPARTMENT_MODULES[user.department]) moduleScreens(m, allowed);
  for (const s of DEPARTMENT_ANALYTICS[user.department]) allowed.add(s);

  // Common workspaces always include the personal home.
  allowed.add("employee-home");
  if (user.department === "sales") allowed.add("sales-home");
  if (isCeo) allowed.add("ceo-overview");

  const allowedScreens = Array.from(allowed);

  const allowedModules = new Set<string>(["home", "workspace", "mobile", "people", "mail", "meetings", "documents"]);
  if (user.department === "sales") {
    allowedModules.add("sales");
    allowedModules.add("ai");
    allowedModules.add("analytics");
  }
  for (const m of DEPARTMENT_MODULES[user.department]) {
    if (m === "sales") allowedModules.add("sales");
    if (m === "sales-ai") allowedModules.add("ai");
    if (m === "executive") allowedModules.add("executive");
    if (m === "analytics") allowedModules.add("analytics");
    if (m === "enterprise") allowedModules.add("enterprise");
    if (m === "security") allowedModules.add("security");
    if (m === "platform") allowedModules.add("platform");
    if (m === "operations") allowedModules.add("operations");
    if (m === "observability") allowedModules.add("observability");
    if (m === "design-system") allowedModules.add("design-system");
  }
  if (user.department !== "executive") {
    // Department users reach their analytics through the department entry;
    // the Analytics module shortcut stays available for their own screens.
    allowedModules.add("analytics");
  }
  if (isCeo) allowedModules.add("settings");

  return {
    userId: user.userId,
    name: user.name,
    email: user.email,
    title: user.title,
    department: user.department,
    departmentLabel: departmentLabel(user.department),
    role: user.role,
    roleLabel: roleInfo.label,
    sessionRole: roleInfo.sessionRole,
    homeScreen: homeScreenFor(user),
    allowedScreens,
    allowedModules: Array.from(allowedModules),
    permissions: permissionsFor(user),
  };
}

function moduleScreens(m: ScreenModule, out: Set<ScreenId>) {
  // screens.ts is pure metadata — safe to import on the server.
  for (const s of screensByModule(m)) out.add(s.id);
}

// ---------- Demo personal data seeds (§11/§12 — personalized workspace) ----------
// Small per-user seeds so each demo account opens a genuinely personal
// workspace (own tasks / meetings / notifications / mail). Namespaced ids
// avoid any collision with the standing company fixtures.
export interface PersonalSeed {
  tasks: { id: string; title: string; detail: string; priority: "Low" | "Medium" | "High"; dueInDays: number; source: "Manual" | "Meeting action item" | "Approval process" | "AI recommendation" }[];
  meetings: { id: string; title: string; startInHours: number; durationMin: number; location: string; agenda: string }[];
  notifications: { id: string; title: string; body: string; category: "Approvals" | "Tasks" | "Meetings" | "System" | "Sales" | "Finance" | "Service"; unread: boolean; priority: "High" | "Medium" | "Low" }[];
  mails: { id: string; subject: string; preview: string; body: string; fromName: string; fromEmail: string; unread: boolean; starred: boolean; folder: "inbox" }[];
}

export const PERSONAL_SEEDS: Record<string, PersonalSeed> = {
  "demo.ceo": {
    tasks: [
      { id: "t-dem-c1", title: "Review weekly board metrics pack", detail: "Confirm the KPI commentary before Friday circulation.", priority: "High", dueInDays: 0, source: "Manual" },
      { id: "t-dem-c2", title: "Approve pending executive approvals", detail: "Two high-value requests routed through the Approval Matrix.", priority: "High", dueInDays: 1, source: "Approval process" },
      { id: "t-dem-c3", title: "Quarterly town-hall prep", detail: "Outline company performance narrative and Q&A themes.", priority: "Medium", dueInDays: 3, source: "Manual" },
    ],
    meetings: [
      { id: "m-dem-c1", title: "Leadership standup — department heads", startInHours: 4, durationMin: 30, location: "Board Room", agenda: "Company performance, blockers, decisions needed." },
    ],
    notifications: [
      { id: "n-dem-c1", title: "Executive approval awaiting decision", body: "A step-up approval is awaiting your decision.", category: "Approvals", unread: true, priority: "High" },
      { id: "n-dem-c2", title: "Weekly KPI snapshot ready", body: "Company KPI overview is ready for review.", category: "System", unread: false, priority: "Medium" },
    ],
    mails: [
      { id: "ml-dem-c1", subject: "Board pack — weekly metrics", preview: "Company KPI commentary attached for your review…", body: "Hi,\n\nCompany KPI commentary attached. Two items need your call before Friday.", fromName: "Executive Office", fromEmail: "eoffice@qubitone.in", unread: true, starred: true, folder: "inbox" },
      { id: "ml-dem-c2", subject: "Approval routing — capex request", preview: "A capex request above the step-up threshold…", body: "A capex request above the step-up threshold awaits your decision in Executive Approvals.", fromName: "Finance Automation", fromEmail: "automation@qubitone.in", unread: false, starred: false, folder: "inbox" },
      { id: "ml-dem-c3", subject: "Town hall logistics", preview: "Quarterly town hall slot proposed…", body: "Quarterly town hall slot proposed for the last Friday of the month.", fromName: "People Ops", fromEmail: "people@qubitone.in", unread: false, starred: false, folder: "inbox" },
    ],
  },
  "demo.sales": {
    tasks: [
      { id: "t-dem-s1", title: "Follow up: Kepler Industries proposal", detail: "Send revised pricing for the 40-unit order and confirm the decision timeline.", priority: "High", dueInDays: 0, source: "Manual" },
      { id: "t-dem-s2", title: "Prepare demo for Nova Retail", detail: "Align with presales on the retail workspace walkthrough.", priority: "Medium", dueInDays: 1, source: "Meeting action item" },
      { id: "t-dem-s3", title: "Update pipeline stages for Q3 deals", detail: "Review stale opportunities and refresh close dates.", priority: "Medium", dueInDays: 3, source: "Manual" },
    ],
    meetings: [
      { id: "m-dem-s1", title: "Kepler Industries — pricing follow-up call", startInHours: 3, durationMin: 30, location: "Google Meet", agenda: "Walk through revised pricing and next steps." },
      { id: "m-dem-s2", title: "Weekly pipeline review", startInHours: 26, durationMin: 45, location: "Meeting Room 2", agenda: "Own pipeline, blockers, forecast." },
    ],
    notifications: [
      { id: "n-dem-s1", title: "Follow-up due today", body: "Kepler Industries proposal follow-up is due today.", category: "Tasks", unread: true, priority: "High" },
      { id: "n-dem-s2", title: "Meeting in 3 hours", body: "Kepler Industries pricing call at the scheduled time.", category: "Meetings", unread: true, priority: "Medium" },
    ],
    mails: [
      { id: "ml-dem-s1", subject: "Revised pricing — Kepler Industries", preview: "Sharing the revised 40-unit pricing for your review…", body: "Hi,\n\nSharing the revised 40-unit pricing for your review. The volume discount applies from unit 25 onward.\n\nRegards,\nSales Ops", fromName: "Sales Operations", fromEmail: "sales.ops@qubitone.in", unread: true, starred: true, folder: "inbox" },
      { id: "ml-dem-s2", subject: "Nova Retail — demo confirmed", preview: "The retail workspace walkthrough is confirmed for this week…", body: "Hello,\n\nThe retail workspace walkthrough is confirmed for this week. Presales will join.", fromName: "Nova Retail", fromEmail: "procurement@novaretail.example.com", unread: false, starred: false, folder: "inbox" },
      { id: "ml-dem-s3", subject: "Weekly target summary", preview: "Your week-to-date attainment and open follow-ups…", body: "Weekly summary: attainment 68%, 4 open follow-ups, 2 quotes awaiting decision.", fromName: "Sales Console", fromEmail: "console@qubitone.in", unread: false, starred: false, folder: "inbox" },
    ],
  },
  "demo.finance": {
    tasks: [
      { id: "t-dem-f1", title: "Review pending vendor invoices", detail: "Three vendor invoices await verification before payment run.", priority: "High", dueInDays: 0, source: "Manual" },
      { id: "t-dem-f2", title: "Reconcile petty cash — week 46", detail: "Match vouchers against the petty cash ledger.", priority: "Medium", dueInDays: 1, source: "Manual" },
      { id: "t-dem-f3", title: "Prepare receivables ageing snapshot", detail: "Flag accounts past 30 days for the collections list.", priority: "Medium", dueInDays: 2, source: "Manual" },
    ],
    meetings: [
      { id: "m-dem-f1", title: "Month-close planning", startInHours: 5, durationMin: 45, location: "Meeting Room 1", agenda: "Close checklist, pending invoices, accruals." },
    ],
    notifications: [
      { id: "n-dem-f1", title: "Invoices awaiting verification", body: "3 vendor invoices are pending your verification.", category: "Tasks", unread: true, priority: "High" },
      { id: "n-dem-f2", title: "Approval request assigned", body: "A travel reimbursement awaits finance review.", category: "Approvals", unread: true, priority: "Medium" },
    ],
    mails: [
      { id: "ml-dem-f1", subject: "Vendor invoice batch — November", preview: "Three invoices attached for verification before the payment run…", body: "Hi,\n\nThree vendor invoices attached for verification before this week's payment run.", fromName: "Accounts Payable", fromEmail: "ap@qubitone.in", unread: true, starred: true, folder: "inbox" },
      { id: "ml-dem-f2", subject: "Reimbursement — field travel", preview: "Reimbursement request submitted for your review…", body: "A field travel reimbursement has been submitted for finance review.", fromName: "People Ops", fromEmail: "people@qubitone.in", unread: false, starred: false, folder: "inbox" },
      { id: "ml-dem-f3", subject: "Bank statement — week 46", preview: "Weekly statement available in the banking workspace…", body: "The weekly bank statement is available in the banking workspace.", fromName: "Banking Console", fromEmail: "console@qubitone.in", unread: false, starred: false, folder: "inbox" },
    ],
  },
  "demo.hr": {
    tasks: [
      { id: "t-dem-h1", title: "Schedule onboarding — new joiner", detail: "Prepare accounts, ID card and orientation slot.", priority: "High", dueInDays: 0, source: "Manual" },
      { id: "t-dem-h2", title: "Review leave balance anomalies", detail: "Two employees show negative leave balances.", priority: "Medium", dueInDays: 1, source: "Manual" },
      { id: "t-dem-h3", title: "Publish updated travel policy", detail: "Circulate the revised travel policy for acknowledgements.", priority: "Low", dueInDays: 4, source: "Manual" },
    ],
    meetings: [
      { id: "m-dem-h1", title: "Candidate panel — Sales Executive", startInHours: 4, durationMin: 45, location: "Meeting Room 3", agenda: "Panel interview round 2." },
    ],
    notifications: [
      { id: "n-dem-h1", title: "Onboarding due today", body: "New joiner onboarding checklist is due today.", category: "Tasks", unread: true, priority: "High" },
      { id: "n-dem-h2", title: "Leave request pending", body: "A leave request awaits HR review.", category: "Approvals", unread: true, priority: "Medium" },
    ],
    mails: [
      { id: "ml-dem-h1", subject: "Onboarding — document checklist", preview: "New joiner documents received; accounts setup pending…", body: "Hi,\n\nNew joiner documents received. Accounts setup pending on IT.", fromName: "IT Administration", fromEmail: "it@qubitone.in", unread: true, starred: true, folder: "inbox" },
      { id: "ml-dem-h2", subject: "Interview panel availability", preview: "Please confirm tomorrow's panel slot…", body: "Please confirm tomorrow's panel slot for the Sales Executive round 2.", fromName: "Recruitment", fromEmail: "recruit@qubitone.in", unread: false, starred: false, folder: "inbox" },
      { id: "ml-dem-h3", subject: "Policy acknowledgement report", preview: "84% acknowledgements for the revised policy…", body: "84% acknowledgements recorded for the revised policy so far.", fromName: "People Console", fromEmail: "console@qubitone.in", unread: false, starred: false, folder: "inbox" },
    ],
  },
  "demo.inventory": {
    tasks: [
      { id: "t-dem-i1", title: "Cycle count — Warehouse A, aisle 4", detail: "Verify serialized units against system stock.", priority: "High", dueInDays: 0, source: "Manual" },
      { id: "t-dem-i2", title: "Process pending goods receipts", detail: "Two POs awaiting goods receipt posting.", priority: "Medium", dueInDays: 1, source: "Manual" },
      { id: "t-dem-i3", title: "Flag low-stock items for reorder", detail: "Review reorder report and raise purchase requests.", priority: "Medium", dueInDays: 2, source: "Manual" },
    ],
    meetings: [
      { id: "m-dem-i1", title: "Dispatch schedule review", startInHours: 6, durationMin: 30, location: "Warehouse Office", agenda: "Tomorrow's dispatch plan and carrier slots." },
    ],
    notifications: [
      { id: "n-dem-i1", title: "Goods receipt pending", body: "2 purchase orders await goods receipt posting.", category: "Tasks", unread: true, priority: "High" },
      { id: "n-dem-i2", title: "Low stock alert", body: "3 items are below the reorder threshold.", category: "System", unread: true, priority: "Medium" },
    ],
    mails: [
      { id: "ml-dem-i1", subject: "GRN pending — PO batch", preview: "Two POs are awaiting goods receipt posting…", body: "Hi,\n\nTwo purchase orders are awaiting goods receipt posting at Warehouse A.", fromName: "Procurement", fromEmail: "procure@qubitone.in", unread: true, starred: true, folder: "inbox" },
      { id: "ml-dem-i2", subject: "Carrier slot confirmation", preview: "Tomorrow's dispatch carrier slots are confirmed…", body: "Tomorrow's dispatch carrier slots are confirmed for the west zone.", fromName: "Logistics", fromEmail: "logistics@qubitone.in", unread: false, starred: false, folder: "inbox" },
      { id: "ml-dem-i3", subject: "Reorder report — week 46", preview: "3 items below threshold attached…", body: "Reorder report attached — 3 items below threshold this week.", fromName: "Inventory Console", fromEmail: "console@qubitone.in", unread: false, starred: false, folder: "inbox" },
    ],
  },
  "demo.marketing": {
    tasks: [
      { id: "t-dem-m1", title: "Draft December campaign brief", detail: "Draft the campaign brief for the year-end push.", priority: "High", dueInDays: 0, source: "Manual" },
      { id: "t-dem-m2", title: "Review content calendar — next week", detail: "Confirm posts and owners for the coming week.", priority: "Medium", dueInDays: 1, source: "Manual" },
      { id: "t-dem-m3", title: "SEO keyword refresh — top 20 pages", detail: "Refresh keyword tracking for the top 20 landing pages.", priority: "Low", dueInDays: 5, source: "Manual" },
    ],
    meetings: [
      { id: "m-dem-m1", title: "Creative review — campaign assets", startInHours: 7, durationMin: 30, location: "Google Meet", agenda: "Review draft creatives for the December push." },
    ],
    notifications: [
      { id: "n-dem-m1", title: "Post awaiting review", body: "A scheduled post awaits your review.", category: "Tasks", unread: true, priority: "High" },
      { id: "n-dem-m2", title: "Weekly social summary", body: "Engagement up 6% week over week.", category: "System", unread: false, priority: "Medium" },
    ],
    mails: [
      { id: "ml-dem-m1", subject: "Campaign brief — review request", preview: "Draft brief attached for the December push…", body: "Hi,\n\nDraft brief attached for the December push. Comments by Thursday please.", fromName: "Brand Studio", fromEmail: "brand@qubitone.in", unread: true, starred: true, folder: "inbox" },
      { id: "ml-dem-m2", subject: "Content calendar — next week", preview: "Two slots still need owners…", body: "Two slots in next week's calendar still need owners.", fromName: "Content Desk", fromEmail: "content@qubitone.in", unread: false, starred: false, folder: "inbox" },
      { id: "ml-dem-m3", subject: "SEO weekly snapshot", preview: "Organic sessions +4%; top pages stable…", body: "Organic sessions +4% week over week; top pages stable.", fromName: "Growth Console", fromEmail: "console@qubitone.in", unread: false, starred: false, folder: "inbox" },
    ],
  },
  "demo.service": {
    tasks: [
      { id: "t-dem-v1", title: "Site visit — Kepler Industries", detail: "Preventive maintenance visit; carry checklist kit B.", priority: "High", dueInDays: 0, source: "Manual" },
      { id: "t-dem-v2", title: "Close ticket with photo evidence", detail: "Attach resolution photos and customer signature.", priority: "High", dueInDays: 0, source: "Manual" },
      { id: "t-dem-v3", title: "Update spare parts usage log", detail: "Log yesterday's parts consumption against the work order.", priority: "Medium", dueInDays: 1, source: "Manual" },
    ],
    meetings: [
      { id: "m-dem-v1", title: "Field team standup", startInHours: 2, durationMin: 15, location: "Field App", agenda: "Today's visit plan and parts availability." },
    ],
    notifications: [
      { id: "n-dem-v1", title: "Visit scheduled today", body: "Preventive maintenance visit at Kepler Industries today.", category: "Tasks", unread: true, priority: "High" },
      { id: "n-dem-v2", title: "New ticket assigned", body: "A support ticket has been assigned to you.", category: "Tasks", unread: true, priority: "Medium" },
    ],
    mails: [
      { id: "ml-dem-v1", subject: "Visit schedule — today", preview: "Your site visit at Kepler Industries is today 14:00…", body: "Hi,\n\nYour site visit at Kepler Industries is today 14:00. Checklist kit B required.", fromName: "Service Desk", fromEmail: "service@qubitone.in", unread: true, starred: true, folder: "inbox" },
      { id: "ml-dem-v2", subject: "Spare parts stock at hub", preview: "Kit B components available at the west hub…", body: "Kit B components are available at the west hub for pickup.", fromName: "Parts Warehouse", fromEmail: "parts@qubitone.in", unread: false, starred: false, folder: "inbox" },
      { id: "ml-dem-v3", subject: "Customer signature pending", preview: "One completed visit awaits customer signature…", body: "One completed visit is pending the customer signature upload.", fromName: "Service Console", fromEmail: "console@qubitone.in", unread: false, starred: false, folder: "inbox" },
    ],
  },
};
