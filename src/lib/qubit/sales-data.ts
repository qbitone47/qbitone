// ============================================================
// Qubit One — Sales Operating System (Phase 6)
// ONE canonical data model for the operational Sales module.
// ============================================================
// The CEO Command Center (Phase 5) reads its aggregate SALES block
// from executive-data.ts. Phase 6 is the OPERATIONAL system behind
// it: leads, contacts, accounts, opportunities, follow-ups,
// meetings, quotations, orders, activities, WhatsApp conversations,
// visits, travel and expenses — fixture scale, enterprise shape.
//
// Facts stay consistent with the executive block where they meet:
// Q3 FY27 target ₹5.35 Cr, bookings-to-date ₹2.41 Cr, Zenith renewal
// (Meera), Meridian/NRC slips, Everest Textiles win (Arvind).
// Money conventions: pipeline/opportunity values in ₹ Cr (numbers,
// formatted with formatINR); transactional documents (quotations,
// orders, expenses) in whole rupees.
// ============================================================

// ---------- period ----------
export const SALES_PERIOD = {
  label: "Q3 FY27",
  window: "1 Oct – 31 Dec 2026",
  asOfLabel: "Friday, 13 November 2026 · 09:42 IST",
} as const;

const H = 3_600_000;
const D = 24 * H;
/** demo clock anchor: today ~09:40 IST, so "overdue / due today / upcoming" stays meaningful */
export const SALES_NOW = Date.now() - (Date.now() % (15 * 60_000));
const today0 = (d = 0) => SALES_NOW - ((SALES_NOW + 5.5 * H) % D) + d * D; // ~00:00 local, offset by d days

// ============================================================
// Types
// ============================================================

export type LeadStatus = "New" | "Working" | "Qualified" | "Unqualified" | "Converted";
export type LeadPriority = "Hot" | "Warm" | "Cold";
export type OpportunityStage =
  | "New"
  | "Qualification"
  | "Discovery"
  | "Proposal"
  | "Negotiation"
  | "Contracting"
  | "Won"
  | "Lost";
export type QuotationStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Sent"
  | "Viewed"
  | "Negotiation"
  | "Accepted"
  | "Rejected"
  | "Expired"
  | "Cancelled";
export type OrderStatus = "Confirmed" | "In Fulfillment" | "Dispatched" | "Delivered" | "Closed" | "Cancelled";
export type PaymentState = "Unpaid" | "Partially Paid" | "Paid";
export type FulfillmentState = "Pending" | "Packed" | "Dispatched" | "Delivered";
export type ExpenseStatus = "Draft" | "Submitted" | "Approved" | "Reimbursed" | "Rejected";
export type VisitStatus = "Planned" | "In Progress" | "Completed" | "Cancelled";
export type TravelStatus = "Planned" | "Ongoing" | "Completed" | "Cancelled";
export type WaStatus = "Open" | "Pending" | "Resolved";
export type FollowUpState = "Overdue" | "Due Today" | "Upcoming" | "Completed" | "Cancelled";
export type MeetingStatus = "Scheduled" | "Completed" | "Cancelled";
export type ActivityType =
  | "Call"
  | "Email"
  | "WhatsApp"
  | "Meeting"
  | "Visit"
  | "Note"
  | "Task"
  | "Follow-up"
  | "Quotation"
  | "Order"
  | "Stage change"
  | "Status change"
  | "Lead assigned"
  | "Conversion";

export interface SalesAccount {
  id: string;
  name: string;
  industry: string;
  location: string;
  region: string;
  ownerId: string;
  status: "Customer" | "Prospect" | "Churned";
  customerSince?: string;
  annualValueCr?: number;
  phone: string;
  website: string;
  employees: number;
}

export interface SalesContact {
  id: string;
  name: string;
  designation: string;
  accountId: string;
  phone: string;
  email: string;
  ownerId: string;
  /** communication consent — WhatsApp/email/call each independently granted (spec §92/§77) */
  consent: { whatsapp: boolean; email: boolean; call: boolean };
  preferred: "WhatsApp" | "Email" | "Call";
}

export interface SalesLead {
  id: string;
  name: string;
  company: string;
  contactPerson: string;
  phone: string;
  email: string;
  source: string;
  industry: string;
  location: string;
  ownerId: string;
  status: LeadStatus;
  priority: LeadPriority;
  score: number; // 0–100
  estimatedValueCr: number;
  expectedClose?: string;
  nextFollowUpAt?: number;
  createdAt: number;
  lastActivityAt: number;
  tags: string[];
  notes?: string;
  convertedTo?: { contactId: string; accountId: string; opportunityId?: string; at: number };
  disqualifiedReason?: string;
}

export interface SalesOpportunity {
  id: string;
  name: string;
  accountId: string;
  contactId: string;
  ownerId: string;
  stage: OpportunityStage;
  probability: number; // 0–100
  valueCr: number;
  expectedClose: string;
  source: string;
  products: string[];
  competitors?: string[];
  nextAction?: string;
  nextFollowUpAt?: number;
  quotationId?: string;
  riskNote?: string;
  slippedFrom?: string;
  createdAt: number;
  lastStageChangeAt: number;
  lossReason?: string;
  closedAt?: number;
}

export interface SalesFollowUp {
  id: string;
  type: "Call" | "Email" | "WhatsApp" | "Meeting" | "Visit" | "Send Quote";
  subject: string;
  ownerId: string;
  leadId?: string;
  accountId?: string;
  contactId?: string;
  opportunityId?: string;
  dueAt: number;
  state: FollowUpState;
  priority: "High" | "Medium" | "Low";
  lastInteractionAt?: number;
  outcome?: string;
  completedAt?: number;
}

export interface SalesMeeting {
  id: string;
  title: string;
  accountId: string;
  contactId?: string;
  opportunityId?: string;
  ownerId: string;
  startAt: number;
  durationMin: number;
  location: string;
  isLink?: boolean;
  status: MeetingStatus;
  agenda?: string;
  notes?: string;
}

export interface QuoteItem {
  id: string;
  productId: string;
  name: string;
  qty: number;
  unitPrice: number; // ₹
  discountPct: number;
}

export interface SalesQuotation {
  id: string;
  number: string; // QTN-2026-041
  accountId: string;
  contactId?: string;
  opportunityId?: string;
  ownerId: string;
  status: QuotationStatus;
  createdAt: number;
  validUntil: string;
  items: QuoteItem[];
  taxPct: number;
  paymentTerms: string;
  deliveryTerms: string;
  notes?: string;
  approvalId?: string;
  approvalNote?: string;
  sentAt?: number;
  viewedAt?: number;
  decidedAt?: number;
  versions: { at: number; by: string; note: string }[];
}

export interface SalesOrder {
  id: string;
  number: string; // SO-2026-038
  accountId: string;
  quotationId?: string;
  opportunityId?: string;
  ownerId: string;
  status: OrderStatus;
  payment: PaymentState;
  fulfillment: FulfillmentState;
  items: QuoteItem[];
  total: number; // ₹
  createdAt: number;
  invoiceId?: string;
  dispatchId?: string;
  deliveryBy?: string;
  cancelledReason?: string;
}

export interface SalesActivity {
  id: string;
  at: number;
  type: ActivityType;
  actorId: string;
  entity: { kind: "lead" | "account" | "contact" | "opportunity" | "quotation" | "order" | "visit"; id: string };
  summary: string;
  outcome?: string;
  source?: string;
}

export interface WaMessage {
  id: string;
  at: number;
  direction: "in" | "out";
  body: string;
  template?: string;
  state?: "sent" | "delivered" | "read";
}

export interface WaConversation {
  id: string;
  waNumber: string;
  contactName: string;
  accountId?: string;
  leadId?: string;
  opportunityId?: string;
  ownerId: string;
  status: WaStatus;
  unread: number;
  lastMessageAt: number;
  messages: WaMessage[];
}

export interface SalesVisit {
  id: string;
  accountId: string;
  contactId?: string;
  ownerId: string;
  opportunityId?: string;
  plannedAt: number;
  durationMin: number;
  location: string;
  purpose: string;
  status: VisitStatus;
  checklist: { label: string; done: boolean }[];
  notes?: string;
  outcome?: string;
  nextAction?: string;
  evidence?: string[];
  checkedInAt?: number;
  completedAt?: number;
}

export interface TravelPlan {
  id: string;
  ownerId: string;
  destination: string;
  purpose: string;
  startAt: number;
  endAt: number;
  estimatedCost: number; // ₹
  status: TravelStatus;
  visitIds: string[];
  notes?: string;
}

export interface SalesExpense {
  id: string;
  employeeId: string;
  date: number;
  category: "Travel" | "Fuel" | "Hotel" | "Client Entertainment" | "Communication" | "Other";
  amount: number; // ₹
  description: string;
  opportunityId?: string;
  visitId?: string;
  travelId?: string;
  status: ExpenseStatus;
  receiptName?: string;
  submittedAt?: number;
  decidedAt?: number;
  decidedBy?: string;
  note?: string;
}

export interface TeamDef {
  id: string;
  name: string;
  region: string;
  headId: string;
  memberIds: string[];
}

export interface TargetRow {
  id: string;
  kind: "employee" | "team";
  refId: string;
  label: string;
  quotaCr: number;
  achievedCr: number;
  pipelineCr: number;
  forecastCr: number;
}

export interface SalesProduct {
  id: string;
  name: string;
  category: string;
  unitPrice: number; // ₹
  unit: string;
}

export interface AssignmentRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  active: boolean;
}

export interface ApprovalRuleDef {
  id: string;
  trigger: string;
  rule: string;
  approver: string;
  active: boolean;
}

export interface SalesSettings {
  stages: { id: string; name: OpportunityStage; probability: number; requiresQuotation: boolean }[];
  leadSources: string[];
  lossReasons: string[];
  activityTypes: string[];
  assignmentRules: AssignmentRule[];
  approvalRules: ApprovalRuleDef[];
  quotaTotalCr: number;
}

// ============================================================
// People & teams (reuses the enterprise employee registry ids)
// ============================================================

export const SALES_TEAM_MEMBERS = ["rahul", "pankaj", "meera", "vikrams", "rohitv", "arvind"] as const;

export const SALES_TEAMS: TeamDef[] = [
  { id: "team-west", name: "West Enterprise", region: "West", headId: "meera", memberIds: ["meera", "rohitv"] },
  { id: "team-south", name: "South Enterprise", region: "South", headId: "meera", memberIds: ["meera"] },
  { id: "team-north", name: "North Key Accounts", region: "North", headId: "vikrams", memberIds: ["vikrams"] },
  { id: "team-east", name: "Growth East", region: "East", headId: "pankaj", memberIds: ["pankaj", "arvind"] },
];

