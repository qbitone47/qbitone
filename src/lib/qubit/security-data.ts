// ============================================================
// Qubit One — Security & Identity data model (Phase 3)
// Realistic security datasets for Qubit One Pvt Ltd.
// Client-safe: static types + demo fixtures. Live security
// mutations (auth, revocations, policies, audit) are enforced
// server-side via /api/security/* — see security-server.ts.
// ============================================================

import type { ScreenId } from "./screens";

// ---------- Demo clock ----------
// Fixed enterprise clock so relative times are deterministic
// across server and client (no hydration drift, stable demo).
export const SECURITY_NOW = new Date("2026-11-13T09:42:00+05:30");

// ---------- Authentication methods ----------
export type MfaMethodId = "authenticator-app" | "passkey" | "security-key" | "push" | "recovery-code";

export interface AuthFactor {
  id: MfaMethodId;
  name: string;
  detail: string;
  status: "Enabled" | "Set up" | "Available";
  primary?: boolean;
  phishingResistant?: boolean;
  meta?: string;
}

export const AUTH_FACTORS: AuthFactor[] = [
  {
    id: "authenticator-app",
    name: "Authenticator app",
    detail: "Time-based one-time codes (TOTP)",
    status: "Enabled",
    primary: true,
    meta: "Added 12 Aug 2025 · Last used today, 09:12",
  },
  {
    id: "passkey",
    name: "Passkey",
    detail: "Face or fingerprint — phishing-resistant, satisfies MFA",
    status: "Set up",
    phishingResistant: true,
  },
  {
    id: "security-key",
    name: "Security key",
    detail: "FIDO2 hardware key (YubiKey, Titan)",
    status: "Available",
    phishingResistant: true,
  },
  {
    id: "push",
    name: "Push approval",
    detail: "Approve sign-in from the Qubit One mobile app",
    status: "Enabled",
    meta: "Used 2 Nov 2026",
  },
  {
    id: "recovery-code",
    name: "Recovery codes",
    detail: "Single-use codes for account recovery",
    status: "Enabled",
    meta: "8 of 10 remaining",
  },
];

// ---------- SSO providers (only configured providers exist) ----------
export interface SsoProvider {
  id: string;
  name: string;
  kind: "OpenID Connect" | "SAML 2.0";
  status: "Available" | "Degraded";
  hint: string;
  lastUsed: string;
}

export const SSO_PROVIDERS: SsoProvider[] = [
  {
    id: "entra",
    name: "Microsoft Entra ID",
    kind: "OpenID Connect",
    status: "Available",
    hint: "qubitone.in is verified on the Qubit One tenant",
    lastUsed: "Today, 08:56",
  },
  {
    id: "google",
    name: "Google Workspace",
    kind: "OpenID Connect",
    status: "Available",
    hint: "For @qubitone.in Google accounts",
    lastUsed: "9 Nov 2026",
  },
  {
    id: "okta",
    name: "Okta",
    kind: "SAML 2.0",
    status: "Degraded",
    hint: "Used by contractors on the partner tenant",
    lastUsed: "28 Oct 2026",
  },
];

// ---------- Device sessions ----------
export type SessionStatus = "Active" | "Revoked" | "Expired" | "Suspicious";

export interface UserSession {
  id: string;
  device: string;
  deviceKind: "laptop" | "phone" | "tablet" | "desktop";
  browser: string;
  os: string;
  location: string;
  ipMasked: string;
  started: string;
  lastActive: string;
  status: SessionStatus;
  current?: boolean;
  trusted?: boolean;
  recentlyAuthenticated?: boolean;
  note?: string;
}

