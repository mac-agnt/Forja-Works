import type { Assignment, Cat, FState, Job, Milestone, Pack, PersonId, ProgItem, Revision, Task } from "./types";
import { CATS } from "./types";
import { addDays, diffDays, fmtDate, fmtDateLong } from "./dates";
import { eur, pct, hrs } from "./format";

export const WORK_DAYS = ["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-30"];
export const TODAY = "2026-11-24";
export const DAY_HOURS = 8;

export type Link = { page: string; tab?: string; job?: string };

/* ── lookups ─────────────────────────────────────────────── */
export const personName = (s: FState, id: string) => s.people.find((p) => p.id === id)?.name ?? id;
export const jobOf = (s: FState, id: string) => s.jobs.find((j) => j.id === id);
export const clientOf = (s: FState, jobId: string) => s.clients.find((c) => c.id === jobOf(s, jobId)?.clientId);
export const supplierName = (s: FState, id: string) => s.suppliers.find((x) => x.id === id)?.name ?? id;
export const crew = (s: FState) => s.people.filter((p) => p.crew);
export const packOf = (s: FState, id: string) => s.packs.find((p) => p.id === id);

/* ── materials ───────────────────────────────────────────── */
export const receivedQty = (s: FState, reqId: string) => s.receipts.filter((r) => r.reqId === reqId).reduce((a, r) => a + r.qty, 0);
export const shortQty = (s: FState, reqId: string) => {
  const r = s.requirements.find((x) => x.id === reqId);
  return r ? Math.max(0, r.qty - receivedQty(s, reqId)) : 0;
};
export const totalShort = (s: FState, jobId?: string) =>
  s.requirements.filter((r) => !jobId || r.jobId === jobId).reduce((a, r) => a + shortQty(s, r.id), 0);

/* ── drawings and packs ──────────────────────────────────── */
export function currentRev(s: FState, packageId: string): Revision | undefined {
  const list = s.revisions.filter((r) => r.packageId === packageId);
  const live = list.filter((r) => r.status !== "superseded" && r.status !== "withdrawn");
  return live[live.length - 1] ?? list[list.length - 1];
}
export const depositOf = (s: FState, jobId: string): Milestone | undefined => s.milestones.find((m) => m.jobId === jobId && m.kind === "deposit");

export interface GateRow { key: string; label: string; ok: boolean; detail: string }
export function packGates(s: FState, p: Pack): GateRow[] {
  const job = jobOf(s, p.jobId)!;
  const rows: GateRow[] = [];
  for (const g of p.gates) {
    if (g === "quote") {
      rows.push({ key: g, label: "Accepted base quote", ok: job.baseQuoteAccepted, detail: job.baseQuoteAccepted ? "Quote accepted" : "Quote not accepted" });
    } else if (g === "drawing") {
      const r = currentRev(s, p.id);
      rows.push({ key: g, label: "Current revision approved", ok: !!r && r.status === "approved", detail: r ? r.rev + (r.status === "approved" ? " approved" : r.status === "changes" ? " changes requested" : " awaiting client approval") : "No drawing issued" });
    } else if (g === "deposit") {
      const d = depositOf(s, p.jobId);
      rows.push({ key: g, label: "Deposit recorded", ok: !!d && d.status === "received", detail: d ? (d.status === "received" ? eur(d.amount) + " recorded" : eur(d.amount) + " deposit outstanding") : "No deposit milestone" });
    } else if (g === "materials") {
      const reqs = s.requirements.filter((r) => r.packId === p.id);
      const short = reqs.reduce((a, r) => a + shortQty(s, r.id), 0);
      rows.push({ key: g, label: "Materials for this package", ok: short === 0, detail: short === 0 ? "All received" : short + " units short" });
    } else if (g === "variation") {
      const v = s.variations.find((x) => x.id === p.variationId);
      rows.push({ key: g, label: "Variation accepted", ok: v?.status === "accepted", detail: v?.status === "accepted" ? "Accepted" : "Awaiting client acceptance" });
    }
  }
  return rows;
}
export const gatesClear = (s: FState, p: Pack) => packGates(s, p).every((g) => g.ok);

/* ── capacity ────────────────────────────────────────────── */
export const dayAvail = (s: FState, day: string) => (WORK_DAYS.includes(day) ? crew(s).length * DAY_HOURS : 0);
export const dayPlanned = (s: FState, day: string, list: Assignment[] = s.assignments) => list.filter((a) => a.day === day).reduce((n, a) => n + a.hours, 0);
export const personLoad = (s: FState, id: PersonId, day: string, list: Assignment[] = s.assignments) =>
  list.filter((a) => a.crewId === id && a.day === day).reduce((n, a) => n + a.hours, 0);

export interface MoveItem { a: Assignment; ok: boolean; reason: string }
export interface MovePreview {
  jobId: string; from: string; to: string; items: MoveItem[]; eligible: boolean; hours: number;
  before: Record<string, number>; after: Record<string, number>; dispatchDay?: string; dispatchKept: boolean; personOk: boolean;
}
export function previewMove(s: FState, jobId: string, from: string, to: string): MovePreview {
  const movable = s.assignments.filter((a) => a.jobId === jobId && a.day === from && (a.kind === "bench" || a.kind === "finishing" || a.pinned));
  const items: MoveItem[] = movable.map((a) => {
    if (a.pinned) return { a, ok: false, reason: "Pinned: fixed commitment" };
    const free = DAY_HOURS - personLoad(s, a.crewId, to);
    if (free < a.hours) return { a, ok: false, reason: personName(s, a.crewId) + " has only " + free + "h free on " + fmtDate(to) };
    const inst = s.assignments.some((x) => x.crewId === a.crewId && x.day === to && x.kind === "install");
    if (inst) return { a, ok: false, reason: personName(s, a.crewId) + " is on an install that day" };
    return { a, ok: true, reason: "Transferable: " + personName(s, a.crewId) + " free " + free + "h" };
  });
  const dispatch = s.assignments.find((a) => a.jobId === jobId && a.kind === "dispatch");
  const dispatchKept = !dispatch || diffDays(dispatch.day, to) >= 0;
  const okItems = items.filter((i) => i.ok);
  const eligible = okItems.length > 0 && okItems.length === items.length && dispatchKept;
  const moved = s.assignments.map((a) => (okItems.some((i) => i.a.id === a.id) ? { ...a, day: to } : a));
  const days = WORK_DAYS;
  const before: Record<string, number> = {};
  const after: Record<string, number> = {};
  days.forEach((d) => { before[d] = dayPlanned(s, d); after[d] = dayPlanned(s, d, moved); });
  const personOk = crew(s).every((p) => [from, to].every((d) => personLoad(s, p.id, d, moved) <= DAY_HOURS));
  return { jobId, from, to, items, eligible, hours: okItems.reduce((n, i) => n + i.a.hours, 0), before, after, dispatchDay: dispatch?.day, dispatchKept, personOk };
}