export const SALES_OWNERS = [
  { id: "pankaj", name: "Pankaj Sharma", title: "Account Manager" },
  { id: "meera", name: "Meera Iyer", title: "Senior Account Manager" },
  { id: "vikrams", name: "Vikram Singh", title: "Key Account Manager" },
  { id: "rohitv", name: "Rohit Verma", title: "Sales Executive" },
  { id: "arvind", name: "Arvind Swamy", title: "Field Sales Executive" },
  { id: "sagar", name: "Sagar Singh", title: "Chief Executive Officer" },
] as const;

// ============================================================
// Accounts & contacts
// ============================================================

export const SALES_ACCOUNTS: SalesAccount[] = [
  // — New / Qualification pipeline accounts —
  { id: "acc-galaxy", name: "Galaxy Foods", industry: "Food Processing", location: "Indore", region: "West", ownerId: "arvind", status: "Prospect", phone: "+91 73 1400 2200", website: "galaxyfoods.example", employees: 480 },
  { id: "acc-trident", name: "Trident Motors", industry: "Automotive", location: "Chennai", region: "South", ownerId: "pankaj", status: "Prospect", phone: "+91 44 2810 6600", website: "tridentmotors.example", employees: 3100 },
  { id: "acc-acme", name: "Acme Manufacturing", industry: "Manufacturing", location: "Pune", region: "West", ownerId: "pankaj", status: "Customer", customerSince: "Mar 2024", annualValueCr: 0.64, phone: "+91 20 6720 1100", website: "acmemfg.in", employees: 1200 },
  { id: "acc-zenith", name: "Zenith Industries", industry: "Industrial Equipment", location: "Bengaluru", region: "South", ownerId: "meera", status: "Customer", customerSince: "Jul 2023", annualValueCr: 0.58, phone: "+91 80 4120 7800", website: "zenithind.com", employees: 860 },
  { id: "acc-meridian", name: "Meridian Trend", industry: "Media & Analytics", location: "Delhi NCR", region: "North", ownerId: "vikrams", status: "Customer", customerSince: "Jan 2025", annualValueCr: 0.42, phone: "+91 11 4600 2300", website: "meridiantrend.io", employees: 410 },
  { id: "acc-nrc", name: "National Retail Co", industry: "Retail", location: "Mumbai", region: "West", ownerId: "pankaj", status: "Customer", customerSince: "Sep 2022", annualValueCr: 0.71, phone: "+91 22 6780 4500", website: "nationalretail.co.in", employees: 2400 },
  { id: "acc-orbit", name: "Orbit Retail", industry: "Retail", location: "Gurugram", region: "North", ownerId: "vikrams", status: "Customer", customerSince: "Feb 2025", annualValueCr: 0.22, phone: "+91 12 4480 9100", website: "orbitretail.in", employees: 700 },
  { id: "acc-halcyon", name: "Halcyon Logistics", industry: "Logistics", location: "Mumbai", region: "West", ownerId: "rohitv", status: "Customer", customerSince: "Aug 2025", annualValueCr: 0.18, phone: "+91 22 6900 3400", website: "halcyonlog.com", employees: 320 },
  { id: "acc-indus", name: "Indus Bank", industry: "Banking", location: "Jaipur", region: "North", ownerId: "arvind", status: "Prospect", phone: "+91 14 1270 8800", website: "indusbank.example", employees: 5200 },
  { id: "acc-spire", name: "Spire Health", industry: "Healthcare", location: "Hyderabad", region: "South", ownerId: "rohitv", status: "Prospect", phone: "+91 40 2210 6700", website: "spirehealth.example", employees: 950 },
  { id: "acc-everest", name: "Everest Textiles", industry: "Textiles", location: "Surat", region: "West", ownerId: "arvind", status: "Customer", customerSince: "Oct 2026", annualValueCr: 0.22, phone: "+91 26 1230 5500", website: "everesttextiles.example", employees: 1500 },
  { id: "acc-bluewave", name: "Bluewave Media", industry: "Media", location: "Mumbai", region: "West", ownerId: "sagar", status: "Prospect", phone: "+91 22 4000 1900", website: "bluewave.example", employees: 260 },
];

export const SALES_CONTACTS: SalesContact[] = [
  { id: "ct-galaxy", name: "Kiran Zaveri", designation: "Promoter — Operations", accountId: "acc-galaxy", phone: "+91 94250 41001", email: "kiran@galaxyfoods.example", ownerId: "arvind", consent: { whatsapp: true, email: true, call: true }, preferred: "Call" },
  { id: "ct-trident", name: "Shruti Raman", designation: "GM — Sales Ops", accountId: "acc-trident", phone: "+91 98400 42001", email: "shruti.raman@tridentmotors.example", ownerId: "pankaj", consent: { whatsapp: true, email: true, call: true }, preferred: "Email" },
  { id: "ct-rakesh", name: "Rakesh Khanna", designation: "Head of IT", accountId: "acc-acme", phone: "+91 98210 31001", email: "rakesh.khanna@acmemfg.in", ownerId: "pankaj", consent: { whatsapp: true, email: true, call: true }, preferred: "Email" },
  { id: "ct-priyan", name: "Priya Nair", designation: "Procurement Lead", accountId: "acc-acme", phone: "+91 98210 31002", email: "priya.nair@acmemfg.in", ownerId: "pankaj", consent: { whatsapp: true, email: true, call: false }, preferred: "WhatsApp" },
  { id: "ct-suresh", name: "Suresh Babu", designation: "VP Operations", accountId: "acc-zenith", phone: "+91 98450 32001", email: "suresh.babu@zenithind.com", ownerId: "meera", consent: { whatsapp: true, email: true, call: true }, preferred: "Call" },
  { id: "ct-anita", name: "Anita Desai", designation: "CIO", accountId: "acc-meridian", phone: "+91 98110 33001", email: "anita.desai@meridiantrend.io", ownerId: "vikrams", consent: { whatsapp: false, email: true, call: true }, preferred: "Email" },
  { id: "ct-manav", name: "Manav Sethi", designation: "Director — Stores", accountId: "acc-nrc", phone: "+91 98200 34001", email: "manav.sethi@nationalretail.co.in", ownerId: "pankaj", consent: { whatsapp: true, email: true, call: true }, preferred: "WhatsApp" },
  { id: "ct-divya", name: "Divya Kapoor", designation: "Head of Digital", accountId: "acc-orbit", phone: "+91 98180 35001", email: "divya.kapoor@orbitretail.in", ownerId: "vikrams", consent: { whatsapp: true, email: true, call: true }, preferred: "Email" },
  { id: "ct-farhan", name: "Farhan Ali", designation: "Operations Manager", accountId: "acc-halcyon", phone: "+91 98920 36001", email: "farhan.ali@halcyonlog.com", ownerId: "rohitv", consent: { whatsapp: true, email: false, call: true }, preferred: "WhatsApp" },
  { id: "ct-latha", name: "Latha Krishnan", designation: "Chief Manager — IT", accountId: "acc-indus", phone: "+91 94140 37001", email: "latha.krishnan@indusbank.example", ownerId: "arvind", consent: { whatsapp: false, email: true, call: true }, preferred: "Email" },
  { id: "ct-gopal", name: "Dr. Gopal Rao", designation: "Medical Director", accountId: "acc-spire", phone: "+91 94400 38001", email: "gopal.rao@spirehealth.example", ownerId: "rohitv", consent: { whatsapp: true, email: true, call: true }, preferred: "Call" },
  { id: "ct-hitesh", name: "Hitesh Patel", designation: "Managing Director", accountId: "acc-everest", phone: "+91 94260 39001", email: "hitesh@everesttextiles.example", ownerId: "arvind", consent: { whatsapp: true, email: true, call: true }, preferred: "WhatsApp" },
  { id: "ct-renae", name: "Rena Fernandes", designation: "Head of Content", accountId: "acc-bluewave", phone: "+91 99200 40001", email: "rena@bluewave.example", ownerId: "sagar", consent: { whatsapp: true, email: true, call: false }, preferred: "Email" },
];

// ============================================================
// Product catalog (quotation builder pulls from here — never a
// duplicate product master; inventory remains the source of truth)
// ============================================================

export const SALES_PRODUCTS: SalesProduct[] = [
  { id: "prd-erp", name: "Qubit ERP License", category: "Software", unitPrice: 450000, unit: "per user / year" },
  { id: "prd-impl", name: "Implementation Services", category: "Services", unitPrice: 1800000, unit: "fixed scope" },
  { id: "prd-cloud", name: "Managed Cloud Hosting", category: "Services", unitPrice: 96000, unit: "per month" },
  { id: "prd-comp", name: "Compliance Module", category: "Software", unitPrice: 620000, unit: "per site / year" },
  { id: "prd-support", name: "Premium Support", category: "Services", unitPrice: 380000, unit: "per year" },
  { id: "prd-training", name: "Training Program", category: "Services", unitPrice: 150000, unit: "per session" },
  { id: "prd-integration", name: "Integration Hub Connector", category: "Software", unitPrice: 240000, unit: "each / year" },
  { id: "prd-field", name: "Field Mobility App", category: "Software", unitPrice: 90000, unit: "per user / year" },
];

// ============================================================
// Opportunities — consistent with the executive SALES block
// ============================================================

const daysAgo = (d: number) => SALES_NOW - d * D;

