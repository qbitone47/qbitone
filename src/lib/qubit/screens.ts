// Screen metadata for Qubit One — pure data, no JSX (safe for contexts)
// Phase 1: Enterprise Architecture (screens 01–12)
// Phase 2: Enterprise Design System (screens 13–30)
// Phase 3: Authentication & Security (screens 31–40)

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
  | "security-alerts";

export type ScreenModule = "enterprise" | "design-system" | "security";

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
}
