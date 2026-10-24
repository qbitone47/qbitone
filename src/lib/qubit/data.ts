// ============================================================
// Qubit One — Enterprise data model
// Realistic organization data for Qubit One Pvt Ltd (Phase 1)
// ============================================================

export type EmployeeStatus = "Active" | "Probation" | "Notice Period" | "On Leave" | "Exit Initiated";
export type Sensitivity = "Public" | "Internal" | "Confidential" | "Restricted";
export type WorkflowStatus = "Active" | "Draft" | "Disabled";
export type RuleStatus = "Active" | "Disabled" | "Conflict";
export type ConnectionStatus = "Connected" | "Warning" | "Disconnected" | "Configuration Required";

export interface Employee {
  id: string;
  name: string;
  title: string;
  department: string; // department name
  managerId: string | null;
  location: string;
  email: string;
  phone: string;
  status: EmployeeStatus;
  since: string; // e.g. "12 Dec 2022"
  employeeId: string;
}

export interface SubDepartment {
  id: string;
  name: string;
  employeeCount: number;
  headId?: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  headId: string;
  parent: string;
  employeeCount: number;
  subDepartments: SubDepartment[];
  locations: string[];
  status: "Active" | "Archived";
  createdAt: string;
  description: string;
}

export interface Role {
  id: string;
  name: string;
  department: string;
  reportingLevel: "Executive" | "Level 2" | "Level 3" | "Level 4";
  employees: number;
  permissionsSummary: string;
  approvalAuthority: string;
  dataBoundary: string;
  purpose: string;
  status: "Active" | "Draft";
  lastModified: string;
}

export interface LifecycleStage {
  id: string;
  name: string;
  count: number;
  description: string;
}

export interface LifecycleRecord {
  id: string;
  employeeId: string;
  stage: string;
  ownerId: string;
  startDate: string;
  pendingTasks: number;
  status: "In Progress" | "Pending" | "Completed" | "On Hold";
  history: { date: string; event: string }[];
}

export interface DataDomain {
  id: string;
  name: string;
  ownerDepartment: string;
  ownerRole: string;
  stewardId: string;
  accessLevel: string;
  sensitivity: Sensitivity;
  retention: string;
  status: "Active" | "Under Review";
  lastReview: string;
  records: string;
  systems: string[];
}

export interface Workflow {
  id: string;
  name: string;
  department: string;
  trigger: string;
  actionSummary: string;
  ownerId: string;
  status: WorkflowStatus;
  version: string;
  lastModified: string;
  runsThisMonth: number;
  avgCompletion: string;
  steps: { stage: string; label: string; detail: string }[];
}

export interface ApprovalRule {
  id: string;
  requestType: string;
  department: string;
  amountRange: string;
  approverId: string;
  backupApproverId: string;
  escalationToId: string;
  sla: string;
  status: RuleStatus;
  priority: number;
  note?: string;
  lastModified: string;
}

export interface NotificationRule {
  id: string;
  event: string;
  department: string;
  recipients: string;
  channels: string[];
  priority: "High" | "Medium" | "Low";
  trigger: string;
  frequency: string;
  status: "Active" | "Paused";
  lastModified: string;
  preview?: { title: string; body: string };
}

export interface Integration {
  id: string;
  name: string;
  provider: string;
  category: string;
  status: ConnectionStatus;
  apiStatus: string;
  lastSync: string;
  dataDirection: "Bidirectional" | "Inbound" | "Outbound";
  environment: "Production" | "Staging";
  health: number;
  latency: string;
  description: string;
  scopes: string[];
  logs: { time: string; event: string; level: "info" | "warn" | "error" }[];
}

export interface NavModule {
  id: string;
  name: string;
  route: string;
  icon: string; // registry key resolved in the screen
  parent: string | null;
  allowedRoles: string[]; // role ids; ["all"] = everyone
  status: "Active" | "Disabled";
  visibility: "All Roles" | "Restricted";
  description: string;
  order: number;
}