export const SALES_OPPORTUNITIES: SalesOpportunity[] = [
  { id: "opp-acme", name: "Platform expansion — Phase 2", accountId: "acc-acme", contactId: "ct-rakesh", ownerId: "pankaj", stage: "Negotiation", probability: 75, valueCr: 0.84, expectedClose: "15 Dec 2026", source: "Expansion", products: ["Qubit ERP License", "Managed Cloud Hosting"], competitors: ["Legacy ERP Inc"], nextAction: "Legal review call with Rakesh — 18 Nov", nextFollowUpAt: today0(2) + 10 * H, createdAt: daysAgo(41), lastStageChangeAt: daysAgo(6) },
  { id: "opp-zenith", name: "Renewal + automation add-on", accountId: "acc-zenith", contactId: "ct-suresh", ownerId: "meera", stage: "Contracting", probability: 85, valueCr: 0.62, expectedClose: "8 Dec 2026", source: "Renewal", products: ["Qubit ERP License", "Integration Hub Connector"], quotationId: "qtn-041", nextAction: "Countersignature from Zenith procurement", nextFollowUpAt: today0(1) + 8 * H, createdAt: daysAgo(28), lastStageChangeAt: daysAgo(3) },
  { id: "opp-meridian", name: "Enterprise platform rollout", accountId: "acc-meridian", contactId: "ct-anita", ownerId: "vikrams", stage: "Negotiation", probability: 45, valueCr: 0.52, expectedClose: "18 Dec 2026", source: "Inbound", products: ["Qubit ERP License", "Implementation Services"], quotationId: "qtn-044", riskNote: "Stalled at Negotiation for 21 days — legal review of data-processing terms.", slippedFrom: "October 2026", nextAction: "Chase legal redlines on DPA", nextFollowUpAt: today0() + 14 * H, createdAt: daysAgo(63), lastStageChangeAt: daysAgo(21) },
  { id: "opp-nrc", name: "Full-suite rollout", accountId: "acc-nrc", contactId: "ct-manav", ownerId: "pankaj", stage: "Contracting", probability: 55, valueCr: 0.34, expectedClose: "21 Dec 2026", source: "Referral", products: ["Qubit ERP License", "Field Mobility App"], quotationId: "qtn-042", riskNote: "Procurement board meets 17 Dec — signing risk if agenda slips again.", slippedFrom: "October 2026", nextAction: "Confirm board agenda slot with Manav", nextFollowUpAt: today0(2) + 15 * H, createdAt: daysAgo(57), lastStageChangeAt: daysAgo(9) },
  { id: "opp-orbit", name: "Digital services suite", accountId: "acc-orbit", contactId: "ct-divya", ownerId: "vikrams", stage: "Proposal", probability: 55, valueCr: 0.48, expectedClose: "22 Dec 2026", source: "Marketing Campaign", products: ["Compliance Module", "Premium Support"], quotationId: "qtn-043", nextAction: "Present revised commercial structure", nextFollowUpAt: today0(3) + 11 * H, createdAt: daysAgo(35), lastStageChangeAt: daysAgo(12) },
  { id: "opp-halcyon", name: "Managed services contract", accountId: "acc-halcyon", contactId: "ct-farhan", ownerId: "rohitv", stage: "Proposal", probability: 50, valueCr: 0.35, expectedClose: "18 Dec 2026", source: "WhatsApp Campaign", products: ["Managed Cloud Hosting", "Premium Support"], nextAction: "Send revised quotation after ops review", nextFollowUpAt: today0(1) + 16 * H, createdAt: daysAgo(24), lastStageChangeAt: daysAgo(8) },
  { id: "opp-spire", name: "Pilot conversion — Phase 1", accountId: "acc-spire", contactId: "ct-gopal", ownerId: "rohitv", stage: "Proposal", probability: 30, valueCr: 0.18, expectedClose: "30 Dec 2026", source: "Trade Show", products: ["Compliance Module"], riskNote: "Executive sponsor changed on 4 Nov — re-engagement plan in progress.", nextAction: "Re-brief the new sponsor on pilot outcomes", nextFollowUpAt: today0(4) + 10 * H, createdAt: daysAgo(48), lastStageChangeAt: daysAgo(15) },
  { id: "opp-indus", name: "Compliance module pilot", accountId: "acc-indus", contactId: "ct-latha", ownerId: "arvind", stage: "Discovery", probability: 25, valueCr: 0.29, expectedClose: "28 Feb 2027", source: "Partner", products: ["Compliance Module"], competitors: ["RegTech One"], nextAction: "Security questionnaire walkthrough", nextFollowUpAt: today0(5) + 9 * H, createdAt: daysAgo(19), lastStageChangeAt: daysAgo(11) },
  { id: "opp-everest", name: "ERP rollout — Phase 1", accountId: "acc-everest", contactId: "ct-hitesh", ownerId: "arvind", stage: "Won", probability: 100, valueCr: 0.22, expectedClose: "28 Oct 2026", source: "Field Visit", products: ["Qubit ERP License", "Implementation Services"], quotationId: "qtn-037", createdAt: daysAgo(96), lastStageChangeAt: daysAgo(16), closedAt: daysAgo(16) },
  { id: "opp-bluewave", name: "Strategic partnership pilot", accountId: "acc-bluewave", contactId: "ct-renae", ownerId: "sagar", stage: "Discovery", probability: 20, valueCr: 0.15, expectedClose: "31 Jan 2027", source: "Executive network", products: ["Managed Cloud Hosting"], nextAction: "Share pilot structure with Rena", nextFollowUpAt: today0(6) + 11 * H, createdAt: daysAgo(14), lastStageChangeAt: daysAgo(14) },
  { id: "opp-galaxy", name: "Inventory & dispatch suite", accountId: "acc-galaxy", ownerId: "arvind", contactId: "ct-galaxy", stage: "Qualification", probability: 20, valueCr: 0.26, expectedClose: "15 Jan 2027", source: "Website", products: ["Qubit ERP License"], nextAction: "Qualify budget with promoter office", nextFollowUpAt: today0(2) + 12 * H, createdAt: daysAgo(9), lastStageChangeAt: daysAgo(5) },
  { id: "opp-trident", name: "CRM platform evaluation", accountId: "acc-trident", ownerId: "pankaj", contactId: "ct-trident", stage: "New", probability: 10, valueCr: 0.38, expectedClose: "28 Feb 2027", source: "Trade Show", products: ["Qubit ERP License", "Field Mobility App"], nextAction: "First discovery call scheduling", nextFollowUpAt: today0(1) + 13 * H, createdAt: daysAgo(4), lastStageChangeAt: daysAgo(4) },

  // IAM demo identity record — demo.sales' own opportunity.
  { id: "opp-kepler", name: "Dispatch automation — 40 units", accountId: "acc-spire", ownerId: "demo.sales", contactId: "ct-gopal", stage: "Proposal", probability: 60, valueCr: 0.24, expectedClose: "18 Dec 2026", source: "Referral", products: ["Qubit ERP License", "Managed Cloud Hosting"], nextAction: "Kepler pricing follow-up call", nextFollowUpAt: today0() + 15 * H, createdAt: daysAgo(9), lastStageChangeAt: daysAgo(2) },
];

// ============================================================
// Leads
// ============================================================

