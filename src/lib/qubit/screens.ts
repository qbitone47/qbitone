// Screen metadata for Qubit One — pure data, no JSX (safe for contexts)
// Phase 1: Enterprise Architecture (screens 01–12)
// Phase 2: Enterprise Design System (screens 13–30)
// Phase 3: Authentication & Security (screens 31–40)
// Phase 4: Core Employee Workspace (screens 41–58)
// Phase 5: CEO Command Center (screens 59–72)
// Phase 6: Sales Operating System (screens 73–102)
// Phase 7: Sales AI (screens 103–110)

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
  | "executive-reports"
  | "sales-home"
  | "lead-inbox"
  | "lead-detail"
  | "lead-create"
  | "contact-detail"
  | "account-detail"
  | "opportunity-detail"
  | "sales-pipeline"
  | "sales-forecast"
  | "sales-targets"
  | "sales-leaderboard"
  | "followup-queue"
  | "customer-meetings"
  | "quotation-list"
  | "quotation-builder"
  | "quotation-detail"
  | "order-list"
  | "order-detail"
  | "customer-activity"
  | "whatsapp-inbox"
  | "whatsapp-conversation"
  | "whatsapp-convert"
  | "sales-visiting-card"
  | "sales-travel"
  | "visit-planner"
  | "visit-detail"
  | "sales-expenses"
  | "sales-reports"
  | "team-sales-dashboard"
  | "sales-settings"
  | "sales-ai-home"
  | "ai-lead-prioritization"
  | "ai-followup-writer"
  | "ai-customer-summary"
  | "ai-next-best-action"
  | "ai-pipeline-review"
  | "ai-daily-brief"
  | "ai-sales-qa";