// ------------------------------------------------------------
// Employees
// ------------------------------------------------------------
export const employees: Employee[] = [
  { id: "sagar", name: "Sagar Singh", title: "Chief Executive Officer", department: "Executive", managerId: null, location: "Mumbai HQ", email: "sagar.singh@qubitone.in", phone: "+91 98200 10001", status: "Active", since: "12 Jan 2019", employeeId: "QO-0001" },
  { id: "rahul", name: "Rahul Mehta", title: "Sales Head", department: "Sales", managerId: "sagar", location: "Mumbai HQ", email: "rahul.mehta@qubitone.in", phone: "+91 98200 10002", status: "Active", since: "4 Mar 2019", employeeId: "QO-0014" },
  { id: "priya", name: "Priya Sharma", title: "Finance Head", department: "Finance", managerId: "sagar", location: "Mumbai HQ", email: "priya.sharma@qubitone.in", phone: "+91 98200 10003", status: "Active", since: "18 Apr 2019", employeeId: "QO-0021" },
  { id: "neha", name: "Neha Patel", title: "HR Head", department: "HR & People", managerId: "sagar", location: "Mumbai HQ", email: "neha.patel@qubitone.in", phone: "+91 98200 10004", status: "Active", since: "2 Jun 2019", employeeId: "QO-0027" },
  { id: "amit", name: "Amit Verma", title: "Marketing Head", department: "Marketing", managerId: "sagar", location: "Mumbai HQ", email: "amit.verma@qubitone.in", phone: "+91 98200 10005", status: "Active", since: "9 Sep 2019", employeeId: "QO-0033" },
  { id: "vikramj", name: "Vikram Joshi", title: "Service Manager", department: "Service", managerId: "sagar", location: "Bengaluru", email: "vikram.joshi@qubitone.in", phone: "+91 98200 10006", status: "Active", since: "15 Nov 2019", employeeId: "QO-0040" },
  { id: "karan", name: "Karan Mehta", title: "Inventory Manager", department: "Inventory", managerId: "sagar", location: "Pune", email: "karan.mehta@qubitone.in", phone: "+91 98200 10007", status: "Active", since: "7 Jan 2020", employeeId: "QO-0046" },
  { id: "arjun", name: "Arjun Nair", title: "IT Head", department: "IT & Technology", managerId: "sagar", location: "Mumbai HQ", email: "arjun.nair@qubitone.in", phone: "+91 98200 10008", status: "Active", since: "21 Feb 2020", employeeId: "QO-0052" },
  { id: "sanjay", name: "Sanjay Gupta", title: "Operations Head", department: "Operations", managerId: "sagar", location: "Delhi NCR", email: "sanjay.gupta@qubitone.in", phone: "+91 98200 10009", status: "Active", since: "30 Mar 2020", employeeId: "QO-0058" },

  { id: "pankaj", name: "Pankaj Sharma", title: "Account Manager", department: "Sales", managerId: "rahul", location: "Mumbai HQ", email: "pankaj.sharma@qubitone.in", phone: "+91 98210 20011", status: "Active", since: "6 Jul 2020", employeeId: "QO-0102" },
  { id: "meera", name: "Meera Iyer", title: "Senior Account Manager", department: "Sales", managerId: "rahul", location: "Bengaluru", email: "meera.iyer@qubitone.in", phone: "+91 98210 20012", status: "Active", since: "19 Aug 2020", employeeId: "QO-0115" },
  { id: "vikrams", name: "Vikram Singh", title: "Key Account Manager", department: "Sales", managerId: "rahul", location: "Delhi NCR", email: "vikram.singh@qubitone.in", phone: "+91 98210 20013", status: "Active", since: "12 Dec 2022", employeeId: "QO-0244" },
  { id: "rohitv", name: "Rohit Verma", title: "Sales Executive", department: "Sales", managerId: "pankaj", location: "Mumbai HQ", email: "rohit.verma@qubitone.in", phone: "+91 98210 20014", status: "Active", since: "3 Oct 2025", employeeId: "QO-1187" },
  { id: "arvind", name: "Arvind Swamy", title: "Field Sales Executive", department: "Sales", managerId: "pankaj", location: "Jaipur", email: "arvind.swamy@qubitone.in", phone: "+91 98210 20015", status: "Active", since: "22 Feb 2023", employeeId: "QO-0311" },

  { id: "kavita", name: "Kavita Joshi", title: "Finance Manager", department: "Finance", managerId: "priya", location: "Mumbai HQ", email: "kavita.joshi@qubitone.in", phone: "+91 98220 30011", status: "Active", since: "14 Jun 2021", employeeId: "QO-0189" },
  { id: "tanvi", name: "Tanvi Shah", title: "Taxation Lead", department: "Finance", managerId: "priya", location: "Mumbai HQ", email: "tanvi.shah@qubitone.in", phone: "+91 98220 30012", status: "Active", since: "1 Nov 2021", employeeId: "QO-0203" },
  { id: "rameshb", name: "Ramesh Bhatt", title: "Accountant", department: "Finance", managerId: "kavita", location: "Bengaluru", email: "ramesh.bhatt@qubitone.in", phone: "+91 98220 30013", status: "Active", since: "8 Apr 2022", employeeId: "QO-0231" },

  { id: "anita", name: "Anita Rao", title: "HR Executive", department: "HR & People", managerId: "neha", location: "Mumbai HQ", email: "anita.rao@qubitone.in", phone: "+91 98230 40011", status: "Active", since: "23 May 2022", employeeId: "QO-0264" },
  { id: "divya", name: "Divya Nair", title: "HR Executive", department: "HR & People", managerId: "neha", location: "Bengaluru", email: "divya.nair@qubitone.in", phone: "+91 98230 40012", status: "On Leave", since: "17 Jan 2023", employeeId: "QO-0289" },

  { id: "deepak", name: "Deepak Kumar", title: "Marketing Specialist", department: "Marketing", managerId: "amit", location: "Mumbai HQ", email: "deepak.kumar@qubitone.in", phone: "+91 98240 50011", status: "Active", since: "5 Sep 2022", employeeId: "QO-0302" },
  { id: "shyam", name: "Shyam Kumar", title: "Marketing Executive", department: "Marketing", managerId: "amit", location: "Mumbai HQ", email: "shyam.kumar@qubitone.in", phone: "+91 98240 50012", status: "Active", since: "30 Oct 2023", employeeId: "QO-0415" },
  { id: "pooja", name: "Pooja Desai", title: "Digital Marketing Specialist", department: "Marketing", managerId: "amit", location: "Pune", email: "pooja.desai@qubitone.in", phone: "+91 98240 50013", status: "Active", since: "8 Mar 2023", employeeId: "QO-0344" },

  { id: "rameshp", name: "Ramesh Pillai", title: "Senior Service Engineer", department: "Service", managerId: "vikramj", location: "Bengaluru", email: "ramesh.pillai@qubitone.in", phone: "+91 98250 60011", status: "Notice Period", since: "11 Feb 2021", employeeId: "QO-0177" },
  { id: "sneha", name: "Sneha Gupta", title: "Business Analyst", department: "Operations", managerId: "sanjay", location: "Delhi NCR", email: "sneha.gupta@qubitone.in", phone: "+91 98260 70011", status: "Probation", since: "1 Oct 2025", employeeId: "QO-1201" },
  { id: "siddharth", name: "Siddharth Malhotra", title: "Warehouse Supervisor", department: "Inventory", managerId: "karan", location: "Pune", email: "siddharth.m@qubitone.in", phone: "+91 98270 80011", status: "Active", since: "26 Jun 2022", employeeId: "QO-0271" },
  { id: "nikhil", name: "Nikhil Rao", title: "IT Support Engineer", department: "IT & Technology", managerId: "arjun", location: "Mumbai HQ", email: "nikhil.rao@qubitone.in", phone: "+91 98280 90011", status: "Active", since: "9 Jan 2023", employeeId: "QO-0298" },
  { id: "ankit", name: "Ankit Sharma", title: "Sales Trainee (Candidate)", department: "Sales", managerId: "pankaj", location: "Mumbai HQ", email: "ankit.sharma@qubitone.in", phone: "+91 98210 20016", status: "Active", since: "5 Oct 2025", employeeId: "QO-1198" },

  // IAM demo identities (see iam.ts) — individual employee records for the
  // dedicated per-department demo accounts. Each maps 1:1 to exactly one
  // login (no duplicate employee identities).
  { id: "demo.ceo", name: "Demo CEO", title: "Chief Executive Officer (Demo)", department: "Executive", managerId: null, location: "Mumbai HQ", email: "demo.ceo@qubitone.in", phone: "+91 98290 90001", status: "Active", since: "1 Nov 2026", employeeId: "QO-D001" },
  { id: "demo.sales", name: "Demo Sales", title: "Sales Executive (Demo)", department: "Sales", managerId: "demo.ceo", location: "Mumbai HQ", email: "demo.sales@qubitone.in", phone: "+91 98290 90002", status: "Active", since: "1 Nov 2026", employeeId: "QO-D002" },
  { id: "demo.finance", name: "Demo Finance", title: "Finance Executive (Demo)", department: "Finance", managerId: "demo.ceo", location: "Mumbai HQ", email: "demo.finance@qubitone.in", phone: "+91 98290 90003", status: "Active", since: "1 Nov 2026", employeeId: "QO-D003" },
  { id: "demo.hr", name: "Demo HR", title: "HR Manager (Demo)", department: "HR & People", managerId: "demo.ceo", location: "Mumbai HQ", email: "demo.hr@qubitone.in", phone: "+91 98290 90004", status: "Active", since: "1 Nov 2026", employeeId: "QO-D004" },
  { id: "demo.inventory", name: "Demo Inventory", title: "Inventory Executive (Demo)", department: "Inventory", managerId: "demo.ceo", location: "Pune Warehouse", email: "demo.inventory@qubitone.in", phone: "+91 98290 90005", status: "Active", since: "1 Nov 2026", employeeId: "QO-D005" },
  { id: "demo.marketing", name: "Demo Marketing", title: "Marketing Executive (Demo)", department: "Marketing", managerId: "demo.ceo", location: "Mumbai HQ", email: "demo.marketing@qubitone.in", phone: "+91 98290 90006", status: "Active", since: "1 Nov 2026", employeeId: "QO-D006" },
  { id: "demo.service", name: "Demo Service", title: "Service Engineer (Demo)", department: "Service", managerId: "demo.ceo", location: "Field · West Zone", email: "demo.service@qubitone.in", phone: "+91 98290 90007", status: "Active", since: "1 Nov 2026", employeeId: "QO-D007" },
];

export const getEmployee = (id: string | null | undefined): Employee | undefined =>
  employees.find((e) => e.id === id);

export const employeeName = (id: string | null | undefined): string =>
  id ? getEmployee(id)?.name ?? "—" : "—";

export const directReports = (id: string): Employee[] =>
  employees.filter((e) => e.managerId === id);

export const searchEmployees = (query: string): Employee[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return employees
    .filter((e) => e.name.toLowerCase().includes(q) || e.title.toLowerCase().includes(q) || e.department.toLowerCase().includes(q))
    .slice(0, 8);
};

// ------------------------------------------------------------
// Departments
// ------------------------------------------------------------
export const COMPANY_NAME = "Qubit One Pvt Ltd";
export const COMPANY_EMPLOYEES = 1245;