export const SALES_LEADS: SalesLead[] = [
  { id: "lead-101", name: "Sunrise Packaging", company: "Sunrise Packaging Pvt Ltd", contactPerson: "Deepak Shah", phone: "+91 98200 51001", email: "deepak@sunrisepack.example", source: "Website", industry: "Packaging", location: "Ahmedabad", ownerId: "rohitv", status: "Working", priority: "Hot", score: 82, estimatedValueCr: 0.14, expectedClose: "20 Dec 2026", nextFollowUpAt: today0() + 12 * H, createdAt: daysAgo(6), lastActivityAt: daysAgo(1), tags: ["inbound", "budget-confirmed"], notes: "Wants dispatch automation for 3 plants before year end." },
  { id: "lead-102", name: "Meridian Trend — data team", company: "Meridian Trend", contactPerson: "Anita Desai", phone: "+91 98110 33001", email: "anita.desai@meridiantrend.io", source: "Referral", industry: "Media & Analytics", location: "Delhi NCR", ownerId: "vikrams", status: "Qualified", priority: "Hot", score: 91, estimatedValueCr: 0.52, expectedClose: "18 Dec 2026", nextFollowUpAt: today0() + 14 * H, createdAt: daysAgo(30), lastActivityAt: daysAgo(2), tags: ["expansion", "enterprise"], notes: "Qualified for the platform rollout — linked to opportunity." },
  { id: "lead-103", name: "Kaveri Agro", company: "Kaveri Agro Industries", contactPerson: "Srinivas Rao", phone: "+91 94400 52001", email: "srinivas@kaveriagro.example", source: "Trade Show", industry: "Agro Processing", location: "Vijayawada", ownerId: "arvind", status: "New", priority: "Warm", score: 64, estimatedValueCr: 0.09, expectedClose: "31 Jan 2027", nextFollowUpAt: today0(1) + 10 * H, createdAt: daysAgo(2), lastActivityAt: daysAgo(2), tags: ["trade-show", "south"] },
  { id: "lead-104", name: "Vayu Renewables", company: "Vayu Renewables Ltd", contactPerson: "Ishaan Malhotra", phone: "+91 98100 53001", email: "ishaan@vayurenew.example", source: "Marketing Campaign", industry: "Energy", location: "Pune", ownerId: "sagar", status: "Working", priority: "Warm", score: 71, estimatedValueCr: 0.21, expectedClose: "15 Jan 2027", nextFollowUpAt: today0(2) + 9 * H, createdAt: daysAgo(8), lastActivityAt: daysAgo(3), tags: ["campaign-q3", "compliance"] },
  { id: "lead-105", name: "Silverline Clinics", company: "Silverline Clinics Group", contactPerson: "Dr. Meenal Joshi", phone: "+91 98670 54001", email: "meenal@silverline.example", source: "Inbound Call", industry: "Healthcare", location: "Nagpur", ownerId: "rohitv", status: "New", priority: "Cold", score: 38, estimatedValueCr: 0.06, nextFollowUpAt: today0(4) + 11 * H, createdAt: daysAgo(3), lastActivityAt: daysAgo(3), tags: ["healthcare"] },
  { id: "lead-106", name: "Bhavani Steel", company: "Bhavani Steel Works", contactPerson: "Ravi Kiran", phone: "+91 94900 55001", email: "ravi@bhavanisteel.example", source: "Partner", industry: "Metals", location: "Vizag", ownerId: "arvind", status: "Qualified", priority: "Hot", score: 88, estimatedValueCr: 0.18, expectedClose: "10 Jan 2027", nextFollowUpAt: today0(1) + 15 * H, createdAt: daysAgo(11), lastActivityAt: daysAgo(1), tags: ["partner-lead", "east-coast"] },
  { id: "lead-107", name: "Prism Interiors", company: "Prism Interiors Studio", contactPerson: "Nandita Bose", phone: "+91 98300 56001", email: "nandita@prisminteriors.example", source: "WhatsApp Campaign", industry: "Design Services", location: "Kolkata", ownerId: "pankaj", status: "Working", priority: "Warm", score: 59, estimatedValueCr: 0.04, nextFollowUpAt: today0(3) + 10 * H, createdAt: daysAgo(12), lastActivityAt: daysAgo(4), tags: ["whatsapp-campaign"] },
  { id: "lead-108", name: "Orbit Retail — analytics", company: "Orbit Retail", contactPerson: "Divya Kapoor", phone: "+91 98180 35001", email: "divya.kapoor@orbitretail.in", source: "Referral", industry: "Retail", location: "Gurugram", ownerId: "vikrams", status: "Converted", priority: "Hot", score: 95, estimatedValueCr: 0.48, nextFollowUpAt: undefined, createdAt: daysAgo(40), lastActivityAt: daysAgo(12), tags: ["converted"], convertedTo: { contactId: "ct-divya", accountId: "acc-orbit", opportunityId: "opp-orbit", at: daysAgo(33) } },
  { id: "lead-109", name: "Everest Textiles", company: "Everest Textiles", contactPerson: "Hitesh Patel", phone: "+91 94260 39001", email: "hitesh@everesttextiles.example", source: "Field Visit", industry: "Textiles", location: "Surat", ownerId: "arvind", status: "Converted", priority: "Hot", score: 92, estimatedValueCr: 0.22, createdAt: daysAgo(95), lastActivityAt: daysAgo(16), tags: ["converted", "won"], convertedTo: { contactId: "ct-hitesh", accountId: "acc-everest", opportunityId: "opp-everest", at: daysAgo(90) } },
  { id: "lead-110", name: "Falcon Freight", company: "Falcon Freightways", contactPerson: "Imran Sheikh", phone: "+91 98900 57001", email: "imran@falonfreight.example", source: "Website", industry: "Logistics", location: "Bhopal", ownerId: "rohitv", status: "Unqualified", priority: "Cold", score: 21, estimatedValueCr: 0.02, createdAt: daysAgo(16), lastActivityAt: daysAgo(9), tags: ["disqualified"], disqualifiedReason: "No budget cycle until FY28 — revisit next year." },
  { id: "lead-111", name: "Nimbus Pharma", company: "Nimbus Pharmaceuticals", contactPerson: "Ketan Mehta", phone: "+91 98240 58001", email: "ketan@nimbuspharma.example", source: "Website", industry: "Pharmaceuticals", location: "Ahmedabad", ownerId: "meera", status: "Working", priority: "Hot", score: 79, estimatedValueCr: 0.31, expectedClose: "15 Jan 2027", nextFollowUpAt: today0(2) + 12 * H, createdAt: daysAgo(7), lastActivityAt: daysAgo(1), tags: ["inbound", "quality-compliance"] },
  { id: "lead-112", name: "Atlas Components", company: "Atlas Components Ltd", contactPerson: "Joydeep Sen", phone: "+91 98310 59001", email: "joydeep@atlascomp.example", source: "Referral", industry: "Auto Components", location: "Pithampur", ownerId: "vikrams", status: "Qualified", priority: "Warm", score: 74, estimatedValueCr: 0.09, expectedClose: "20 Dec 2026", nextFollowUpAt: today0(3) + 14 * H, createdAt: daysAgo(18), lastActivityAt: daysAgo(5), tags: ["amc", "renewal"] },
  { id: "lead-113", name: "Nova Learning", company: "Nova Learning Systems", contactPerson: "Aditi Rao", phone: "+91 99400 60001", email: "aditi@novalearning.example", source: "Marketing Campaign", industry: "EdTech", location: "Bengaluru", ownerId: "meera", status: "New", priority: "Cold", score: 42, estimatedValueCr: 0.05, nextFollowUpAt: today0(5) + 10 * H, createdAt: daysAgo(1), lastActivityAt: daysAgo(1), tags: ["campaign-q3"] },
  { id: "lead-114", name: "Trident Motors — CRM", company: "Trident Motors", contactPerson: "Shruti Raman", phone: "+91 98400 42001", email: "shruti.raman@tridentmotors.example", source: "Trade Show", industry: "Automotive", location: "Chennai", ownerId: "pankaj", status: "Converted", priority: "Hot", score: 81, estimatedValueCr: 0.38, createdAt: daysAgo(5), lastActivityAt: daysAgo(2), tags: ["converted"], convertedTo: { contactId: "ct-trident", accountId: "acc-trident", opportunityId: "opp-trident", at: daysAgo(3) } },

  // IAM demo identity records — demo.sales owns a small personal book of
  // business so the own-scope boundary shows a genuinely personal pipeline.
  { id: "lead-dem-1", name: "Kepler Industries", company: "Kepler Industries Ltd", contactPerson: "Manoj Bhatt", phone: "+91 98211 71001", email: "manoj@keplerind.example", source: "Referral", industry: "Manufacturing", location: "Pune", ownerId: "demo.sales", status: "Working", priority: "Hot", score: 86, estimatedValueCr: 0.24, expectedClose: "18 Dec 2026", nextFollowUpAt: today0() + 15 * H, createdAt: daysAgo(9), lastActivityAt: daysAgo(1), tags: ["demo-book", "pricing-revision"], notes: "Revised 40-unit pricing shared — decision expected this week." },
  { id: "lead-dem-2", name: "Nova Retail", company: "Nova Retail Chain", contactPerson: "Preethi Menon", phone: "+91 98211 71002", email: "preethi@novaretail.example", source: "Website", industry: "Retail", location: "Kochi", ownerId: "demo.sales", status: "Qualified", priority: "Warm", score: 68, estimatedValueCr: 0.12, expectedClose: "12 Jan 2027", nextFollowUpAt: today0(1) + 11 * H, createdAt: daysAgo(4), lastActivityAt: daysAgo(1), tags: ["demo-book", "demo-scheduled"], notes: "Retail workspace walkthrough confirmed with presales." },
  { id: "lead-dem-3", name: "Sundara Foods", company: "Sundara Foods Pvt Ltd", contactPerson: "Vikas Anand", phone: "+91 98211 71003", email: "vikas@sundarafoods.example", source: "WhatsApp Campaign", industry: "FMCG", location: "Indore", ownerId: "demo.sales", status: "New", priority: "Cold", score: 35, estimatedValueCr: 0.05, nextFollowUpAt: today0(3) + 10 * H, createdAt: daysAgo(2), lastActivityAt: daysAgo(2), tags: ["demo-book"] },
];

// ============================================================
// Follow-ups, meetings
// ============================================================

export const SALES_FOLLOWUPS: SalesFollowUp[] = [
  { id: "fu-1", type: "Call", subject: "Confirm legal review agenda", ownerId: "pankaj", accountId: "acc-acme", contactId: "ct-rakesh", opportunityId: "opp-acme", dueAt: today0() - 2 * H, state: "Overdue", priority: "High", lastInteractionAt: daysAgo(2) },
  { id: "fu-2", type: "WhatsApp", subject: "Send pilot pricing follow-up", ownerId: "rohitv", leadId: "lead-101", dueAt: today0() - 26 * H, state: "Overdue", priority: "High", lastInteractionAt: daysAgo(3) },
  { id: "fu-3", type: "Email", subject: "Share compliance questionnaire", ownerId: "arvind", accountId: "acc-indus", contactId: "ct-latha", opportunityId: "opp-indus", dueAt: today0() - 4 * H, state: "Overdue", priority: "Medium", lastInteractionAt: daysAgo(4) },
  { id: "fu-4", type: "Send Quote", subject: "Dispatch revised Zenith countersignature pack", ownerId: "meera", accountId: "acc-zenith", opportunityId: "opp-zenith", dueAt: today0() + 3 * H, state: "Due Today", priority: "High", lastInteractionAt: daysAgo(1) },
  { id: "fu-5", type: "Call", subject: "Qualify Galaxy Foods budget", ownerId: "arvind", accountId: "acc-galaxy", opportunityId: "opp-galaxy", dueAt: today0() + 5 * H, state: "Due Today", priority: "Medium" },
  { id: "fu-6", type: "Meeting", subject: "DPA walkthrough with Meridian legal", ownerId: "vikrams", accountId: "acc-meridian", opportunityId: "opp-meridian", dueAt: today0() + 7 * H, state: "Due Today", priority: "High", lastInteractionAt: daysAgo(2) },
  { id: "fu-7", type: "Call", subject: "Trident Motors discovery scheduling", ownerId: "pankaj", accountId: "acc-trident", opportunityId: "opp-trident", dueAt: today0() + 9 * H, state: "Due Today", priority: "Medium" },
  { id: "fu-8", type: "Visit", subject: "Kaveri Agro plant walkthrough", ownerId: "arvind", leadId: "lead-103", dueAt: today0(1) + 10 * H, state: "Upcoming", priority: "Medium" },
  { id: "fu-9", type: "Email", subject: "Silverline — nurture with case study", ownerId: "rohitv", leadId: "lead-105", dueAt: today0(2) + 11 * H, state: "Upcoming", priority: "Low" },
  { id: "fu-10", type: "Call", subject: "Nimbus Pharma quality requirements", ownerId: "meera", leadId: "lead-111", dueAt: today0(2) + 13 * H, state: "Upcoming", priority: "High" },
  { id: "fu-11", type: "WhatsApp", subject: "Prism Interiors budget check", ownerId: "pankaj", leadId: "lead-107", dueAt: today0(3) + 10 * H, state: "Upcoming", priority: "Low" },
  { id: "fu-12", type: "Send Quote", subject: "Halcyon revised managed-services quote", ownerId: "rohitv", accountId: "acc-halcyon", opportunityId: "opp-halcyon", dueAt: today0(1) + 16 * H, state: "Upcoming", priority: "High", lastInteractionAt: daysAgo(5) },
  { id: "fu-13", type: "Call", subject: "Atlas AMC renewal terms", ownerId: "vikrams", leadId: "lead-112", dueAt: today0(-1) + 12 * H, state: "Completed", priority: "Medium", outcome: "Renewal terms agreed in principle — quote this week.", completedAt: today0(-1) + 13 * H, lastInteractionAt: daysAgo(1) },
  { id: "fu-14", type: "Email", subject: "Vayu Renewables compliance scope", ownerId: "sagar", leadId: "lead-104", dueAt: today0(-2) + 11 * H, state: "Completed", priority: "Medium", outcome: "Scope confirmed; pricing requested.", completedAt: today0(-2) + 15 * H, lastInteractionAt: daysAgo(3) },

  // IAM demo identity records — demo.sales' personal follow-up queue.
  { id: "fu-dem-1", type: "Call", subject: "Kepler Industries — pricing follow-up", ownerId: "demo.sales", leadId: "lead-dem-1", opportunityId: "opp-kepler", dueAt: today0() + 15 * H, state: "Due Today", priority: "High", lastInteractionAt: daysAgo(1) },
  { id: "fu-dem-2", type: "Meeting", subject: "Nova Retail demo prep sync", ownerId: "demo.sales", leadId: "lead-dem-2", dueAt: today0(1) + 11 * H, state: "Upcoming", priority: "Medium" },
  { id: "fu-dem-3", type: "WhatsApp", subject: "Sundara Foods — first touch", ownerId: "demo.sales", leadId: "lead-dem-3", dueAt: today0(3) + 10 * H, state: "Upcoming", priority: "Low" },
];

