import type {
  Assignment, CostEntry, Cat, Enquiry, FEvent, FState, Job, Milestone, Pack, Person, ProgItem, PO, Quote,
  QuoteLine, Receipt, Requirement, Revision, Snag, Supplier, Task, Variation, Client,
} from "./types";
import { dublinMinutes } from "./dates";

const PEOPLE: Person[] = [
  { id: "caio", name: "Caio Pazini", title: "Founder and owner", role: "owner", email: "caio@forjaworks.com", crew: false, rate: 0 },
  { id: "joyce", name: "Joyce", title: "Operations", role: "ops", email: "joyce@forjaworks.com", crew: false, rate: 0 },
  { id: "ana", name: "Ana", title: "Designer", role: "designer", email: "ana@forjaworks.com", crew: false, rate: 55 },
  { id: "leo", name: "Leo", title: "Designer", role: "designer", email: "leo@forjaworks.com", crew: false, rate: 55 },
  { id: "niamh", name: "Niamh", title: "Production manager", role: "pm", email: "niamh@forjaworks.com", crew: false, rate: 0 },
  { id: "rui", name: "Rui", title: "Workshop crew lead", role: "lead", email: "rui@forjaworks.com", crew: true, rate: 45 },
  { id: "ben", name: "Ben", title: "Workshop crew", role: "lead", email: "ben@forjaworks.com", crew: true, rate: 45 },
  { id: "eva", name: "Eva", title: "Workshop crew lead", role: "lead", email: "eva@forjaworks.com", crew: true, rate: 45 },
  { id: "tom", name: "Tom", title: "Workshop crew", role: "lead", email: "tom@forjaworks.com", crew: true, rate: 45 },
];

const CLIENTS: Client[] = [
  { id: "c-smoke", name: "Smokehouse Social Ltd", contact: "Dara Whelan", type: "commercial", email: "dara@smokehouse-social.example" },
  { id: "c-fornace", name: "Fornace Pizza Group", contact: "Marco Lyons", type: "commercial", email: "marco@fornace-pizza.example" },
  { id: "c-victor", name: "Victor Hennessy", contact: "Victor Hennessy", type: "residential", email: "victor@hennessy-home.example" },
  { id: "c-tide", name: "Tidewater Beverages", contact: "Aoife Brannock", type: "commercial", email: "aoife@tidewater-bev.example" },
  { id: "c-bean", name: "Bean & Anchor Café", contact: "Sinead Cosgrave", type: "commercial", email: "sinead@beanandanchor.example" },
  { id: "c-halden", name: "Halden & Pryce Opticians", contact: "Ruairi Halden", type: "commercial", email: "ruairi@haldenpryce.example" },
  { id: "c-brennan", name: "Orla and Kevin Brennan", contact: "Orla Brennan", type: "residential", email: "orla@brennan-home.example" },
];

const SUPPLIERS: Supplier[] = [
  { id: "s-quay", name: "Quay Timber Supply", supplies: "Sheet goods, timber, edge banding", leadDays: 3, contact: "Orders desk" },
  { id: "s-kiln", name: "Kiln Finish Supplies", supplies: "Coatings, lacquers, abrasives", leadDays: 2, contact: "Trade counter" },
];

const z = (m: number, w: number, i: number, o: number, l: number): Record<Cat, number> => ({ materials: m, workshop: w, install: i, overhead: o, logistics: l });

function job(p: Partial<Job> & Pick<Job, "code" | "name" | "type" | "clientId" | "ownerId" | "designerId" | "stage" | "contractValue" | "quoteCost" | "remaining" | "summary">): Job {
  return {
    id: p.code, segment: p.type === "commercial" ? "Commercial" : "Residential", service: "Forja Works", baseQuoteAccepted: true,
    staffNotes: "", ...p,
  } as Job;
}