export const departments: Department[] = [
  {
    id: "sales", code: "SAL", name: "Sales", headId: "rahul", parent: COMPANY_NAME,
    employeeCount: 243,
    subDepartments: [
      { id: "sales-inside", name: "Inside Sales", employeeCount: 68, headId: "pankaj" },
      { id: "sales-field", name: "Field Sales", employeeCount: 72, headId: "meera" },
      { id: "sales-channel", name: "Channel Sales", employeeCount: 54 },
      { id: "sales-ops", name: "Sales Operations", employeeCount: 31 },
      { id: "sales-support", name: "Sales Support", employeeCount: 18 },
    ],
    locations: ["Mumbai HQ", "Bengaluru", "Delhi NCR", "Pune", "Jaipur"],
    status: "Active", createdAt: "12 Jan 2022",
    description: "Owns end-to-end revenue — lead generation, pipeline management, quotations and customer acquisition across all regions.",
  },
  {
    id: "finance", code: "FIN", name: "Finance", headId: "priya", parent: COMPANY_NAME,
    employeeCount: 87,
    subDepartments: [
      { id: "fin-accounts", name: "Accounts", employeeCount: 32, headId: "kavita" },
      { id: "fin-tax", name: "Taxation", employeeCount: 14, headId: "tanvi" },
      { id: "fin-audit", name: "Audit", employeeCount: 11 },
      { id: "fin-procurement", name: "Procurement", employeeCount: 18 },
      { id: "fin-treasury", name: "Treasury", employeeCount: 12 },
    ],
    locations: ["Mumbai HQ", "Bengaluru"],
    status: "Active", createdAt: "12 Jan 2022",
    description: "Manages financial planning, accounting, taxation, audit and procurement governance for the organization.",
  },
  {
    id: "hr", code: "HRP", name: "HR & People", headId: "neha", parent: COMPANY_NAME,
    employeeCount: 126,
    subDepartments: [
      { id: "hr-recruitment", name: "Recruitment", employeeCount: 28, headId: "anita" },
      { id: "hr-operations", name: "HR Operations", employeeCount: 34, headId: "divya" },
      { id: "hr-ld", name: "Learning & Development", employeeCount: 22 },
      { id: "hr-payroll", name: "Payroll & Benefits", employeeCount: 19 },
      { id: "hr-engagement", name: "Employee Engagement", employeeCount: 23 },
    ],
    locations: ["Mumbai HQ", "Bengaluru", "Delhi NCR"],
    status: "Active", createdAt: "12 Jan 2022",
    description: "Drives talent acquisition, employee experience, learning, payroll and engagement across the employee lifecycle.",
  },
  {
    id: "marketing", code: "MKT", name: "Marketing", headId: "amit", parent: COMPANY_NAME,
    employeeCount: 53,
    subDepartments: [
      { id: "mkt-digital", name: "Digital Marketing", employeeCount: 18, headId: "pooja" },
      { id: "mkt-brand", name: "Brand & Content", employeeCount: 15, headId: "deepak" },
      { id: "mkt-events", name: "Events & Field Marketing", employeeCount: 11 },
      { id: "mkt-product", name: "Product Marketing", employeeCount: 9 },
    ],
    locations: ["Mumbai HQ", "Pune"],
    status: "Active", createdAt: "18 Jan 2022",
    description: "Builds the Qubit One brand, demand generation, content and product marketing programs.",
  },
  {
    id: "service", code: "SVC", name: "Service", headId: "vikramj", parent: COMPANY_NAME,
    employeeCount: 96,
    subDepartments: [
      { id: "svc-desk", name: "Support Desk", employeeCount: 41 },
      { id: "svc-field", name: "Field Service", employeeCount: 29, headId: "rameshp" },
      { id: "svc-quality", name: "Service Quality", employeeCount: 13 },
      { id: "svc-spares", name: "Spares & Logistics", employeeCount: 13 },
    ],
    locations: ["Bengaluru", "Mumbai HQ", "Delhi NCR", "Hyderabad"],
    status: "Active", createdAt: "20 Jan 2022",
    description: "Delivers post-sales support, field service, SLA management and service quality assurance.",
  },
  {
    id: "inventory", code: "INV", name: "Inventory", headId: "karan", parent: COMPANY_NAME,
    employeeCount: 65,
    subDepartments: [
      { id: "inv-warehouse", name: "Warehouse Operations", employeeCount: 28, headId: "siddharth" },
      { id: "inv-logistics", name: "Logistics & Dispatch", employeeCount: 21 },
      { id: "inv-control", name: "Stock Control", employeeCount: 16 },
    ],
    locations: ["Pune", "Mumbai HQ", "Hyderabad"],
    status: "Active", createdAt: "25 Jan 2022",
    description: "Manages warehousing, stock control, logistics and dispatch across all fulfillment centers.",
  },
  {
    id: "it", code: "ITT", name: "IT & Technology", headId: "arjun", parent: COMPANY_NAME,
    employeeCount: 43,
    subDepartments: [
      { id: "it-infra", name: "Infrastructure & Networks", employeeCount: 14 },
      { id: "it-apps", name: "Applications & Integrations", employeeCount: 12, headId: "nikhil" },
      { id: "it-security", name: "Information Security", employeeCount: 9 },
      { id: "it-support", name: "IT Support", employeeCount: 8 },
    ],
    locations: ["Mumbai HQ"],
    status: "Active", createdAt: "1 Feb 2022",
    description: "Operates enterprise infrastructure, business applications, integrations and information security.",
  },
  {
    id: "operations", code: "OPS", name: "Operations", headId: "sanjay", parent: COMPANY_NAME,
    employeeCount: 78,
    subDepartments: [
      { id: "ops-supply", name: "Supply Chain", employeeCount: 26 },
      { id: "ops-facilities", name: "Facilities & Admin", employeeCount: 18 },
      { id: "ops-bp", name: "Business Process", employeeCount: 17, headId: "sneha" },
      { id: "ops-quality", name: "Quality & Compliance", employeeCount: 17 },
    ],
    locations: ["Delhi NCR", "Mumbai HQ"],
    status: "Active", createdAt: "5 Feb 2022",
    description: "Coordinates supply chain, facilities, business processes, quality and enterprise compliance.",
  },
];

export const getDepartment = (id: string | null | undefined): Department | undefined =>
  departments.find((d) => d.id === id);

export const departmentByName = (name: string): Department | undefined =>
  departments.find((d) => d.name.toLowerCase() === name.toLowerCase());

// ------------------------------------------------------------
// Roles (Screen 03)
// ------------------------------------------------------------
export const roles: Role[] = [
  { id: "ceo", name: "CEO", department: "Executive", reportingLevel: "Executive", employees: 1, permissionsSummary: "Full organization access", approvalAuthority: "Final authority — all approvals above ₹10,00,000", dataBoundary: "Entire organization", purpose: "Chief executive authority for company strategy, governance and final approvals.", status: "Active", lastModified: "2 Jan 2026" },
  { id: "dept-head", name: "Department Head", department: "All Departments", reportingLevel: "Level 2", employees: 8, permissionsSummary: "Full department access, cross-module view", approvalAuthority: "Approves within department up to ₹50,000", dataBoundary: "Own department + shared reports", purpose: "Leads a business department, owns its goals, budgets and approval authority.", status: "Active", lastModified: "2 Jan 2026" },
  { id: "sales-head", name: "Sales Head", department: "Sales", reportingLevel: "Level 2", employees: 3, permissionsSummary: "Full Sales module, Analytics view", approvalAuthority: "Quotation discounts up to 10%", dataBoundary: "Sales + customer data", purpose: "Owns company-wide revenue targets, sales strategy and channel performance.", status: "Active", lastModified: "28 Dec 2025" },
  { id: "sales-exec", name: "Sales Executive", department: "Sales", reportingLevel: "Level 3", employees: 45, permissionsSummary: "Sales create/edit, limited Finance view", approvalAuthority: "None — submits for approval", dataBoundary: "Assigned accounts only", purpose: "Manages leads, opportunities and quotations for assigned accounts.", status: "Active", lastModified: "28 Dec 2025" },
  { id: "account-manager", name: "Account Manager", department: "Sales", reportingLevel: "Level 3", employees: 12, permissionsSummary: "Sales create/edit, customer 360 view", approvalAuthority: "Approves team leaves", dataBoundary: "Assigned account portfolio", purpose: "Owns key customer relationships, renewals and account growth.", status: "Active", lastModified: "21 Dec 2025" },
  { id: "finance-manager", name: "Finance Manager", department: "Finance", reportingLevel: "Level 3", employees: 6, permissionsSummary: "Finance full, Sales/HR view", approvalAuthority: "Approves expenses ₹10,001–₹50,000", dataBoundary: "All financial data", purpose: "Runs accounting operations, monthly close, budgets and financial reporting.", status: "Active", lastModified: "19 Dec 2025" },
  { id: "accountant", name: "Accountant", department: "Finance", reportingLevel: "Level 4", employees: 12, permissionsSummary: "Finance create/edit, no approvals", approvalAuthority: "None — prepares for approval", dataBoundary: "Assigned ledgers", purpose: "Processes invoices, payments, reconciliations and ledger entries.", status: "Active", lastModified: "15 Dec 2025" },
  { id: "hr-manager", name: "HR Manager", department: "HR & People", reportingLevel: "Level 3", employees: 4, permissionsSummary: "HR full, employee data steward", approvalAuthority: "Approves leave and onboarding plans", dataBoundary: "All employee data (confidential)", purpose: "Manages HR operations, recruitment, policies and employee relations.", status: "Active", lastModified: "12 Dec 2025" },
  { id: "hr-exec", name: "HR Executive", department: "HR & People", reportingLevel: "Level 4", employees: 18, permissionsSummary: "HR create/edit, payroll view", approvalAuthority: "None", dataBoundary: "Employee data (excluding payroll export)", purpose: "Handles onboarding, records, attendance tracking and HR queries.", status: "Active", lastModified: "10 Dec 2025" },
  { id: "mkt-specialist", name: "Marketing Specialist", department: "Marketing", reportingLevel: "Level 4", employees: 22, permissionsSummary: "Marketing create/edit, Analytics view", approvalAuthority: "Campaign budget up to ₹25,000", dataBoundary: "Marketing + campaign data", purpose: "Executes campaigns, content and digital programs for the brand.", status: "Active", lastModified: "8 Dec 2025" },
  { id: "service-engineer", name: "Service Engineer", department: "Service", reportingLevel: "Level 3", employees: 38, permissionsSummary: "Service edit, Inventory view", approvalAuthority: "Service escalation up to ₹5,000", dataBoundary: "Assigned tickets + sites", purpose: "Resolves service tickets, performs field installs and maintenance.", status: "Active", lastModified: "5 Dec 2025" },
  { id: "inventory-manager", name: "Inventory Manager", department: "Inventory", reportingLevel: "Level 2", employees: 5, permissionsSummary: "Inventory full, Procurement view", approvalAuthority: "Stock transfer up to ₹2,00,000", dataBoundary: "Warehouse + stock data", purpose: "Owns stock accuracy, warehouse operations and transfer governance.", status: "Active", lastModified: "2 Dec 2025" },
  { id: "it-admin", name: "IT Administrator", department: "IT & Technology", reportingLevel: "Level 3", employees: 3, permissionsSummary: "Administration, Integrations, Security", approvalAuthority: "Access grants (dual control)", dataBoundary: "Systems + configuration data", purpose: "Administers Qubit One platform, users, integrations and security posture.", status: "Active", lastModified: "1 Dec 2025" },
  { id: "ops-manager", name: "Operations Manager", department: "Operations", reportingLevel: "Level 3", employees: 7, permissionsSummary: "Operations + Inventory edit", approvalAuthority: "Purchase approval up to ₹25,000", dataBoundary: "Operations + vendor data", purpose: "Coordinates business processes, vendors, facilities and compliance.", status: "Draft", lastModified: "20 Nov 2025" },
];