export const SALES_MEETINGS: SalesMeeting[] = [
  { id: "mtg-1", title: "Acme Phase 2 — legal review call", accountId: "acc-acme", contactId: "ct-rakesh", opportunityId: "opp-acme", ownerId: "pankaj", startAt: today0() + 11 * H, durationMin: 45, location: "Teams meeting", isLink: true, status: "Scheduled", agenda: "DPA redlines, Phase 2 acceptance criteria" },
  { id: "mtg-2", title: "Meridian legal — DPA walkthrough", accountId: "acc-meridian", contactId: "ct-anita", opportunityId: "opp-meridian", ownerId: "vikrams", startAt: today0() + 15 * H, durationMin: 60, location: "Zoom", isLink: true, status: "Scheduled", agenda: "Data-processing terms, retention schedule" },
  { id: "mtg-3", title: "Zenith procurement — closing handshake", accountId: "acc-zenith", contactId: "ct-suresh", opportunityId: "opp-zenith", ownerId: "meera", startAt: today0(1) + 9 * H, durationMin: 30, location: "Zenith HQ, Bengaluru", status: "Scheduled", agenda: "Countersignature and kickoff logistics" },
  { id: "mtg-4", title: "Galaxy Foods — promoter intro", accountId: "acc-galaxy", contactId: "ct-galaxy", opportunityId: "opp-galaxy", ownerId: "arvind", startAt: today0(2) + 10 * H, durationMin: 45, location: "Indore plant office", status: "Scheduled" },
  { id: "mtg-5", title: "NRC procurement pre-read", accountId: "acc-nrc", contactId: "ct-manav", opportunityId: "opp-nrc", ownerId: "pankaj", startAt: today0(3) + 14 * H, durationMin: 30, location: "Teams meeting", isLink: true, status: "Scheduled" },
  { id: "mtg-6", title: "Orbit Retail — commercial revision review", accountId: "acc-orbit", contactId: "ct-divya", opportunityId: "opp-orbit", ownerId: "vikrams", startAt: today0(-2) + 12 * H, durationMin: 45, location: "Orbit office, Gurugram", status: "Completed", notes: "Divya asked for a phased commercial structure; revision due this week." },
  { id: "mtg-7", title: "Halcyon ops review", accountId: "acc-halcyon", contactId: "ct-farhan", opportunityId: "opp-halcyon", ownerId: "rohitv", startAt: today0(-4) + 10 * H, durationMin: 30, location: "Call", status: "Completed", notes: "Ops team approved scope; waiting on revised quote." },
  { id: "mtg-8", title: "Spire Health — sponsor re-brief (cancelled)", accountId: "acc-spire", contactId: "ct-gopal", opportunityId: "opp-spire", ownerId: "rohitv", startAt: today0(-1) + 16 * H, durationMin: 30, location: "Teams meeting", isLink: true, status: "Cancelled", notes: "New sponsor unavailable — moving to next week." },
];

// ============================================================
// Quotations (amounts in ₹)
// ============================================================

const item = (id: string, productId: string, qty: number, discountPct = 0): QuoteItem => {
  const p = SALES_PRODUCTS.find((x) => x.id === productId)!;
  return { id, productId, name: p.name, qty, unitPrice: p.unitPrice, discountPct };
};

export const SALES_QUOTATIONS: SalesQuotation[] = [
  {
    id: "qtn-041", number: "QTN-2026-041", accountId: "acc-zenith", contactId: "ct-suresh", opportunityId: "opp-zenith", ownerId: "meera",
    status: "Accepted", createdAt: daysAgo(21), validUntil: "31 Dec 2026",
    items: [item("i1", "prd-erp", 85), item("i2", "prd-integration", 4, 10)], taxPct: 18,
    paymentTerms: "50% advance, 50% on go-live", deliveryTerms: "Implementation 10 weeks from PO",
    notes: "Renewal + automation add-on per Q3 negotiation.",
    sentAt: daysAgo(20), viewedAt: daysAgo(19), decidedAt: daysAgo(4),
    versions: [{ at: daysAgo(21), by: "Meera Iyer", note: "Draft created from opportunity opp-zenith" }, { at: daysAgo(20), by: "Meera Iyer", note: "v2 — integration connector count revised to 4" }, { at: daysAgo(4), by: "Suresh Babu", note: "Accepted by customer" }],
  },
  {
    id: "qtn-042", number: "QTN-2026-042", accountId: "acc-nrc", contactId: "ct-manav", opportunityId: "opp-nrc", ownerId: "pankaj",
    status: "Sent", createdAt: daysAgo(14), validUntil: "20 Dec 2026",
    items: [item("i1", "prd-erp", 120, 12), item("i2", "prd-field", 60), item("i3", "prd-impl", 1)], taxPct: 18,
    paymentTerms: "30% advance, milestone-based", deliveryTerms: "Phase-wise rollout over 16 weeks",
    notes: "Board pre-read submitted — procurement decision on 17 Dec.",
    sentAt: daysAgo(13), viewedAt: daysAgo(11),
    versions: [{ at: daysAgo(14), by: "Pankaj Sharma", note: "Draft created" }, { at: daysAgo(13), by: "Pankaj Sharma", note: "v2 — discount 12% approved by Sales Head" }],
  },
  {
    id: "qtn-043", number: "QTN-2026-043", accountId: "acc-orbit", contactId: "ct-divya", opportunityId: "opp-orbit", ownerId: "vikrams",
    status: "Pending Approval", createdAt: daysAgo(5), validUntil: "22 Dec 2026",
    items: [item("i1", "prd-comp", 3, 18), item("i2", "prd-support", 1)], taxPct: 18,
    paymentTerms: "Annual, net-30", deliveryTerms: "Remote enablement, 3 weeks",
    notes: "18% phased-structure discount — above the 15% threshold, routed to Sales Head.",
    versions: [{ at: daysAgo(5), by: "Vikram Singh", note: "Draft created with phased commercial structure" }, { at: daysAgo(2), by: "Vikram Singh", note: "Submitted for discount approval" }],
  },
  {
    id: "qtn-044", number: "QTN-2026-044", accountId: "acc-meridian", contactId: "ct-anita", opportunityId: "opp-meridian", ownerId: "vikrams",
    status: "Negotiation", createdAt: daysAgo(26), validUntil: "18 Dec 2026",
    items: [item("i1", "prd-erp", 60), item("i2", "prd-impl", 1, 8)], taxPct: 18,
    paymentTerms: "Quarterly milestones", deliveryTerms: "12-week rollout",
    notes: "DPA redlines outstanding — legal review in progress.",
    sentAt: daysAgo(24), viewedAt: daysAgo(23),
    versions: [{ at: daysAgo(26), by: "Vikram Singh", note: "Draft created" }, { at: daysAgo(24), by: "Vikram Singh", note: "v2 sent after scoping workshop" }],
  },
  {
    id: "qtn-037", number: "QTN-2026-037", accountId: "acc-everest", contactId: "ct-hitesh", opportunityId: "opp-everest", ownerId: "arvind",
    status: "Accepted", createdAt: daysAgo(40), validUntil: "31 Oct 2026",
    items: [item("i1", "prd-erp", 45), item("i2", "prd-impl", 1, 5)], taxPct: 18,
    paymentTerms: "40% advance, rest on go-live", deliveryTerms: "8-week implementation",
    notes: "Won deal — Phase 1 rollout.",
    sentAt: daysAgo(38), viewedAt: daysAgo(36), decidedAt: daysAgo(18),
    versions: [{ at: daysAgo(40), by: "Arvind Swamy", note: "Draft created after plant visit" }, { at: daysAgo(18), by: "Hitesh Patel", note: "Accepted — PO received" }],
  },
  {
    id: "qtn-045", number: "QTN-2026-045", accountId: "acc-halcyon", contactId: "ct-farhan", opportunityId: "opp-halcyon", ownerId: "rohitv",
    status: "Draft", createdAt: daysAgo(3), validUntil: "31 Dec 2026",
    items: [item("i1", "prd-cloud", 12), item("i2", "prd-support", 1)], taxPct: 18,
    paymentTerms: "Monthly invoicing", deliveryTerms: "Migration window TBD",
    notes: "Draft — awaiting ops review outcome before pricing finalisation.",
    versions: [{ at: daysAgo(3), by: "Rohit Verma", note: "Draft created from opp-halcyon" }],
  },
  {
    id: "qtn-036", number: "QTN-2026-036", accountId: "acc-nrc", contactId: "ct-manav", opportunityId: "opp-nrc", ownerId: "pankaj",
    status: "Expired", createdAt: daysAgo(70), validUntil: "31 Oct 2026",
    items: [item("i1", "prd-erp", 100), item("i2", "prd-impl", 1)], taxPct: 18,
    paymentTerms: "30% advance", deliveryTerms: "14-week rollout",
    notes: "Slipped from October — superseded by QTN-2026-042.",
    versions: [{ at: daysAgo(70), by: "Pankaj Sharma", note: "Original quote" }, { at: daysAgo(32), by: "System", note: "Expired unaccepted" }],
  },
  {
    id: "qtn-039", number: "QTN-2026-039", accountId: "acc-spire", contactId: "ct-gopal", opportunityId: "opp-spire", ownerId: "rohitv",
    status: "Rejected", createdAt: daysAgo(33), validUntil: "30 Nov 2026",
    items: [item("i1", "prd-comp", 2)], taxPct: 18,
    paymentTerms: "Annual", deliveryTerms: "Remote",
    notes: "Rejected after sponsor change — revisiting with new stakeholder.",
    sentAt: daysAgo(31), viewedAt: daysAgo(28), decidedAt: daysAgo(10),
    versions: [{ at: daysAgo(33), by: "Rohit Verma", note: "Pilot pricing" }, { at: daysAgo(10), by: "Dr. Gopal Rao", note: "Rejected — sponsor change" }],
  },
];

// ============================================================
// Orders (₹) — connected to Finance (invoice), Inventory (dispatch)
// ============================================================