export interface Slot { day: string; crew: PersonId[]; each: number }
export function suggestSlot(s: FState, hoursNeeded: number): Slot | null {
  const each = Math.min(DAY_HOURS, hoursNeeded / 2);
  for (const day of WORK_DAYS) {
    const free = crew(s).filter((p) => DAY_HOURS - personLoad(s, p.id, day) >= each && !s.assignments.some((a) => a.crewId === p.id && a.day === day && a.kind === "install"));
    if (free.length >= 2) return { day, crew: [free[0].id, free[1].id], each };
  }
  return null;
}

/* ── costing ─────────────────────────────────────────────── */
export interface JobCosts {
  revenue: number; quoteCost: number; quoteProfit: number; quoteMargin: number;
  actualBy: Record<Cat, number>; remainingBy: Record<Cat, number>; actual: number; remaining: number; varCost: number; varRevenue: number;
  forecast: number; forecastProfit: number; forecastMargin: number; slip: number; baseRevenue: number;
}
export function jobCosts(s: FState, jobId: string): JobCosts {
  const job = jobOf(s, jobId)!;
  const actualBy = Object.fromEntries(CATS.map((c) => [c, 0])) as Record<Cat, number>;
  s.costEntries.filter((e) => e.jobId === jobId).forEach((e) => { actualBy[e.cat] += e.amount; });
  const remainingBy = { ...job.remaining };
  const acc = s.variations.filter((v) => v.jobId === jobId && v.status === "accepted");
  const varRevenue = acc.reduce((n, v) => n + v.revenue, 0);
  const varCost = acc.reduce((n, v) => n + v.cost, 0);
  const actual = CATS.reduce((n, c) => n + actualBy[c], 0);
  const remaining = CATS.reduce((n, c) => n + remainingBy[c], 0);
  const quoteCost = CATS.reduce((n, c) => n + job.quoteCost[c], 0);
  const baseRevenue = job.contractValue;
  const revenue = baseRevenue + varRevenue;
  const forecast = actual + remaining + varCost;
  const quoteProfit = baseRevenue - quoteCost;
  const forecastProfit = revenue - forecast;
  const quoteMargin = baseRevenue ? (quoteProfit / baseRevenue) * 100 : 0;
  const forecastMargin = revenue ? (forecastProfit / revenue) * 100 : 0;
  return { revenue, baseRevenue, quoteCost, quoteProfit, quoteMargin, actualBy, remainingBy, actual, remaining, varCost, varRevenue, forecast, forecastProfit, forecastMargin, slip: quoteMargin - forecastMargin };
}
export const quoteTotals = (lines: { qty: number; rate: number; cat: string }[]) => {
  const cost = lines.reduce((n, l) => n + l.qty * l.rate, 0);
  const hours = lines.filter((l) => l.cat === "Workshop hours").reduce((n, l) => n + l.qty, 0);
  return { cost, hours };
};

/* ── design clock for FW-263 ─────────────────────────────── */
export const DESIGN_DAYS = 7;
export const DESIGN_BASELINE_RECEIPT = "2026-11-23";
export const DESIGN_BASELINE_TARGET = "2026-11-30";
export function designWhatIf(receivedOn: string) {
  const target = addDays(receivedOn, DESIGN_DAYS);
  const delay = diffDays(target, DESIGN_BASELINE_TARGET);
  return { target, delay };
}
export interface ProgRow extends ProgItem { moved: number; conflict: boolean; pendingStart: boolean }
export function programmeFor(s: FState, jobId: string): ProgRow[] {
  const items = s.programme.filter((p) => p.jobId === jobId);
  if (jobId !== "FW-263") return items.map((p) => ({ ...p, moved: 0, conflict: false, pendingStart: false }));
  const paid = s.designReceivedOn;
  const delay = paid ? designWhatIf(paid).delay : 0;
  const rows = items.map((p) => {
    if (p.id === "p-263-1") return { ...p, forecast: paid ? designWhatIf(paid).target : p.baseline, moved: delay, conflict: false, pendingStart: !paid };
    if (p.kind === "fixed") return { ...p, moved: 0, conflict: false, pendingStart: false };
    return { ...p, forecast: addDays(p.baseline, delay), moved: delay, conflict: false, pendingStart: !paid };
  });
  return rows.map((r) => ({ ...r, conflict: !!r.blocksWorkshop && rows.some((o) => o.kind === "fixed" && o.forecast === r.forecast) }));
}

/* ── tasks ───────────────────────────────────────────────── */
export function taskDone(s: FState, t: Task): boolean {
  if (t.manualDone) return true;
  switch (t.doneWhen) {
    case "shortage262": return totalShort(s, "FW-262") === 0;
    case "r03Approved": { const r = currentRev(s, "PK-261"); return !!r && r.rev === "R03" && r.status === "approved"; }
    case "cityMoved": return s.moves.some((m) => m.jobId === "FW-266");
    case "snagsResolved": return s.snags.filter((x) => x.jobId === "FW-267").every((x) => x.status !== "open");
    case "passDecided": return s.enquiries.some((e) => e.id === "E-401" && !!e.decision);
    case "burgerReviewed": return false;
    default:
      if (t.doneWhen?.startsWith("slot:")) return !!packOf(s, t.doneWhen.slice(5))?.slotDay && packOf(s, t.doneWhen.slice(5))!.status !== "ready";
      if (t.doneWhen?.startsWith("rev:")) { const r = s.revisions.find((x) => x.id === t.doneWhen!.slice(4)); return !!r && r.status !== "changes"; }
      return false;
  }
}
export const openTasks = (s: FState) => s.tasks.filter((t) => !taskDone(s, t));