// ------------------------------------------------------------
// Permission matrix (Screen 04)
// cell: "enabled" | "disabled" | "inherited" | "restricted"
// ------------------------------------------------------------
export type PermissionCell = "enabled" | "disabled" | "inherited" | "restricted";
export const PERMISSION_ACTIONS = ["View", "Create", "Edit", "Delete", "Approve", "Export", "Manage"] as const;

export interface RolePermissions {
  roleId: string;
  cells: Record<string, PermissionCell>; // key: `${module}::${action}`
}

export const PERMISSION_MODULES = [
  "Dashboard", "Sales", "Finance", "HR & People", "Inventory", "Marketing",
  "Service", "Meetings", "AI", "Analytics", "Documents", "Administration",
] as const;

const buildSalesExecPermissions = (): Record<string, PermissionCell> => {
  const cells: Record<string, PermissionCell> = {};
  const spec: Record<string, Partial<Record<(typeof PERMISSION_ACTIONS)[number], PermissionCell>>> = {
    Dashboard: { View: "enabled" },
    Sales: { View: "enabled", Create: "enabled", Edit: "enabled", Delete: "restricted", Approve: "disabled", Export: "enabled", Manage: "disabled" },
    Finance: { View: "enabled", Create: "disabled", Edit: "disabled", Delete: "disabled", Approve: "disabled", Export: "restricted", Manage: "disabled" },
    "HR & People": { View: "inherited", Create: "disabled", Edit: "disabled", Delete: "disabled", Approve: "disabled", Export: "disabled", Manage: "disabled" },
    Inventory: { View: "enabled", Create: "disabled", Edit: "disabled", Delete: "disabled", Approve: "disabled", Export: "disabled", Manage: "disabled" },
    Marketing: { View: "enabled", Create: "disabled", Edit: "disabled", Delete: "disabled", Approve: "disabled", Export: "disabled", Manage: "disabled" },
    Service: { View: "enabled", Create: "enabled", Edit: "restricted", Delete: "disabled", Approve: "disabled", Export: "disabled", Manage: "disabled" },
    Meetings: { View: "enabled", Create: "enabled", Edit: "disabled", Delete: "disabled", Approve: "disabled", Export: "disabled", Manage: "disabled" },
    AI: { View: "enabled", Create: "disabled", Edit: "disabled", Delete: "disabled", Approve: "disabled", Export: "disabled", Manage: "disabled" },
    Analytics: { View: "enabled", Create: "disabled", Edit: "disabled", Delete: "disabled", Approve: "disabled", Export: "enabled", Manage: "disabled" },
    Documents: { View: "enabled", Create: "enabled", Edit: "enabled", Delete: "restricted", Approve: "disabled", Export: "disabled", Manage: "disabled" },
    Administration: { View: "restricted", Create: "disabled", Edit: "disabled", Delete: "disabled", Approve: "disabled", Export: "disabled", Manage: "disabled" },
  };
  for (const mod of PERMISSION_MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      cells[`${mod}::${action}`] = spec[mod]?.[action] ?? "disabled";
    }
  }
  return cells;
};

export const rolePermissions: RolePermissions[] = [
  { roleId: "sales-exec", cells: buildSalesExecPermissions() },
];

export const selectableRolesForMatrix = [
  { id: "sales-exec", label: "Sales Executive" },
  { id: "dept-head", label: "Department Head" },
  { id: "finance-manager", label: "Finance Manager" },
  { id: "hr-manager", label: "HR Manager" },
  { id: "service-engineer", label: "Service Engineer" },
];

// ------------------------------------------------------------
// Employee lifecycle (Screen 06)
// ------------------------------------------------------------
export const lifecycleStages: LifecycleStage[] = [
  { id: "candidate", name: "Candidate", count: 24, description: "Actively interviewed candidates" },
  { id: "offer", name: "Offer", count: 12, description: "Offers released, awaiting acceptance" },
  { id: "onboarding", name: "Onboarding", count: 18, description: "Joining formalities in progress" },
  { id: "active", name: "Active", count: 1048, description: "Currently employed" },
  { id: "performance", name: "Performance", count: 96, description: "Under review cycles" },
  { id: "promotion", name: "Promotion / Transfer", count: 28, description: "Role change in progress" },
  { id: "exit", name: "Exit", count: 22, description: "Exiting with clearance pending" },
];

export const lifecycleRecords: LifecycleRecord[] = [
  {
    id: "lc1", employeeId: "ankit", stage: "Candidate", ownerId: "anita", startDate: "5 Oct 2025", pendingTasks: 3, status: "In Progress",
    history: [
      { date: "5 Oct 2025", event: "Applied — Sales Trainee requisition #REQ-214" },
      { date: "9 Oct 2025", event: "Screening round cleared by Pankaj Sharma" },
      { date: "14 Oct 2025", event: "Final interview scheduled with Rahul Mehta" },
    ],
  },
  {
    id: "lc2", employeeId: "rohitv", stage: "Offer", ownerId: "rahul", startDate: "3 Oct 2025", pendingTasks: 2, status: "Pending",
    history: [
      { date: "3 Oct 2025", event: "Offer released — Sales Executive, Band L3" },
      { date: "7 Oct 2025", event: "Candidate requested 1 week to respond" },
    ],
  },
  {
    id: "lc3", employeeId: "sneha", stage: "Onboarding", ownerId: "anita", startDate: "1 Oct 2025", pendingTasks: 5, status: "In Progress",
    history: [
      { date: "1 Oct 2025", event: "Joined — Business Analyst, Operations" },
      { date: "2 Oct 2025", event: "ID card & system accounts created" },
      { date: "10 Oct 2025", event: "Buddy assigned — Sanjay Gupta" },
    ],
  },
  { id: "lc4", employeeId: "vikrams", stage: "Active", ownerId: "rahul", startDate: "12 Dec 2022", pendingTasks: 0, status: "Completed", history: [{ date: "12 Dec 2022", event: "Onboarding completed" }, { date: "1 Apr 2024", event: "Promoted to Key Account Manager" }] },
  { id: "lc5", employeeId: "pooja", stage: "Performance", ownerId: "amit", startDate: "8 Mar 2023", pendingTasks: 2, status: "In Progress", history: [{ date: "1 Oct 2025", event: "H2 review cycle started" }, { date: "12 Oct 2025", event: "Self-assessment submitted" }] },
  { id: "lc6", employeeId: "kavita", stage: "Promotion / Transfer", ownerId: "priya", startDate: "14 Jun 2021", pendingTasks: 1, status: "In Progress", history: [{ date: "20 Sep 2025", event: "Promotion to Senior Finance Manager proposed" }, { date: "8 Oct 2025", event: "Compensation revision approved by CEO" }] },
  {
    id: "lc7", employeeId: "rameshp", stage: "Exit", ownerId: "vikramj", startDate: "2 Feb 2026", pendingTasks: 4, status: "Pending",
    history: [
      { date: "2 Nov 2025", event: "Resignation submitted — notice period 90 days" },
      { date: "4 Nov 2025", event: "Exit interview scheduled" },
      { date: "10 Nov 2025", event: "Knowledge transfer plan in progress" },
    ],
  },
  { id: "lc8", employeeId: "arvind", stage: "Active", ownerId: "meera", startDate: "22 Feb 2023", pendingTasks: 0, status: "Completed", history: [{ date: "22 Feb 2023", event: "Onboarding completed" }] },
  { id: "lc9", employeeId: "divya", stage: "Active", ownerId: "neha", startDate: "17 Jan 2023", pendingTasks: 1, status: "On Hold", history: [{ date: "17 Jan 2023", event: "Onboarding completed" }, { date: "1 Nov 2025", event: "On leave — childcare break till 15 Dec 2025" }] },
  { id: "lc10", employeeId: "nikhil", stage: "Performance", ownerId: "arjun", startDate: "9 Jan 2023", pendingTasks: 1, status: "In Progress", history: [{ date: "1 Oct 2025", event: "H2 review cycle started" }] },
  { id: "lc11", employeeId: "tanvi", stage: "Active", ownerId: "priya", startDate: "1 Nov 2021", pendingTasks: 0, status: "Completed", history: [{ date: "1 Nov 2021", event: "Onboarding completed" }] },
  { id: "lc12", employeeId: "shyam", stage: "Onboarding", ownerId: "anita", startDate: "30 Sep 2025", pendingTasks: 2, status: "In Progress", history: [{ date: "30 Sep 2025", event: "Joined — Marketing Executive" }, { date: "6 Oct 2025", event: "Brand guidelines training completed" }] },
];