export const DEVICE_SESSIONS: UserSession[] = [
  {
    id: "sess-01",
    device: "MacBook Pro 14\"",
    deviceKind: "laptop",
    browser: "Chrome 141",
    os: "macOS Sequoia",
    location: "Mumbai, India",
    ipMasked: "103.25.128.•••",
    started: "Today, 09:12",
    lastActive: "Active now",
    status: "Active",
    current: true,
    trusted: true,
    recentlyAuthenticated: true,
  },
  {
    id: "sess-02",
    device: "iPhone 15 Pro",
    deviceKind: "phone",
    browser: "Safari",
    os: "iOS 18.1",
    location: "Mumbai, India",
    ipMasked: "49.36.180.•••",
    started: "11 Nov 2026, 18:20",
    lastActive: "26 minutes ago",
    status: "Active",
    trusted: true,
  },
  {
    id: "sess-03",
    device: "ThinkPad X1",
    deviceKind: "laptop",
    browser: "Edge 140",
    os: "Windows 11",
    location: "Pune, India",
    ipMasked: "115.240.94.•••",
    started: "12 Nov 2026, 15:04",
    lastActive: "Yesterday, 19:48",
    status: "Active",
    recentlyAuthenticated: true,
    note: "Signed in with passkey on 12 Nov",
  },
  {
    id: "sess-04",
    device: "Windows PC",
    deviceKind: "desktop",
    browser: "Chrome 138",
    os: "Windows 10",
    location: "Nashik, India",
    ipMasked: "106.201.22.•••",
    started: "13 Nov 2026, 03:41",
    lastActive: "Today, 03:44",
    status: "Suspicious",
    note: "Unrecognized device · failed MFA twice before signing in",
  },
  {
    id: "sess-05",
    device: "iPad Air",
    deviceKind: "tablet",
    browser: "Safari",
    os: "iPadOS 17",
    location: "Mumbai, India",
    ipMasked: "103.25.129.•••",
    started: "2 Nov 2026, 10:02",
    lastActive: "2 Nov 2026, 11:15",
    status: "Revoked",
    note: "Signed out by you",
  },
  {
    id: "sess-06",
    device: "MacBook Air",
    deviceKind: "laptop",
    browser: "Chrome 139",
    os: "macOS Sonoma",
    location: "Bengaluru, India",
    ipMasked: "157.32.9.•••",
    started: "21 Oct 2026, 09:30",
    lastActive: "23 Oct 2026, 18:02",
    status: "Expired",
    note: "Expired after 14 days of inactivity",
  },
];

// ---------- Recovery methods ----------
export interface RecoveryMethod {
  id: string;
  kind: "email" | "phone" | "codes";
  name: string;
  detail: string;
  status: "Verified" | "Action needed";
  meta: string;
}

export const RECOVERY_METHODS: RecoveryMethod[] = [
  {
    id: "rec-email",
    kind: "email",
    name: "Recovery email",
    detail: "s•••r.singh@qubitone.in",
    status: "Verified",
    meta: "Verified 12 Aug 2025",
  },
  {
    id: "rec-phone",
    kind: "phone",
    name: "Recovery phone",
    detail: "+91 98••• ••001",
    status: "Verified",
    meta: "Verified 12 Aug 2025",
  },
  {
    id: "rec-codes",
    kind: "codes",
    name: "Recovery codes",
    detail: "8 of 10 single-use codes remaining",
    status: "Action needed",
    meta: "Generated 12 Aug 2025 — regenerating invalidates old codes",
  },
];

// ---------- Security posture recommendations ----------
export interface SecurityRecommendation {
  id: string;
  title: string;
  why: string;
  action: string;
  weight: "recommended" | "review" | "optional";
  target?: ScreenId;
  doneWhen?: "passkey-added";
}

export const SECURITY_RECOMMENDATIONS: SecurityRecommendation[] = [
  {
    id: "rec-passkey",
    title: "Add a passkey",
    why: "Passkeys are phishing-resistant and satisfy MFA in one step.",
    action: "Set up",
    weight: "recommended",
    doneWhen: "passkey-added",
  },
  {
    id: "rec-session",
    title: "Review the sign-in from Nashik",
    why: "An unrecognized Windows device signed in at 03:41 today and was flagged as suspicious.",
    action: "Review",
    weight: "review",
    target: "device-sessions",
  },
  {
    id: "rec-codes",
    title: "Regenerate recovery codes",
    why: "You have used 2 of 10 recovery codes. Fresh codes keep recovery safe.",
    action: "Regenerate",
    weight: "optional",
    target: "password-recovery",
  },
];

// ---------- Personal security activity (Security Center / Password screen) ----------
export interface SecurityEvent {
  id: string;
  title: string;
  detail: string;
  time: string;
  kind: "auth" | "factor" | "password" | "session" | "access" | "policy";
  result: "Success" | "Failure" | "Blocked";
}

