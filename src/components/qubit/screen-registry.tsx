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
};