// ------------------------------------------------------------
// Data ownership (Screen 07)
// ------------------------------------------------------------
export const dataDomains: DataDomain[] = [
  { id: "dd-employee", name: "Employee Data", ownerDepartment: "HR & People", ownerRole: "HR Manager", stewardId: "anita", accessLevel: "Role-based (HR roles only)", sensitivity: "Restricted", retention: "7 years after exit", status: "Active", lastReview: "12 Nov 2025", records: "1,245 employee records", systems: ["Qubit One HR", "Payroll"] },
  { id: "dd-customer", name: "Customer Data", ownerDepartment: "Sales", ownerRole: "Sales Head", stewardId: "rahul", accessLevel: "Department + assigned accounts", sensitivity: "Confidential", retention: "10 years after last contract", status: "Active", lastReview: "8 Nov 2025", records: "3,482 customer accounts", systems: ["Qubit One CRM", "WhatsApp Business"] },
  { id: "dd-sales", name: "Sales Data", ownerDepartment: "Sales", ownerRole: "Sales Head", stewardId: "pankaj", accessLevel: "Sales roles + Finance (read)", sensitivity: "Confidential", retention: "8 years", status: "Active", lastReview: "8 Nov 2025", records: "12,940 transactions YTD", systems: ["Qubit One CRM", "Analytics"] },
  { id: "dd-financial", name: "Financial Data", ownerDepartment: "Finance", ownerRole: "Finance Manager", stewardId: "kavita", accessLevel: "Finance roles only", sensitivity: "Restricted", retention: "10 years (statutory)", status: "Active", lastReview: "30 Oct 2025", records: "48,210 ledger entries", systems: ["Qubit One Finance", "ERP"] },
  { id: "dd-inventory", name: "Inventory Data", ownerDepartment: "Inventory", ownerRole: "Inventory Manager", stewardId: "karan", accessLevel: "Inventory + Operations roles", sensitivity: "Internal", retention: "5 years", status: "Active", lastReview: "22 Oct 2025", records: "9,315 SKUs", systems: ["Qubit One Inventory", "ERP"] },
  { id: "dd-service", name: "Service Data", ownerDepartment: "Service", ownerRole: "Service Manager", stewardId: "vikramj", accessLevel: "Service roles + Sales (read)", sensitivity: "Internal", retention: "5 years", status: "Active", lastReview: "18 Oct 2025", records: "21,077 tickets lifetime", systems: ["Qubit One Service"] },
  { id: "dd-marketing", name: "Marketing Data", ownerDepartment: "Marketing", ownerRole: "Marketing Head", stewardId: "deepak", accessLevel: "Marketing roles", sensitivity: "Internal", retention: "3 years", status: "Active", lastReview: "15 Oct 2025", records: "148 campaigns, 62,400 leads", systems: ["Qubit One Marketing", "Google Workspace"] },
  { id: "dd-document", name: "Document Data", ownerDepartment: "Operations", ownerRole: "Operations Head", stewardId: "sanjay", accessLevel: "Permission-based per library", sensitivity: "Confidential", retention: "Per document class", status: "Under Review", lastReview: "2 Sep 2025", records: "86,214 documents", systems: ["Qubit One Documents", "Cloud Storage"] },
  { id: "dd-meeting", name: "Meeting Data", ownerDepartment: "Operations", ownerRole: "Operations Head", stewardId: "sneha", accessLevel: "Participants + organizers", sensitivity: "Internal", retention: "2 years", status: "Active", lastReview: "10 Oct 2025", records: "4,830 meetings YTD", systems: ["Qubit One Meetings", "Microsoft 365"] },
];

