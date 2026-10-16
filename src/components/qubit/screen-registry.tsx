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
};