/* ── job summary ─────────────────────────────────────────── */
export interface JobSummary {
  state: string;
  tone: "ok" | "warn" | "bad" | "info";
  next: string;
  owner: string;
  ownerKind: "client" | "staff";
  affects?: string;
  link: Link;
}
export function jobSummary(s: FState, job: Job): JobSummary {
  const code = job.code;
  const L = (page: string, tab?: string): Link => ({ page, tab, job: code });
  const pk = (id: string) => packOf(s, id);
  if (code === "FW-261") {
    const p = pk("PK-261")!;
    const rev = currentRev(s, "PK-261")!;
    const dep = depositOf(s, code)!;
    const approved = rev.status === "approved";
    const paid = dep.status === "received";
    if (rev.status === "changes") return { state: "Held · " + rev.rev + " changes requested", tone: "bad", next: "Designer revises " + rev.rev, owner: "Ana", ownerKind: "staff", link: L("Jobs", "drawings") };
    if (!approved && !paid) return { state: "Held · " + rev.rev + " awaiting approval · " + eur(dep.amount) + " deposit outstanding", tone: "bad", next: "Client approves " + rev.rev, owner: clientOf(s, code)!.contact, ownerKind: "client", affects: "Workshop release", link: L("Jobs", "drawings") };
    if (approved && !paid) return { state: "Drawing approved · waiting for " + eur(dep.amount) + " deposit", tone: "warn", next: "Confirm " + eur(dep.amount) + " deposit receipt", owner: "Joyce", ownerKind: "staff", link: L("Job Costing", "payments") };
    if (!approved && paid) return { state: "Deposit recorded · waiting for " + rev.rev + " approval", tone: "warn", next: "Client approves " + rev.rev, owner: clientOf(s, code)!.contact, ownerKind: "client", affects: "Workshop release", link: L("Jobs", "drawings") };
    if (p.status === "ready") return { state: "Pack released · " + rev.rev + " ready for a slot", tone: "ok", next: "Assign workshop slot", owner: "Niamh", ownerKind: "staff", link: L("Workshop", "packs") };
    if (p.status === "scheduled") return { state: "In production · " + fmtDate(p.slotDay!), tone: "ok", next: "Crew builds counter on " + rev.rev, owner: personName(s, p.leadId), ownerKind: "staff", link: L("Workshop", "today") };
    return { state: "Production", tone: "ok", next: "Continue build", owner: personName(s, p.leadId), ownerKind: "staff", link: L("Workshop", "today") };
  }
  if (code === "FW-262") {
    const short = totalShort(s, code);
    const pb = pk("PK-262-1")!;
    if (short > 0) return { state: "Fabrication · banquette cutting held, " + short + " sheets short", tone: "warn", next: "Receive " + short + " birch-ply sheets", owner: "Joyce", ownerKind: "staff", link: L("Purchasing", "shortages") };
    if (pb.status === "ready") return { state: "Materials cleared · cutting needs a slot", tone: "info", next: "Choose a slot for banquette cutting", owner: "Niamh", ownerKind: "staff", link: L("Workshop", "packs") };
    return { state: "Fabrication under way", tone: "ok", next: "Crew cuts banquette", owner: "Eva", ownerKind: "staff", link: L("Workshop", "today") };
  }
  if (code === "FW-263") {
    const paid = s.designReceivedOn;
    const rev = currentRev(s, "PK-263");
    if (!paid) return { state: "Design fee outstanding · clock not started", tone: "warn", next: "Client pays " + eur(1800) + " design fee", owner: "Victor Hennessy", ownerKind: "client", affects: "Design target " + fmtDate(DESIGN_BASELINE_TARGET) + " or later", link: L("Jobs", "live") };
    if (rev && rev.status === "changes") return { state: "Design · revision requested", tone: "warn", next: "Designer revises " + rev.rev, owner: "Ana", ownerKind: "staff", link: L("Jobs", "drawings") };
    return { state: "Design under way · target " + fmtDate(designWhatIf(paid).target), tone: "ok", next: "Ana delivers design for review", owner: "Ana", ownerKind: "staff", affects: fmtDate(designWhatIf(paid).target), link: L("Jobs", "programme") };
  }
  if (code === "FW-264") return { state: "Approved pack ready · install " + fmtDate("2026-11-27"), tone: "ok", next: "Pack out and load for Friday install", owner: "Rui", ownerKind: "staff", affects: "Install Fri 27 Nov", link: L("Workshop", "packs") };
  if (code === "FW-265") {
    const m = s.milestones.find((x) => x.id === "M-265-2")!;
    return { state: "Crew on site · " + eur(m.amount) + " installation payment " + (m.status === "received" ? "received" : "due"), tone: m.status === "received" ? "ok" : "warn", next: m.status === "received" ? "Finish install" : "Collect " + eur(m.amount) + " installation payment", owner: "Joyce", ownerKind: "staff", link: L("Job Costing", "payments") };
  }
  if (code === "FW-266") {
    const moved = s.moves.some((m) => m.jobId === code);
    return { state: moved ? "Signage assembly · moved to Wed, dispatch Thu kept" : "Signage assembly in production", tone: moved ? "ok" : "warn", next: moved ? "Dispatch Thursday 26 Nov" : "Confirm 12h move to Wednesday", owner: "Niamh", ownerKind: "staff", link: L("Workshop", "capacity") };
  }
  const snags = s.snags.filter((x) => x.jobId === "FW-267");
  const open = snags.filter((x) => x.status === "open").length;
  const wait = snags.filter((x) => x.status === "resolved").length;
  const fin = s.milestones.find((m) => m.id === "M-267-3")!;
  if (open > 0) return { state: open + " snag" + (open > 1 ? "s" : "") + " open", tone: "warn", next: "Installer closes " + open + " snag" + (open > 1 ? "s" : ""), owner: "Rui", ownerKind: "staff", link: L("Jobs", "snags") };
  if (wait > 0) return { state: "Snags resolved · waiting for client sign-off", tone: "info", next: "Client confirms resolved snags", owner: "Orla Brennan", ownerKind: "client", affects: eur(fin.amount) + " final payment", link: L("Jobs", "snags") };
  if (fin.status === "received") return { state: "Complete", tone: "ok", next: "Handover complete", owner: "Joyce", ownerKind: "staff", link: L("Jobs", "snags") };
  return { state: "Signed off · " + eur(fin.amount) + " final payment due", tone: "warn", next: "Confirm " + eur(fin.amount) + " final payment", owner: "Joyce", ownerKind: "staff", link: L("Job Costing", "payments") };
}