export const RECENT_SECURITY_EVENTS: SecurityEvent[] = [
  {
    id: "ev-01",
    title: "Sign in — password + authenticator",
    detail: "MacBook Pro · Chrome · Mumbai · 103.25.128.•••",
    time: "Today, 09:12",
    kind: "auth",
    result: "Success",
  },
  {
    id: "ev-02",
    title: "New device signed in",
    detail: "Windows PC · Chrome · Nashik · flagged for review",
    time: "Today, 03:44",
    kind: "session",
    result: "Success",
  },
  {
    id: "ev-03",
    title: "Failed sign-in — wrong password",
    detail: "Windows PC · Chrome · Nashik · attempt 2 of 2 before MFA",
    time: "Today, 03:41",
    kind: "auth",
    result: "Failure",
  },
  {
    id: "ev-04",
    title: "Session revoked",
    detail: "iPad Air · Safari · signed out by you",
    time: "2 Nov 2026, 11:15",
    kind: "session",
    result: "Success",
  },
  {
    id: "ev-05",
    title: "Role access approved",
    detail: "Finance Analyst (30 days) · approved by Priya Sharma",
    time: "28 Oct 2026, 16:40",
    kind: "access",
    result: "Success",
  },
  {
    id: "ev-06",
    title: "Password changed",
    detail: "Changed from MacBook Pro · other sessions were signed out",
    time: "14 Oct 2026, 10:22",
    kind: "password",
    result: "Success",
  },
];

// ---------- Role access requests ----------
export type AccessRequestStatus =
  | "Draft"
  | "Submitted"
  | "Pending Approval"
  | "Approved"
  | "Rejected"
  | "Expired"
  | "Revoked";

export interface AccessRequest {
  id: string;
  requestedRole: string;
  department: string;
  permissions: string[];
  justification: string;
  approver: string;
  approverTitle: string;
  approvalPath: string[];
  risk: "Low" | "Medium" | "High";
  status: AccessRequestStatus;
  submitted: string;
  reviewBy?: string;
  duration: string;
  decidedBy?: string;
  decidedOn?: string;
  decisionNote?: string;
}

export const ACCESS_REQUESTS: AccessRequest[] = [
  {
    id: "req-104",
    requestedRole: "Finance Analyst",
    department: "Finance",
    permissions: ["View finance dashboards", "Export monthly reports", "View cost centers"],
    justification:
      "Preparing the Q4 board pack requires consolidated cost-center reporting. This grant covers the reporting window only.",
    approver: "Priya Sharma",
    approverTitle: "Finance Head",
    approvalPath: ["Sagar Singh (self)", "Priya Sharma — Finance Head", "Security review (high risk)"],
    risk: "Medium",
    status: "Pending Approval",
    submitted: "12 Nov 2026, 17:25",
    reviewBy: "15 Nov 2026",
    duration: "30 days",
  },
  {
    id: "req-101",
    requestedRole: "Accountant",
    department: "Finance",
    permissions: ["Create journal entries", "View ledgers", "Run reconciliations"],
    justification: "Covering for Meera Iyer during her leave (18–20 Dec).",
    approver: "Priya Sharma",
    approverTitle: "Finance Head",
    approvalPath: ["Sagar Singh (self)", "Priya Sharma — Finance Head"],
    risk: "Medium",
    status: "Approved",
    submitted: "28 Oct 2026, 11:02",
    reviewBy: "30 Oct 2026",
    duration: "30 days",
    decidedBy: "Priya Sharma",
    decidedOn: "28 Oct 2026, 16:40",
    decisionNote: "Approved for the leave-cover window only. Expires automatically.",
  },
  {
    id: "req-098",
    requestedRole: "IT Administrator",
    department: "Technology",
    permissions: ["Manage users", "Manage security policies", "Manage integrations"],
    justification: "Annual infrastructure audit — temporary elevation to verify access reviews.",
    approver: "Sagar Singh",
    approverTitle: "CEO",
    approvalPath: ["Sagar Singh (self)", "Security review (high risk)"],
    risk: "High",
    status: "Rejected",
    submitted: "20 Oct 2026, 09:15",
    reviewBy: "22 Oct 2026",
    duration: "7 days",
    decidedBy: "Security review",
    decidedOn: "21 Oct 2026, 14:10",
    decisionNote:
      "Rejected — audit tasks can be completed with read-only auditor access. Self-requested admin elevation is not permitted.",
  },
  {
    id: "req-087",
    requestedRole: "Sales Head (delegate)",
    department: "Sales",
    permissions: ["Approve quotations up to 10%", "View sales analytics"],
    justification: "Delegation while Rahul Mehta is on vacation.",
    approver: "Rahul Mehta",
    approverTitle: "Sales Head",
    approvalPath: ["Sagar Singh (self)", "Rahul Mehta — Sales Head"],
    risk: "High",
    status: "Revoked",
    submitted: "2 Sep 2026, 10:00",
    reviewBy: "3 Sep 2026",
    duration: "12 days",
    decidedBy: "Rahul Mehta",
    decidedOn: "2 Sep 2026, 15:30",
    decisionNote: "Delegation ended on schedule — access revoked automatically.",
  },
];