const JOBS: Job[] = [
  job({ code: "FW-261", name: "Burger fit-out", type: "commercial", clientId: "c-smoke", ownerId: "joyce", designerId: "ana", stage: "Awaiting release",
    contractValue: 48000, quoteCost: z(14000, 10000, 4800, 3600, 1200), remaining: z(8000, 10440, 4800, 3360, 1200),
    summary: "Counter, back bar and booth seating for a new burger restaurant.", segment: "Commercial hospitality",
    staffNotes: "Caio flagged the 27.0% forecast. Extra 32 workshop hours came from the R03 service opening rework." }),
  job({ code: "FW-262", name: "Pizza fit-out", type: "commercial", clientId: "c-fornace", ownerId: "niamh", designerId: "leo", stage: "Production",
    contractValue: 62000, quoteCost: z(20000, 13000, 6000, 3000, 1400), remaining: z(11800, 6200, 6000, 2100, 1400),
    summary: "Banquette seating, pass counter and oven surround.", segment: "Commercial hospitality",
    staffNotes: "Quay short-shipped the birch ply. Finishing is booked on unrelated materials." }),
  job({ code: "FW-263", name: "Victor house", type: "residential", clientId: "c-victor", ownerId: "ana", designerId: "ana", stage: "Design",
    contractValue: 1800, baseQuoteAccepted: false, quoteCost: z(0, 900, 0, 100, 0), remaining: z(0, 900, 0, 100, 0),
    summary: "Kitchen and utility joinery for a Dublin 6 house. Design fee first.", segment: "Residential", service: "Forja Home",
    staffNotes: "Seven-day design clock starts on receipt of the design fee." }),
  job({ code: "FW-264", name: "Docklands pop-up bar", type: "commercial", clientId: "c-tide", ownerId: "niamh", designerId: "leo", stage: "Install",
    contractValue: 28500, quoteCost: z(7800, 5200, 3400, 1900, 900), remaining: z(300, 200, 3400, 400, 600), installDate: "2026-11-27",
    summary: "Demountable brand activation bar. Install slot fixed Friday 27 Nov.", segment: "Commercial brand activation",
    staffNotes: "Premium activation example. Install slot cannot move." }),
  job({ code: "FW-265", name: "Rathmines café", type: "commercial", clientId: "c-bean", ownerId: "joyce", designerId: "ana", stage: "Install",
    contractValue: 30000, quoteCost: z(9500, 6500, 4500, 2700, 800), remaining: z(0, 0, 2500, 700, 200),
    summary: "Counter, wall seating and shelving. Crew on site.", segment: "Commercial hospitality",
    staffNotes: "Workshop labour ran over by 400. Installation payment now due." }),
  job({ code: "FW-266", name: "City shopfront", type: "commercial", clientId: "c-halden", ownerId: "niamh", designerId: "leo", stage: "Production",
    contractValue: 22000, quoteCost: z(6400, 5200, 3000, 2200, 700), remaining: z(500, 2600, 3000, 1100, 700),
    summary: "Signage assembly and fascia for an optician's shopfront.", segment: "Commercial retail", installDate: "2026-11-30",
    staffNotes: "Flexible six-hour blocks can move to Wednesday without missing Thursday dispatch." }),
  job({ code: "FW-267", name: "Garden room", type: "residential", clientId: "c-brennan", ownerId: "joyce", designerId: "ana", stage: "Snagging",
    contractValue: 20000, quoteCost: z(5600, 4200, 2800, 1800, 500), remaining: z(0, 0, 100, 0, 50),
    summary: "Insulated garden room with built-in storage.", segment: "Residential", service: "Studio Forja",
    staffNotes: "Final payment follows client snag sign-off." }),
];

const M = (id: string, jobId: string, kind: Milestone["kind"], label: string, amount: number, status: Milestone["status"], dueNote: string, extra: Partial<Milestone> = {}): Milestone =>
  ({ id, jobId, kind, label, amount, status, dueNote, ...extra });

