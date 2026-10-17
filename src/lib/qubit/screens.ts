// Screen metadata for Qubit One — pure data, no JSX (safe for contexts)
// Phase 1: Enterprise Architecture (screens 01–12)
// Phase 2: Enterprise Design System (screens 13–30)
// Phase 3: Authentication & Security (screens 31–40)
// Phase 4: Core Employee Workspace (screens 41–58)
// Phase 5: CEO Command Center (screens 59–72)

export type ScreenId =
  | "org-structure"
  | "dept-hierarchy"
  | "role-matrix"
  | "permission-matrix"
  | "reporting-lines"
  | "employee-lifecycle"
  | "data-ownership"
  | "workflow-catalog"
  | "approval-matrix"
  | "notification-rules"
  | "integration-map"
  | "enterprise-navigation"
  | "design-tokens"
  | "typography"
  | "color-system"
  | "buttons"
  | "inputs-forms"
  | "tables"
  | "cards"
  | "charts"
  | "navigation"
  | "command-bar"
  | "modal-drawer"
  | "status-system"
  | "empty-states"
  | "loading-states"
  | "error-states"
  | "toast-alerts"
  | "accessibility"
  | "responsive-grid"
  | "login"
  | "mfa-verification"
  | "sso-provider-selection"
  | "password-recovery"
  | "device-sessions"
  | "security-center"
  | "role-access-request"
  | "ip-network-policy"
  | "audit-log"
  | "security-alerts"
  | "employee-home"
  | "my-profile"
  | "my-tasks"
  | "my-calendar"
  | "my-meetings"
  | "my-approvals"
  | "my-documents"
  | "my-notifications"
  | "my-activity"
  | "company-directory"
  | "organization-chart"
  | "employee-360"
  | "digital-id-card"
  | "digital-visiting-card"
  | "mail-inbox"
  | "compose-mail"
  | "sent-mail"
  | "mail-search"
  | "ceo-overview"
  | "revenue-snapshot"
  | "sales-command"
  | "finance-snapshot"
  | "people-overview"
  | "marketing-overview"
  | "service-overview"
  | "inventory-overview"
  | "field-operations"
  | "executive-alerts"
  | "executive-approvals"
  | "ceo-ai-insights"
  | "kpi-drilldown"
  | "executive-reports";

export type ScreenModule = "enterprise" | "design-system" | "security" | "workspace" | "people" | "mail" | "executive";

/** Screens rendered without the app shell (standalone authentication) */
export const AUTH_SCREENS: ScreenId[] = ["login", "mfa-verification", "sso-provider-selection"];

export interface ScreenMeta {
  id: ScreenId;
  num: string;
  title: string;
  shortTitle: string;
  description: string;
  module: ScreenModule;
}