export type ScreenModule = "enterprise" | "design-system" | "security" | "workspace" | "people" | "mail" | "executive" | "sales" | "sales-ai";

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
  // ——— Phase 6 · Sales Operating System ———
  { id: "sales-home", num: "73", title: "Sales Home", shortTitle: "Sales Home", description: "Your daily sales operating center — follow-ups, pipeline, meetings and alerts.", module: "sales" },
  { id: "lead-inbox", num: "74", title: "Lead Inbox", shortTitle: "Lead Inbox", description: "The central lead workspace — triage, assign and convert with duplicate guards.", module: "sales" },
  { id: "lead-detail", num: "75", title: "Lead Detail", shortTitle: "Lead Detail", description: "The complete lead workspace — qualification, timeline and conversion path.", module: "sales" },
  { id: "lead-create", num: "76", title: "Lead Creation", shortTitle: "New Lead", description: "Enterprise lead creation with duplicate detection before anything is saved.", module: "sales" },
  { id: "contact-detail", num: "77", title: "Contact Detail", shortTitle: "Contact Detail", description: "Contact-centric workspace with consent-aware communication and history.", module: "sales" },
  { id: "account-detail", num: "78", title: "Account Detail", shortTitle: "Account Detail", description: "Customer 360 — contacts, opportunities, quotations, orders and full activity.", module: "sales" },
  { id: "opportunity-detail", num: "79", title: "Opportunity Detail", shortTitle: "Opportunity Detail", description: "Deal workspace — controlled stage progression, quotations and negotiation history.", module: "sales" },
  { id: "sales-pipeline", num: "80", title: "Sales Pipeline", shortTitle: "Pipeline", description: "Enterprise Kanban pipeline with stage rules, values and risk indicators.", module: "sales" },
  { id: "sales-forecast", num: "81", title: "Sales Forecast", shortTitle: "Forecast", description: "Commit, best case and weighted pipeline — Actual, Forecast and Target never mixed.", module: "sales" },
  { id: "sales-targets", num: "82", title: "Sales Targets", shortTitle: "Targets", description: "Targets by employee, team and region with controlled, audited editing.", module: "sales" },
  { id: "sales-leaderboard", num: "83", title: "Sales Leaderboard", shortTitle: "Leaderboard", description: "Performance visibility — achievement, conversion and pipeline, never gamified.", module: "sales" },
  { id: "followup-queue", num: "84", title: "Follow-up Queue", shortTitle: "Follow-ups", description: "Due today, overdue and upcoming — complete, reschedule and record outcomes.", module: "sales" },
  { id: "customer-meetings", num: "85", title: "Customer Meetings", shortTitle: "Meetings", description: "Sales meeting workspace connected to the enterprise Meetings module.", module: "sales" },
  { id: "quotation-list", num: "86", title: "Quotation List", shortTitle: "Quotations", description: "Quotation lifecycle — draft to accepted, with approvals routed by the matrix.", module: "sales" },
  { id: "quotation-builder", num: "87", title: "Quotation Builder", shortTitle: "Quote Builder", description: "Catalog-driven quotation creation with server-side pricing and discount rules.", module: "sales" },
  { id: "quotation-detail", num: "88", title: "Quotation Detail", shortTitle: "Quotation Detail", description: "Quotation lifecycle view — items, approvals, versions and state-aware actions.", module: "sales" },
  { id: "order-list", num: "89", title: "Order List", shortTitle: "Orders", description: "Sales orders connected to Finance, Inventory and Dispatch — never disconnected.", module: "sales" },
  { id: "order-detail", num: "90", title: "Order Detail", shortTitle: "Order Detail", description: "Order fulfillment view — payment, dispatch and delivery with valid transitions only.", module: "sales" },
  { id: "customer-activity", num: "91", title: "Customer Activity", shortTitle: "Customer Activity", description: "One unified timeline across every customer touchpoint — consent respected.", module: "sales" },
  { id: "whatsapp-inbox", num: "92", title: "WhatsApp Lead Inbox", shortTitle: "WhatsApp Inbox", description: "WhatsApp Business API inbox — legitimate, consent-checked, fully auditable.", module: "sales" },
  { id: "whatsapp-conversation", num: "93", title: "WhatsApp Conversation", shortTitle: "WhatsApp Chat", description: "Business conversation workspace — templates, linking and lead creation.", module: "sales" },
  { id: "whatsapp-convert", num: "94", title: "WhatsApp Lead Conversion", shortTitle: "Lead Conversion", description: "Lead → Contact → Account → Opportunity with a review step and duplicate guard.", module: "sales" },
  { id: "sales-visiting-card", num: "95", title: "Digital Visiting Card", shortTitle: "Visiting Card", description: "The sales identity card — customer-facing, built on the Phase 4 architecture.", module: "sales" },
  { id: "sales-travel", num: "96", title: "Sales Travel", shortTitle: "Travel", description: "Travel planning connected to visits, meetings, expenses and opportunities.", module: "sales" },
  { id: "visit-planner", num: "97", title: "Field Visit Planner", shortTitle: "Visit Planner", description: "Plan and assign customer visits — calendar and list, no covert tracking.", module: "sales" },
  { id: "visit-detail", num: "98", title: "Field Visit Detail", shortTitle: "Visit Detail", description: "Visit execution — checklist, evidence, outcome and the follow-up it creates.", module: "sales" },
  { id: "sales-expenses", num: "99", title: "Sales Expenses", shortTitle: "Expenses", description: "Sales expense claims — Finance remains the financial source of truth.", module: "sales" },
  { id: "sales-reports", num: "100", title: "Sales Reports", shortTitle: "Sales Reports", description: "Operational sales reporting — pipeline, conversion, win/loss and aging.", module: "sales" },
  { id: "team-sales-dashboard", num: "101", title: "Team Sales Dashboard", shortTitle: "Team Sales", description: "Manager workspace — what is happening, what is at risk, who needs attention.", module: "sales" },
  { id: "sales-settings", num: "102", title: "Sales Settings", shortTitle: "Settings", description: "Sales configuration — stages, sources, rules. Admin-only, validated, audited.", module: "sales" },
  // ——— Phase 7 · Sales AI ———
  { id: "sales-ai-home", num: "103", title: "Sales AI Home", shortTitle: "Sales AI Home", description: "Sales intelligence command center — insights, recommendations and quick actions, grounded in authorized data.", module: "sales-ai" },
  { id: "ai-lead-prioritization", num: "104", title: "AI Lead Prioritization", shortTitle: "Lead Prioritization", description: "Explainable AI ranking of your leads — every factor inspectable, insufficient data never scored.", module: "sales-ai" },
  { id: "ai-followup-writer", num: "105", title: "AI Follow-up Writer", shortTitle: "Follow-up Writer", description: "Context → AI draft → edit → review → send. Nothing external leaves without your confirmation.", module: "sales-ai" },
  { id: "ai-customer-summary", num: "106", title: "AI Customer Summary", shortTitle: "Customer Summary", description: "Structured Customer 360 from authorized records — evidence-linked, refreshable, copyable.", module: "sales-ai" },
  { id: "ai-next-best-action", num: "107", title: "AI Next Best Action", shortTitle: "Next Best Action", description: "What to do next — reason, evidence, urgency and confidence. Accepting routes into existing workflows.", module: "sales-ai" },
  { id: "ai-pipeline-review", num: "108", title: "AI Pipeline Review", shortTitle: "Pipeline Review", description: "Pipeline health with stalled-deal, aging and forecast-risk insights. Actual, forecast and AI estimate never mixed.", module: "sales-ai" },
  { id: "ai-daily-brief", num: "109", title: "AI Daily Brief", shortTitle: "Daily Brief", description: "A personalized, concise read of today — priorities, meetings, follow-ups, target progress and risks.", module: "sales-ai" },
  { id: "ai-sales-qa", num: "110", title: "AI Sales Q&A", shortTitle: "Sales Q&A", description: "Grounded answers over authorized sales data — key numbers, reasoning, sources, recommended actions.", module: "sales-ai" },
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
  /** Sales deep links (Phase 6) */
  leadId?: string;
  contactId?: string;
  accountId?: string;
  opportunityId?: string;
  quotationId?: string;
  orderId?: string;
  waId?: string;
  visitId?: string;
  expenseId?: string;
  travelId?: string;
}