/* ── exceptions ──────────────────────────────────────────── */
export interface Exc {
  id: string; severity: "high" | "medium"; title: string; jobId?: string; owner: string; route: "Niamh" | "Caio" | "Joyce" | "Client";
  blocking: string; evidence: string; unaffected?: string; link: Link;
}
export function exceptions(s: FState): Exc[] {
  const out: Exc[] = [];
  const tue = dayPlanned(s, TODAY), av = dayAvail(s, TODAY);
  if (tue > av) out.push({ id: "x-cap", severity: "high", title: "Tuesday has " + tue + "h booked against " + av + "h available", owner: "Niamh", route: "Niamh", blocking: "Rui and Ben are over eight hours on Tuesday", evidence: "Workshop Planner, capacity grid " + fmtDate(TODAY), unaffected: "Docklands install on Friday is pinned and unaffected", link: { page: "Workshop", tab: "capacity", job: "FW-266" } });
  const p1 = packOf(s, "PK-261")!;
  if (p1.status === "held") {
    const g = packGates(s, p1).filter((x) => !x.ok);
    out.push({ id: "x-261", severity: "high", title: "Burger counter pack held: " + g.map((x) => x.detail.toLowerCase()).join("; "), jobId: "FW-261", owner: g.some((x) => x.key === "drawing") ? "Dara Whelan (client)" : "Joyce", route: g.some((x) => x.key === "drawing") ? "Client" : "Joyce", blocking: g.map((x) => x.label).join(" and "), evidence: "Gate check on PK-261 v" + p1.version, unaffected: "Materials for this package are received", link: { page: "Jobs", tab: "drawings", job: "FW-261" } });
  }
  s.requirements.forEach((r) => {
    const sh = shortQty(s, r.id);
    if (sh > 0) {
      const po = s.pos.find((x) => x.id === r.poId);
      out.push({ id: "x-sh-" + r.id, severity: "high", title: sh + " " + r.item.toLowerCase() + " " + r.unit + "s short on " + r.poId, jobId: r.jobId, owner: personName(s, po?.buyerId ?? "joyce"), route: "Joyce", blocking: "Banquette cutting task cannot start", evidence: receivedQty(s, r.id) + " of " + r.qty + " received, " + r.poId, unaffected: "16h of finishing uses different materials and continues", link: { page: "Purchasing", tab: "shortages", job: r.jobId } });
    }
  });
  const packCleared = s.packs.find((p) => p.id === "PK-262-1");
  if (packCleared && packCleared.status === "ready" && !packCleared.slotDay) out.push({ id: "x-slot-262", severity: "medium", title: "Banquette cutting is ready and has no slot", jobId: "FW-262", owner: "Niamh", route: "Niamh", blocking: "Production manager to choose day and crew", evidence: "Materials hold cleared by receipt", link: { page: "Workshop", tab: "packs", job: "FW-262" } });
  const p1r = packOf(s, "PK-261")!;
  if (p1r.status === "ready" && !p1r.slotDay) out.push({ id: "x-slot-261", severity: "medium", title: "Burger counter pack released and waiting for a slot", jobId: "FW-261", owner: "Niamh", route: "Niamh", blocking: "No capacity assigned until the production manager picks a slot", evidence: "Released on R03", link: { page: "Workshop", tab: "packs", job: "FW-261" } });
  if (p1.history.some((h) => h.status === "withdrawn") && p1.status === "held") out.push({ id: "x-sup", severity: "medium", title: "Superseded R02 pack withdrawn: printed copies may exist", jobId: "FW-261", owner: "Niamh", route: "Niamh", blocking: "No cutting on R02 dimensions (900 mm opening)", evidence: "PK-261 v1 withdrawn, R03 changes the opening to 940 mm", link: { page: "Workshop", tab: "packs", job: "FW-261" } });
  Object.entries(s.blockers).forEach(([jobId, text]) => {
    if (text) out.push({ id: "x-bl-" + jobId, severity: "medium", title: "Blocker reported: " + text, jobId, owner: "Niamh", route: "Niamh", blocking: text, evidence: "End-of-day entry", link: { page: "Workshop", tab: "eod", job: jobId } });
  });
  const conflict = programmeFor(s, "FW-263").find((r) => r.conflict);
  if (conflict) out.push({ id: "x-conf", severity: "medium", title: "Victor house workshop start now lands on the fixed supplier delivery slot", jobId: "FW-263", owner: "Niamh", route: "Niamh", blocking: "Provisional date " + fmtDate(conflict.forecast) + " conflicts, capacity not promised", evidence: "Design fee received late, dependent dates moved " + conflict.moved + " day", link: { page: "Jobs", tab: "programme", job: "FW-263" } });
  const c61 = jobCosts(s, "FW-261");
  if (c61.slip >= 1) out.push({ id: "x-mar", severity: "medium", title: "Burger fit-out forecast margin " + pct(c61.forecastMargin) + " against " + pct(c61.quoteMargin) + " quoted", jobId: "FW-261", owner: "Caio", route: "Caio", blocking: "Commercial decision: absorb or price a variation", evidence: "32 extra workshop hours expected (" + eur(1440) + ")", link: { page: "Job Costing", tab: "forecast", job: "FW-261" } });
  return out;
}