// ------------------------------------------------------------
// Workflows (Screen 08)
// ------------------------------------------------------------
export const workflows: Workflow[] = [
  {
    id: "wf-onboarding", name: "Employee Onboarding", department: "HR & People", trigger: "New Hire", actionSummary: "Accounts, assets, induction, buddy assignment", ownerId: "anita", status: "Active", version: "v1.2", lastModified: "18 Dec 2025", runsThisMonth: 18, avgCompletion: "6 days",
    steps: [
      { stage: "trigger", label: "Trigger", detail: "Offer accepted — employee record created" },
      { stage: "conditions", label: "Conditions", detail: "Joining date within 30 days; location confirmed" },
      { stage: "actions", label: "Actions", detail: "Create ID, email, system access; assign assets; schedule induction" },
      { stage: "approval", label: "Approval", detail: "HR Manager confirms day-1 readiness" },
      { stage: "completion", label: "Completion", detail: "Buddy assigned; 30-day check-ins scheduled" },
    ],
  },
  { id: "wf-leave", name: "Leave Approval", department: "HR & People", trigger: "Leave Request", actionSummary: "Manager approval → HR record → balance update", ownerId: "neha", status: "Active", version: "v1.3", lastModified: "10 Dec 2025", runsThisMonth: 96, avgCompletion: "8 hours", steps: [
    { stage: "trigger", label: "Trigger", detail: "Employee submits leave request" },
    { stage: "conditions", label: "Conditions", detail: "Balance available; team coverage check" },
    { stage: "actions", label: "Actions", detail: "Notify manager; update calendar; notify team" },
    { stage: "approval", label: "Approval", detail: "Manager approves; HR Head for 10+ days" },
    { stage: "completion", label: "Completion", detail: "Leave balance updated; payroll informed" },
  ] },
  { id: "wf-expense", name: "Expense Approval", department: "Finance", trigger: "Expense Submit", actionSummary: "Policy check → manager → finance → payout", ownerId: "kavita", status: "Active", version: "v1.5", lastModified: "28 Dec 2025", runsThisMonth: 212, avgCompletion: "1.2 days", steps: [
    { stage: "trigger", label: "Trigger", detail: "Employee submits expense report" },
    { stage: "conditions", label: "Conditions", detail: "Policy limits by category; receipt attached" },
    { stage: "actions", label: "Actions", detail: "Route per approval matrix amount slabs" },
    { stage: "approval", label: "Approval", detail: "Manager → Department Head → Finance per slab" },
    { stage: "completion", label: "Completion", detail: "Marked for next payout cycle; ledger posted" },
  ] },
  { id: "wf-quotation", name: "Quotation Approval", department: "Sales", trigger: "Quotation Submit", actionSummary: "Pricing validation → head approval → release", ownerId: "rahul", status: "Active", version: "v2.0", lastModified: "22 Dec 2025", runsThisMonth: 74, avgCompletion: "9 hours", steps: [
    { stage: "trigger", label: "Trigger", detail: "Sales Executive submits quotation" },
    { stage: "conditions", label: "Conditions", detail: "Price list check; discount slab validation" },
    { stage: "actions", label: "Actions", detail: "Route by discount %; generate PDF; log to CRM" },
    { stage: "approval", label: "Approval", detail: "≤10% Sales Head; 11–20% Finance Head; 21%+ CEO" },
    { stage: "completion", label: "Completion", detail: "Quotation released to customer; follow-up task created" },
  ] },
  { id: "wf-po", name: "Purchase Order Approval", department: "Finance", trigger: "PO Submit", actionSummary: "Budget check → finance approval → PO issue", ownerId: "kavita", status: "Active", version: "v1.4", lastModified: "15 Dec 2025", runsThisMonth: 58, avgCompletion: "1.5 days", steps: [
    { stage: "trigger", label: "Trigger", detail: "Purchase request submitted" },
    { stage: "conditions", label: "Conditions", detail: "Budget available; vendor registered" },
    { stage: "actions", label: "Actions", detail: "Route per amount slab; generate PO document" },
    { stage: "approval", label: "Approval", detail: "≤₹25,000 Manager; >₹25,000 Finance Head; >₹10L CEO" },
    { stage: "completion", label: "Completion", detail: "PO issued to vendor; GRN tracking enabled" },
  ] },
  { id: "wf-stock", name: "Stock Transfer", department: "Inventory", trigger: "Stock Transfer", actionSummary: "Availability check → approval → dispatch → receipt", ownerId: "karan", status: "Active", version: "v1.2", lastModified: "9 Dec 2025", runsThisMonth: 41, avgCompletion: "2.1 days", steps: [
    { stage: "trigger", label: "Trigger", detail: "Transfer request raised between warehouses" },
    { stage: "conditions", label: "Conditions", detail: "Stock availability; transfer value limit" },
    { stage: "actions", label: "Actions", detail: "Reserve stock; create dispatch note; notify logistics" },
    { stage: "approval", label: "Approval", detail: "Inventory Manager for >₹50,000 value" },
    { stage: "completion", label: "Completion", detail: "Receipt confirmed; stock ledger reconciled" },
  ] },
  { id: "wf-ticket", name: "Service Ticket Assignment", department: "Service", trigger: "New Ticket", actionSummary: "Categorize → assign by skill & region → SLA clock", ownerId: "vikramj", status: "Active", version: "v2.0", lastModified: "20 Dec 2025", runsThisMonth: 486, avgCompletion: "18 minutes", steps: [
    { stage: "trigger", label: "Trigger", detail: "Customer raises ticket via portal/WhatsApp" },
    { stage: "conditions", label: "Conditions", detail: "Priority matrix; region & skill matching" },
    { stage: "actions", label: "Actions", detail: "Auto-assign engineer; send acknowledgment; start SLA" },
    { stage: "approval", label: "Approval", detail: "Escalation to Service Manager on SLA breach risk" },
    { stage: "completion", label: "Completion", detail: "Resolution confirmed; CSAT survey sent" },
  ] },
  { id: "wf-meeting-content", name: "Meeting Content Approval", department: "Marketing", trigger: "Content Submit", actionSummary: "Brand check → head approval → publication", ownerId: "amit", status: "Draft", version: "v1.0", lastModified: "5 Dec 2025", runsThisMonth: 0, avgCompletion: "—", steps: [
    { stage: "trigger", label: "Trigger", detail: "Marketer submits meeting/content deck" },
    { stage: "conditions", label: "Conditions", detail: "Brand template used; data figures verified" },
    { stage: "actions", label: "Actions", detail: "Route to Marketing Head; archive approved version" },
    { stage: "approval", label: "Approval", detail: "Marketing Head; CEO for external audiences" },
    { stage: "completion", label: "Completion", detail: "Published to meeting workspace" },
  ] },
  { id: "wf-exit", name: "Exit Clearance", department: "HR & People", trigger: "Resignation Submitted", actionSummary: "Clearances: assets, finance, IT, knowledge transfer", ownerId: "neha", status: "Active", version: "v1.1", lastModified: "2 Dec 2025", runsThisMonth: 6, avgCompletion: "12 days", steps: [
    { stage: "trigger", label: "Trigger", detail: "Resignation accepted by manager" },
    { stage: "conditions", label: "Conditions", detail: "Notice period; pending dues identified" },
    { stage: "actions", label: "Actions", detail: "Create clearance checklist; notify all departments" },
    { stage: "approval", label: "Approval", detail: "HR Head signs off final clearance" },
    { stage: "completion", label: "Completion", detail: "Full & final settlement initiated; access revoked" },
  ] },
  { id: "wf-meeting-approval", name: "Meeting Approval", department: "Operations", trigger: "Meeting Scheduled", actionSummary: "Room + budget validation → organizer confirmation", ownerId: "sanjay", status: "Active", version: "v1.0", lastModified: "1 Dec 2025", runsThisMonth: 134, avgCompletion: "35 minutes", steps: [
    { stage: "trigger", label: "Trigger", detail: "Meeting room booked with external guests" },
    { stage: "conditions", label: "Conditions", detail: "Room capacity; travel budget if any" },
    { stage: "actions", label: "Actions", detail: "Notify facilities; prepare AV; add to calendar" },
    { stage: "approval", label: "Approval", detail: "Operations Head for external visitor meetings" },
    { stage: "completion", label: "Completion", detail: "Invites confirmed; visitor passes generated" },
  ] },
];

// ------------------------------------------------------------
// Approval matrix (Screen 09)
// ------------------------------------------------------------
export const approvalRules: ApprovalRule[] = [
  { id: "ar1", requestType: "Expense", department: "All Departments", amountRange: "₹0 – ₹10,000", approverId: "pankaj", backupApproverId: "meera", escalationToId: "rahul", sla: "1 day", status: "Active", priority: 1, lastModified: "12 Dec 2025" },
  { id: "ar2", requestType: "Expense", department: "All Departments", amountRange: "₹10,001 – ₹50,000", approverId: "rahul", backupApproverId: "priya", escalationToId: "priya", sla: "2 days", status: "Active", priority: 2, lastModified: "12 Dec 2025" },
  { id: "ar3", requestType: "Expense", department: "All Departments", amountRange: "₹50,001 and above", approverId: "priya", backupApproverId: "sagar", escalationToId: "sagar", sla: "3 days", status: "Active", priority: 3, lastModified: "12 Dec 2025" },
  { id: "ar4", requestType: "Purchase", department: "All Departments", amountRange: "₹0 – ₹25,000", approverId: "pankaj", backupApproverId: "kavita", escalationToId: "priya", sla: "1 day", status: "Active", priority: 4, lastModified: "8 Dec 2025" },
  { id: "ar5", requestType: "Purchase", department: "All Departments", amountRange: "₹25,001 – ₹10,00,000", approverId: "priya", backupApproverId: "sagar", escalationToId: "sagar", sla: "2 days", status: "Active", priority: 5, lastModified: "8 Dec 2025" },
  { id: "ar6", requestType: "Purchase", department: "All Departments", amountRange: "₹10,00,001 and above", approverId: "sagar", backupApproverId: "priya", escalationToId: "sagar", sla: "4 days", status: "Active", priority: 6, lastModified: "8 Dec 2025" },
  { id: "ar7", requestType: "Quotation Discount", department: "Sales", amountRange: "0% – 10%", approverId: "rahul", backupApproverId: "meera", escalationToId: "priya", sla: "1 day", status: "Active", priority: 7, lastModified: "1 Dec 2025" },
  { id: "ar8", requestType: "Quotation Discount", department: "Sales", amountRange: "11% – 20%", approverId: "priya", backupApproverId: "sagar", escalationToId: "sagar", sla: "1 day", status: "Active", priority: 8, lastModified: "1 Dec 2025" },
  { id: "ar9", requestType: "Quotation Discount", department: "Sales", amountRange: "Above 20%", approverId: "sagar", backupApproverId: "priya", escalationToId: "sagar", sla: "2 days", status: "Active", priority: 9, lastModified: "1 Dec 2025" },
  { id: "ar10", requestType: "Employee Advance", department: "All Departments", amountRange: "₹0 – ₹1,00,000", approverId: "kavita", backupApproverId: "priya", escalationToId: "sagar", sla: "2 days", status: "Active", priority: 10, lastModified: "20 Nov 2025" },
  { id: "ar11", requestType: "Leave Request", department: "All Departments", amountRange: "Any", approverId: "pankaj", backupApproverId: "anita", escalationToId: "neha", sla: "1 day", status: "Active", priority: 11, lastModified: "20 Nov 2025" },
  { id: "ar12", requestType: "Expense", department: "All Departments", amountRange: "₹0 – ₹50,000", approverId: "priya", backupApproverId: "kavita", escalationToId: "sagar", sla: "2 days", status: "Conflict", priority: 12, note: "Overlaps Expense rules 1–2 (₹0–₹50,000). Disable or narrow the range to resolve.", lastModified: "30 Dec 2025" },
];

export const approvalRuleHistory: Record<string, { date: string; event: string; by: string }[]> = {
  ar3: [
    { date: "12 Dec 2025", event: "SLA changed from 5 days to 3 days", by: "Priya Sharma" },
    { date: "8 Oct 2025", event: "Backup approver changed from vacant to CEO", by: "Sagar Singh" },
    { date: "2 Jan 2025", event: "Rule created", by: "Sagar Singh" },
  ],
  ar12: [
    { date: "30 Dec 2025", event: "Conflict detected — overlaps Expense rules 1–2", by: "Qubit One Governance Check" },
    { date: "30 Dec 2025", event: "Rule created and auto-disabled", by: "Kavita Joshi" },
  ],
};

