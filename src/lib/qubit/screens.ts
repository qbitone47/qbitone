// Screen metadata for Qubit One — pure data, no JSX (safe for contexts)
// Phase 1: Enterprise Architecture (screens 01–12)
// Phase 2: Enterprise Design System (screens 13–30)
// Phase 3: Authentication & Security (screens 31–40)
// Phase 4: Core Employee Workspace (screens 41–58)
// Phase 5: CEO Command Center (screens 59–72)
// Phase 6: Sales Operating System (screens 73–102)
// Phase 7: Sales AI (screens 103–110)
// Phase 17: Analytics / Audit (screens 267–284)
// Phase 18: Enterprise Hardening + Mobile (screens 285–308) — final UI/product phase

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
  | "ai-sales-qa"
  | "analytics-home"
  | "executive-analytics"
  | "sales-analytics"
  | "finance-analytics"
  | "marketing-analytics"
  | "hr-analytics"
  | "service-analytics"
  | "inventory-analytics"
  | "employee-productivity"
  | "task-analytics"
  | "funnel-analytics"
  | "cohort-analysis"
  | "report-builder"
  | "report-detail"
  | "audit-explorer"
  | "data-export"
  | "scheduled-reports"
  | "analytics-settings"
  // ——— Phase 18 · Mobile (285–300) ———
  | "mobile-home"
  | "mobile-sales-home"
  | "mobile-lead-detail"
  | "mobile-whatsapp"
  | "mobile-meetings"
  | "mobile-tasks"
  | "mobile-service-home"
  | "mobile-service-visit"
  | "mobile-attendance"
  | "mobile-approvals"
  | "mobile-notifications"
  | "mobile-profile"
  | "mobile-id-card"
  | "mobile-visiting-card"
  | "mobile-mail"
  | "mobile-ai"
  // ——— Phase 18 · Enterprise Hardening (301–308) ———
  | "responsive-qa"
  | "performance-dashboard"
  | "accessibility-review"
  | "security-hardening"
  | "backup-recovery"
  | "monitoring"
  | "release-management"
  | "system-status";