/* ── briefing ────────────────────────────────────────────── */
export interface Clause { text: string; done: boolean; link: Link }
export function briefing(s: FState): Clause[] {
  const tue = dayPlanned(s, TODAY), av = dayAvail(s, TODAY);
  const p = packOf(s, "PK-261")!;
  const rev = currentRev(s, "PK-261")!;
  const dep = depositOf(s, "FW-261")!;
  const short = totalShort(s, "FW-262");
  const out: Clause[] = [];
  out.push(tue > av
    ? { text: "Tuesday has " + tue + " workshop hours booked against " + av + " available.", done: false, link: { page: "Workshop", tab: "capacity" } }
    : { text: "Tuesday is within capacity at " + tue + " of " + av + " workshop hours.", done: true, link: { page: "Workshop", tab: "capacity" } });
  if (p.status === "held") {
    const bits: string[] = [];
    if (rev.status !== "approved") bits.push(rev.rev + " approval");
    if (dep.status !== "received") bits.push("a " + eur(dep.amount) + " deposit");
    out.push({ text: "The burger counter is waiting on " + bits.join(" and ") + ".", done: false, link: { page: "Jobs", tab: "drawings", job: "FW-261" } });
  } else {
    out.push({ text: "The burger counter pack is released on " + rev.rev + (p.slotDay ? " and booked for " + fmtDate(p.slotDay) + "." : " and needs a slot from Niamh."), done: true, link: { page: "Workshop", tab: "packs", job: "FW-261" } });
  }
  out.push(short > 0
    ? { text: "Pizza is " + short + " birch-ply sheet" + (short > 1 ? "s" : "") + " short.", done: false, link: { page: "Purchasing", tab: "shortages", job: "FW-262" } }
    : { text: "Pizza has all 18 birch-ply sheets and its cutting hold is cleared.", done: true, link: { page: "Workshop", tab: "packs", job: "FW-262" } });
  return out;
}

/* ── KPIs for dashboard ──────────────────────────────────── */
export interface KpiRow { label: string; detail: string; link: Link }
export interface Kpi { id: string; label: string; value: string; sub: string; tone: "ok" | "warn" | "bad" | "info"; rows: KpiRow[] }
export function kpis(s: FState): Record<"owner" | "production" | "commercial", Kpi[]> {
  const exc = exceptions(s);
  const decisions = [
    ...exc.filter((e) => e.route === "Caio").map((e) => ({ label: e.title, detail: e.blocking, link: e.link })),
    ...openTasks(s).filter((t) => t.ownerId === "caio").map((t) => ({ label: t.title, detail: "Due " + t.dueTime, link: t.link as Link })),
  ];
  const slips = s.jobs.map((j) => ({ j, c: jobCosts(s, j.code) })).filter((x) => x.c.slip >= 1);
  const ready = s.packs.filter((p) => p.status === "ready");
  const held = s.packs.filter((p) => p.status === "held");
  const tue = dayPlanned(s, TODAY), av = dayAvail(s, TODAY);
  const wk = WORK_DAYS.reduce((n, d) => n + dayPlanned(s, d), 0), wkAv = WORK_DAYS.reduce((n, d) => n + dayAvail(s, d), 0);
  const due = s.milestones.filter((m) => m.status === "due" || m.status === "outstanding");
  const pend = s.variations.filter((v) => v.status === "pending");
  const margins = s.jobs.filter((j) => j.code !== "FW-263").map((j) => jobCosts(s, j.code));
  const rev = margins.reduce((n, c) => n + c.revenue, 0), prof = margins.reduce((n, c) => n + c.forecastProfit, 0);
  const jl = (code: string): Link => ({ page: "Jobs", tab: "live", job: code });
  return {
    owner: [
      { id: "o1", label: "Decisions for Caio", value: String(decisions.length), sub: "estimate review and go or pass", tone: decisions.length ? "warn" : "ok", rows: decisions },
      { id: "o2", label: "Margin slips", value: String(slips.length), sub: slips.map((x) => x.j.code).join(", ") || "none", tone: slips.length ? "bad" : "ok", rows: slips.map((x) => ({ label: x.j.code + " " + x.j.name, detail: "Forecast " + pct(x.c.forecastMargin) + " vs " + pct(x.c.quoteMargin) + " quoted", link: { page: "Job Costing", tab: "forecast", job: x.j.code } })) },
      { id: "o3", label: "Held jobs", value: String(held.length), sub: "packs not released", tone: held.length ? "warn" : "ok", rows: held.map((p) => ({ label: p.jobId + " " + p.label, detail: packGates(s, p).filter((g) => !g.ok).map((g) => g.detail).join("; "), link: { page: "Workshop", tab: "packs", job: p.jobId } })) },
      { id: "o4", label: "Live jobs", value: String(s.jobs.length), sub: s.jobs.filter((j) => j.type === "commercial").length + " commercial, " + s.jobs.filter((j) => j.type === "residential").length + " residential", tone: "info", rows: s.jobs.map((j) => ({ label: j.code + " " + j.name, detail: jobSummary(s, j).state, link: jl(j.code) })) },
    ],
    production: [
      { id: "p1", label: "Ready packs", value: String(ready.length), sub: "released, waiting for a slot", tone: ready.length ? "info" : "ok", rows: ready.map((p) => ({ label: p.jobId + " " + p.label, detail: "v" + p.version + " on " + (currentRev(s, p.id)?.rev ?? ""), link: { page: "Workshop", tab: "packs", job: p.jobId } })) },
      { id: "p2", label: "Tuesday load", value: tue + "/" + av + "h", sub: tue > av ? "over by " + (tue - av) + "h" : "within capacity", tone: tue > av ? "bad" : "ok", rows: s.assignments.filter((a) => a.day === TODAY).map((a) => ({ label: a.jobId + " " + a.label, detail: personName(s, a.crewId) + " " + a.hours + "h", link: { page: "Workshop", tab: "capacity", job: a.jobId } })) },
      { id: "p3", label: "Week demand", value: wk + "/" + wkAv + "h", sub: "booked vs available to Mon 30 Nov", tone: wk > wkAv ? "bad" : "info", rows: WORK_DAYS.map((d) => ({ label: fmtDate(d), detail: dayPlanned(s, d) + "/" + dayAvail(s, d) + "h", link: { page: "Workshop", tab: "capacity" } })) },
      { id: "p4", label: "Shortages", value: String(totalShort(s)), sub: "units short across open orders", tone: totalShort(s) ? "warn" : "ok", rows: s.requirements.filter((r) => shortQty(s, r.id) > 0).map((r) => ({ label: r.jobId + " " + r.item, detail: shortQty(s, r.id) + " short on " + r.poId, link: { page: "Purchasing", tab: "shortages", job: r.jobId } })) },
    ],
    commercial: [
      { id: "c1", label: "Forecast margin", value: pct(rev ? (prof / rev) * 100 : 0), sub: "across 6 build jobs", tone: "info", rows: s.jobs.filter((j) => j.code !== "FW-263").map((j) => ({ label: j.code + " " + j.name, detail: pct(jobCosts(s, j.code).forecastMargin) + " on " + eur(jobCosts(s, j.code).revenue), link: { page: "Job Costing", tab: "forecast", job: j.code } })) },
      { id: "c2", label: "Changes awaiting acceptance", value: String(pend.length), sub: pend.map((v) => v.id + " " + eur(v.revenue, true)).join(", ") || "none", tone: pend.length ? "warn" : "ok", rows: pend.map((v) => ({ label: v.id + " " + v.title, detail: eur(v.revenue, true) + " revenue, " + eur(v.cost, true) + " expected cost", link: { page: "Estimates", tab: "variations", job: v.jobId } })) },
      { id: "c3", label: "Payments due", value: eur(due.reduce((n, m) => n + m.amount, 0)), sub: due.length + " milestones", tone: due.length ? "warn" : "ok", rows: due.map((m) => ({ label: m.jobId + " " + m.label, detail: eur(m.amount) + ", " + m.dueNote, link: { page: "Job Costing", tab: "payments", job: m.jobId } })) },
      { id: "c4", label: "Open enquiries", value: String(s.enquiries.filter((e) => e.stage !== "Passed" && e.stage !== "Won").length), sub: "not in the seven live jobs", tone: "info", rows: s.enquiries.filter((e) => e.stage !== "Passed" && e.stage !== "Won").map((e) => ({ label: e.id + " " + e.title, detail: eur(e.revenue) + ", " + eur(Math.round(((e.revenue - e.cost) / Math.max(e.hours, 1)) * 100) / 100) + " profit per workshop hour", link: { page: "Estimates", tab: "fit" } })) },
    ],
  };
}