// ------------------------------------------------------------
// Notification rules (Screen 10)
// ------------------------------------------------------------
export const notificationRules: NotificationRule[] = [
  { id: "nr1", event: "Leave Request", department: "HR & People", recipients: "Reporting Manager", channels: ["In-App", "Email"], priority: "Medium", trigger: "On Submit", frequency: "Immediate", status: "Active", lastModified: "14 Dec 2025", preview: { title: "Leave request — Rohit Verma", body: "Rohit Verma requested 3 days leave (18–20 Dec). Balance 11.5 days. Review in My Approvals." } },
  { id: "nr2", event: "Expense Approval", department: "Finance", recipients: "Approver (per matrix)", channels: ["In-App", "Email"], priority: "High", trigger: "On Submit", frequency: "Immediate", status: "Active", lastModified: "12 Dec 2025", preview: { title: "Expense ₹34,200 needs your approval", body: "Meera Iyer submitted a travel expense of ₹34,200 (client visit — Bengaluru). SLA: 2 days." } },
  { id: "nr3", event: "Sales Quotation", department: "Sales", recipients: "Approver, Sales Head", channels: ["In-App", "Email"], priority: "Medium", trigger: "On Submit", frequency: "Immediate", status: "Active", lastModified: "10 Dec 2025" },
  { id: "nr4", event: "Service Ticket", department: "Service", recipients: "Assigned Engineer, Service Manager", channels: ["In-App", "Push", "WhatsApp"], priority: "High", trigger: "On Ticket Create", frequency: "Immediate", status: "Active", lastModified: "8 Dec 2025", preview: { title: "Ticket #ST-4821 assigned to you", body: "High priority — Atlas Retail, Bengaluru. SLA 4h. Issue: POS terminal not booting." } },
  { id: "nr5", event: "Meeting Schedule", department: "All Departments", recipients: "All Participants", channels: ["In-App", "Email"], priority: "Medium", trigger: "On Assign", frequency: "Immediate + 15 min before", status: "Active", lastModified: "5 Dec 2025" },
  { id: "nr6", event: "Task Assignment", department: "All Departments", recipients: "Assignee", channels: ["In-App"], priority: "Medium", trigger: "On Assign", frequency: "Immediate", status: "Active", lastModified: "2 Dec 2025" },
  { id: "nr7", event: "Document Shared", department: "All Departments", recipients: "Recipient", channels: ["In-App", "Email"], priority: "Low", trigger: "On Share", frequency: "Hourly digest", status: "Active", lastModified: "28 Nov 2025" },
  { id: "nr8", event: "System Alert", department: "IT & Technology", recipients: "IT Admins, On-call", channels: ["In-App", "Email", "Push"], priority: "High", trigger: "On Event", frequency: "Immediate", status: "Active", lastModified: "25 Nov 2025", preview: { title: "ERP sync delayed", body: "ERP System last sync 6h ago (usual: 15 min). Data direction: inbound. View integration health." } },
  { id: "nr9", event: "Purchase Approval", department: "Finance", recipients: "Approver (per matrix)", channels: ["In-App", "Email"], priority: "High", trigger: "On Submit", frequency: "Immediate", status: "Paused", lastModified: "20 Nov 2025" },
];

// ------------------------------------------------------------
// Integrations (Screen 11)
// ------------------------------------------------------------
export const integrations: Integration[] = [
  { id: "int-whatsapp", name: "WhatsApp Business", provider: "Meta", category: "Communication", status: "Connected", apiStatus: "Operational", lastSync: "2 minutes ago", dataDirection: "Bidirectional", environment: "Production", health: 99.8, latency: "120 ms", description: "Customer messaging, service ticket creation and notification delivery over WhatsApp.", scopes: ["Messages", "Templates", "Webhooks"], logs: [
    { time: "Today 10:42", event: "Inbound message → ticket #ST-4821 created", level: "info" },
    { time: "Today 09:15", event: "Template 'service_ack' approved by Meta", level: "info" },
    { time: "Yesterday 18:03", event: "486 notifications delivered (98.9% success)", level: "info" },
  ] },
  { id: "int-m365", name: "Microsoft 365", provider: "Microsoft", category: "Productivity", status: "Connected", apiStatus: "Operational", lastSync: "4 minutes ago", dataDirection: "Bidirectional", environment: "Production", health: 99.9, latency: "85 ms", description: "Calendar, mail and Teams integration for meetings, approvals and notifications.", scopes: ["Calendar", "Mail", "Teams"], logs: [
    { time: "Today 10:30", event: "Calendar sync — 128 events up to date", level: "info" },
    { time: "Today 08:00", event: "Mail channel healthy", level: "info" },
  ] },
  { id: "int-google", name: "Google Workspace", provider: "Google", category: "Productivity", status: "Connected", apiStatus: "Operational", lastSync: "7 minutes ago", dataDirection: "Bidirectional", environment: "Production", health: 99.6, latency: "110 ms", description: "Drive-linked document libraries and shared calendars for cross-team scheduling.", scopes: ["Drive", "Calendar", "Directory"], logs: [
    { time: "Today 10:05", event: "Drive index refreshed — 86,214 documents", level: "info" },
    { time: "Yesterday 22:10", event: "Directory sync — 1,245 users", level: "info" },
  ] },
  { id: "int-outlook", name: "Outlook / Exchange", provider: "Microsoft", category: "Communication", status: "Connected", apiStatus: "Operational", lastSync: "3 minutes ago", dataDirection: "Inbound", environment: "Production", health: 99.7, latency: "95 ms", description: "Enterprise mail routing for approval notifications and customer communication capture.", scopes: ["Mail read", "Send"], logs: [
    { time: "Today 10:38", event: "Approval mail relayed to 12 recipients", level: "info" },
  ] },
  { id: "int-payments", name: "Payment Gateway", provider: "Razorpay", category: "Finance", status: "Connected", apiStatus: "Operational", lastSync: "1 minute ago", dataDirection: "Bidirectional", environment: "Production", health: 99.95, latency: "64 ms", description: "Customer payments, invoice settlement and reconciliation with Finance module.", scopes: ["Payments", "Refunds", "Settlements"], logs: [
    { time: "Today 10:44", event: "Settlement of ₹4.2L reconciled to ledger", level: "info" },
    { time: "Today 09:58", event: "12 invoices paid via UPI/RTGS", level: "info" },
  ] },
  { id: "int-erp", name: "ERP System", provider: "SAP", category: "Core Business", status: "Warning", apiStatus: "Degraded — elevated latency", lastSync: "6 hours ago", dataDirection: "Bidirectional", environment: "Production", health: 91.2, latency: "2.4 s", description: "Master data, purchase orders, GRN and financial posting sync with the enterprise ERP.", scopes: ["Masters", "PO", "GRN", "Ledger"], logs: [
    { time: "Today 04:40", event: "Sync job failed — gateway timeout (retry 3/5)", level: "error" },
    { time: "Today 05:10", event: "Partial sync resumed — 70% records", level: "warn" },
    { time: "Yesterday 23:00", event: "Nightly batch completed in 42 min", level: "info" },
  ] },
  { id: "int-ai", name: "AI Services", provider: "Z.ai", category: "Intelligence", status: "Connected", apiStatus: "Operational", lastSync: "Live", dataDirection: "Outbound", environment: "Production", health: 99.9, latency: "310 ms", description: "Governed AI capabilities — document summarization and insight generation (Phase-later modules).", scopes: ["Summarize", "Insights"], logs: [
    { time: "Today 10:20", event: "Insight job completed for Sales weekly review", level: "info" },
  ] },
  { id: "int-storage", name: "Cloud Storage", provider: "Amazon Web Services", category: "Infrastructure", status: "Connected", apiStatus: "Operational", lastSync: "Live", dataDirection: "Bidirectional", environment: "Production", health: 99.99, latency: "38 ms", description: "Encrypted object storage for documents, backups and attachments.", scopes: ["Objects", "Lifecycle", "Encryption"], logs: [
    { time: "Today 03:00", event: "Nightly backup — 128 GB, verified", level: "info" },
  ] },
  { id: "int-analytics", name: "Analytics (Data Warehouse)", provider: "Snowflake", category: "Analytics", status: "Configuration Required", apiStatus: "Awaiting warehouse credentials", lastSync: "Never", dataDirection: "Inbound", environment: "Staging", health: 0, latency: "—", description: "Enterprise data warehouse feeding Analytics dashboards and governed reporting.", scopes: ["Read warehouse"], logs: [
    { time: "28 Dec 2025", event: "Connection created — waiting for service account", level: "warn" },
  ] },
];