export function seedState(): FState {
  const mins = dublinMinutes();
  const base = Date.UTC(2026, 10, 24, Math.floor(mins / 60), mins % 60);
  const at = (minsBefore: number) => base - minsBefore * 60000;
  const day = (offset: number) => base - offset * 86400000;

  const milestones: Milestone[] = [
    M("M-261-D", "FW-261", "design", "Design fee", 3600, "received", "Paid 12 Nov", { receivedAt: day(12), receivedOn: "2026-11-12", ref: "RC-0912", receivedBy: "Joyce" }),
    M("M-261-1", "FW-261", "deposit", "Deposit", 24000, "outstanding", "Needed before production release"),
    M("M-261-2", "FW-261", "installation", "During installation", 19200, "scheduled", "Due as install starts"),
    M("M-261-3", "FW-261", "final", "After snag sign-off", 4800, "locked", "Due after snag sign-off"),
    M("M-262-D", "FW-262", "design", "Design fee", 2400, "received", "Paid", { receivedAt: day(40), receivedOn: "2026-10-15", ref: "RC-0871", receivedBy: "Joyce" }),
    M("M-262-1", "FW-262", "deposit", "Deposit", 31000, "received", "Paid 28 Oct", { receivedAt: day(27), receivedOn: "2026-10-28", ref: "RC-0880", receivedBy: "Joyce" }),
    M("M-262-2", "FW-262", "installation", "During installation", 24800, "scheduled", "Due as install starts"),
    M("M-262-3", "FW-262", "final", "After snag sign-off", 6200, "locked", "Due after snag sign-off"),
    M("M-263-D", "FW-263", "design", "Design fee", 1800, "outstanding", "Pay to start design"),
    M("M-264-1", "FW-264", "deposit", "Deposit", 14250, "received", "Paid", { receivedAt: day(21), receivedOn: "2026-11-03", ref: "RC-0893", receivedBy: "Joyce" }),
    M("M-264-2", "FW-264", "installation", "During installation", 11400, "due", "Due Fri 27 Nov"),
    M("M-264-3", "FW-264", "final", "After snag sign-off", 2850, "locked", "Due after snag sign-off"),
    M("M-265-1", "FW-265", "deposit", "Deposit", 15000, "received", "Paid", { receivedAt: day(30), receivedOn: "2026-10-25", ref: "RC-0876", receivedBy: "Joyce" }),
    M("M-265-2", "FW-265", "installation", "Installation payment", 12000, "due", "Due now"),
    M("M-265-3", "FW-265", "final", "Final payment", 3000, "scheduled", "Scheduled after handover"),
    M("M-266-1", "FW-266", "deposit", "Deposit", 11000, "received", "Paid", { receivedAt: day(18), receivedOn: "2026-11-06", ref: "RC-0898", receivedBy: "Joyce" }),
    M("M-266-2", "FW-266", "installation", "During installation", 8800, "scheduled", "Due as install starts"),
    M("M-266-3", "FW-266", "final", "After snag sign-off", 2200, "locked", "Due after snag sign-off"),
    M("M-267-1", "FW-267", "deposit", "Deposit", 10000, "received", "Paid", { receivedAt: day(60), receivedOn: "2026-09-25", ref: "RC-0820", receivedBy: "Joyce" }),
    M("M-267-2", "FW-267", "installation", "During installation", 8000, "received", "Paid", { receivedAt: day(20), receivedOn: "2026-11-04", ref: "RC-0894", receivedBy: "Joyce" }),
    M("M-267-3", "FW-267", "final", "After snag sign-off", 2000, "locked", "Due after client snag sign-off"),
  ];

  const trail = (actor: string, text: string, ago: number) => ({ at: at(ago), actor, text });
  const revisions: Revision[] = [
    { id: "rv-261-1", jobId: "FW-261", packageId: "PK-261", rev: "R01", title: "Counter, first issue", status: "superseded", openingMm: 880, note: "First concept elevation.", issuedBy: "Ana", issuedAt: day(14),
      approvedBy: "Dara Whelan", approvedAt: day(13), trail: [trail("Ana", "Issued R01", 14 * 1440), trail("Dara Whelan", "Approved R01", 13 * 1440)] },
    { id: "rv-261-2", jobId: "FW-261", packageId: "PK-261", rev: "R02", title: "Counter, service opening 900 mm", status: "superseded", openingMm: 900, note: "Service opening 900 mm. Superseded by R03.", issuedBy: "Ana", issuedAt: day(8),
      approvedBy: "Dara Whelan", approvedAt: day(7), trail: [trail("Ana", "Issued R02", 8 * 1440), trail("Dara Whelan", "Approved R02", 7 * 1440), trail("Ana", "Superseded by R03 after POS terminal check", 5 * 1440)] },
    { id: "rv-261-3", jobId: "FW-261", packageId: "PK-261", rev: "R03", title: "Counter, service opening 940 mm", status: "awaiting", openingMm: 940, note: "Service opening widened from 900 mm to 940 mm to clear the POS terminal and tray run.", issuedBy: "Ana", issuedAt: at(26 * 60),
      trail: [trail("Ana", "Issued R03 for client sign-off", 26 * 60)] },
    { id: "rv-262-1", jobId: "FW-262", packageId: "PK-262-1", rev: "R05", title: "Banquette cutting set", status: "approved", note: "Approved banquette cut set.", issuedBy: "Leo", issuedAt: day(12), approvedBy: "Marco Lyons", approvedAt: day(10),
      trail: [trail("Leo", "Issued R05", 12 * 1440), trail("Marco Lyons", "Approved R05", 10 * 1440)] },
    { id: "rv-262-2", jobId: "FW-262", packageId: "PK-262-F", rev: "R03", title: "Finishing schedule", status: "approved", note: "Colour and finish schedule.", issuedBy: "Leo", issuedAt: day(15), approvedBy: "Marco Lyons", approvedAt: day(14),
      trail: [trail("Leo", "Issued R03", 15 * 1440), trail("Marco Lyons", "Approved R03", 14 * 1440)] },
    { id: "rv-264-1", jobId: "FW-264", packageId: "PK-264", rev: "R04", title: "Pop-up bar kit of parts", status: "approved", note: "Approved kit-of-parts drawings.", issuedBy: "Leo", issuedAt: day(10), approvedBy: "Aoife Brannock", approvedAt: day(9),
      trail: [trail("Leo", "Issued R04", 10 * 1440), trail("Aoife Brannock", "Approved R04", 9 * 1440)] },
    { id: "rv-266-1", jobId: "FW-266", packageId: "PK-266", rev: "R02", title: "Signage and fascia", status: "approved", note: "Approved fascia and sign drawings.", issuedBy: "Leo", issuedAt: day(16), approvedBy: "Ruairi Halden", approvedAt: day(15),
      trail: [trail("Leo", "Issued R02", 16 * 1440), trail("Ruairi Halden", "Approved R02", 15 * 1440)] },
    { id: "rv-265-1", jobId: "FW-265", packageId: "PK-265", rev: "R03", title: "Café counter and seating", status: "approved", note: "Approved.", issuedBy: "Ana", issuedAt: day(40), approvedBy: "Sinead Cosgrave", approvedAt: day(39),
      trail: [trail("Ana", "Issued R03", 40 * 1440), trail("Sinead Cosgrave", "Approved R03", 39 * 1440)] },
    { id: "rv-267-1", jobId: "FW-267", packageId: "PK-267", rev: "R02", title: "Garden room joinery", status: "approved", note: "Approved.", issuedBy: "Ana", issuedAt: day(70), approvedBy: "Orla Brennan", approvedAt: day(69),
      trail: [trail("Ana", "Issued R02", 70 * 1440), trail("Orla Brennan", "Approved R02", 69 * 1440)] },
  ];

  const packs: Pack[] = [
    { id: "PK-261", jobId: "FW-261", label: "Burger counter", version: 2, status: "held", gates: ["quote", "drawing", "deposit", "materials"], leadId: "rui", hoursNeeded: 16, station: "Bench A",
      cutList: ["Counter carcass panels x 14 (18 mm birch ply)", "Service opening reveal x 2", "Tray rail x 3", "Back-bar shelves x 4"],
      dimensions: ["Counter 3,600 x 1,050 x 900 mm", "Service opening 940 mm (R03)", "Kick 120 mm"],
      materialPicks: ["Birch ply 18 mm x 14 sheets", "Edge banding x 6 rolls", "Hardware set HS-261"],
      qa: ["Opening measured 940 mm at both reveals", "Panel squareness within 1 mm", "Edge banding flush", "Dry fit signed by lead"],
      history: [{ at: day(7), version: 1, rev: "R02", status: "withdrawn", text: "v1 issued on R02 (opening 900 mm). Withdrawn when R03 changed the opening to 940 mm. Superseded." }] },
    { id: "PK-262-1", jobId: "FW-262", label: "Banquette cutting", version: 1, status: "held", gates: ["quote", "drawing", "deposit", "materials"], leadId: "eva", hoursNeeded: 16, station: "Panel saw and CNC",
      cutList: ["Banquette backs x 12", "Seat bases x 12", "Rails x 24"], dimensions: ["Run 1: 5,400 mm", "Run 2: 3,200 mm", "Seat height 450 mm"],
      materialPicks: ["Birch ply 18 mm x 18 sheets"], qa: ["Offcut check against nest plan", "Grain direction on visible faces"], history: [] },
    { id: "PK-262-F", jobId: "FW-262", label: "Pizza finishing", version: 1, status: "scheduled", gates: ["quote", "drawing", "deposit"], leadId: "eva", hoursNeeded: 32, station: "Finishing bay",
      cutList: [], dimensions: ["Oven surround 2,100 x 1,800 mm"], materialPicks: ["Water-based lacquer x 4 tins"], qa: ["Sheen reading 20 percent", "No orange peel"], workOrderId: "WO-262-F1", slotDay: "2026-11-24", releasedAt: day(4), history: [] },
    { id: "PK-264", jobId: "FW-264", label: "Pop-up bar kit", version: 1, status: "scheduled", gates: ["quote", "drawing", "deposit"], leadId: "rui", hoursNeeded: 16, station: "Install crew",
      cutList: ["Kit packed to load list LL-264"], dimensions: ["Bar 4,200 x 700 x 1,100 mm"], materialPicks: ["Kit of parts"], qa: ["Load list ticked", "Spare fixings bag"], workOrderId: "WO-264-1", slotDay: "2026-11-24", releasedAt: day(5), history: [] },
    { id: "PK-266", jobId: "FW-266", label: "Signage assembly", version: 1, status: "scheduled", gates: ["quote", "drawing", "deposit"], leadId: "rui", hoursNeeded: 12, station: "Bench A",
      cutList: ["Fascia panels x 6", "Sign boxes x 2"], dimensions: ["Fascia 5,200 x 600 mm"], materialPicks: ["Acrylic x 8 sheets", "Aluminium extrusions"], qa: ["LED run test", "Fascia joint gap under 1 mm"], workOrderId: "WO-266-1", slotDay: "2026-11-24", releasedAt: day(6), history: [] },
    { id: "PK-265", jobId: "FW-265", label: "Café install pack", version: 1, status: "complete", gates: ["quote", "drawing", "deposit"], leadId: "ben", hoursNeeded: 0, station: "Install crew",
      cutList: [], dimensions: [], materialPicks: [], qa: [], workOrderId: "WO-265-1", releasedAt: day(24), history: [] },
    { id: "PK-267", jobId: "FW-267", label: "Garden room pack", version: 1, status: "complete", gates: ["quote", "drawing", "deposit"], leadId: "ben", hoursNeeded: 0, station: "Install crew",
      cutList: [], dimensions: [], materialPicks: [], qa: [], workOrderId: "WO-267-1", releasedAt: day(50), history: [] },
  ];

  const A = (id: string, jobId: string, label: string, crewId: Assignment["crewId"], d: string, hours: number, kind: Assignment["kind"], station: string, pinned = false, packId?: string): Assignment =>
    ({ id, jobId, label, crewId, day: d, hours, pinned, kind, station, packId });
  const assignments: Assignment[] = [
    A("a1", "FW-264", "Docklands kit pack-out and load", "rui", "2026-11-24", 8, "bench", "Install crew", true, "PK-264"),
    A("a2", "FW-264", "Docklands kit pack-out and load", "ben", "2026-11-24", 8, "bench", "Install crew", true, "PK-264"),
    A("a3", "FW-262", "Pizza finishing", "eva", "2026-11-24", 8, "finishing", "Finishing bay", false, "PK-262-F"),
    A("a4", "FW-262", "Pizza finishing", "tom", "2026-11-24", 8, "finishing", "Finishing bay", false, "PK-262-F"),
    A("a5", "FW-266", "City shopfront signage assembly", "rui", "2026-11-24", 6, "bench", "Bench A", false, "PK-266"),
    A("a6", "FW-266", "City shopfront signage assembly", "ben", "2026-11-24", 6, "bench", "Bench A", false, "PK-266"),
    A("a7", "FW-262", "Pizza finishing", "eva", "2026-11-25", 8, "finishing", "Finishing bay", false, "PK-262-F"),
    A("a8", "FW-262", "Pizza finishing", "tom", "2026-11-25", 8, "finishing", "Finishing bay", false, "PK-262-F"),
    A("a9", "FW-266", "City shopfront dispatch load", "rui", "2026-11-26", 4, "dispatch", "Dispatch", false, "PK-266"),
    A("a10", "FW-266", "City shopfront dispatch load", "ben", "2026-11-26", 4, "dispatch", "Dispatch", false, "PK-266"),
    A("a11", "FW-264", "Docklands install", "rui", "2026-11-27", 8, "install", "Install crew", true, "PK-264"),
    A("a12", "FW-264", "Docklands install", "ben", "2026-11-27", 8, "install", "Install crew", true, "PK-264"),
  ];

  const R = (id: string, jobId: string, packId: string | undefined, item: string, unit: string, qty: number, supplierId: string, poId: string, unitCost: number, leadDays: number, needBy: string): Requirement =>
    ({ id, jobId, packId, item, unit, qty, supplierId, poId, unitCost, leadDays, needBy });
  const requirements: Requirement[] = [
    R("rq-262-ply", "FW-262", "PK-262-1", "Birch ply 18 mm", "sheet", 18, "s-quay", "PO-262-01", 45, 3, "2026-11-25"),
    R("rq-262-lac", "FW-262", "PK-262-F", "Water-based lacquer", "tin", 4, "s-kiln", "PO-262-02", 62, 2, "2026-11-23"),
    R("rq-261-ply", "FW-261", "PK-261", "Birch ply 18 mm", "sheet", 14, "s-quay", "PO-261-01", 45, 3, "2026-11-23"),
    R("rq-261-edge", "FW-261", "PK-261", "Edge banding", "roll", 6, "s-quay", "PO-261-01", 38, 3, "2026-11-23"),
    R("rq-266-acr", "FW-266", "PK-266", "Acrylic sheet 5 mm", "sheet", 8, "s-quay", "PO-266-01", 71, 3, "2026-11-20"),
    R("rq-264-kit", "FW-264", "PK-264", "Edge banding and fixings", "kit", 1, "s-quay", "PO-264-01", 410, 3, "2026-11-20"),
  ];
  const pos: PO[] = [
    { id: "PO-262-01", jobId: "FW-262", supplierId: "s-quay", buyerId: "joyce", orderedOn: "2026-11-18", note: "18 birch-ply sheets for banquette cutting" },
    { id: "PO-262-02", jobId: "FW-262", supplierId: "s-kiln", buyerId: "joyce", orderedOn: "2026-11-17", note: "Lacquer for finishing" },
    { id: "PO-261-01", jobId: "FW-261", supplierId: "s-quay", buyerId: "joyce", orderedOn: "2026-11-16", note: "Counter package materials" },
    { id: "PO-266-01", jobId: "FW-266", supplierId: "s-quay", buyerId: "niamh", orderedOn: "2026-11-12", note: "Signage acrylic" },
    { id: "PO-264-01", jobId: "FW-264", supplierId: "s-quay", buyerId: "niamh", orderedOn: "2026-11-10", note: "Kit fixings" },
  ];
  const rc = (id: string, reqId: string, poId: string, qty: number, ago: number, ref: string): Receipt => ({ id, reqId, poId, qty, at: day(ago), by: "Joyce", ref });
  const receipts: Receipt[] = [
    rc("rc-1", "rq-262-ply", "PO-262-01", 12, 1, "DN-4471 delivery one"),
    rc("rc-2", "rq-262-lac", "PO-262-02", 4, 3, "DN-4440"),
    rc("rc-3", "rq-261-ply", "PO-261-01", 14, 2, "DN-4456"),
    rc("rc-4", "rq-261-edge", "PO-261-01", 6, 2, "DN-4456"),
    rc("rc-5", "rq-266-acr", "PO-266-01", 8, 6, "DN-4398"),
    rc("rc-6", "rq-264-kit", "PO-264-01", 1, 9, "DN-4380"),
  ];

  const ce: CostEntry[] = [];
  const addCost = (jobId: string, cat: Cat, amount: number, desc: string) =>
    ce.push({ id: "ce-" + jobId + "-" + cat, jobId, cat, amount, date: "2026-11-20", source: "seed", desc });
  const seedActuals: Record<string, [number, number, number, number, number]> = {
    "FW-261": [6000, 1000, 0, 240, 0],
    "FW-262": [8200, 6800, 0, 900, 0],
    "FW-263": [0, 0, 0, 0, 0],
    "FW-264": [7500, 5000, 0, 1500, 300],
    "FW-265": [9500, 6900, 2000, 2000, 600],
    "FW-266": [5900, 2600, 0, 1100, 0],
    "FW-267": [5600, 4300, 2600, 1800, 450],
  };
  const catLabels: Cat[] = ["materials", "workshop", "install", "overhead", "logistics"];
  Object.entries(seedActuals).forEach(([jobId, arr]) => arr.forEach((amt, i) => { if (amt > 0) addCost(jobId, catLabels[i], amt, "Actuals to date (seed)"); }));

  const variations: Variation[] = [
    { id: "V01", jobId: "FW-261", title: "Fluted frontage to counter", kind: "extra", revenue: 2400, cost: 1200, status: "pending", note: "Optional fluted oak-veneer frontage. Priced separately and paid on its own line." },
  ];
  const snags: Snag[] = [
    { id: "sn-1", jobId: "FW-267", title: "Latch alignment on garden room door", status: "open" },
    { id: "sn-2", jobId: "FW-267", title: "Paint touch-up on skirting, north wall", status: "open" },
  ];

  const P = (id: string, jobId: string, label: string, clientLabel: string, baseline: string, forecast: string, kind: ProgItem["kind"], owner: string, blocksWorkshop = false): ProgItem =>
    ({ id, jobId, label, clientLabel, baseline, forecast, kind, owner, blocksWorkshop });
  const programme: ProgItem[] = [
    P("p-261-1", "FW-261", "R03 client sign-off", "Approve your counter drawing", "2026-11-24", "2026-11-24", "design", "Dara Whelan"),
    P("p-261-2", "FW-261", "Workshop release and build", "Your counter is built in our workshop", "2026-11-26", "2026-11-26", "provisional", "Niamh"),
    P("p-261-3", "FW-261", "Install", "Installation at your premises", "2026-12-09", "2026-12-09", "provisional", "Rui"),
    P("p-262-1", "FW-262", "Banquette cutting", "Banquette seating cut", "2026-11-26", "2026-11-26", "provisional", "Eva"),
    P("p-262-2", "FW-262", "Install", "Installation", "2026-12-07", "2026-12-07", "provisional", "Rui"),
    P("p-263-1", "FW-263", "Design target", "Your design is ready for review", "2026-11-30", "2026-11-30", "design", "Ana"),
    P("p-263-2", "FW-263", "Client design sign-off", "You sign off the design", "2026-12-04", "2026-12-04", "provisional", "Victor Hennessy"),
    P("p-263-3", "FW-263", "Supplier delivery slot", "Kitchen supplier delivery to our workshop", "2026-12-09", "2026-12-09", "fixed", "Fixed by supplier"),
    P("p-263-4", "FW-263", "Workshop start", "Workshop starts your joinery", "2026-12-08", "2026-12-08", "provisional", "Niamh", true),
    P("p-263-5", "FW-263", "Install", "Installation at your home", "2027-01-18", "2027-01-18", "provisional", "Rui"),
    P("p-264-1", "FW-264", "Install", "Installation Friday 27 November", "2026-11-27", "2026-11-27", "fixed", "Rui"),
    P("p-265-1", "FW-265", "Install complete", "Installation complete", "2026-11-27", "2026-11-27", "provisional", "Ben"),
    P("p-266-1", "FW-266", "Dispatch", "Dispatch to site", "2026-11-26", "2026-11-26", "fixed", "Niamh"),
    P("p-266-2", "FW-266", "Install", "Installation at your shopfront", "2026-11-30", "2026-11-30", "provisional", "Rui"),
    P("p-267-1", "FW-267", "Snag sign-off", "Confirm snags are resolved", "2026-11-26", "2026-11-26", "design", "Orla Brennan"),
  ];

  const L = (id: string, cat: QuoteLine["cat"], label: string, qty: number, unit: string, rate: number): QuoteLine => ({ id, cat, label, qty, unit, rate });
  const q261v1: QuoteLine[] = [
    L("l1", "Materials", "Birch ply, edge banding, hardware, solid-surface top", 1, "lot", 14000),
    L("l2", "Workshop hours", "Workshop labour", 200, "h", 45),
    L("l3", "Finishing", "Sprayed finishes (subcontract)", 1, "lot", 1000),
    L("l4", "Install", "Install crew and site supervision", 1, "lot", 4800),
    L("l5", "Transport", "Delivery and van hire", 1, "lot", 1200),
    L("l6", "Overhead", "Overhead allocation", 1, "lot", 3600),
  ];
  const q261v2: QuoteLine[] = q261v1.map((l) => (l.id === "l2" ? { ...l, qty: 232 } : l));
  const q264: QuoteLine[] = [
    L("l1", "Materials", "Demountable bar kit materials", 1, "lot", 7800),
    L("l2", "Workshop hours", "Workshop labour", 100, "h", 45),
    L("l3", "Finishing", "Branded finish and graphics prep", 1, "lot", 700),
    L("l4", "Install", "Two-person install and strike", 1, "lot", 3400),
    L("l5", "Transport", "Van and tail-lift", 1, "lot", 900),
    L("l6", "Overhead", "Overhead allocation", 1, "lot", 1900),
  ];
  const qe402: QuoteLine[] = [
    L("l1", "Materials", "Activation bar and totem materials", 1, "lot", 8200),
    L("l2", "Workshop hours", "Workshop labour", 64, "h", 45),
    L("l3", "Finishing", "Brand-colour finishing", 1, "lot", 2100),
    L("l4", "Install", "Install, two events", 1, "lot", 4800),
    L("l5", "Transport", "Transport", 1, "lot", 1320),
    L("l6", "Overhead", "Overhead allocation", 1, "lot", 3100),
  ];
  const qe401: QuoteLine[] = [
    L("l1", "Materials", "Oak and hardware", 1, "lot", 1500),
    L("l2", "Workshop hours", "Workshop labour", 32, "h", 45),
    L("l3", "Finishing", "Oil finish", 1, "lot", 300),
    L("l4", "Install", "Single-visit install", 1, "lot", 700),
    L("l5", "Transport", "Van", 1, "lot", 200),
    L("l6", "Overhead", "Overhead allocation", 1, "lot", 1260),
  ];
  const quotes: Quote[] = [
    { id: "Q-261", name: "Burger fit-out", jobId: "FW-261", currentV: 1, versions: [
      { v: 1, name: "v1 accepted quote", note: "Accepted 11 Nov at 30.0 percent expected profit.", lines: q261v1, price: 48000 },
      { v: 2, name: "v2 forecast revision", note: "Adds 32 expected workshop hours at EUR 45 from the R03 rework.", lines: q261v2, price: 48000 }] },
    { id: "Q-264", name: "Docklands pop-up bar (premium activation reference)", jobId: "FW-264", currentV: 1, versions: [
      { v: 1, name: "v1 accepted quote", note: "Accepted. Premium brand activation priced at 32.6 percent.", lines: q264, price: 28500 }] },
    { id: "Q-E402", name: "Craft lager activation", enquiryId: "E-402", currentV: 1, versions: [
      { v: 1, name: "v1 estimate", note: "Estimate for fit review.", lines: qe402, price: 32000 }] },
    { id: "Q-E401", name: "Bar-back one-off", enquiryId: "E-401", currentV: 1, versions: [
      { v: 1, name: "v1 estimate", note: "Estimate for fit review.", lines: qe401, price: 6000 }] },
  ];

  const E = (id: string, title: string, client: string, source: Enquiry["source"], ownerId: Enquiry["ownerId"], d: number, brief: string, path: Enquiry["path"], stage: Enquiry["stage"], revenue: number, cost: number, hours: number, type: Enquiry["type"] = "commercial"): Enquiry =>
    ({ id, title, client, source, ownerId, receivedDaysAgo: d, brief, path, stage, revenue, cost, hours, type });
  const enquiries: Enquiry[] = [
    E("E-401", "Bar-back one-off", "The Anchor Rooms", "Instagram", "caio", 3, "Single oak bar-back with lit shelves. Drawings supplied by the venue.", "Quote from supplied drawings", "Discovery", 6000, 5400, 32),
    E("E-402", "Craft lager activation", "Tidewater Beverages", "Gmail", "caio", 5, "Spring brand activation: demountable bar and totem, two events.", "Paid design first", "Quoted", 32000, 22400, 64),
    E("E-403", "Hotel bar refit", "Seaview Hotel Dun Laoghaire", "Google Forms", "joyce", 8, "Full bar refit, back bar and booth seating. Brief submitted by form.", "Paid design first", "Discovery", 86000, 63000, 410),
    E("E-404", "Kitchen and utility", "Blackrock family home", "Referral", "ana", 6, "Fitted kitchen with utility run. Referral from Garden room client.", "Paid design first", "New", 24000, 18600, 150, "residential"),
    E("E-405", "Retail shop fit", "Dundrum boutique", "Gmail", "joyce", 10, "Retail fixtures and till wall. Presentation emailed.", "Quote from supplied drawings", "Quoted", 41000, 30100, 220),
    E("E-406", "Banquette refresh", "Smithfield wine bar", "Instagram", "niamh", 2, "Reupholster-free refresh of existing banquettes.", "Quote from supplied drawings", "New", 9500, 8100, 60),
  ];

  const T = (t: Omit<Task, "id" | "kind"> & { id: string; kind?: Task["kind"] }): Task => ({ kind: "task", ...t });
  const tasks: Task[] = [
    T({ id: "T-J1", title: "Chase Quay Timber on PO-262-01 for 6 birch-ply sheets", ownerId: "joyce", due: "2026-11-24", dueTime: "17:00", priority: "High", dept: "Purchasing", jobId: "FW-262", doneWhen: "shortage262", link: { page: "Purchasing", tab: "shortages", job: "FW-262" }, note: "Delivery one supplied 12 of 18." }),
    T({ id: "T-A1", title: "Send R03 for client sign-off and confirm 940 mm opening", ownerId: "ana", due: "2026-11-24", dueTime: "14:00", priority: "High", dept: "Design", jobId: "FW-261", kind: "approval", doneWhen: "r03Approved", link: { page: "Jobs", tab: "drawings", job: "FW-261" } }),
    T({ id: "T-N1", title: "Confirm 12h City shopfront move from Tuesday to Wednesday", ownerId: "niamh", due: "2026-11-24", dueTime: "11:00", priority: "High", dept: "Workshop", jobId: "FW-266", kind: "approval", doneWhen: "cityMoved", link: { page: "Workshop", tab: "capacity", job: "FW-266" } }),
    T({ id: "T-C1", title: "Review low-margin burger fit-out estimate (27.0% forecast)", ownerId: "caio", due: "2026-11-24", dueTime: "16:00", priority: "High", dept: "Commercial", jobId: "FW-261", doneWhen: "burgerReviewed", link: { page: "Job Costing", tab: "forecast", job: "FW-261" } }),
    T({ id: "T-C2", title: "Decide on the 6,000 one-off bar-back enquiry (go or pass)", ownerId: "caio", due: "2026-11-24", dueTime: "17:30", priority: "Medium", dept: "Commercial", doneWhen: "passDecided", link: { page: "Estimates", tab: "fit" } }),
    T({ id: "T-R1", title: "Close latch and paint snags at Garden room", ownerId: "rui", due: "2026-11-25", dueTime: "12:00", priority: "Medium", dept: "Installation", jobId: "FW-267", doneWhen: "snagsResolved", link: { page: "Jobs", tab: "snags", job: "FW-267" } }),
    T({ id: "T-J2", title: "Collect 12,000 installation payment from Bean & Anchor", ownerId: "joyce", due: "2026-11-26", dueTime: "12:00", priority: "Medium", dept: "Finance", jobId: "FW-265", link: { page: "Job Costing", tab: "payments", job: "FW-265" } }),
    T({ id: "T-L1", title: "Prepare concept boards for Victor house", ownerId: "leo", due: "2026-11-25", dueTime: "16:00", priority: "Low", dept: "Design", jobId: "FW-263", link: { page: "Jobs", tab: "live", job: "FW-263" } }),
    T({ id: "T-N0", title: "Check Docklands pack-out against load list LL-264", ownerId: "niamh", due: "2026-11-24", dueTime: "15:00", priority: "Medium", dept: "Workshop", jobId: "FW-264", link: { page: "Workshop", tab: "packs", job: "FW-264" } }),
  ];

  const ev = (id: string, ago: number, actor: string, jobId: string | undefined, kind: string, text: string, from?: string, to?: string, ref?: FEvent["ref"]): FEvent =>
    ({ id, at: at(ago), actor, jobId, kind, text, from, to, ref });
  const events: FEvent[] = [
    ev("e1", 26 * 60, "Ana", "FW-261", "revision", "Issued R03 for client sign-off", "R02 approved", "R03 awaiting", { page: "Jobs", tab: "drawings", job: "FW-261" }),
    ev("e2", 25 * 60, "Pack held", "FW-261", "pack", "Pack PK-261 held on R03 approval and deposit", "v2 draft", "held", { page: "Workshop", tab: "packs", job: "FW-261" }),
    ev("e3", 22 * 60, "Joyce", "FW-262", "receipt", "Received 12 of 18 birch-ply sheets against PO-262-01", "0 of 18", "12 of 18", { page: "Purchasing", tab: "deliveries", job: "FW-262" }),
    ev("e4", 20 * 60, "Ops Watchdog", "FW-262", "alert", "Banquette cutting held: 6 sheets short", undefined, undefined, { page: "Purchasing", tab: "shortages", job: "FW-262" }),
    ev("e5", 6 * 60, "Joyce", "FW-265", "payment", "Recorded installation milestone as due", "scheduled", "due", { page: "Job Costing", tab: "payments", job: "FW-265" }),
    ev("e6", 5 * 60, "Rui", "FW-266", "eod", "End of day: signage assembly 6h, 10 of 14 panels", undefined, undefined, { page: "Workshop", tab: "eod", job: "FW-266" }),
    ev("e7", 4 * 60, "Niamh", "FW-264", "pack", "Docklands kit pack-out scheduled for Tuesday", undefined, undefined, { page: "Workshop", tab: "capacity", job: "FW-264" }),
    ev("e8", 3 * 60, "Workshop Planner", undefined, "agent", "Flagged Tuesday at 44h booked against 32h available", "32h", "44h", { page: "Workshop", tab: "capacity" }),
    ev("e9", 2 * 60, "Margin Review", "FW-261", "agent", "Burger fit-out forecast 27.0%, down from 30.0%", "30.0%", "27.0%", { page: "Job Costing", tab: "forecast", job: "FW-261" }),
  ];

  const startedAt = Date.now();
  return {
    v: 1,
    meta: { base, startedAt, seq: 100 },
    ui: { role: "owner", person: "caio", tvJob: null },
    people: PEOPLE, clients: CLIENTS, suppliers: SUPPLIERS, jobs: JOBS, milestones, revisions, packs,
    workOrders: [
      { id: "WO-262-F1", jobId: "FW-262", packId: "PK-262-F", version: 1, rev: "R03", createdAt: day(4) },
      { id: "WO-264-1", jobId: "FW-264", packId: "PK-264", version: 1, rev: "R04", createdAt: day(5) },
      { id: "WO-266-1", jobId: "FW-266", packId: "PK-266", version: 1, rev: "R02", createdAt: day(6) },
    ],
    assignments, requirements, pos, receipts, invoices: [], costEntries: ce, variations, snags, programme,
    enquiries, quotes, tasks, eods: [], events, drafts: [],
    settings: { tvLargeType: true, tvRotate: false, approvalControls: true, sendingEnabled: false },
    designReceivedOn: null,
    tvNext: {}, handover: {}, blockers: {}, moves: [],
  };
}