/* ── TV ──────────────────────────────────────────────────── */
export interface TvRow { jobId: string; jobName: string; station: string; lead: string; rev: string; status: string; tone: "ok" | "warn" | "bad" | "info"; next: string; due: string; version: number }
export function tvRows(s: FState): TvRow[] {
  const rows: TvRow[] = [];
  const seen = new Set<string>();
  s.packs.filter((p) => p.status !== "complete").forEach((p) => {
    const job = jobOf(s, p.jobId)!;
    const rev = currentRev(s, p.id)?.rev ?? "R01";
    const today = s.assignments.filter((a) => a.packId === p.id && a.day === TODAY);
    const override = s.tvNext[p.jobId];
    let status = "", tone: TvRow["tone"] = "ok", next = "", due = "Today 17:00";
    if (p.status === "held") {
      const miss = packGates(s, p).filter((g) => !g.ok);
      status = "HELD"; tone = "bad";
      next = "Do not cut. " + miss.map((g) => g.detail).join("; ");
      due = "Waiting";
    } else if (p.status === "ready") {
      status = "READY - NO SLOT YET"; tone = "info";
      const sl = suggestSlot(s, p.hoursNeeded);
      next = "Niamh to assign slot" + (sl ? " (next free " + fmtDate(sl.day) + ")" : "");
      due = "Waiting for Niamh";
    } else {
      status = today.length ? "IN PROGRESS" : "SCHEDULED"; tone = "ok";
      const nextDay = s.assignments.filter((a) => a.packId === p.id && a.day >= TODAY).sort((a, b) => a.day.localeCompare(b.day))[0];
      next = override || (nextDay ? nextDay.label + " (" + fmtDate(nextDay.day) + ")" : "Continue");
      due = nextDay ? (nextDay.day === TODAY ? "Today 17:00" : fmtDate(nextDay.day)) : "Today 17:00";
    }
    if (override && p.status !== "held") next = override;
    rows.push({ jobId: p.jobId, jobName: job.name, station: p.station, lead: personName(s, p.leadId), rev, status, tone, next, due, version: p.version });
    seen.add(p.id);
  });
  return rows;
}

/* ── activity helper ─────────────────────────────────────── */
export const eventsSorted = (s: FState) => [...s.events].sort((a, b) => b.at - a.at);

/* ── fit review ──────────────────────────────────────────── */
export function fit(s: FState, id: string) {
  const e = s.enquiries.find((x) => x.id === id)!;
  const profit = e.revenue - e.cost;
  const perHour = e.hours ? profit / e.hours : 0;
  const marginPct = e.revenue ? (profit / e.revenue) * 100 : 0;
  const weekFree = WORK_DAYS.reduce((n, d) => n + Math.max(0, dayAvail(s, d) - dayPlanned(s, d)), 0);
  return { e, profit, perHour, marginPct, weekFree, fits: e.hours <= weekFree + 60 };
}