/** Roles a user may request, mapped from the org role catalog */
export const REQUESTABLE_ROLES: {
  id: string;
  name: string;
  department: string;
  permissions: string[];
  risk: "Low" | "Medium" | "High";
  approver: string;
  approverTitle: string;
}[] = [
  {
    id: "accountant",
    name: "Accountant",
    department: "Finance",
    permissions: ["Create journal entries", "View ledgers", "Run reconciliations"],
    risk: "Medium",
    approver: "Priya Sharma",
    approverTitle: "Finance Head",
  },
  {
    id: "finance-analyst",
    name: "Finance Analyst",
    department: "Finance",
    permissions: ["View finance dashboards", "Export monthly reports", "View cost centers"],
    risk: "Medium",
    approver: "Priya Sharma",
    approverTitle: "Finance Head",
  },
  {
    id: "sales-exec",
    name: "Sales Executive",
    department: "Sales",
    permissions: ["Manage own pipeline", "Create quotations"],
    risk: "Low",
    approver: "Rahul Mehta",
    approverTitle: "Sales Head",
  },
  {
    id: "hr-exec",
    name: "HR Executive",
    department: "HR & People",
    permissions: ["View employee records", "Initiate lifecycle moves"],
    risk: "Medium",
    approver: "Neha Patel",
    approverTitle: "HR Head",
  },
  {
    id: "ops-manager",
    name: "Operations Manager",
    department: "Operations",
    permissions: ["Manage workflows", "Approve operational requests"],
    risk: "High",
    approver: "Sagar Singh",
    approverTitle: "CEO",
  },
  {
    id: "it-admin",
    name: "IT Administrator",
    department: "Technology",
    permissions: ["Manage users", "Manage security policies", "Manage integrations"],
    risk: "High",
    approver: "Sagar Singh",
    approverTitle: "CEO",
  },
];

// ---------- IP / Network policies ----------
export type PolicyAction = "Allow" | "Restrict" | "Require Verification" | "Deny";
export type PolicyStatus = "Active" | "Draft" | "Scheduled" | "Disabled";

export interface NetworkPolicy {
  id: string;
  name: string;
  scope: string;
  cidr: string;
  environment: "Production" | "Staging" | "All environments";
  affected: string;
  action: PolicyAction;
  priority: number;
  status: PolicyStatus;
  createdBy: string;
  lastModified: string;
  effective: string;
  note?: string;
}

export const NETWORK_POLICIES: NetworkPolicy[] = [
  {
    id: "pol-01",
    name: "Mumbai HQ network",
    scope: "All members",
    cidr: "103.25.128.0/22",
    environment: "Production",
    affected: "1,245 users",
    action: "Allow",
    priority: 10,
    status: "Active",
    createdBy: "Sagar Singh",
    lastModified: "4 Nov 2026",
    effective: "4 Nov 2026",
    note: "Trusted office range — no additional verification.",
  },
  {
    id: "pol-02",
    name: "Pune office network",
    scope: "All members",
    cidr: "115.240.94.0/24",
    environment: "Production",
    affected: "312 users",
    action: "Allow",
    priority: 20,
    status: "Active",
    createdBy: "Sagar Singh",
    lastModified: "4 Nov 2026",
    effective: "4 Nov 2026",
  },
  {
    id: "pol-03",
    name: "Partner VPN ranges",
    scope: "Contractors",
    cidr: "203.0.113.0/24",
    environment: "Production",
    affected: "48 users",
    action: "Require Verification",
    priority: 30,
    status: "Active",
    createdBy: "Sagar Singh",
    lastModified: "28 Oct 2026",
    effective: "28 Oct 2026",
    note: "Step-up MFA on every new session.",
  },
  {
    id: "pol-04",
    name: "Finance module — office only",
    scope: "Role: Finance",
    cidr: "103.25.128.0/22",
    environment: "Production",
    affected: "64 users",
    action: "Restrict",
    priority: 40,
    status: "Active",
    createdBy: "Sagar Singh",
    lastModified: "21 Oct 2026",
    effective: "21 Oct 2026",
    note: "Finance data restricted to office + VPN egress.",
  },
  {
    id: "pol-05",
    name: "Blocked source ranges",
    scope: "All members",
    cidr: "185.220.101.0/24",
    environment: "All environments",
    affected: "0 users",
    action: "Deny",
    priority: 5,
    status: "Active",
    createdBy: "Security policy",
    lastModified: "2 Jan 2026",
    effective: "2 Jan 2026",
    note: "Known anonymizer exits — sign-ins are denied and audited.",
  },
  {
    id: "pol-06",
    name: "Staging console access",
    scope: "IT Administration",
    cidr: "103.25.130.0/24",
    environment: "Staging",
    affected: "12 users",
    action: "Allow",
    priority: 50,
    status: "Draft",
    createdBy: "Sagar Singh",
    lastModified: "12 Nov 2026",
    effective: "—",
    note: "Draft — pending conflict review with pol-04.",
  },
];