// ------------------------------------------------------------
// Enterprise navigation (Screen 12)
// ------------------------------------------------------------
export const navRoles = [
  { id: "administrator", label: "Administrator" },
  { id: "sales-exec", label: "Sales Executive" },
  { id: "hr-manager", label: "HR Manager" },
  { id: "finance-head", label: "Finance Head" },
  { id: "service-engineer", label: "Service Engineer" },
  { id: "employee", label: "Employee (Base)" },
];

export const navModules: NavModule[] = [
  { id: "nm-home", name: "Home", route: "/home", icon: "home", parent: null, allowedRoles: ["all"], status: "Active", visibility: "All Roles", description: "Company home — announcements, quick links and daily summary.", order: 1 },
  { id: "nm-workspace", name: "My Workspace", route: "/workspace", icon: "layout", parent: null, allowedRoles: ["all"], status: "Active", visibility: "All Roles", description: "Personal workspace — tasks, calendar, meetings and approvals.", order: 2 },
  { id: "nm-profile", name: "My Profile", route: "/workspace/profile", icon: "user", parent: "nm-workspace", allowedRoles: ["all"], status: "Active", visibility: "All Roles", description: "Personal and employment profile.", order: 1 },
  { id: "nm-tasks", name: "My Tasks", route: "/workspace/tasks", icon: "check", parent: "nm-workspace", allowedRoles: ["all"], status: "Active", visibility: "All Roles", description: "Assigned and created tasks.", order: 2 },
  { id: "nm-calendar", name: "My Calendar", route: "/workspace/calendar", icon: "calendar", parent: "nm-workspace", allowedRoles: ["all"], status: "Active", visibility: "All Roles", description: "Personal and team calendar.", order: 3 },
  { id: "nm-meetings", name: "My Meetings", route: "/workspace/meetings", icon: "video", parent: "nm-workspace", allowedRoles: ["all"], status: "Active", visibility: "All Roles", description: "Scheduled meetings and minutes.", order: 4 },
  { id: "nm-approvals", name: "My Approvals", route: "/workspace/approvals", icon: "check-circle", parent: "nm-workspace", allowedRoles: ["all"], status: "Active", visibility: "All Roles", description: "Pending approvals assigned to the user.", order: 5 },
  { id: "nm-documents", name: "My Documents", route: "/workspace/documents", icon: "folder", parent: "nm-workspace", allowedRoles: ["all"], status: "Active", visibility: "All Roles", description: "Personal documents and shared with me.", order: 6 },
  { id: "nm-sales", name: "Sales", route: "/sales", icon: "trending", parent: null, allowedRoles: ["all"], status: "Active", visibility: "Restricted", description: "CRM, leads, quotations and revenue operations.", order: 3 },
  { id: "nm-sales-dash", name: "Sales Dashboard", route: "/sales/dashboard", icon: "gauge", parent: "nm-sales", allowedRoles: ["all"], status: "Active", visibility: "All Roles", description: "Revenue, pipeline and target tracking.", order: 1 },
  { id: "nm-sales-leads", name: "Leads", route: "/sales/leads", icon: "users", parent: "nm-sales", allowedRoles: ["all"], status: "Active", visibility: "All Roles", description: "Lead capture, scoring and assignment.", order: 2 },
  { id: "nm-sales-customers", name: "Customers", route: "/sales/customers", icon: "building", parent: "nm-sales", allowedRoles: ["all"], status: "Active", visibility: "All Roles", description: "Customer 360 and account management.", order: 3 },
  { id: "nm-sales-quotes", name: "Quotations", route: "/sales/quotations", icon: "file-text", parent: "nm-sales", allowedRoles: ["all"], status: "Active", visibility: "All Roles", description: "Quotation builder and approvals.", order: 4 },
  { id: "nm-finance", name: "Finance", route: "/finance", icon: "wallet", parent: null, allowedRoles: ["administrator", "finance-head", "employee"], status: "Active", visibility: "Restricted", description: "Accounting, expenses, budgets and statutory compliance.", order: 4 },
  { id: "nm-finance-dash", name: "Finance Dashboard", route: "/finance/dashboard", icon: "gauge", parent: "nm-finance", allowedRoles: ["administrator", "finance-head"], status: "Active", visibility: "All Roles", description: "Cashflow, receivables and spend overview.", order: 1 },
  { id: "nm-finance-expenses", name: "Expenses", route: "/finance/expenses", icon: "receipt", parent: "nm-finance", allowedRoles: ["all"], status: "Active", visibility: "All Roles", description: "Expense claims and approvals.", order: 2 },
  { id: "nm-hr", name: "HR & People", route: "/hr", icon: "users", parent: null, allowedRoles: ["all"], status: "Active", visibility: "Restricted", description: "Employee lifecycle, attendance, payroll and engagement.", order: 5 },
  { id: "nm-hr-employees", name: "Employees", route: "/hr/employees", icon: "users", parent: "nm-hr", allowedRoles: ["all"], status: "Active", visibility: "All Roles", description: "Employee directory and records.", order: 1 },
  { id: "nm-hr-recruitment", name: "Recruitment", route: "/hr/recruitment", icon: "user-plus", parent: "nm-hr", allowedRoles: ["administrator", "hr-manager"], status: "Active", visibility: "All Roles", description: "Requisitions, candidates and offers.", order: 2 },
  { id: "nm-hr-payroll", name: "Payroll", route: "/hr/payroll", icon: "banknote", parent: "nm-hr", allowedRoles: ["administrator", "hr-manager", "finance-head"], status: "Active", visibility: "Restricted", description: "Payroll processing and payslips.", order: 3 },
  { id: "nm-inventory", name: "Inventory", route: "/inventory", icon: "package", parent: null, allowedRoles: ["all"], status: "Active", visibility: "Restricted", description: "Items, warehouses, stock and transfers.", order: 6 },
  { id: "nm-marketing", name: "Marketing", route: "/marketing", icon: "megaphone", parent: null, allowedRoles: ["all"], status: "Active", visibility: "Restricted", description: "Campaigns, content and lead generation.", order: 7 },
  { id: "nm-service", name: "Service", route: "/service", icon: "wrench", parent: null, allowedRoles: ["all"], status: "Active", visibility: "Restricted", description: "Tickets, SLA and field service.", order: 8 },
  { id: "nm-meetings-mod", name: "Meetings", route: "/meetings", icon: "video", parent: null, allowedRoles: ["all"], status: "Active", visibility: "All Roles", description: "Company-wide meeting rooms, scheduling and minutes.", order: 9 },
  { id: "nm-ai", name: "AI", route: "/ai", icon: "sparkles", parent: null, allowedRoles: ["all"], status: "Disabled", visibility: "Restricted", description: "Qubit AI assistant and governed AI capabilities (planned phase).", order: 10 },
  { id: "nm-analytics", name: "Analytics", route: "/analytics", icon: "bar-chart", parent: null, allowedRoles: ["all"], status: "Active", visibility: "Restricted", description: "Governed dashboards, reports and KPIs.", order: 11 },
  { id: "nm-documents-mod", name: "Documents", route: "/documents", icon: "folder", parent: null, allowedRoles: ["all"], status: "Active", visibility: "All Roles", description: "Enterprise document management and libraries.", order: 12 },
  { id: "nm-admin", name: "Administration", route: "/admin", icon: "settings", parent: null, allowedRoles: ["administrator"], status: "Active", visibility: "Restricted", description: "Organization, users, roles, audit and platform settings.", order: 13 },
];

// ------------------------------------------------------------
// Top-bar notifications (shell)
// ------------------------------------------------------------
export interface ShellNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  module: string;
}

export const shellNotifications: ShellNotification[] = [
  { id: "n1", title: "Expense approval pending", body: "₹34,200 travel expense from Meera Iyer is awaiting your approval (SLA 2 days).", time: "12 min ago", unread: true, module: "Finance" },
  { id: "n2", title: "ERP sync degraded", body: "ERP System last successful sync was 6 hours ago. Integration health: Warning.", time: "1 h ago", unread: true, module: "Integrations" },
  { id: "n3", title: "New role requests review", body: "3 role change requests from HR & People need governance review.", time: "3 h ago", unread: true, module: "Enterprise" },
  { id: "n4", title: "Quotation approved", body: "Quotation #QT-2841 (Atlas Retail) approved by Sales Head.", time: "Yesterday", unread: false, module: "Sales" },
  { id: "n5", title: "Data ownership review due", body: "Document Data governance review is due since 2 Sep 2025.", time: "Yesterday", unread: false, module: "Enterprise" },
];

export const formatCount = (n: number): string => n.toLocaleString("en-IN");
