"use client";

import type { ComponentType } from "react";
import type { ScreenId } from "@/lib/qubit/screens";
import { OrganizationStructureScreen } from "./screens/organization-structure";
import { DepartmentHierarchyScreen } from "./screens/department-hierarchy";
import { RoleMatrixScreen } from "./screens/role-matrix";
import { PermissionMatrixScreen } from "./screens/permission-matrix";
import { ReportingLinesScreen } from "./screens/reporting-lines";
import { EmployeeLifecycleScreen } from "./screens/employee-lifecycle";
import { DataOwnershipScreen } from "./screens/data-ownership";
import { WorkflowCatalogScreen } from "./screens/workflow-catalog";
import { ApprovalMatrixScreen } from "./screens/approval-matrix";
import { NotificationRulesScreen } from "./screens/notification-rules";
import { IntegrationMapScreen } from "./screens/integration-map";
import { EnterpriseNavigationScreen } from "./screens/enterprise-navigation";
import { DesignTokensScreen } from "./screens/design-tokens";
import { TypographyScreen } from "./screens/typography";
import { ColorSystemScreen } from "./screens/color-system";
import { ButtonsScreen } from "./screens/buttons";
import { InputsFormsScreen } from "./screens/inputs-forms";
import { TablesScreen } from "./screens/tables";
import { CardsScreen } from "./screens/cards";
import { ChartsScreen } from "./screens/charts";
import { NavigationScreen } from "./screens/navigation";
import { CommandBarScreen } from "./screens/command-bar";
import { ModalDrawerScreen } from "./screens/modal-drawer";
import { StatusSystemScreen } from "./screens/status-system";
import { EmptyStatesScreen } from "./screens/empty-states";
import { LoadingStatesScreen } from "./screens/loading-states";
import { ErrorStatesScreen } from "./screens/error-states";
import { ToastAlertsScreen } from "./screens/toast-alerts";
import { AccessibilityScreen } from "./screens/accessibility";
import { ResponsiveGridScreen } from "./screens/responsive-grid";
import { LoginScreen } from "./screens/login";
import { MfaVerificationScreen } from "./screens/mfa-verification";
import { SsoProviderSelectionScreen } from "./screens/sso-provider-selection";
import { PasswordRecoveryScreen } from "./screens/password-recovery";
import { DeviceSessionsScreen } from "./screens/device-sessions";
import { SecurityCenterScreen } from "./screens/security-center";
import { RoleAccessRequestScreen } from "./screens/role-access-request";
import { IpNetworkPolicyScreen } from "./screens/ip-network-policy";
import { AuditLogScreen } from "./screens/audit-log";
import { SecurityAlertsScreen } from "./screens/security-alerts";
import { EmployeeHomeScreen } from "./screens/employee-home";
import { MyProfileScreen } from "./screens/my-profile";
import { MyTasksScreen } from "./screens/my-tasks";
import { MyCalendarScreen } from "./screens/my-calendar";
import { MyMeetingsScreen } from "./screens/my-meetings";
import { MyApprovalsScreen } from "./screens/my-approvals";
import { MyDocumentsScreen } from "./screens/my-documents";
import { MyNotificationsScreen } from "./screens/my-notifications";
import { MyActivityScreen } from "./screens/my-activity";
import { CompanyDirectoryScreen } from "./screens/company-directory";
import { OrganizationChartScreen } from "./screens/organization-chart";
import { Employee360Screen } from "./screens/employee-360";
import { DigitalIdCardScreen } from "./screens/digital-id-card";
import { DigitalVisitingCardScreen } from "./screens/digital-visiting-card";
import { MailInboxScreen } from "./screens/mail-inbox";
import { ComposeMailScreen } from "./screens/compose-mail";
import { SentMailScreen } from "./screens/sent-mail";
import { MailSearchScreen } from "./screens/mail-search";
import { CeoOverviewScreen } from "./screens/ceo-overview";
import { RevenueSnapshotScreen } from "./screens/revenue-snapshot";
import { SalesCommandScreen } from "./screens/sales-command";
import { FinanceSnapshotScreen } from "./screens/finance-snapshot";
import { PeopleOverviewScreen } from "./screens/people-overview";
import { MarketingOverviewScreen } from "./screens/marketing-overview";
import { ServiceOverviewScreen } from "./screens/service-overview";
import { InventoryOverviewScreen } from "./screens/inventory-overview";
import { FieldOperationsScreen } from "./screens/field-operations";
import { ExecutiveAlertsScreen } from "./screens/executive-alerts";
import { ExecutiveApprovalsScreen } from "./screens/executive-approvals";
import { CeoAiInsightsScreen } from "./screens/ceo-ai-insights";
import { KpiDrilldownScreen } from "./screens/kpi-drilldown";
import { ExecutiveReportsScreen } from "./screens/executive-reports";
import { SalesHomeScreen } from "./screens/sales-home";
import { LeadInboxScreen } from "./screens/lead-inbox";
import { LeadDetailScreen } from "./screens/lead-detail";
import { LeadCreateScreen } from "./screens/lead-create";
import { ContactDetailScreen } from "./screens/contact-detail";
import { AccountDetailScreen } from "./screens/account-detail";
import { OpportunityDetailScreen } from "./screens/opportunity-detail";
import { SalesPipelineScreen } from "./screens/sales-pipeline";
import { SalesForecastScreen } from "./screens/sales-forecast";
import { SalesTargetsScreen } from "./screens/sales-targets";
import { SalesLeaderboardScreen } from "./screens/sales-leaderboard";
import { FollowupQueueScreen } from "./screens/followup-queue";
import { CustomerMeetingsScreen } from "./screens/customer-meetings";
import { QuotationListScreen } from "./screens/quotation-list";
import { QuotationBuilderScreen } from "./screens/quotation-builder";
import { QuotationDetailScreen } from "./screens/quotation-detail";
import { OrderListScreen } from "./screens/order-list";
import { OrderDetailScreen } from "./screens/order-detail";
import { CustomerActivityScreen } from "./screens/customer-activity";
import { WhatsappInboxScreen } from "./screens/whatsapp-inbox";
import { WhatsappConversationScreen } from "./screens/whatsapp-conversation";
import { WhatsappConvertScreen } from "./screens/whatsapp-convert";
import { SalesVisitingCardScreen } from "./screens/sales-visiting-card";
import { SalesTravelScreen } from "./screens/sales-travel";
import { VisitPlannerScreen } from "./screens/visit-planner";
import { VisitDetailScreen } from "./screens/visit-detail";
import { SalesExpensesScreen } from "./screens/sales-expenses";
import { SalesReportsScreen } from "./screens/sales-reports";
import { TeamSalesDashboardScreen } from "./screens/team-sales-dashboard";
import { SalesSettingsScreen } from "./screens/sales-settings";
import { SalesAiHomeScreen } from "./screens/sales-ai-home";
import { AiLeadPrioritizationScreen } from "./screens/ai-lead-prioritization";
import { AiFollowupWriterScreen } from "./screens/ai-followup-writer";
import { AiCustomerSummaryScreen } from "./screens/ai-customer-summary";
import { AiNextBestActionScreen } from "./screens/ai-next-best-action";
import { AiPipelineReviewScreen } from "./screens/ai-pipeline-review";
import { AiDailyBriefScreen } from "./screens/ai-daily-brief";
import { AiSalesQaScreen } from "./screens/ai-sales-qa";
import { AnalyticsHomeScreen } from "./screens/analytics-home";
import { ExecutiveAnalyticsScreen } from "./screens/executive-analytics";
import { SalesAnalyticsScreen } from "./screens/sales-analytics";
import { FinanceAnalyticsScreen } from "./screens/finance-analytics";
import { MarketingAnalyticsScreen } from "./screens/marketing-analytics";
import { HrAnalyticsScreen } from "./screens/hr-analytics";
import { ServiceAnalyticsScreen } from "./screens/service-analytics";
import { InventoryAnalyticsScreen } from "./screens/inventory-analytics";
import { EmployeeProductivityScreen } from "./screens/employee-productivity";
import { TaskAnalyticsScreen } from "./screens/task-analytics";
import { FunnelAnalyticsScreen } from "./screens/funnel-analytics";
import { CohortAnalysisScreen } from "./screens/cohort-analysis";
import { ReportBuilderScreen } from "./screens/report-builder";
import { ReportDetailScreen } from "./screens/report-detail";
import { AuditExplorerScreen } from "./screens/audit-explorer";
import { DataExportScreen } from "./screens/data-export";
import { ScheduledReportsScreen } from "./screens/scheduled-reports";
import { AnalyticsSettingsScreen } from "./screens/analytics-settings";
import { MobileHomeScreen } from "./screens/mobile-home";
import { MobileSalesHomeScreen } from "./screens/mobile-sales-home";
import { MobileLeadDetailScreen } from "./screens/mobile-lead-detail";
import { MobileWhatsappScreen } from "./screens/mobile-whatsapp";
import { MobileMeetingsScreen } from "./screens/mobile-meetings";
import { MobileTasksScreen } from "./screens/mobile-tasks";
import { MobileServiceHomeScreen } from "./screens/mobile-service-home";
import { MobileServiceVisitScreen } from "./screens/mobile-service-visit";
import { MobileAttendanceScreen } from "./screens/mobile-attendance";
import { MobileApprovalsScreen } from "./screens/mobile-approvals";
import { MobileNotificationsScreen } from "./screens/mobile-notifications";
import { MobileProfileScreen } from "./screens/mobile-profile";
import { MobileIdCardScreen } from "./screens/mobile-id-card";
import { MobileVisitingCardScreen } from "./screens/mobile-visiting-card";
import { MobileMailScreen } from "./screens/mobile-mail";
import { MobileAiScreen } from "./screens/mobile-ai";
import { ResponsiveQaScreen } from "./screens/responsive-qa";
import { PerformanceDashboardScreen } from "./screens/performance-dashboard";
import { AccessibilityReviewScreen } from "./screens/accessibility-review";
import { SecurityHardeningScreen } from "./screens/security-hardening";
import { BackupRecoveryScreen } from "./screens/backup-recovery";
import { MonitoringScreen } from "./screens/monitoring";
import { ReleaseManagementScreen } from "./screens/release-management";
import { SystemStatusScreen } from "./screens/system-status";