/* ── portal (client-safe payload) ────────────────────────── */
export interface PortalPayload {
  code: string; name: string; clientName: string; contact: string;
  next: { text: string; owedBy: string; affects: string; ownedByClient: boolean };
  programme: { label: string; date: string; baseline?: string; reason?: string; state: "done" | "next" | "later"; fixed: boolean }[];
  drawing: { id: string; rev: string; title: string; status: string; note: string; openingMm?: number; comment?: string; approvedOn?: string; actionable: boolean } | null;
  drawingHistory: { rev: string; status: string }[];
  payments: { id: string; label: string; amount: number; status: string; note: string; isDesignFee: boolean }[];
  variations: { id: string; title: string; amount: number; status: string; note: string; kind: string }[];
  snags: { id: string; title: string; status: string }[];
  designFee: { amount: number; outstanding: boolean; target?: string } | null;
}
export function portalPayload(s: FState, jobId: string): PortalPayload | null {
  const job = jobOf(s, jobId);
  const client = clientOf(s, jobId);
  if (!job || !client) return null;
  const sum = jobSummary(s, job);
  const pkgId = job.code === "FW-261" ? "PK-261" : "PK-" + job.code.slice(3);
  const rev = s.revisions.filter((r) => r.jobId === jobId && r.status !== "superseded" && r.status !== "withdrawn").slice(-1)[0] ?? null;
  const prog = programmeFor(s, jobId).map((p, i, arr) => {
    const moved = p.moved > 0 && p.forecast !== p.baseline;
    const first = arr.findIndex((x) => x.forecast >= "2026-11-24");
    return { label: p.clientLabel, date: p.forecast, baseline: moved ? p.baseline : undefined, reason: moved ? "Design fee received after the original assumed date" : undefined, state: (p.forecast < "2026-11-24" ? "done" : i === first ? "next" : "later") as "done" | "next" | "later", fixed: p.kind === "fixed" };
  });
  const ms = s.milestones.filter((m) => m.jobId === jobId);
  const payments = ms.map((m) => ({ id: m.id, label: m.label, amount: m.amount, status: m.status === "received" ? "Paid" : m.status === "due" || m.status === "outstanding" ? "Due" : m.status === "locked" ? "After sign-off" : "Scheduled", note: m.dueNote, isDesignFee: m.kind === "design" }));
  const vs = s.variations.filter((v) => v.jobId === jobId).map((v) => ({ id: v.id, title: v.title, amount: v.revenue, status: v.status === "pending" ? "Awaiting your decision" : v.status === "accepted" ? "Accepted" : "Declined", note: v.note, kind: v.kind }));
  const fee = ms.find((m) => m.kind === "design" && m.status === "outstanding");
  const owedByClient = sum.ownerKind === "client";
  void pkgId;
  return {
    code: job.code, name: job.name, clientName: client.name, contact: client.contact,
    next: { text: owedByClient ? sum.next : "Nothing needed from you right now. " + sum.next + " is with " + sum.owner + ".", owedBy: owedByClient ? "You" : sum.owner, affects: sum.affects ?? (prog.find((p) => p.state === "next")?.label ?? ""), ownedByClient: owedByClient },
    programme: prog,
    drawing: rev ? { id: rev.id, rev: rev.rev, title: rev.title, status: rev.status === "approved" ? "Approved" : rev.status === "changes" ? "Changes requested" : "Awaiting your approval", note: rev.note, openingMm: rev.openingMm, comment: rev.comment, approvedOn: rev.approvedAt ? String(rev.approvedAt) : undefined, actionable: rev.status === "awaiting" } : null,
    drawingHistory: s.revisions.filter((r) => r.jobId === jobId).map((r) => ({ rev: r.rev, status: r.status === "superseded" ? "Replaced" : r.status === "approved" ? "Approved" : r.status === "changes" ? "Changes requested" : "Awaiting approval" })),
    payments, variations: vs,
    snags: s.snags.filter((x) => x.jobId === jobId).map((x) => ({ id: x.id, title: x.title, status: x.status === "open" ? "Being fixed" : x.status === "resolved" ? "Fixed, please confirm" : "Confirmed" })),
    designFee: fee ? { amount: fee.amount, outstanding: true } : jobId === "FW-263" ? { amount: 1800, outstanding: false, target: s.designReceivedOn ? designWhatIf(s.designReceivedOn).target : undefined } : null,
  };
}