export const SCREENS: ScreenMeta[] = [
  // ——— Phase 1 · Enterprise Architecture ———
  { id: "org-structure", num: "01", title: "Organization Structure", shortTitle: "Org Structure", description: "Complete view of company hierarchy and reporting structure.", module: "enterprise" },
  { id: "dept-hierarchy", num: "02", title: "Department Hierarchy", shortTitle: "Departments", description: "Manage departments and their hierarchy.", module: "enterprise" },
  { id: "role-matrix", num: "03", title: "Role Matrix", shortTitle: "Role Matrix", description: "View and manage all organizational roles.", module: "enterprise" },
  { id: "permission-matrix", num: "04", title: "Permission Matrix", shortTitle: "Permissions", description: "Central RBAC governance across Qubit One modules.", module: "enterprise" },
  { id: "reporting-lines", num: "05", title: "Reporting Lines", shortTitle: "Reporting Lines", description: "Understand who reports to whom across the organization.", module: "enterprise" },
  { id: "employee-lifecycle", num: "06", title: "Employee Lifecycle", shortTitle: "Lifecycle", description: "Complete employee journey from hiring to exit.", module: "enterprise" },
  { id: "data-ownership", num: "07", title: "Data Ownership", shortTitle: "Data Ownership", description: "Define data ownership and governance for enterprise data.", module: "enterprise" },
  { id: "workflow-catalog", num: "08", title: "Workflow Catalog", shortTitle: "Workflows", description: "Manage all business workflows and automations.", module: "enterprise" },
  { id: "approval-matrix", num: "09", title: "Approval Matrix", shortTitle: "Approvals", description: "Configure approvals for different request types.", module: "enterprise" },
  { id: "notification-rules", num: "10", title: "Notification Rules", shortTitle: "Notifications", description: "Manage system notifications across the organization.", module: "enterprise" },
  { id: "integration-map", num: "11", title: "Integration Map", shortTitle: "Integrations", description: "Central view of systems connected to Qubit One.", module: "enterprise" },
  { id: "enterprise-navigation", num: "12", title: "Enterprise Navigation", shortTitle: "Navigation", description: "Master information architecture for the entire application.", module: "enterprise" },
  // ——— Phase 2 · Enterprise Design System ———
  { id: "design-tokens", num: "13", title: "Design Tokens", shortTitle: "Tokens", description: "Foundational tokens — color, type, spacing, radius, elevation, motion.", module: "design-system" },
  { id: "typography", num: "14", title: "Typography", shortTitle: "Typography", description: "Complete typographic hierarchy for enterprise data density.", module: "design-system" },
  { id: "color-system", num: "15", title: "Color System", shortTitle: "Color", description: "Qubit One color language — brand, neutrals and semantics.", module: "design-system" },
  { id: "buttons", num: "16", title: "Buttons", shortTitle: "Buttons", description: "Every button variant, state and usage rule in one reference.", module: "design-system" },
  { id: "inputs-forms", num: "17", title: "Inputs & Forms", shortTitle: "Inputs & Forms", description: "Enterprise form system — fields, states, validation, layout.", module: "design-system" },
  { id: "tables", num: "18", title: "Tables", shortTitle: "Tables", description: "Core enterprise data-table system for large datasets.", module: "design-system" },
  { id: "cards", num: "19", title: "Cards", shortTitle: "Cards", description: "Card patterns and when to choose them over tables.", module: "design-system" },
  { id: "charts", num: "20", title: "Charts", shortTitle: "Charts", description: "Data-visualization language that communicates, not decorates.", module: "design-system" },
  { id: "navigation", num: "21", title: "Navigation", shortTitle: "Navigation", description: "Sidebar, breadcrumbs, tabs and mobile navigation patterns.", module: "design-system" },
  { id: "command-bar", num: "22", title: "Command Bar", shortTitle: "Command Bar", description: "Global ⌘ K search and quick-action experience.", module: "design-system" },
  { id: "modal-drawer", num: "23", title: "Modal & Drawer Patterns", shortTitle: "Modals & Drawers", description: "Overlays for secondary workflows and contextual detail.", module: "design-system" },
  { id: "status-system", num: "24", title: "Status System", shortTitle: "Status", description: "One unified status vocabulary across every module.", module: "design-system" },
  { id: "empty-states", num: "25", title: "Empty States", shortTitle: "Empty States", description: "What users see when there is no data — and what to do next.", module: "design-system" },
  { id: "loading-states", num: "26", title: "Loading States", shortTitle: "Loading", description: "Skeletons and progress patterns that feel fast and controlled.", module: "design-system" },
  { id: "error-states", num: "27", title: "Error States", shortTitle: "Errors", description: "Standardized error experiences with clear recovery paths.", module: "design-system" },
  { id: "toast-alerts", num: "28", title: "Toast & Alerts", shortTitle: "Toasts & Alerts", description: "Transient feedback and persistent system messaging.", module: "design-system" },
  { id: "accessibility", num: "29", title: "Accessibility Patterns", shortTitle: "Accessibility", description: "Inclusive defaults — keyboard, focus, ARIA and touch targets.", module: "design-system" },
  { id: "responsive-grid", num: "30", title: "Responsive Grid", shortTitle: "Responsive Grid", description: "Layout system from desktop workspace to mobile single column.", module: "design-system" },
  // ——— Phase 3 · Authentication & Security ———
  { id: "login", num: "31", title: "Login", shortTitle: "Login", description: "Enterprise authentication entry point — password, SSO and passkey.", module: "security" },
  { id: "mfa-verification", num: "32", title: "MFA Verification", shortTitle: "MFA Verification", description: "Second-factor verification — authenticator, push, passkey, recovery.", module: "security" },
  { id: "sso-provider-selection", num: "33", title: "SSO Provider Selection", shortTitle: "SSO Providers", description: "Choose among the organization's configured identity providers.", module: "security" },
  { id: "password-recovery", num: "34", title: "Password & Recovery", shortTitle: "Passwords", description: "Password lifecycle and account recovery with step-up authentication.", module: "security" },
  { id: "device-sessions", num: "35", title: "Device Sessions", shortTitle: "Sessions", description: "See and control every active session on your account.", module: "security" },
  { id: "security-center", num: "36", title: "Security Center", shortTitle: "Security Center", description: "Personal security posture, factors, sessions and recommendations.", module: "security" },
  { id: "role-access-request", num: "37", title: "Role Access Request", shortTitle: "Access Requests", description: "Request role access along the approval path — never self-granted.", module: "security" },
  { id: "ip-network-policy", num: "38", title: "IP / Network Policy", shortTitle: "Network Policy", description: "Admin network rules with conflict checks and lockout protection.", module: "security" },
  { id: "audit-log", num: "39", title: "Audit Log", shortTitle: "Audit Log", description: "Trustworthy, searchable enterprise security history.", module: "security" },
  { id: "security-alerts", num: "40", title: "Security Alerts", shortTitle: "Alerts", description: "Calibrated, actionable alerts with recommended next steps.", module: "security" },
  // ——— Phase 4 · Core Employee Workspace ———
  { id: "employee-home", num: "41", title: "Employee Home", shortTitle: "Home", description: "Your personalized daily workspace — priorities, work, approvals and messages.", module: "workspace" },
  { id: "my-profile", num: "42", title: "My Profile", shortTitle: "My Profile", description: "Your enterprise identity — self-service fields, company-controlled record.", module: "workspace" },
  { id: "my-tasks", num: "43", title: "My Tasks", shortTitle: "My Tasks", description: "One queue for everything assigned to you — meetings, workflows, sales, HR.", module: "workspace" },
  { id: "my-calendar", num: "44", title: "My Calendar", shortTitle: "My Calendar", description: "Meetings, deadlines, company events and leave — with real privacy.", module: "workspace" },
  { id: "my-meetings", num: "45", title: "My Meetings", shortTitle: "My Meetings", description: "Today's live sessions, what's ahead, and the record of what happened.", module: "workspace" },
  { id: "my-approvals", num: "46", title: "My Approvals", shortTitle: "My Approvals", description: "Requests waiting on your decision — routed by the Approval Matrix.", module: "workspace" },
  { id: "my-documents", num: "47", title: "My Documents", shortTitle: "My Documents", description: "Your authorized document workspace — access enforced server-side.", module: "workspace" },
  { id: "my-notifications", num: "48", title: "My Notifications", shortTitle: "Notifications", description: "One notification center, deep-linked into the same operating system.", module: "workspace" },
  { id: "my-activity", num: "49", title: "My Activity", shortTitle: "My Activity", description: "Your personal work timeline — distinct from the enterprise audit trail.", module: "workspace" },
  { id: "company-directory", num: "50", title: "Company Directory", shortTitle: "Directory", description: "Find anyone at Qubit One — name, skill, department, designation, location.", module: "people" },
  { id: "organization-chart", num: "51", title: "Organization Chart", shortTitle: "Org Chart", description: "The live structure — progressive expansion, search-driven focus.", module: "people" },
  { id: "employee-360", num: "52", title: "Employee 360", shortTitle: "Employee 360", description: "The connected overview — scoped by role, never a super-profile.", module: "people" },
  { id: "digital-id-card", num: "53", title: "Digital ID Card", shortTitle: "Digital ID", description: "Your enterprise identity credential — verifiable against the registry.", module: "people" },
  { id: "digital-visiting-card", num: "54", title: "Digital Visiting Card", shortTitle: "Visiting Card", description: "Your professional card — vCard, copy and live share link.", module: "people" },
  { id: "mail-inbox", num: "55", title: "Company Mail Inbox", shortTitle: "Inbox", description: "High-density enterprise mail — one system with Sent, Compose and Search.", module: "mail" },
  { id: "compose-mail", num: "56", title: "Compose Mail", shortTitle: "Compose", description: "Directory-backed recipients, policy-checked attachments, honest states.", module: "mail" },
  { id: "sent-mail", num: "57", title: "Sent Mail", shortTitle: "Sent", description: "Every message you've sent — with honest delivery status and retry.", module: "mail" },
  { id: "mail-search", num: "58", title: "Mail Search", shortTitle: "Mail Search", description: "Server-enforced search across your authorized mailbox.", module: "mail" },
  // ——— Phase 5 · CEO Command Center ———
  { id: "ceo-overview", num: "59", title: "CEO Overview", shortTitle: "CEO Overview", description: "Company health, key KPIs, attention items and today's decisions — one executive picture.", module: "executive" },
  { id: "revenue-snapshot", num: "60", title: "Revenue Snapshot", shortTitle: "Revenue", description: "Concise revenue performance — target, trend, contribution and variance.", module: "executive" },
  { id: "sales-command", num: "61", title: "Sales Command Center", shortTitle: "Sales Command", description: "Executive sales view — pipeline health, forecast confidence and major deals.", module: "executive" },
  { id: "finance-snapshot", num: "62", title: "Finance Snapshot", shortTitle: "Finance", description: "CEO-level financial health — cash, margins, receivables and budget variance.", module: "executive" },
  { id: "people-overview", num: "63", title: "People Overview", shortTitle: "People", description: "Workforce health — headcount, hiring, attrition and distribution, aggregated.", module: "executive" },
  { id: "marketing-overview", num: "64", title: "Marketing Overview", shortTitle: "Marketing", description: "Marketing business impact — leads, pipeline contribution and channel ROI.", module: "executive" },
  { id: "service-overview", num: "65", title: "Service Overview", shortTitle: "Service", description: "Customer service health — SLA, backlog and critical exceptions first.", module: "executive" },
  { id: "inventory-overview", num: "66", title: "Inventory Overview", shortTitle: "Inventory", description: "Stock and supply visibility — value, exceptions and bottlenecks, not SKU walls.", module: "executive" },
  { id: "field-operations", num: "67", title: "Field Operations", shortTitle: "Field Ops", description: "Field execution — visits, delays and regional performance at a glance.", module: "executive" },
  { id: "executive-alerts", num: "68", title: "Executive Alerts", shortTitle: "Executive Alerts", description: "High-signal exceptions that need executive awareness — calibrated, actionable.", module: "executive" },
  { id: "executive-approvals", num: "69", title: "Executive Approvals", shortTitle: "Executive Approvals", description: "Decisions only executive authority can make — step-up protected and audited.", module: "executive" },
  { id: "ceo-ai-insights", num: "70", title: "CEO AI Insights", shortTitle: "AI Insights", description: "Evidence-based AI interpretation of authorized company data — never invented.", module: "executive" },
  { id: "kpi-drilldown", num: "71", title: "Company KPI Drilldown", shortTitle: "KPI Drilldown", description: "Focused investigation behind every executive KPI — definition to underlying records.", module: "executive" },
  { id: "executive-reports", num: "72", title: "Executive Reports", shortTitle: "Executive Reports", description: "Executive reporting library — generate, schedule and share authorized reports.", module: "executive" },
];

export const screenMeta = (id: ScreenId): ScreenMeta =>
  SCREENS.find((s) => s.id === id) ?? SCREENS[0];

export const screensByModule = (m: ScreenModule): ScreenMeta[] =>
  SCREENS.filter((s) => s.module === m);

/** Cross-screen navigation parameters */
export interface ScreenParams {
  departmentId?: string;
  employeeId?: string;
  stageId?: string;
  focusNodeId?: string;
  /** MFA challenge id passed from Login (31) to MFA Verification (32) */
  challengeId?: string;
  /** Alert / audit correlation focus */
  correlationId?: string;
  /** Workspace deep links (Phase 4) */
  taskId?: string;
  filter?: string;
  meetingId?: string;
  approvalId?: string;
  sentId?: string;
  /** Mail compose prefill */
  to?: string;
  mailReply?: string;
  mailForward?: string;
  replyAll?: boolean;
  /** Executive deep links (Phase 5) */
  kpiId?: string;
  domainId?: string;
  reportId?: string;
  insightId?: string;
  region?: string;
}