export const SCREEN_COMPONENTS: Record<ScreenId, ComponentType> = {
  "org-structure": OrganizationStructureScreen,
  "dept-hierarchy": DepartmentHierarchyScreen,
  "role-matrix": RoleMatrixScreen,
  "permission-matrix": PermissionMatrixScreen,
  "reporting-lines": ReportingLinesScreen,
  "employee-lifecycle": EmployeeLifecycleScreen,
  "data-ownership": DataOwnershipScreen,
  "workflow-catalog": WorkflowCatalogScreen,
  "approval-matrix": ApprovalMatrixScreen,
  "notification-rules": NotificationRulesScreen,
  "integration-map": IntegrationMapScreen,
  "enterprise-navigation": EnterpriseNavigationScreen,
  "design-tokens": DesignTokensScreen,
  typography: TypographyScreen,
  "color-system": ColorSystemScreen,
  buttons: ButtonsScreen,
  "inputs-forms": InputsFormsScreen,
  tables: TablesScreen,
  cards: CardsScreen,
  charts: ChartsScreen,
  navigation: NavigationScreen,
  "command-bar": CommandBarScreen,
  "modal-drawer": ModalDrawerScreen,
  "status-system": StatusSystemScreen,
  "empty-states": EmptyStatesScreen,
  "loading-states": LoadingStatesScreen,
  "error-states": ErrorStatesScreen,
  "toast-alerts": ToastAlertsScreen,
  accessibility: AccessibilityScreen,
  "responsive-grid": ResponsiveGridScreen,
  login: LoginScreen,
  "mfa-verification": MfaVerificationScreen,
  "sso-provider-selection": SsoProviderSelectionScreen,
  "password-recovery": PasswordRecoveryScreen,
  "device-sessions": DeviceSessionsScreen,
  "security-center": SecurityCenterScreen,
  "role-access-request": RoleAccessRequestScreen,
  "ip-network-policy": IpNetworkPolicyScreen,
  "audit-log": AuditLogScreen,
  "security-alerts": SecurityAlertsScreen,
  "employee-home": EmployeeHomeScreen,
  "my-profile": MyProfileScreen,
  "my-tasks": MyTasksScreen,
  "my-calendar": MyCalendarScreen,
  "my-meetings": MyMeetingsScreen,
  "my-approvals": MyApprovalsScreen,
  "my-documents": MyDocumentsScreen,
  "my-notifications": MyNotificationsScreen,
  "my-activity": MyActivityScreen,
  "company-directory": CompanyDirectoryScreen,
  "organization-chart": OrganizationChartScreen,
  "employee-360": Employee360Screen,
  "digital-id-card": DigitalIdCardScreen,
  "digital-visiting-card": DigitalVisitingCardScreen,
  "mail-inbox": MailInboxScreen,
  "compose-mail": ComposeMailScreen,
  "sent-mail": SentMailScreen,
  "mail-search": MailSearchScreen,
  "ceo-overview": CeoOverviewScreen,
  "revenue-snapshot": RevenueSnapshotScreen,
  "sales-command": SalesCommandScreen,
  "finance-snapshot": FinanceSnapshotScreen,
  "people-overview": PeopleOverviewScreen,
  "marketing-overview": MarketingOverviewScreen,
  "service-overview": ServiceOverviewScreen,
  "inventory-overview": InventoryOverviewScreen,
  "field-operations": FieldOperationsScreen,
  "executive-alerts": ExecutiveAlertsScreen,
  "executive-approvals": ExecutiveApprovalsScreen,
  "ceo-ai-insights": CeoAiInsightsScreen,
  "kpi-drilldown": KpiDrilldownScreen,
  "executive-reports": ExecutiveReportsScreen,
  "sales-home": SalesHomeScreen,
  "lead-inbox": LeadInboxScreen,
  "lead-detail": LeadDetailScreen,
  "lead-create": LeadCreateScreen,
  "contact-detail": ContactDetailScreen,
  "account-detail": AccountDetailScreen,
  "opportunity-detail": OpportunityDetailScreen,
  "sales-pipeline": SalesPipelineScreen,
  "sales-forecast": SalesForecastScreen,
  "sales-targets": SalesTargetsScreen,
  "sales-leaderboard": SalesLeaderboardScreen,
  "followup-queue": FollowupQueueScreen,
  "customer-meetings": CustomerMeetingsScreen,
  "quotation-list": QuotationListScreen,
  "quotation-builder": QuotationBuilderScreen,
  "quotation-detail": QuotationDetailScreen,
  "order-list": OrderListScreen,
  "order-detail": OrderDetailScreen,
  "customer-activity": CustomerActivityScreen,
  "whatsapp-inbox": WhatsappInboxScreen,
  "whatsapp-conversation": WhatsappConversationScreen,
  "whatsapp-convert": WhatsappConvertScreen,
  "sales-visiting-card": SalesVisitingCardScreen,
  "sales-travel": SalesTravelScreen,
  "visit-planner": VisitPlannerScreen,
  "visit-detail": VisitDetailScreen,
  "sales-expenses": SalesExpensesScreen,
  "sales-reports": SalesReportsScreen,
  "team-sales-dashboard": TeamSalesDashboardScreen,
  "sales-settings": SalesSettingsScreen,
  "sales-ai-home": SalesAiHomeScreen,
  "ai-lead-prioritization": AiLeadPrioritizationScreen,
  "ai-followup-writer": AiFollowupWriterScreen,
  "ai-customer-summary": AiCustomerSummaryScreen,
  "ai-next-best-action": AiNextBestActionScreen,
  "ai-pipeline-review": AiPipelineReviewScreen,
  "ai-daily-brief": AiDailyBriefScreen,
  "ai-sales-qa": AiSalesQaScreen,
  "analytics-home": AnalyticsHomeScreen,
  "executive-analytics": ExecutiveAnalyticsScreen,
  "sales-analytics": SalesAnalyticsScreen,
  "finance-analytics": FinanceAnalyticsScreen,
  "marketing-analytics": MarketingAnalyticsScreen,
  "hr-analytics": HrAnalyticsScreen,
  "service-analytics": ServiceAnalyticsScreen,
  "inventory-analytics": InventoryAnalyticsScreen,
  "employee-productivity": EmployeeProductivityScreen,
  "task-analytics": TaskAnalyticsScreen,
  "funnel-analytics": FunnelAnalyticsScreen,
  "cohort-analysis": CohortAnalysisScreen,
  "report-builder": ReportBuilderScreen,
  "report-detail": ReportDetailScreen,
  "audit-explorer": AuditExplorerScreen,
  "data-export": DataExportScreen,
  "scheduled-reports": ScheduledReportsScreen,
  "analytics-settings": AnalyticsSettingsScreen,
  // ——— Phase 18 · Mobile ———
  "mobile-home": MobileHomeScreen,
  "mobile-sales-home": MobileSalesHomeScreen,
  "mobile-lead-detail": MobileLeadDetailScreen,
  "mobile-whatsapp": MobileWhatsappScreen,
  "mobile-meetings": MobileMeetingsScreen,
  "mobile-tasks": MobileTasksScreen,
  "mobile-service-home": MobileServiceHomeScreen,
  "mobile-service-visit": MobileServiceVisitScreen,
  "mobile-attendance": MobileAttendanceScreen,
  "mobile-approvals": MobileApprovalsScreen,
  "mobile-notifications": MobileNotificationsScreen,
  "mobile-profile": MobileProfileScreen,
  "mobile-id-card": MobileIdCardScreen,
  "mobile-visiting-card": MobileVisitingCardScreen,
  "mobile-mail": MobileMailScreen,
  "mobile-ai": MobileAiScreen,
  // ——— Phase 18 · Enterprise Hardening ———
  "responsive-qa": ResponsiveQaScreen,
  "performance-dashboard": PerformanceDashboardScreen,
  "accessibility-review": AccessibilityReviewScreen,
  "security-hardening": SecurityHardeningScreen,
  "backup-recovery": BackupRecoveryScreen,
  monitoring: MonitoringScreen,
  "release-management": ReleaseManagementScreen,
  "system-status": SystemStatusScreen,
};