export const SALES_ORDERS: SalesOrder[] = [
  { id: "so-038", number: "SO-2026-038", accountId: "acc-zenith", quotationId: "qtn-041", opportunityId: "opp-zenith", ownerId: "meera", status: "Confirmed", payment: "Partially Paid", fulfillment: "Pending", items: SALES_QUOTATIONS[0].items, total: 4_795_560, createdAt: daysAgo(3), invoiceId: "INV-2026-1129", deliveryBy: "10-week implementation from advance receipt" },
  { id: "so-036", number: "SO-2026-036", accountId: "acc-everest", quotationId: "qtn-037", opportunityId: "opp-everest", ownerId: "arvind", status: "In Fulfillment", payment: "Paid", fulfillment: "Dispatched", items: SALES_QUOTATIONS[4].items, total: 2_608_200, createdAt: daysAgo(17), invoiceId: "INV-2026-1104", dispatchId: "DSP-2026-0771", deliveryBy: "Implementation team on site — Surat" },
  { id: "so-031", number: "SO-2026-031", accountId: "acc-nrc", quotationId: "qtn-036", opportunityId: "opp-nrc", ownerId: "pankaj", status: "Cancelled", payment: "Unpaid", fulfillment: "Pending", items: SALES_QUOTATIONS[6].items, total: 2_914_400, createdAt: daysAgo(64), cancelledReason: "October slip — order cancelled pending revised quotation." },
  { id: "so-029", number: "SO-2026-029", accountId: "acc-orbit", ownerId: "vikrams", status: "Delivered", payment: "Paid", fulfillment: "Delivered", items: [item("i1", "prd-field", 25), item("i2", "prd-training", 2)], total: 2_550_000, createdAt: daysAgo(45), invoiceId: "INV-2026-1071", deliveryBy: "Completed 28 Oct 2026" },
  { id: "so-025", number: "SO-2026-025", accountId: "acc-acme", ownerId: "pankaj", status: "Closed", payment: "Paid", fulfillment: "Delivered", items: [item("i1", "prd-cloud", 12), item("i2", "prd-support", 1)], total: 1_532_800, createdAt: daysAgo(80), invoiceId: "INV-2026-0988", deliveryBy: "Annual hosting + support — renewed" },
];

// ============================================================
// WhatsApp Business conversations (API-based, consent-checked)
// ============================================================

const H2 = 2 * H;
export const WA_CONVERSATIONS: WaConversation[] = [
  {
    id: "wa-1", waNumber: "+91 98200 51001", contactName: "Deepak Shah (Sunrise Packaging)", leadId: "lead-101", ownerId: "rohitv",
    status: "Open", unread: 2, lastMessageAt: SALES_NOW - 40 * 60_000,
    messages: [
      { id: "m1", at: SALES_NOW - 26 * H, direction: "in", body: "Hi, we saw your dispatch automation demo at the trade fair. Can you share pricing for 3 plants?" },
      { id: "m2", at: SALES_NOW - 25 * H, direction: "out", body: "Hello Deepak! Sharing an indicative structure today. Would a 30-minute call tomorrow at 11:00 work?", template: "followup_intro", state: "read" },
      { id: "m3", at: SALES_NOW - 5 * H, direction: "in", body: "11 works. Please include implementation timeline." },
      { id: "m4", at: SALES_NOW - 40 * 60_000, direction: "in", body: "Also, do you integrate with Tally?" },
    ],
  },
  {
    id: "wa-2", waNumber: "+91 98920 36001", contactName: "Farhan Ali (Halcyon Logistics)", accountId: "acc-halcyon", opportunityId: "opp-halcyon", ownerId: "rohitv",
    status: "Pending", unread: 0, lastMessageAt: SALES_NOW - 6 * H,
    messages: [
      { id: "m1", at: SALES_NOW - 30 * H, direction: "in", body: "Ops team reviewed. We need the revised managed-services quote this week." },
      { id: "m2", at: SALES_NOW - 6 * H, direction: "out", body: "Thanks Farhan — the revision is with me, you will have it before Thursday.", state: "delivered" },
    ],
  },
  {
    id: "wa-3", waNumber: "+91 98210 31002", contactName: "Priya Nair (Acme Manufacturing)", accountId: "acc-acme", opportunityId: "opp-acme", ownerId: "pankaj",
    status: "Resolved", unread: 0, lastMessageAt: SALES_NOW - 2 * D,
    messages: [
      { id: "m1", at: SALES_NOW - 3 * D, direction: "in", body: "Received the Phase 2 agreement. Legal will revert with redlines." },
      { id: "m2", at: SALES_NOW - 2 * D, direction: "out", body: "Perfect, thank you Priya. We have blocked legal review time on 18 Nov.", state: "read" },
    ],
  },
  {
    id: "wa-4", waNumber: "+91 94400 52001", contactName: "Srinivas Rao (Kaveri Agro)", leadId: "lead-103", ownerId: "arvind",
    status: "Open", unread: 1, lastMessageAt: SALES_NOW - 3 * H,
    messages: [
      { id: "m1", at: SALES_NOW - 3 * H, direction: "in", body: "Namaste, met your team at AgriTech Expo. Interested in ERP for our processing unit." },
    ],
  },
  {
    id: "wa-5", waNumber: "+91 98300 56001", contactName: "Nandita Bose (Prism Interiors)", leadId: "lead-107", ownerId: "pankaj",
    status: "Pending", unread: 0, lastMessageAt: SALES_NOW - 22 * H,
    messages: [
      { id: "m1", at: SALES_NOW - 23 * H, direction: "out", body: "Hello Nandita, following up on the studio management toolkit we discussed.", template: "lead_nurture", state: "delivered" },
      { id: "m2", at: SALES_NOW - 22 * H, direction: "in", body: "Thanks! Sharing with my partner. Budget likely next quarter." },
    ],
  },
  {
    id: "wa-6", waNumber: "+91 98240 58001", contactName: "Ketan Mehta (Nimbus Pharma)", leadId: "lead-111", ownerId: "meera",
    status: "Open", unread: 1, lastMessageAt: SALES_NOW - 90 * 60_000,
    messages: [
      { id: "m1", at: SALES_NOW - 27 * H, direction: "out", body: "Hello Ketan, your quality-compliance requirements are with our solutions team.", template: "lead_nurture", state: "read" },
      { id: "m2", at: SALES_NOW - 90 * 60_000, direction: "in", body: "Great. Can we schedule a demo for the QA team next week?" },
    ],
  },
];

// ============================================================
// Field visits, travel, expenses
// ============================================================

export const SALES_VISITS: SalesVisit[] = [
  {
    id: "vis-1", accountId: "acc-zenith", contactId: "ct-suresh", ownerId: "meera", opportunityId: "opp-zenith",
    plannedAt: today0() + 9 * H, durationMin: 90, location: "Zenith Industries, Peenya, Bengaluru",
    purpose: "Closing handshake — countersignature and kickoff logistics", status: "Planned",
    checklist: [{ label: "Carry sign-ready agreement copies", done: true }, { label: "Confirm kickoff team allocation", done: false }, { label: "Collect advance PO if available", done: false }],
  },
  {
    id: "vis-2", accountId: "acc-galaxy", contactId: "ct-galaxy", ownerId: "arvind", opportunityId: "opp-galaxy",
    plannedAt: today0(1) + 10 * H, durationMin: 120, location: "Galaxy Foods plant, Indore",
    purpose: "Qualification walkthrough — dispatch and inventory pain points", status: "Planned",
    checklist: [{ label: "Plant tour with ops head", done: false }, { label: "Qualify budget cycle", done: false }, { label: "Identify warehouse count", done: false }],
  },
  {
    id: "vis-3", accountId: "acc-everest", contactId: "ct-hitesh", ownerId: "arvind", opportunityId: "opp-everest",
    plannedAt: today0(-6) + 10 * H, durationMin: 150, location: "Everest Textiles, Surat",
    purpose: "Post-sale check-in — implementation health", status: "Completed",
    checklist: [{ label: "Review go-live plan", done: true }, { label: "Training schedule sign-off", done: true }, { label: "Capture Phase 2 interest", done: true }],
    notes: "Implementation healthy. Phase 2 (dispatch module) interest flagged for Q4.",
    outcome: "Positive — expansion signal logged", nextAction: "Propose Phase 2 scope in December review", checkedInAt: today0(-6) + 10 * H + 5 * 60_000, completedAt: today0(-6) + 13 * H,
  },
  {
    id: "vis-4", accountId: "acc-indus", contactId: "ct-latha", ownerId: "arvind", opportunityId: "opp-indus",
    plannedAt: today0(3) + 11 * H, durationMin: 90, location: "Indus Bank, Jaipur",
    purpose: "Security questionnaire walkthrough with IT risk team", status: "Planned",
    checklist: [{ label: "Complete vendor security questionnaire", done: false }, { label: "Data residency briefing", done: false }],
  },
  {
    id: "vis-5", accountId: "acc-halcyon", contactId: "ct-farhan", ownerId: "rohitv", opportunityId: "opp-halcyon",
    plannedAt: today0(-2) + 10 * H, durationMin: 60, location: "Halcyon Logistics, Bhiwandi hub",
    purpose: "Ops review — managed services scope", status: "Completed",
    checklist: [{ label: "Ops scope walkthrough", done: true }, { label: "Pricing expectations", done: true }],
    notes: "Ops approved scope. Farhan wants the revised quote this week.",
    outcome: "Scope agreed — quote revision due", nextAction: "Send revised quotation (fu-12)", checkedInAt: today0(-2) + 10 * H + 3 * 60_000, completedAt: today0(-2) + 12 * H,
  },
  {
    id: "vis-6", accountId: "acc-nrc", contactId: "ct-manav", ownerId: "pankaj", opportunityId: "opp-nrc",
    plannedAt: today0(4) + 15 * H, durationMin: 60, location: "National Retail Co, Andheri, Mumbai",
    purpose: "Board pre-read alignment before 17 Dec procurement meeting", status: "Planned",
    checklist: [{ label: "Board pack walkthrough", done: false }, { label: "Commercial Q&A prep", done: false }],
  },
  {
    id: "vis-7", accountId: "acc-acme", contactId: "ct-rakesh", ownerId: "pankaj", opportunityId: "opp-acme",
    plannedAt: today0(5) + 10 * H, durationMin: 90, location: "Acme Manufacturing, Chakan, Pune",
    purpose: "Phase 2 acceptance criteria workshop", status: "Planned",
    checklist: [{ label: "Acceptance criteria draft", done: false }, { label: "Integration points review", done: false }],
  },
  {
    id: "vis-8", accountId: "acc-orbit", contactId: "ct-divya", ownerId: "vikrams", opportunityId: "opp-orbit",
    plannedAt: today0(-8) + 12 * H, durationMin: 75, location: "Orbit Retail, Gurugram",
    purpose: "Commercial structure discussion", status: "Completed",
    checklist: [{ label: "Phased structure draft", done: true }],
    notes: "Divya prefers phased commercials; revision in QTN-2026-043.",
    outcome: "Revision direction agreed", nextAction: "Submit revised quote for discount approval", checkedInAt: today0(-8) + 12 * H + 2 * 60_000, completedAt: today0(-8) + 13 * H,
  },
];

