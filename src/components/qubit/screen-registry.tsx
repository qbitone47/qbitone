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
};
