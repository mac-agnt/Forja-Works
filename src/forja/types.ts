export type Role = "owner" | "ops" | "designer" | "pm" | "lead" | "client";
export type PersonId = "caio" | "joyce" | "ana" | "leo" | "niamh" | "rui" | "ben" | "eva" | "tom";
export type Cat = "materials" | "workshop" | "install" | "overhead" | "logistics";
export const CATS: Cat[] = ["materials", "workshop", "install", "overhead", "logistics"];

export interface Person {
  id: PersonId;
  name: string;
  title: string;
  role: Role;
  email: string;
  crew: boolean;
  rate: number; // euro per hour used for labour capture
}
export interface Client {
  id: string;
  name: string;
  contact: string;
  type: "commercial" | "residential";
  email: string;
}
export interface Supplier {
  id: string;
  name: string;
  supplies: string;
  leadDays: number;
  contact: string;
}

export type Service = "Forja Works" | "Studio Forja" | "Forja Home" | "Plastico Company";

export interface Job {
  id: string; // = code
  code: string;
  name: string;
  type: "commercial" | "residential";
  segment: string;
  clientId: string;
  ownerId: PersonId;
  designerId: PersonId;
  service: Service;
  stage: "Design" | "Awaiting release" | "Production" | "Install" | "Snagging" | "Handover";
  contractValue: number;
  baseQuoteAccepted: boolean;
  installDate?: string;
  summary: string;
  baselineNote?: string;
  /** staff-side notes, never sent to the client */
  staffNotes: string;
  quoteCost: Record<Cat, number>;
  remaining: Record<Cat, number>;
}

export type MilestoneKind = "design" | "deposit" | "installation" | "final" | "variation";
export interface Milestone {
  id: string;
  jobId: string;
  kind: MilestoneKind;
  label: string;
  amount: number;
  status: "outstanding" | "received" | "scheduled" | "due" | "locked";
  dueNote: string;
  receivedAt?: number;
  receivedOn?: string;
  ref?: string;
  receivedBy?: string;
  variationId?: string;
}

export interface RevTrail {
  at: number;
  actor: string;
  text: string;
}
export interface Revision {
  id: string;
  jobId: string;
  packageId: string;
  rev: string;
  title: string;
  status: "awaiting" | "approved" | "changes" | "superseded" | "withdrawn";
  openingMm?: number;
  note: string;
  issuedBy: string;
  issuedAt: number;
  approvedBy?: string;
  approvedAt?: number;
  comment?: string;
  trail: RevTrail[];
}

export type Gate = "quote" | "drawing" | "deposit" | "materials" | "variation";
export interface PackHistory {
  at: number;
  version: number;
  rev: string;
  status: string;
  text: string;
}
export interface Pack {
  id: string;
  jobId: string;
  label: string;
  version: number;
  status: "held" | "ready" | "scheduled" | "complete";
  gates: Gate[];
  leadId: PersonId;
  hoursNeeded: number;
  station: string;
  cutList: string[];
  dimensions: string[];
  materialPicks: string[];
  qa: string[];
  releasedAt?: number;
  workOrderId?: string;
  slotDay?: string;
  variationId?: string;
  history: PackHistory[];
}
export interface WorkOrder {
  id: string;
  jobId: string;
  packId: string;
  version: number;
  rev: string;
  createdAt: number;
}
export interface Assignment {
  id: string;
  jobId: string;
  label: string;
  crewId: PersonId;
  day: string;
  hours: number;
  pinned: boolean;
  kind: "bench" | "finishing" | "install" | "dispatch";
  station: string;
  packId?: string;
}