export const SALES_TRAVEL: TravelPlan[] = [
  { id: "tvl-1", ownerId: "meera", destination: "Bengaluru", purpose: "Zenith closing handshake (vis-1)", startAt: today0(1) + 8 * H, endAt: today0(1) + 20 * H, estimatedCost: 8500, status: "Planned", visitIds: ["vis-1"], notes: "Morning flight BLR, evening return." },
  { id: "tvl-2", ownerId: "arvind", destination: "Indore", purpose: "Galaxy Foods qualification visit (vis-2)", startAt: today0(1) + 6 * H, endAt: today0(2) + 20 * H, estimatedCost: 12500, status: "Planned", visitIds: ["vis-2"], notes: "Overnight stay; covers Kaveri Agro call remotely." },
  { id: "tvl-3", ownerId: "arvind", destination: "Jaipur", purpose: "Indus Bank security walkthrough (vis-4)", startAt: today0(3) + 6 * H, endAt: today0(3) + 21 * H, estimatedCost: 7800, status: "Planned", visitIds: ["vis-4"] },
  { id: "tvl-4", ownerId: "pankaj", destination: "Pune", purpose: "Acme Phase 2 workshop (vis-7)", startAt: today0(5) + 7 * H, endAt: today0(5) + 20 * H, estimatedCost: 6200, status: "Planned", visitIds: ["vis-7"] },
  { id: "tvl-5", ownerId: "arvind", destination: "Surat", purpose: "Everest post-sale check-in (vis-3)", startAt: today0(-7) + 7 * H, endAt: today0(-6) + 21 * H, estimatedCost: 9400, status: "Completed", visitIds: ["vis-3"] },
];

export const SALES_EXPENSES: SalesExpense[] = [
  { id: "exp-1", employeeId: "arvind", date: today0(-6), category: "Travel", amount: 9400, description: "Surat trip — Everest check-in (tvl-5)", travelId: "tvl-5", visitId: "vis-3", opportunityId: "opp-everest", status: "Approved", receiptName: "irctc-surat.pdf", submittedAt: daysAgo(5), decidedAt: daysAgo(4), decidedBy: "Pankaj Sharma" },
  { id: "exp-2", employeeId: "rohitv", date: today0(-2), category: "Fuel", amount: 1850, description: "Bhiwandi hub visit — local travel (vis-5)", visitId: "vis-5", opportunityId: "opp-halcyon", status: "Submitted", receiptName: "fuel-slip-12nov.jpg", submittedAt: daysAgo(1) },
  { id: "exp-3", employeeId: "meera", date: today0(-1), category: "Client Entertainment", amount: 3200, description: "Zenith procurement lunch — closing phase", opportunityId: "opp-zenith", status: "Submitted", receiptName: "hotel-blr-invoice.pdf", submittedAt: today0() + 1 * H },
  { id: "exp-4", employeeId: "arvind", date: today0(-1), category: "Hotel", amount: 4100, description: "Indore stay booking — Galaxy visit advance", travelId: "tvl-2", status: "Draft" },
  { id: "exp-5", employeeId: "pankaj", date: today0(-8), category: "Communication", amount: 649, description: "Q3 sales team mobile reimbursement", status: "Reimbursed", submittedAt: daysAgo(7), decidedAt: daysAgo(6), decidedBy: "Rahul Mehta" },
  { id: "exp-6", employeeId: "rohitv", date: today0(-9), category: "Travel", amount: 2450, description: "Pune — Spire sponsor meeting (superseded)", status: "Rejected", receiptName: "cab-pune.pdf", submittedAt: daysAgo(8), decidedAt: daysAgo(7), decidedBy: "Rahul Mehta", note: "Meeting was cancelled — not billable to customer pursuit." },
  { id: "exp-7", employeeId: "vikrams", date: today0(-4), category: "Travel", amount: 5600, description: "Gurugram — Orbit commercial review (vis-8)", visitId: "vis-8", opportunityId: "opp-orbit", status: "Approved", receiptName: "flight-del.pdf", submittedAt: daysAgo(3), decidedAt: daysAgo(3), decidedBy: "Rahul Mehta" },
  { id: "exp-8", employeeId: "meera", date: today0(-15), category: "Travel", amount: 8900, description: "Bengaluru — Zenith scoping workshop", opportunityId: "opp-zenith", status: "Reimbursed", receiptName: "blr-oct-trip.pdf", submittedAt: daysAgo(14), decidedAt: daysAgo(13), decidedBy: "Rahul Mehta" },
];

// ============================================================
// Activity timeline (ONE unified feed — filtered per entity)
// ============================================================

export const SALES_ACTIVITIES: SalesActivity[] = [
  { id: "act-1", at: daysAgo(1), type: "Stage change", actorId: "meera", entity: { kind: "opportunity", id: "opp-zenith" }, summary: "Stage moved Negotiation → Contracting", outcome: "Countersignature pending" },
  { id: "act-2", at: daysAgo(4), type: "Status change", actorId: "ct-suresh", entity: { kind: "quotation", id: "qtn-041" }, summary: "Customer accepted QTN-2026-041", outcome: "Order SO-2026-038 created" },
  { id: "act-3", at: daysAgo(3), type: "Order", actorId: "meera", entity: { kind: "order", id: "so-038" }, summary: "Order confirmed — 50% advance invoice INV-2026-1129 raised" },
  { id: "act-4", at: daysAgo(2), type: "Email", actorId: "vikrams", entity: { kind: "opportunity", id: "opp-meridian" }, summary: "DPA redline summary sent to Anita's legal team" },
  { id: "act-5", at: daysAgo(2), type: "Note", actorId: "pankaj", entity: { kind: "opportunity", id: "opp-nrc" }, summary: "Procurement board confirmed for 17 Dec — pre-read requested" },
  { id: "act-6", at: daysAgo(1), type: "WhatsApp", actorId: "ct-farhan", entity: { kind: "opportunity", id: "opp-halcyon" }, summary: "Farhan confirmed ops approval; revised quote requested", source: "WhatsApp Business" },
  { id: "act-7", at: daysAgo(-0), type: "WhatsApp", actorId: "wa-4", entity: { kind: "lead", id: "lead-103" }, summary: "New WhatsApp enquiry — AgriTech Expo follow-up", source: "WhatsApp Business" },
  { id: "act-8", at: daysAgo(-0), type: "WhatsApp", actorId: "wa-1", entity: { kind: "lead", id: "lead-101" }, summary: "Deepak asked about Tally integration", source: "WhatsApp Business" },
  { id: "act-9", at: daysAgo(1), type: "Call", actorId: "rohitv", entity: { kind: "lead", id: "lead-101" }, summary: "Discovery call — 3 plants, dispatch automation focus", outcome: "Budget confirmed; pricing requested" },
  { id: "act-10", at: daysAgo(6), type: "Stage change", actorId: "pankaj", entity: { kind: "opportunity", id: "opp-acme" }, summary: "Stage moved Proposal → Negotiation", outcome: "Legal review scheduled 18 Nov" },
  { id: "act-11", at: daysAgo(8), type: "Meeting", actorId: "rohitv", entity: { kind: "opportunity", id: "opp-halcyon" }, summary: "Ops review meeting held at Bhiwandi hub", outcome: "Scope approved" },
  { id: "act-12", at: daysAgo(16), type: "Status change", actorId: "arvind", entity: { kind: "opportunity", id: "opp-everest" }, summary: "Closed Won — ₹0.22 Cr", outcome: "Won after plant visit + 8-week plan" },
  { id: "act-13", at: daysAgo(16), type: "Conversion", actorId: "arvind", entity: { kind: "lead", id: "lead-109" }, summary: "Lead converted — contact, account and opportunity created" },
  { id: "act-14", at: daysAgo(2), type: "Visit", actorId: "rohitv", entity: { kind: "visit", id: "vis-5" }, summary: "Visit completed at Halcyon Bhiwandi hub", outcome: "Scope agreed — quote revision due" },
  { id: "act-15", at: daysAgo(-0), type: "Task", actorId: "meera", entity: { kind: "quotation", id: "qtn-041" }, summary: "Advance payment follow-up with Zenith finance", },
  { id: "act-16", at: daysAgo(5), type: "Quotation", actorId: "vikrams", entity: { kind: "quotation", id: "qtn-043" }, summary: "18% discount structure submitted for Sales Head approval" },
  { id: "act-17", at: daysAgo(12), type: "Meeting", actorId: "vikrams", entity: { kind: "opportunity", id: "opp-orbit" }, summary: "Commercial revision review at Orbit office", outcome: "Phased structure requested" },
  { id: "act-18", at: daysAgo(9), type: "Status change", actorId: "rohitv", entity: { kind: "lead", id: "lead-110" }, summary: "Lead disqualified — no budget cycle until FY28" },
  { id: "act-19", at: daysAgo(3), type: "Lead assigned", actorId: "rahul", entity: { kind: "lead", id: "lead-111" }, summary: "Inbound lead assigned to Meera Iyer (assignment rule:West inbound)" },
  { id: "act-20", at: daysAgo(2), type: "Note", actorId: "sagar", entity: { kind: "lead", id: "lead-104" }, summary: "Compliance scope confirmed over call with Ishaan" },
  { id: "act-21", at: daysAgo(4), type: "Email", actorId: "pankaj", entity: { kind: "contact", id: "ct-manav" }, summary: "Board pre-read pack shared with Manav" },
  { id: "act-22", at: daysAgo(11), type: "Stage change", actorId: "arvind", entity: { kind: "opportunity", id: "opp-indus" }, summary: "Stage moved Qualification → Discovery" },
  { id: "act-23", at: daysAgo(1), type: "Note", actorId: "arvind", entity: { kind: "visit", id: "vis-3" }, summary: "Everest Phase 2 expansion interest logged" },
  { id: "act-24", at: daysAgo(6), type: "Follow-up", actorId: "meera", entity: { kind: "account", id: "acc-zenith" }, summary: "Follow-up completed — countersignature expected this week" },
  { id: "act-25", at: daysAgo(14), type: "Quotation", actorId: "pankaj", entity: { kind: "quotation", id: "qtn-042" }, summary: "v2 sent with 12% discount approved by Sales Head" },
  { id: "act-26", at: daysAgo(10), type: "Status change", actorId: "ct-gopal", entity: { kind: "quotation", id: "qtn-039" }, summary: "QTN-2026-039 rejected — sponsor change at Spire" },
  { id: "act-27", at: daysAgo(5), type: "Note", actorId: "arvind", entity: { kind: "opportunity", id: "opp-galaxy" }, summary: "Promoter office identified budget owner — qualification call set" },
  { id: "act-28", at: daysAgo(2), type: "Call", actorId: "pankaj", entity: { kind: "lead", id: "lead-114" }, summary: "Conversion review call with Shruti — CRM evaluation scope", outcome: "Converted to opportunity opp-trident" },
];

