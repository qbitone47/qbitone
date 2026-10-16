// Screen metadata for Qubit One Phase 1 — pure data, no JSX (safe for contexts)

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
  | "enterprise-navigation";

export interface ScreenMeta {
  id: ScreenId;
  num: string;
  title: string;
  shortTitle: string;
  description: string;
}

export const SCREENS: ScreenMeta[] = [
  { id: "org-structure", num: "01", title: "Organization Structure", shortTitle: "Org Structure", description: "Complete view of company hierarchy and reporting structure." },
  { id: "dept-hierarchy", num: "02", title: "Department Hierarchy", shortTitle: "Departments", description: "Manage departments and their hierarchy." },
  { id: "role-matrix", num: "03", title: "Role Matrix", shortTitle: "Role Matrix", description: "View and manage all organizational roles." },
  { id: "permission-matrix", num: "04", title: "Permission Matrix", shortTitle: "Permissions", description: "Central RBAC governance across Qubit One modules." },
  { id: "reporting-lines", num: "05", title: "Reporting Lines", shortTitle: "Reporting Lines", description: "Understand who reports to whom across the organization." },
  { id: "employee-lifecycle", num: "06", title: "Employee Lifecycle", shortTitle: "Lifecycle", description: "Complete employee journey from hiring to exit." },
  { id: "data-ownership", num: "07", title: "Data Ownership", shortTitle: "Data Ownership", description: "Define data ownership and governance for enterprise data." },
  { id: "workflow-catalog", num: "08", title: "Workflow Catalog", shortTitle: "Workflows", description: "Manage all business workflows and automations." },
  { id: "approval-matrix", num: "09", title: "Approval Matrix", shortTitle: "Approvals", description: "Configure approvals for different request types." },
  { id: "notification-rules", num: "10", title: "Notification Rules", shortTitle: "Notifications", description: "Manage system notifications across the organization." },
  { id: "integration-map", num: "11", title: "Integration Map", shortTitle: "Integrations", description: "Central view of systems connected to Qubit One." },
  { id: "enterprise-navigation", num: "12", title: "Enterprise Navigation", shortTitle: "Navigation", description: "Master information architecture for the entire application." },
];

export const screenMeta = (id: ScreenId): ScreenMeta =>
  SCREENS.find((s) => s.id === id) ?? SCREENS[0];

/** Cross-screen navigation parameters */
export interface ScreenParams {
  departmentId?: string;
  employeeId?: string;
  stageId?: string;
  focusNodeId?: string;
}