export type ScreenModule = "enterprise" | "design-system" | "security" | "workspace" | "people" | "mail" | "executive" | "sales" | "sales-ai" | "analytics" | "mobile" | "platform";

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
  // ——— Phase 17 · Analytics / Audit ———
  { id: "analytics-home", num: "267", title: "Analytics Home", shortTitle: "Home", description: "One unified entry point into Qubit One analytics — role-aware KPIs, reports, freshness and alerts.", module: "analytics" },
  { id: "executive-analytics", num: "268", title: "Executive Analytics", shortTitle: "Executive", description: "Enterprise executive workspace — revenue, pipeline, cash, people and health, every figure sourced.", module: "analytics" },
  { id: "sales-analytics", num: "269", title: "Sales Analytics", shortTitle: "Sales", description: "Centralized sales analytics over the authoritative Sales OS — funnel, win/loss, performance, revenue.", module: "analytics" },
  { id: "finance-analytics", num: "270", title: "Finance Analytics", shortTitle: "Finance", description: "Finance analytics where Finance stays the source of truth — booked, recognized and collected never mixed.", module: "analytics" },
  { id: "marketing-analytics", num: "271", title: "Marketing Analytics", shortTitle: "Marketing", description: "Campaign, channel and SEO performance with source-aware labels — attribution is never invented.", module: "analytics" },
  { id: "hr-analytics", num: "272", title: "HR Analytics", shortTitle: "HR", description: "Privacy-safe people analytics — aggregated headcount, hiring, attendance and attrition only.", module: "analytics" },
  { id: "service-analytics", num: "273", title: "Service Analytics", shortTitle: "Service", description: "Service health — tickets, SLA, response and resolution, engineer performance and visit completion.", module: "analytics" },
  { id: "inventory-analytics", num: "274", title: "Inventory Analytics", shortTitle: "Inventory", description: "Stock levels, movement and dispatch — operational metrics kept separate from Finance-aligned valuation.", module: "analytics" },
  { id: "employee-productivity", num: "275", title: "Employee Productivity", shortTitle: "Productivity", description: "Privacy-conscious productivity from work items you own — no surveillance, no fabricated scores.", module: "analytics" },
  { id: "task-analytics", num: "276", title: "Task Analytics", shortTitle: "Tasks", description: "Analytics over the ONE workspace task store — status, priority, workload and overdue trends.", module: "analytics" },
  { id: "funnel-analytics", num: "277", title: "Funnel Analytics", shortTitle: "Funnels", description: "One funnel engine over Sales, Recruitment, Service and Marketing — stages, conversion and drop-off.", module: "analytics" },
  { id: "cohort-analysis", num: "278", title: "Cohort / Trend Analysis", shortTitle: "Cohorts & Trends", description: "Acquisition cohorts and trend analysis — honest sample sizes, no weak conclusions dressed as facts.", module: "analytics" },
  { id: "report-builder", num: "279", title: "Custom Report Builder", shortTitle: "Report Builder", description: "Governed report building on the semantic layer — no SQL, server-enforced fields, rows and exports.", module: "analytics" },
  { id: "report-detail", num: "280", title: "Report Detail", shortTitle: "Report Detail", description: "The saved report view — definitions, lineage, freshness and only the actions your role allows.", module: "analytics" },
  { id: "audit-explorer", num: "281", title: "Audit Explorer", shortTitle: "Audit Explorer", description: "An advanced view over the ONE enterprise audit trail — search and filter, never edit.", module: "analytics" },
  { id: "data-export", num: "282", title: "Data Export", shortTitle: "Data Export", description: "Secure, permission-controlled exports — reasons for sensitive data, expiring links, audited jobs.", module: "analytics" },
  { id: "scheduled-reports", num: "283", title: "Scheduled Reports", shortTitle: "Scheduled Reports", description: "Scheduled report deliveries on the Qubit scheduler — validated recipients, audited, pausable.", module: "analytics" },
  { id: "analytics-settings", num: "284", title: "Analytics Settings", shortTitle: "Settings", description: "Analytics administration — metric governance, refresh policies, retention and export rules.", module: "analytics" },
  // ——— Phase 18 · Mobile ———
  { id: "mobile-home", num: "285", title: "Mobile Home", shortTitle: "Mobile Home", description: "The Qubit One mobile command center — today's work, quick actions and role shortcuts.", module: "mobile" },
  { id: "mobile-sales-home", num: "286", title: "Mobile Sales Home", shortTitle: "Mobile Sales", description: "Field sales workspace on the existing Sales OS — leads, follow-ups, pipeline, visits.", module: "mobile" },
  { id: "mobile-lead-detail", num: "287", title: "Mobile Lead Detail", shortTitle: "Mobile Lead", description: "The lead workspace in the field — call, WhatsApp, email, follow-up, convert.", module: "mobile" },
  { id: "mobile-whatsapp", num: "288", title: "Mobile WhatsApp", shortTitle: "Mobile WhatsApp", description: "The authorized WhatsApp Business inbox — conversations, context and actions.", module: "mobile" },
  { id: "mobile-meetings", num: "289", title: "Mobile Meetings", shortTitle: "Mobile Meetings", description: "Today's and upcoming meetings — join, notes and action items on the go.", module: "mobile" },
  { id: "mobile-tasks", num: "290", title: "Mobile Tasks", shortTitle: "Mobile Tasks", description: "My Tasks in the field — today, overdue, upcoming; complete and comment.", module: "mobile" },
  { id: "mobile-service-home", num: "291", title: "Mobile Service Home", shortTitle: "Mobile Service", description: "Field-service command center — visits, urgent tickets, SLA warnings, parts.", module: "mobile" },
  { id: "mobile-service-visit", num: "292", title: "Mobile Service Visit", shortTitle: "Mobile Visit", description: "The complete field-visit workspace — lifecycle, checklist, evidence, parts, notes.", module: "mobile" },
  { id: "mobile-attendance", num: "293", title: "Mobile Attendance", shortTitle: "Mobile Attendance", description: "Check in and out on the enterprise attendance record — leave and history included.", module: "mobile" },
  { id: "mobile-approvals", num: "294", title: "Mobile Approvals", shortTitle: "Mobile Approvals", description: "The approval queue in your pocket — approve, reject, request changes; step-up protected.", module: "mobile" },
  { id: "mobile-notifications", num: "295", title: "Mobile Notifications", shortTitle: "Mobile Alerts", description: "The notification center on mobile — filtered, actionable, deep-linked.", module: "mobile" },
  { id: "mobile-profile", num: "296", title: "Mobile Profile", shortTitle: "Mobile Profile", description: "Your identity on mobile — profile, security, sessions, cards.", module: "mobile" },
  { id: "mobile-id-card", num: "297", title: "Mobile ID Card", shortTitle: "Mobile ID", description: "The digital employee ID card — verifiable, minimal, company-branded.", module: "mobile" },
  { id: "mobile-visiting-card", num: "298", title: "Mobile Visiting Card", shortTitle: "Mobile Card", description: "The professional visiting card — QR, vCard and share, policy-respecting.", module: "mobile" },
  { id: "mobile-mail", num: "299", title: "Mobile Mail", shortTitle: "Mobile Mail", description: "Enterprise mail on mobile — inbox, sent, drafts, compose and search.", module: "mobile" },
  { id: "mobile-ai", num: "300", title: "Mobile AI", shortTitle: "Mobile AI", description: "The Qubit AI Platform on mobile — grounded answers over data you are authorized to see.", module: "mobile" },
  // ——— Phase 18 · Enterprise Hardening ———
  { id: "responsive-qa", num: "301", title: "Responsive QA Dashboard", shortTitle: "Responsive QA", description: "Internal QA over the whole product — breakpoints, overflow, layout and registry integrity.", module: "platform" },
  { id: "performance-dashboard", num: "302", title: "Performance Dashboard", shortTitle: "Performance", description: "Real telemetry only — backend latency, system resources and browser vitals as measured.", module: "platform" },
  { id: "accessibility-review", num: "303", title: "Accessibility Review", shortTitle: "A11y Review", description: "Accessibility governance — findings, severity, owners and resolution across the product.", module: "platform" },
  { id: "security-hardening", num: "304", title: "Security Hardening", shortTitle: "Hardening", description: "Security posture across identity, application, infrastructure and data — never exposing secrets.", module: "platform" },
  { id: "backup-recovery", num: "305", title: "Backup & Recovery", shortTitle: "Backup & DR", description: "Real backups of the platform database — verified, retained, with high-risk restore testing.", module: "platform" },
  { id: "monitoring", num: "306", title: "Monitoring", shortTitle: "Monitoring", description: "One monitoring view over application, database, integrations, jobs and AI services.", module: "platform" },
  { id: "release-management", num: "307", title: "Release Management", shortTitle: "Releases", description: "Release history, environments and rollback readiness — safe by default.", module: "platform" },
  { id: "system-status", num: "308", title: "System Status", shortTitle: "System Status", description: "The one authoritative health view of Qubit One — calm, honest, current.", module: "platform" },
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
  /** Demo authenticator code (Phase 21): the simulated TOTP value issued with the challenge */
  demoCode?: string;
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
  /** Analytics deep links (Phase 17) */
  datasetId?: string;
  exportId?: string;
  scheduleId?: string;
  funnelId?: string;
  /** Mobile deep links (Phase 18) */
  mailId?: string;
  notificationId?: string;
}