// ============================================================
// Targets & leaderboard (canonical with executive region quotas)
// ============================================================

export const SALES_TARGETS: TargetRow[] = [
  { id: "tgt-meera", kind: "employee", refId: "meera", label: "Meera Iyer", quotaCr: 2.8, achievedCr: 1.58, pipelineCr: 1.14, forecastCr: 2.62 },
  { id: "tgt-vikrams", kind: "employee", refId: "vikrams", label: "Vikram Singh", quotaCr: 1.2, achievedCr: 0.51, pipelineCr: 0.63, forecastCr: 1.04 },
  { id: "tgt-pankaj", kind: "employee", refId: "pankaj", label: "Pankaj Sharma", quotaCr: 0.75, achievedCr: 0.32, pipelineCr: 1.56, forecastCr: 0.86 },
  { id: "tgt-rohitv", kind: "employee", refId: "rohitv", label: "Rohit Verma", quotaCr: 0.3, achievedCr: 0, pipelineCr: 0.53, forecastCr: 0.21 },
  { id: "tgt-arvind", kind: "employee", refId: "arvind", label: "Arvind Swamy", quotaCr: 0.3, achievedCr: 0.22, pipelineCr: 0.55, forecastCr: 0.38 },
  { id: "tgt-team-west", kind: "team", refId: "team-west", label: "West Enterprise", quotaCr: 1.9, achievedCr: 0.86, pipelineCr: 1.67, forecastCr: 1.71 },
  { id: "tgt-team-south", kind: "team", refId: "team-south", label: "South Enterprise", quotaCr: 1.5, achievedCr: 0.72, pipelineCr: 1.09, forecastCr: 1.44 },
  { id: "tgt-team-north", kind: "team", refId: "team-north", label: "North Key Accounts", quotaCr: 1.2, achievedCr: 0.51, pipelineCr: 1.11, forecastCr: 1.05 },
  { id: "tgt-team-east", kind: "team", refId: "team-east", label: "Growth East", quotaCr: 0.75, achievedCr: 0.32, pipelineCr: 0.64, forecastCr: 0.55 },
];

export interface LeaderboardRow {
  employeeId: string;
  name: string;
  revenueCr: number;
  achievementPct: number;
  oppsWon: number;
  conversionPct: number;
  avgDealCr: number;
  pipelineCr: number;
  followupCompletionPct: number;
  newCustomers: number;
}

export const SALES_LEADERBOARD: LeaderboardRow[] = [
  { employeeId: "meera", name: "Meera Iyer", revenueCr: 1.58, achievementPct: 56, oppsWon: 2, conversionPct: 34, avgDealCr: 0.79, pipelineCr: 1.14, followupCompletionPct: 92, newCustomers: 0 },
  { employeeId: "arvind", name: "Arvind Swamy", revenueCr: 0.22, achievementPct: 73, oppsWon: 1, conversionPct: 26, avgDealCr: 0.22, pipelineCr: 0.55, followupCompletionPct: 88, newCustomers: 1 },
  { employeeId: "vikrams", name: "Vikram Singh", revenueCr: 0.51, achievementPct: 43, oppsWon: 1, conversionPct: 28, avgDealCr: 0.51, pipelineCr: 0.63, followupCompletionPct: 85, newCustomers: 0 },
  { employeeId: "pankaj", name: "Pankaj Sharma", revenueCr: 0.32, achievementPct: 43, oppsWon: 1, conversionPct: 29, avgDealCr: 0.32, pipelineCr: 1.56, followupCompletionPct: 90, newCustomers: 0 },
  { employeeId: "rohitv", name: "Rohit Verma", revenueCr: 0, achievementPct: 0, oppsWon: 0, conversionPct: 18, avgDealCr: 0, pipelineCr: 0.53, followupCompletionPct: 64, newCustomers: 0 },
];

// ============================================================
// Settings (admin-managed, audited)
// ============================================================

export const SALES_SETTINGS: SalesSettings = {
  stages: [
    { id: "st-new", name: "New", probability: 10, requiresQuotation: false },
    { id: "st-qual", name: "Qualification", probability: 20, requiresQuotation: false },
    { id: "st-disc", name: "Discovery", probability: 35, requiresQuotation: false },
    { id: "st-prop", name: "Proposal", probability: 50, requiresQuotation: true },
    { id: "st-neg", name: "Negotiation", probability: 65, requiresQuotation: true },
    { id: "st-con", name: "Contracting", probability: 85, requiresQuotation: true },
  ],
  leadSources: ["Website", "Referral", "Trade Show", "WhatsApp Campaign", "Inbound Call", "Marketing Campaign", "Partner", "Field Visit", "Executive network"],
  lossReasons: ["Price", "Competitor chosen", "No budget", "No decision", "Lost to status quo", "Timing", "Other"],
  activityTypes: ["Call", "Email", "WhatsApp", "Meeting", "Visit", "Note", "Task", "Follow-up"],
  assignmentRules: [
    { id: "ar-1", name: "West inbound", trigger: "Inbound website leads from MH/Gujarat/Goa", action: "Round-robin: Meera Iyer → Rohit Verma", active: true },
    { id: "ar-2", name: "South inbound", trigger: "Inbound leads from KA/TN/AP/TS", action: "Assign to Meera Iyer", active: true },
    { id: "ar-3", name: "WhatsApp campaign", trigger: "WhatsApp Business campaign reply", action: "Assign to campaign owner; notify within 15 min", active: true },
    { id: "ar-4", name: "Enterprise keyword", trigger: "Company > 1000 employees OR banking/insurance", action: "Escalate to Rahul Mehta for manual assignment", active: true },
    { id: "ar-5", name: "Duplicate guard", trigger: "Matching phone/email of existing lead or contact", action: "Block creation; surface possible matches", active: true },
  ],
  approvalRules: [
    { id: "apr-1", trigger: "Quotation discount > 15%", rule: "Sales Head approval before send", approver: "Rahul Mehta", active: true },
    { id: "apr-2", trigger: "Quotation total > ₹50 L", rule: "Sales Head approval with step-up authentication", approver: "Rahul Mehta", active: true },
    { id: "apr-3", trigger: "Special payment terms (non-standard)", rule: "Finance Head co-approval", approver: "Priya Sharma", active: true },
    { id: "apr-4", trigger: "Expense claim > ₹10,000", rule: "Reporting manager approval", approver: "Reporting manager", active: true },
  ],
  quotaTotalCr: 5.35,
};

// ============================================================
// Sales report catalog (screen 100) — reuses the enterprise
// reporting architecture conceptually; metrics computed from
// THIS canonical store so drilldown stays honest.
// ============================================================

export const SALES_REPORT_CATALOG: {
  id: string;
  title: string;
  description: string;
  cadence: string;
  audience: string;
  format: "PDF" | "XLSX" | "Dashboard";
}[] = [
  { id: "sr-pipeline", title: "Pipeline health report", description: "Stage distribution, aging and coverage against the 2.0x standard.", cadence: "Weekly · Mon 08:00", audience: "Sales Head, managers", format: "Dashboard" },
  { id: "sr-forecast", title: "Forecast vs target", description: "Commit, best case and weighted pipeline against the Q3 target.", cadence: "Weekly · Mon 08:00", audience: "Sales Head, CEO", format: "PDF" },
  { id: "sr-conversion", title: "Lead source conversion", description: "Conversion rate and value by lead source for the period.", cadence: "Monthly · 1st working day", audience: "Sales Head, Marketing", format: "XLSX" },
  { id: "sr-winloss", title: "Win/loss analysis", description: "Won and lost opportunities with loss reasons.", cadence: "Monthly · 1st working day", audience: "Sales Head", format: "PDF" },
  { id: "sr-cycle", title: "Sales cycle report", description: "Median days by stage and by salesperson.", cadence: "Monthly", audience: "Managers", format: "XLSX" },
  { id: "sr-quotation", title: "Quotation conversion", description: "Quote volume, acceptance rate and discount exposure.", cadence: "Weekly · Fri 17:00", audience: "Sales Head, Finance", format: "XLSX" },
  { id: "sr-aging", title: "Opportunity aging", description: "Opportunities stalled beyond stage norms — risk register.", cadence: "Weekly · Mon 08:00", audience: "Managers", format: "Dashboard" },
  { id: "sr-activity", title: "Sales activity report", description: "Calls, meetings, visits and follow-up completion by rep.", cadence: "Weekly · Mon 08:00", audience: "Managers", format: "XLSX" },
];

// ============================================================
// Forecast model (screen 81) — derived from canonical targets
// + opportunities. Actual / Forecast / Target never mixed.
// ============================================================

export function computeForecast(rows: TargetRow[]) {
  const employees = rows.filter((r) => r.kind === "employee");
  const target = employees.reduce((s, r) => s + r.quotaCr, 0);
  const closed = employees.reduce((s, r) => s + r.achievedCr, 0);
  const weighted = employees.reduce((s, r) => s + r.pipelineCr * 0.55, 0); // blended demo weight
  const commit = closed + employees.reduce((s, r) => s + (r.forecastCr - r.achievedCr) * 0.6, 0);
  const bestCase = closed + employees.reduce((s, r) => s + (r.pipelineCr), 0);
  return { target, closed, weighted, commit, bestCase, gap: target - commit };
}

export const SALES_FUNNEL_HISTORY = [
  { week: "W44", commit: 4.52, bestCase: 5.71, weighted: 5.42 },
  { week: "W45", commit: 4.61, bestCase: 5.66, weighted: 5.5 },
  { week: "W46", commit: 4.66, bestCase: 5.62, weighted: 5.55 },
  { week: "W47", commit: 4.7, bestCase: 5.6, weighted: 5.58 },
];