export interface Requirement {
  id: string;
  jobId: string;
  packId?: string;
  item: string;
  unit: string;
  qty: number;
  supplierId: string;
  poId?: string;
  unitCost: number;
  leadDays: number;
  needBy: string;
}
export interface PO {
  id: string;
  jobId: string;
  supplierId: string;
  buyerId: PersonId;
  orderedOn: string;
  note: string;
}
export interface Receipt {
  id: string;
  reqId: string;
  poId: string;
  qty: number;
  at: number;
  by: string;
  ref: string;
}
export interface Invoice {
  id: string;
  supplierId: string;
  ref: string;
  jobId: string;
  poId: string;
  reqId: string;
  qty: number;
  unitCost: number;
  total: number;
  status: "review" | "posted";
}
export interface CostEntry {
  id: string;
  jobId: string;
  cat: Cat;
  amount: number;
  hours?: number;
  workerId?: PersonId;
  date: string;
  source: "seed" | "conversation" | "invoice" | "end-of-day" | "manual";
  desc: string;
  ref?: string;
}
export interface Variation {
  id: string;
  jobId: string;
  title: string;
  kind: "extra" | "omission";
  revenue: number; // signed
  cost: number; // signed
  status: "pending" | "accepted" | "declined";
  note: string;
  acceptedAt?: number;
  acceptedBy?: string;
}
export interface Snag {
  id: string;
  jobId: string;
  title: string;
  status: "open" | "resolved" | "confirmed";
  resolvedBy?: string;
  resolvedAt?: number;
  confirmedAt?: number;
}
export interface ProgItem {
  id: string;
  jobId: string;
  label: string;
  clientLabel: string;
  baseline: string;
  forecast: string;
  kind: "design" | "provisional" | "fixed";
  owner: string;
  blocksWorkshop?: boolean;
}
export interface Enquiry {
  id: string;
  title: string;
  client: string;
  source: "Gmail" | "Instagram" | "Google Forms" | "Referral";
  ownerId: PersonId;
  receivedDaysAgo: number;
  brief: string;
  path: "Paid design first" | "Quote from supplied drawings";
  stage: "New" | "Discovery" | "Quoted" | "Passed" | "Won";
  revenue: number;
  cost: number;
  hours: number;
  type: "commercial" | "residential";
  decision?: { by: string; at: number; reason: string };
}
export interface QuoteLine {
  id: string;
  cat: "Materials" | "Workshop hours" | "Finishing" | "Install" | "Transport" | "Overhead";
  label: string;
  qty: number;
  unit: string;
  rate: number;
}
export interface QuoteVersion {
  v: number;
  name: string;
  note: string;
  lines: QuoteLine[];
  price: number;
}
export interface Quote {
  id: string;
  name: string;
  jobId?: string;
  enquiryId?: string;
  versions: QuoteVersion[];
  currentV: number;
}
export interface Task {
  id: string;
  title: string;
  ownerId: PersonId;
  due: string;
  dueTime: string;
  priority: "High" | "Medium" | "Low";
  dept: string;
  jobId?: string;
  kind: "task" | "approval" | "exception";
  doneWhen?: string;
  manualDone?: boolean;
  link: { page: string; tab?: string; job?: string };
  note?: string;
  dynamic?: boolean;
}
export interface Eod {
  id: string;
  jobId: string;
  leadId: PersonId;
  hours: number;
  pieces: number;
  taskCompleted: boolean;
  blocker: string;
  tomorrow: string;
  at: number;
}
export interface FEvent {
  id: string;
  at: number;
  actor: string;
  jobId?: string;
  kind: string;
  text: string;
  from?: string;
  to?: string;
  ref?: { page: string; tab?: string; job?: string };
  agent?: string;
}
export interface Settings {
  tvLargeType: boolean;
  tvRotate: boolean;
  approvalControls: boolean;
  sendingEnabled: false;
}
export interface Draft {
  id: string;
  jobId: string;
  text: string;
  trigger: string;
}

export interface FState {
  v: number;
  meta: { base: number; startedAt: number; seq: number };
  ui: { role: Role; person: PersonId; tvJob: string | null };
  people: Person[];
  clients: Client[];
  suppliers: Supplier[];
  jobs: Job[];
  milestones: Milestone[];
  revisions: Revision[];
  packs: Pack[];
  workOrders: WorkOrder[];
  assignments: Assignment[];
  requirements: Requirement[];
  pos: PO[];
  receipts: Receipt[];
  invoices: Invoice[];
  costEntries: CostEntry[];
  variations: Variation[];
  snags: Snag[];
  programme: ProgItem[];
  enquiries: Enquiry[];
  quotes: Quote[];
  tasks: Task[];
  eods: Eod[];
  events: FEvent[];
  drafts: Draft[];
  settings: Settings;
  /** design clock for FW-263 */
  designReceivedOn: string | null;
  /** ids of jobs on the TV with a free-text next action override */
  tvNext: Record<string, string>;
  handover: Record<string, string>;
  blockers: Record<string, string>;
  /** a pending/confirmed capacity move record */
  moves: { id: string; jobId: string; from: string; to: string; at: number; by: string }[];
}

export interface Actor {
  role: Role;
  name: string;
}
export interface Result {
  ok: boolean;
  message: string;
}