// ---------- Security alerts ----------
export type AlertSeverity = "Info" | "Warning" | "High" | "Critical";
export type AlertStatus = "New" | "Acknowledged" | "Resolved";

export interface SecurityAlert {
  id: string;
  title: string;
  explanation: string;
  severity: AlertSeverity;
  status: AlertStatus;
  time: string;
  account: string;
  resource: string;
  recommendedAction: string;
  primaryAction: { label: string; kind: "review-session" | "password" | "audit" | "policy" };
  correlationId: string;
  scope: "personal" | "organization";
}

export const SECURITY_ALERTS: SecurityAlert[] = [
  {
    id: "alert-401",
    title: "Repeated failed MFA attempts blocked",
    explanation:
      "Six verification attempts failed for your account from an unrecognized Windows device in Nashik. Rate limiting blocked further attempts after three failures.",
    severity: "Critical",
    status: "New",
    time: "Today, 03:44",
    account: "Sagar Singh (CEO)",
    resource: "Authentication",
    recommendedAction: "Review the device session and change your password if this wasn't you.",
    primaryAction: { label: "Review session", kind: "review-session" },
    correlationId: "QB-AUD-2026-1189",
    scope: "personal",
  },
  {
    id: "alert-402",
    title: "New device signed in to your account",
    explanation:
      "A Windows 10 PC signed in from Nashik at 03:44 using your password and an authenticator code. This device isn't in your trusted list.",
    severity: "High",
    status: "New",
    time: "Today, 03:44",
    account: "Sagar Singh (CEO)",
    resource: "Session sess-04",
    recommendedAction: "If this wasn't you, sign out the session immediately and rotate your password.",
    primaryAction: { label: "Review session", kind: "review-session" },
    correlationId: "QB-AUD-2026-1190",
    scope: "personal",
  },
  {
    id: "alert-403",
    title: "Role access approved — Finance Analyst",
    explanation:
      "Priya Sharma approved your 30-day Finance Analyst grant (request req-101). The grant expires automatically on 27 Nov 2026.",
    severity: "Info",
    status: "Resolved",
    time: "28 Oct 2026, 16:40",
    account: "Sagar Singh (CEO)",
    resource: "Request req-101",
    recommendedAction: "No action needed — access expires automatically and is fully audited.",
    primaryAction: { label: "View audit event", kind: "audit" },
    correlationId: "QB-AUD-2026-0934",
    scope: "personal",
  },
  {
    id: "alert-404",
    title: "Network policy changed — Finance module",
    explanation:
      "Rahul Mehta scoped the Finance module to office networks only (policy pol-04). 64 users are affected; the change is staged and auditable.",
    severity: "Warning",
    status: "Acknowledged",
    time: "21 Oct 2026, 14:12",
    account: "Organization",
    resource: "Policy pol-04",
    recommendedAction: "Confirm your finance team can still reach the module from office networks.",
    primaryAction: { label: "View policy", kind: "policy" },
    correlationId: "QB-AUD-2026-0871",
    scope: "organization",
  },
];

// ---------- Password policy (mirrored server-side) ----------
export const PASSWORD_RULES = [
  { id: "len", label: "At least 12 characters", test: (v: string) => v.length >= 12 },
  { id: "case", label: "Upper and lower case letters", test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { id: "num", label: "At least one number", test: (v: string) => /\d/.test(v) },
  { id: "sym", label: "At least one symbol", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export function passwordStrength(v: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!v) return { score: 0, label: "Empty" };
  const passed = PASSWORD_RULES.filter((r) => r.test(v)).length;
  const bonus = v.length >= 16 ? 1 : 0;
  const score = Math.min(4, passed === 4 ? Math.min(4, 3 + bonus) : passed - 1) as 0 | 1 | 2 | 3 | 4;
  const labels = ["Weak", "Weak", "Fair", "Strong", "Excellent"];
  return { score, label: labels[score] };
}