/* ── agents and chat ─────────────────────────────────────── */
export interface AgentCard { id: string; name: string; remit: string; evidence: string[]; lastRun: string; suggestion: string; link: Link; linkLabel: string; body: string }
export function agents(s: FState): AgentCard[] {
  const exc = exceptions(s);
  const brief = briefing(s);
  const c61 = jobCosts(s, "FW-261");
  const mv = previewMove(s, "FW-266", TODAY, "2026-11-25");
  const moved = s.moves.some((m) => m.jobId === "FW-266");
  const short = totalShort(s, "FW-262");
  const drafts = s.drafts[s.drafts.length - 1];
  return [
    { id: "briefing", name: "Briefing", remit: "Writes Caio's morning summary from live state.", evidence: brief.map((b) => b.text), lastRun: "08:02 today", suggestion: brief.find((b) => !b.done)?.text ?? "Everything on the board is cleared.", link: brief.find((b) => !b.done)?.link ?? { page: "Dashboard", tab: "owner" }, linkLabel: "Open", body: brief.map((b) => b.text).join(" ") },
    { id: "watchdog", name: "Ops Watchdog", remit: "Names the blocking condition, owner and evidence on every exception.", evidence: exc.slice(0, 3).map((e) => e.title + " (" + e.owner + ")"), lastRun: "08:15 today", suggestion: exc[0] ? "Route to " + exc[0].route + ": " + exc[0].title : "No open exceptions.", link: exc[0]?.link ?? { page: "Work", tab: "exceptions" }, linkLabel: "Open exception", body: exc.length + " open exceptions. Routine items go to Niamh. Unresolved commercial decisions escalate to Caio." },
    { id: "planner", name: "Workshop Planner", remit: "Previews moves and slots. Niamh confirms before anything changes.", evidence: ["Tuesday " + dayPlanned(s, TODAY) + "/" + dayAvail(s, TODAY) + "h", "Wednesday " + dayPlanned(s, "2026-11-25") + "/" + dayAvail(s, "2026-11-25") + "h"], lastRun: "08:20 today", suggestion: moved ? "Move confirmed. Tuesday " + dayPlanned(s, TODAY) + "/32h, Wednesday " + dayPlanned(s, "2026-11-25") + "/32h." : "Move City shopfront 6h x 2 to Wednesday: Tuesday " + mv.after[TODAY] + "/32h, Wednesday " + mv.after["2026-11-25"] + "/32h, Thursday dispatch unchanged.", link: { page: "Workshop", tab: "capacity", job: "FW-266" }, linkLabel: "Open capacity", body: "Preview only until the production manager confirms." },
    { id: "materials", name: "Materials", remit: "Matches deliveries to purchase orders. A buyer confirms quantities.", evidence: ["PO-262-01: " + receivedQty(s, "rq-262-ply") + " of 18 received"], lastRun: "07:55 today", suggestion: short > 0 ? "Receive the " + short + " outstanding sheets against PO-262-01. Cannot approve a substitution." : "Delivery matched. Banquette cutting can proceed once Niamh picks a slot.", link: { page: "Purchasing", tab: "shortages", job: "FW-262" }, linkLabel: "Open shortages", body: "Buyer: Joyce." },
    { id: "margin", name: "Margin Review", remit: "Explains slips and opens the extra allowance.", evidence: ["Quoted " + pct(c61.quoteMargin), "Forecast " + pct(c61.forecastMargin), "32 extra workshop hours at €45 = €1,440"], lastRun: "08:30 today", suggestion: c61.slip >= 1 ? "Burger margin is " + (c61.slip).toFixed(1) + " points down. Review the estimate or start a priced variation." : "Margin is back on quote.", link: { page: "Job Costing", tab: "forecast", job: "FW-261" }, linkLabel: "Open forecast", body: "Caio can review the estimate or start a priced variation." },
    { id: "programme", name: "Client Programme", remit: "Drafts client-facing programme updates. Joyce previews, nothing is sent.", evidence: drafts ? [drafts.trigger] : ["No pending trigger"], lastRun: drafts ? "just now" : "yesterday", suggestion: drafts ? drafts.text : "Your design target is now Tuesday 1 December, if the design fee is received today.", link: { page: "Jobs", tab: "programme", job: "FW-263" }, linkLabel: "Open programme", body: "Local preview only. Sending is disabled in this demo." },
  ];
}

export interface Answer { text: string; tool: string; cols?: string[]; rows?: string[][]; actions: { label: string; link: Link }[] }
export function answer(s: FState, q: string): Answer {
  const t = q.toLowerCase();
  if (/build|today|bench|floor|ready/.test(t)) {
    const rows = tvRows(s).map((r) => [r.jobId, r.jobName, r.status.toLowerCase(), r.next]);
    const ready = tvRows(s).filter((r) => r.status === "IN PROGRESS").length;
    return { tool: "workshop_queue", text: "The crew can build " + ready + " jobs today (" + tvRows(s).filter((r) => r.status === "IN PROGRESS").map((r) => r.jobId).join(", ") + "). Burger counter is " + (packOf(s, "PK-261")!.status === "held" ? "held on R03 approval and deposit" : "released") + " and pizza cutting " + (totalShort(s) ? "waits on " + totalShort(s) + " sheets" : "is cleared") + ". Tuesday is " + dayPlanned(s, TODAY) + " of " + dayAvail(s, TODAY) + "h.", cols: ["Job", "Name", "State", "Next"], rows, actions: [{ label: "Open Workshop today", link: { page: "Workshop", tab: "today" } }, { label: "Open capacity", link: { page: "Workshop", tab: "capacity" } }] };
  }
  if (/margin|losing|profit|cost/.test(t)) {
    const rows = s.jobs.filter((j) => j.code !== "FW-263").map((j) => { const c = jobCosts(s, j.code); return [j.code, pct(c.quoteMargin), pct(c.forecastMargin), (c.slip >= 0 ? "-" : "+") + Math.abs(c.slip).toFixed(1) + " pts"]; }).sort((a, b) => parseFloat(b[3].replace(/[-+]/, "")) - parseFloat(a[3].replace(/[-+]/, "")));
    return { tool: "job_costing_forecast", text: "Burger fit-out is the one to watch: " + pct(jobCosts(s, "FW-261").forecastMargin) + " forecast against 30.0% quoted. The slip is 32 extra workshop hours at €45, " + eur(1440) + ". Rathmines café also sits low on labour overrun.", cols: ["Job", "Quoted", "Forecast", "Slip"], rows, actions: [{ label: "Open burger forecast", link: { page: "Job Costing", tab: "forecast", job: "FW-261" } }, { label: "Start priced variation", link: { page: "Estimates", tab: "variations", job: "FW-261" } }] };
  }
  if (/wait|client|owe|pay/.test(t)) {
    const rows = s.jobs.map((j) => ({ j, sm: jobSummary(s, j) })).filter((x) => x.sm.ownerKind === "client").map((x) => [x.j.code, x.j.name, x.sm.owner, x.sm.next]);
    const pay = s.milestones.filter((m) => m.status === "outstanding" || m.status === "due").map((m) => [m.jobId, m.label, eur(m.amount), m.dueNote]);
    return { tool: "client_waiting", text: "We are waiting on clients for " + rows.length + " things and on " + pay.length + " payments. The burger drawing and the Victor design fee are the two that hold work.", cols: ["Job", "Item", "Owed by", "What"], rows: rows.concat(pay.map((p) => [p[0], p[1], p[2], p[3]])), actions: [{ label: "Open Victor portal", link: { page: "Jobs", tab: "live", job: "FW-263" } }, { label: "Open payments", link: { page: "Job Costing", tab: "payments" } }] };
  }
  return { tool: "core_search", text: "I can answer from Forja Works' local records: ask what we can build today, which job is losing margin, or what we are waiting on clients for.", actions: [{ label: "What can we build today?", link: { page: "Workshop", tab: "today" } }] };
}

export { eur, pct, hrs, fmtDate, fmtDateLong };
