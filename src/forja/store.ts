import { useSyncExternalStore } from "react";
import type { Actor, Cat, FEvent, FState, Pack, PersonId, Result, Role, Task } from "./types";
import { seedState } from "./seed";
import {
  TODAY, clientOf, crew, currentRev, designWhatIf, gatesClear, jobOf, packOf, personLoad, personName, previewMove, programmeFor,
  receivedQty, shortQty,
} from "./derive";
import { dayOf, fmtDate } from "./dates";
import { eur } from "./format";

const KEY = "forja-demo-state-v1";
let state: FState = load();
const listeners = new Set<() => void>();

function load(): FState {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (raw) {
      const s = JSON.parse(raw) as FState;
      if (s && s.v === 1 && s.jobs?.length === 7) return s;
    }
  } catch { /* fall through to seed */ }
  return seedState();
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}
function emit() { listeners.forEach((l) => l()); }

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && e.newValue) {
      try { state = JSON.parse(e.newValue) as FState; emit(); } catch { /* ignore */ }
    }
  });
}

export const getState = () => state;
export function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function useForja(): FState { return useSyncExternalStore(subscribe, getState, getState); }

/* ── toasts ──────────────────────────────────────────────── */
export interface Toast { id: number; text: string; kind: "ok" | "warn" | "bad" }
let toasts: Toast[] = [];
let toastId = 0;
const toastListeners = new Set<() => void>();
export function notify(text: string, kind: Toast["kind"] = "ok") {
  const t = { id: ++toastId, text, kind };
  toasts = [...toasts, t].slice(-3);
  toastListeners.forEach((l) => l());
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); toastListeners.forEach((l) => l()); }, 4200);
}
export function useToasts(): Toast[] {
  return useSyncExternalStore((l) => { toastListeners.add(l); return () => { toastListeners.delete(l); }; }, () => toasts, () => toasts);
}

/* ── helpers ─────────────────────────────────────────────── */
export const demoNow = (s: FState = state) => s.meta.base + (Date.now() - s.meta.startedAt);
const nid = (s: FState, p: string) => p + "-" + ++s.meta.seq;

function log(s: FState, e: Omit<FEvent, "id" | "at">) {
  s.events.push({ id: nid(s, "ev"), at: demoNow(s), ...e });
}

const PERMS: Record<string, Role[]> = {
  approveRevision: ["client"], requestChanges: ["client"], acceptVariation: ["client"], confirmSnag: ["client"],
  confirmPayment: ["ops", "owner"], confirmMove: ["pm", "owner"], assignSlot: ["pm", "owner"],
  receive: ["ops", "owner", "pm"], eod: ["lead", "pm", "owner", "ops"], issueRevision: ["designer", "owner"],
  passEnquiry: ["owner"], closeSnag: ["lead", "ops", "owner", "pm"], createVariation: ["owner", "ops", "designer"],
  cost: ["ops", "owner", "lead", "pm"], quote: ["owner", "ops", "designer"], task: ["owner", "ops", "designer", "pm", "lead"],
};
export function can(role: Role, action: keyof typeof PERMS | string): boolean {
  return (PERMS[action] ?? []).includes(role);
}
export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", ops: "Operations", designer: "Designer", pm: "Production manager", lead: "Crew lead", client: "Client" };
export function denyReason(action: string): string {
  const r = PERMS[action] ?? [];
  return "Needs " + r.map((x) => ROLE_LABEL[x].toLowerCase()).join(" or ") + " role.";
}
export function actorNow(s: FState = state): Actor {
  const p = s.people.find((x) => x.id === s.ui.person);
  return { role: s.ui.role, name: p?.name ?? "Caio Pazini" };
}

/** Run a mutation against a clone. Commits on success, toasts the message. */
function run(action: string, actor: Actor, fn: (s: FState) => Result): Result {
  if (!can(actor.role, action)) {
    const r = { ok: false, message: denyReason(action) };
    notify(r.message, "warn");
    return r;
  }
  const s = structuredClone(state) as FState;
  const res = fn(s);
  if (!res.ok) { notify(res.message, "warn"); return res; }
  reconcile(s);
  state = s;
  persist();
  emit();
  notify(res.message, "ok");
  return res;
}

/* ── pack reconciliation: the only place packs change status ─ */
function reconcile(s: FState) {
  const now = demoNow(s);
  for (const p of s.packs) {
    const clear = gatesClear(s, p);
    const rev = currentRev(s, p.id)?.rev ?? "R01";
    if (p.status === "held" && clear) {
      p.status = "ready";
      p.releasedAt = now;
      const woId = "WO-" + p.jobId.slice(3) + "-" + p.id.replace(/^PK-\d+-?/, "") + "v" + p.version;
      if (!s.workOrders.some((w) => w.packId === p.id && w.version === p.version)) {
        s.workOrders.push({ id: woId, jobId: p.jobId, packId: p.id, version: p.version, rev, createdAt: now });
        p.workOrderId = woId;
      }
      p.history.push({ at: now, version: p.version, rev, status: "released", text: "v" + p.version + " released on " + rev + " to the ready queue. No capacity assigned." });
      log(s, { actor: "Gate check", jobId: p.jobId, kind: "pack", text: "Pack " + p.id + " v" + p.version + " released on " + rev + " to the ready queue", from: "held", to: "ready", ref: { page: "Workshop", tab: "packs", job: p.jobId } });
      const tid = "T-slot-" + p.id + "-v" + p.version;
      if (!s.tasks.some((t) => t.id === tid)) {
        s.tasks.push({ id: tid, title: "Choose a slot for " + p.label.toLowerCase() + " (" + p.jobId + ")", ownerId: "niamh", due: TODAY, dueTime: "16:30", priority: "High", dept: "Workshop", jobId: p.jobId, kind: "task", doneWhen: "slot:" + p.id, link: { page: "Workshop", tab: "packs", job: p.jobId }, dynamic: true });
      }
    } else if ((p.status === "ready" || p.status === "scheduled") && !clear && p.workOrderId) {
      const hadSlot = p.status === "scheduled";
      p.history.push({ at: now, version: p.version, rev, status: "withdrawn", text: "v" + p.version + " withdrawn: a gate is no longer clear. Superseded by the next release." });
      p.version += 1;
      p.status = "held";
      p.slotDay = undefined;
      if (hadSlot) s.assignments = s.assignments.filter((a) => !(a.packId === p.id && !a.pinned && a.day >= TODAY));
      log(s, { actor: "Gate check", jobId: p.jobId, kind: "pack", text: "Pack " + p.id + " put on hold", from: "ready", to: "held", ref: { page: "Workshop", tab: "packs", job: p.jobId } });
    }
  }
  /* stage hints */
  const p261 = packOf(s, "PK-261");
  const j261 = s.jobs.find((j) => j.code === "FW-261");
  if (j261 && p261) j261.stage = p261.status === "held" ? "Awaiting release" : "Production";
}

/* ── actions ─────────────────────────────────────────────── */
export const actions = {
  setRole(role: Role, person: PersonId) {
    const s = structuredClone(state) as FState;
    s.ui.role = role; s.ui.person = person;
    state = s; persist(); emit();
  },
  setTvJob(job: string | null) {
    const s = structuredClone(state) as FState; s.ui.tvJob = job; state = s; persist(); emit();
  },
  setSetting(k: "tvLargeType" | "tvRotate" | "approvalControls", v: boolean) {
    const s = structuredClone(state) as FState; s.settings[k] = v; state = s; persist(); emit();
  },
  reset(): Result {
    state = seedState();
    persist(); emit();
    notify("Demo reset to Tuesday 24 November", "ok");
    return { ok: true, message: "Reset" };
  },

  approveRevision(revId: string, actor: Actor): Result {
    return run("approveRevision", actor, (s) => {
      const r = s.revisions.find((x) => x.id === revId);
      if (!r) return { ok: false, message: "Revision not found" };
      if (r.status === "approved") return { ok: false, message: r.rev + " is already approved" };
      if (r.status !== "awaiting") return { ok: false, message: r.rev + " is not awaiting approval" };
      const at = demoNow(s);
      r.status = "approved"; r.approvedBy = actor.name; r.approvedAt = at;
      r.trail.push({ at, actor: actor.name, text: "Approved " + r.rev });
      log(s, { actor: actor.name, jobId: r.jobId, kind: "approval", text: "Client approved " + r.rev, from: "awaiting", to: "approved", ref: { page: "Jobs", tab: "drawings", job: r.jobId } });
      return { ok: true, message: r.rev + " approved by " + actor.name };
    });
  },
  requestChanges(revId: string, comment: string, actor: Actor): Result {
    return run("requestChanges", actor, (s) => {
      const r = s.revisions.find((x) => x.id === revId);
      if (!r) return { ok: false, message: "Revision not found" };
      if (r.status === "changes") return { ok: false, message: "Changes already requested on " + r.rev };
      if (!comment.trim()) return { ok: false, message: "Add a comment so the designer knows what to change" };
      const at = demoNow(s);
      const prev = r.status;
      r.status = "changes"; r.comment = comment.trim();
      r.trail.push({ at, actor: actor.name, text: "Requested changes: " + comment.trim() });
      const job = jobOf(s, r.jobId)!;
      const tid = "T-rev-" + r.id;
      if (!s.tasks.some((t) => t.id === tid)) {
        s.tasks.push({ id: tid, title: "Revise " + r.rev + " after client comment: " + comment.trim().slice(0, 60), ownerId: job.designerId, due: TODAY, dueTime: "17:00", priority: "High", dept: "Design", jobId: r.jobId, kind: "task", doneWhen: "rev:" + r.id, link: { page: "Jobs", tab: "drawings", job: r.jobId }, dynamic: true, note: comment.trim() });
      }
      log(s, { actor: actor.name, jobId: r.jobId, kind: "revision", text: "Client requested changes on " + r.rev + ": " + comment.trim(), from: prev, to: "changes", ref: { page: "Jobs", tab: "drawings", job: r.jobId } });
      return { ok: true, message: "Sent back to " + personName(s, job.designerId) + ". Pack is on hold." };
    });
  },
  issueRevision(jobId: string, packageId: string, info: { title: string; note: string; openingMm?: number }, actor: Actor): Result {
    return run("issueRevision", actor, (s) => {
      const list = s.revisions.filter((r) => r.packageId === packageId);
      const cur = currentRev(s, packageId);
      if (cur && cur.status === "awaiting") return { ok: false, message: cur.rev + " is already awaiting approval" };
      const n = list.length + 1;
      const rev = "R" + String(n).padStart(2, "0");
      const at = demoNow(s);
      if (cur) cur.status = "superseded";
      s.revisions.push({ id: nid(s, "rv"), jobId, packageId, rev, title: info.title, status: "awaiting", openingMm: info.openingMm, note: info.note, issuedBy: actor.name, issuedAt: at, trail: [{ at, actor: actor.name, text: "Issued " + rev + " for client sign-off" }] });
      log(s, { actor: actor.name, jobId, kind: "revision", text: "Issued " + rev + " for client sign-off", from: cur?.rev, to: rev, ref: { page: "Jobs", tab: "drawings", job: jobId } });
      return { ok: true, message: rev + " issued. Previous revision superseded, approval trail kept." };
    });
  },
  confirmPayment(milestoneId: string, actor: Actor): Result {
    return run("confirmPayment", actor, (s) => {
      const m = s.milestones.find((x) => x.id === milestoneId);
      if (!m) return { ok: false, message: "Milestone not found" };
      if (m.status === "received") return { ok: false, message: eur(m.amount) + " already recorded (" + m.ref + ")" };
      if (m.status === "locked") return { ok: false, message: "Not yet due: waiting for sign-off" };
      const at = demoNow(s);
      m.status = "received"; m.receivedAt = at; m.receivedOn = dayOf(at); m.receivedBy = actor.name; m.ref = "RC-" + (1000 + (++s.meta.seq));
      m.dueNote = "Received " + fmtDate(dayOf(at));
      log(s, { actor: actor.name, jobId: m.jobId, kind: "payment", text: "Mock receipt recorded: " + m.label + " " + eur(m.amount), from: "outstanding", to: "received", ref: { page: "Job Costing", tab: "payments", job: m.jobId } });
      if (m.id === "M-263-D") {
        s.designReceivedOn = dayOf(at);
        const w = designWhatIf(s.designReceivedOn);
        const j = jobOf(s, "FW-263")!;
        j.stage = "Design";
        s.drafts.push({ id: nid(s, "dr"), jobId: "FW-263", trigger: "Design fee received " + fmtDate(s.designReceivedOn) + " (baseline assumed Mon 23 Nov, target Mon 30 Nov)", text: "Your design target is now " + "Tuesday 1 December" + ". " + (w.delay === 1 ? "We received the design fee one day after the date our plan assumed." : "") });
        log(s, { actor: "Client Programme", jobId: "FW-263", kind: "agent", agent: "programme", text: "Design clock started. Target moved " + fmtDate("2026-11-30") + " to " + fmtDate(w.target) + "; dependent provisional dates moved " + w.delay + " day. Baseline kept.", from: "2026-11-30", to: w.target, ref: { page: "Jobs", tab: "programme", job: "FW-263" } });
        if (programmeFor(s, "FW-263").some((r) => r.conflict) && !s.tasks.some((t) => t.id === "T-conf-263")) {
          s.tasks.push({ id: "T-conf-263", title: "Review Victor house workshop start: collides with fixed supplier delivery slot", ownerId: "niamh", due: "2026-11-25", dueTime: "12:00", priority: "Medium", dept: "Workshop", jobId: "FW-263", kind: "exception", link: { page: "Jobs", tab: "programme", job: "FW-263" }, dynamic: true });
        }
      }
      return { ok: true, message: eur(m.amount) + " recorded as " + actor.name + " (" + m.ref + ", mock receipt)" };
    });
  },
  confirmMove(jobId: string, from: string, to: string, actor: Actor): Result {
    return run("confirmMove", actor, (s) => {
      const pv = previewMove(s, jobId, from, to);
      if (!pv.eligible) return { ok: false, message: pv.items.length ? "Nothing eligible to move" : "No unpinned work for this job on that day" };
      const ids = new Set(pv.items.filter((i) => i.ok).map((i) => i.a.id));
      s.assignments.forEach((a) => { if (ids.has(a.id)) a.day = to; });
      s.moves.push({ id: nid(s, "mv"), jobId, from, to, at: demoNow(s), by: actor.name });
      log(s, { actor: actor.name, jobId, kind: "capacity", text: "Moved " + pv.hours + "h of " + jobOf(s, jobId)!.name + " from " + fmtDate(from) + " to " + fmtDate(to), from: pv.before[from] + "/32h", to: pv.after[from] + "/32h", ref: { page: "Workshop", tab: "capacity", job: jobId } });
      return { ok: true, message: "Moved " + pv.hours + "h to " + fmtDate(to) + ". " + fmtDate(from) + " " + pv.after[from] + "/32h, " + fmtDate(to) + " " + pv.after[to] + "/32h." };
    });
  },
  assignSlot(packId: string, day: string, crewIds: PersonId[], each: number, actor: Actor): Result {
    return run("assignSlot", actor, (s) => {
      const p = packOf(s, packId);
      if (!p) return { ok: false, message: "Pack not found" };
      if (p.status !== "ready") return { ok: false, message: p.status === "scheduled" ? "Already scheduled" : "Pack is not released" };
      if (crewIds.length === 0) return { ok: false, message: "Choose crew" };
      for (const c of crewIds) {
        if (personLoad(s, c, day) + each > 8) return { ok: false, message: personName(s, c) + " would be over eight hours on " + fmtDate(day) };
        if (s.assignments.some((a) => a.crewId === c && a.day === day && a.kind === "install")) return { ok: false, message: personName(s, c) + " is on an install on " + fmtDate(day) };
      }
      crewIds.forEach((c) => s.assignments.push({ id: nid(s, "a"), jobId: p.jobId, label: p.label, crewId: c, day, hours: each, pinned: false, kind: "bench", station: p.station, packId }));
      p.status = "scheduled"; p.slotDay = day;
      log(s, { actor: actor.name, jobId: p.jobId, kind: "capacity", text: "Slot chosen for " + p.label + ": " + fmtDate(day) + ", " + crewIds.map((c) => personName(s, c)).join(" and "), ref: { page: "Workshop", tab: "capacity", job: p.jobId } });
      return { ok: true, message: p.label + " booked for " + fmtDate(day) };
    });
  },
  receive(reqId: string, qty: number, actor: Actor): Result {
    return run("receive", actor, (s) => {
      const r = s.requirements.find((x) => x.id === reqId);
      if (!r) return { ok: false, message: "Requirement not found" };
      const q = Math.floor(qty);
      if (!(q > 0)) return { ok: false, message: "Enter a quantity above zero" };
      const short = shortQty(s, reqId);
      if (short === 0) return { ok: false, message: "Already fully received. Over-receipt is rejected." };
      if (q > short) return { ok: false, message: "Over-receipt rejected: only " + short + " " + r.unit + "s outstanding on " + r.poId };
      s.receipts.push({ id: nid(s, "rc"), reqId, poId: r.poId!, qty: q, at: demoNow(s), by: actor.name, ref: "DN-" + (4480 + s.meta.seq) });
      const left = short - q;
      log(s, { actor: actor.name, jobId: r.jobId, kind: "receipt", text: "Received " + q + " " + r.item.toLowerCase() + " against " + r.poId + (left ? ", " + left + " still short" : ", order complete"), from: receivedQty(s, reqId) - q + " of " + r.qty, to: receivedQty(s, reqId) + " of " + r.qty, ref: { page: "Purchasing", tab: "deliveries", job: r.jobId } });
      return { ok: true, message: "Received " + q + ". " + (left ? left + " still short." : "Materials hold cleared.") };
    });
  },
  resetPizzaReceipts(actor: Actor): Result {
    return run("receive", actor, (s) => {
      s.receipts = s.receipts.filter((r) => r.reqId !== "rq-262-ply" || r.id === "rc-1");
      const p = packOf(s, "PK-262-1")!;
      s.assignments = s.assignments.filter((a) => a.packId !== p.id);
      s.tasks = s.tasks.filter((t) => !t.id.startsWith("T-slot-PK-262-1"));
      s.workOrders = s.workOrders.filter((w) => w.packId !== p.id);
      p.status = "held"; p.slotDay = undefined; p.workOrderId = undefined; p.releasedAt = undefined; p.history = []; p.version = 1;
      return { ok: true, message: "Pizza delivery reset: 12 of 18 received" };
    });
  },
  photographInvoice(actor: Actor): Result {
    return run("cost", actor, (s) => {
      if (s.invoices.length) return { ok: false, message: "Invoice already captured: " + s.invoices[0].ref };
      s.invoices.push({ id: "INV-QT-5521", supplierId: "s-quay", ref: "QT-5521", jobId: "FW-262", poId: "PO-262-01", reqId: "rq-262-ply", qty: 12, unitCost: 45, total: 540, status: "review" });
      log(s, { actor: actor.name, jobId: "FW-262", kind: "invoice", text: "Photographed invoice QT-5521 from Quay Timber Supply, matched to FW-262 and PO-262-01, awaiting review", ref: { page: "Job Costing", tab: "capture", job: "FW-262" } });
      return { ok: true, message: "Invoice read and matched. Review before posting." };
    });
  },
  postInvoice(id: string, actor: Actor): Result {
    return run("cost", actor, (s) => {
      const inv = s.invoices.find((i) => i.id === id);
      if (!inv) return { ok: false, message: "Invoice not found" };
      if (inv.status === "posted") return { ok: false, message: "Invoice already posted. Not counted twice." };
      inv.status = "posted";
      s.costEntries.push({ id: "ce-" + inv.id, jobId: inv.jobId, cat: "materials", amount: inv.total, date: TODAY, source: "invoice", desc: "Invoice " + inv.ref + " (" + inv.qty + " sheets at " + eur(inv.unitCost) + ")", ref: inv.id });
      const j = jobOf(s, inv.jobId)!;
      j.remaining.materials = Math.max(0, j.remaining.materials - inv.total);
      log(s, { actor: actor.name, jobId: inv.jobId, kind: "cost", text: "Posted invoice " + inv.ref + " " + eur(inv.total) + " to actual materials (moved from expected, quantity came from the receipt)", ref: { page: "Job Costing", tab: "ledger", job: inv.jobId } });
      return { ok: true, message: eur(inv.total) + " posted once to FW-262 actuals" };
    });
  },
  postLabour(key: string, jobId: string, workerId: PersonId, hours: number, desc: string, fromRemaining: boolean, actor: Actor): Result {
    return run("cost", actor, (s) => {
      const id = "ce-lab-" + key;
      if (s.costEntries.some((e) => e.id === id)) return { ok: false, message: "That entry is already booked" };
      const w = s.people.find((p) => p.id === workerId);
      const rate = w?.rate || 45;
      const amount = hours * rate;
      s.costEntries.push({ id, jobId, cat: "workshop", amount, hours, workerId, date: TODAY, source: "conversation", desc });
      const j = jobOf(s, jobId)!;
      if (fromRemaining) j.remaining.workshop = Math.max(0, j.remaining.workshop - amount);
      log(s, { actor: actor.name, jobId, kind: "cost", text: "Booked " + hours + "h labour (" + personName(s, workerId) + ") " + eur(amount) + (fromRemaining ? " from expected cost" : " as unplanned spend"), ref: { page: "Job Costing", tab: "ledger", job: jobId } });
      return { ok: true, message: "Booked " + hours + "h to " + jobId + " (" + eur(amount) + ")" };
    });
  },
  submitEod(e: { key: string; jobId: string; leadId: PersonId; hours: number; pieces: number; taskCompleted: boolean; blocker: string; tomorrow: string }, actor: Actor): Result {
    return run("eod", actor, (s) => {
      if (s.eods.some((x) => x.id === e.key)) return { ok: false, message: "End-of-day entry already saved" };
      if (!(e.hours >= 0)) return { ok: false, message: "Enter hours worked" };
      const at = demoNow(s);
      s.eods.push({ id: e.key, jobId: e.jobId, leadId: e.leadId, hours: e.hours, pieces: e.pieces, taskCompleted: e.taskCompleted, blocker: e.blocker, tomorrow: e.tomorrow, at });
      const rate = s.people.find((p) => p.id === e.leadId)?.rate || 45;
      const amount = e.hours * rate;
      if (amount > 0) {
        s.costEntries.push({ id: "ce-eod-" + e.key, jobId: e.jobId, cat: "workshop", amount, hours: e.hours, workerId: e.leadId, date: TODAY, source: "end-of-day", desc: "End of day: " + e.hours + "h" });
        const j = jobOf(s, e.jobId)!;
        j.remaining.workshop = Math.max(0, j.remaining.workshop - amount);
      }
      const lead = personName(s, e.leadId);
      s.handover[e.jobId] = lead + ": " + e.hours + "h worked, " + e.pieces + " pieces done, task " + (e.taskCompleted ? "complete" : "not complete") + (e.blocker ? ". Blocker: " + e.blocker : ". No blocker") + ". Tomorrow first: " + e.tomorrow;
      if (e.tomorrow) s.tvNext[e.jobId] = e.tomorrow;
      if (e.blocker) s.blockers[e.jobId] = e.blocker; else delete s.blockers[e.jobId];
      log(s, { actor: lead, jobId: e.jobId, kind: "eod", text: "End of day: " + e.hours + "h, " + e.pieces + " pieces, task " + (e.taskCompleted ? "complete" : "open") + (e.blocker ? ", blocker: " + e.blocker : ""), ref: { page: "Workshop", tab: "eod", job: e.jobId } });
      return { ok: true, message: "End of day saved. Board, ledger and handover updated." };
    });
  },
  createVariation(jobId: string, title: string, kind: "extra" | "omission", revenue: number, cost: number, actor: Actor): Result {
    return run("createVariation", actor, (s) => {
      if (!title.trim()) return { ok: false, message: "Name the variation" };
      const sign = kind === "omission" ? -1 : 1;
      const id = "V" + String(s.variations.length + 1).padStart(2, "0");
      s.variations.push({ id, jobId, title: title.trim(), kind, revenue: sign * Math.abs(revenue), cost: sign * Math.abs(cost), status: "pending", note: kind === "omission" ? "Scope omission, credited on its own line." : "Optional extra, priced separately." });
      log(s, { actor: actor.name, jobId, kind: "variation", text: "Drafted " + (kind === "omission" ? "omission " : "extra ") + id + " " + title.trim() + " (" + eur(sign * Math.abs(revenue), true) + ")", ref: { page: "Estimates", tab: "variations", job: jobId } });
      return { ok: true, message: id + " drafted. Client accepts it in the portal." };
    });
  },
  acceptVariation(id: string, actor: Actor): Result {
    return run("acceptVariation", actor, (s) => {
      const v = s.variations.find((x) => x.id === id);
      if (!v) return { ok: false, message: "Variation not found" };
      if (v.status === "accepted") return { ok: false, message: id + " is already accepted" };
      if (v.status === "declined") return { ok: false, message: id + " was declined" };
      const at = demoNow(s);
      v.status = "accepted"; v.acceptedAt = at; v.acceptedBy = actor.name;
      const job = jobOf(s, v.jobId)!;
      const code = job.code;
      s.milestones.push({ id: "M-" + code.slice(3) + "-" + v.id, jobId: v.jobId, kind: "variation", label: v.id + " " + v.title, amount: v.revenue, status: "scheduled", dueNote: v.revenue < 0 ? "Credit applied to the final payment" : "Separate payment line, due on completion of the change", variationId: v.id });
      const pkgId = "PK-" + code.slice(3) + "-" + v.id;
      s.revisions.push({ id: "rv-" + pkgId, jobId: v.jobId, packageId: pkgId, rev: v.id + "-R01", title: v.title + " drawing", status: "awaiting", note: "Revised drawing for the " + (v.kind === "omission" ? "omitted" : "added") + " scope. Needs its own sign-off.", issuedBy: personName(s, job.designerId), issuedAt: at, trail: [{ at, actor: personName(s, job.designerId), text: "Issued " + v.id + "-R01 after variation acceptance" }] });
      s.packs.push({ id: pkgId, jobId: v.jobId, label: v.title, version: 1, status: "held", gates: ["variation", "drawing"], leadId: "rui", hoursNeeded: 8, station: "Bench A", cutList: ["Revised parts per " + v.id + "-R01"], dimensions: [], materialPicks: [], qa: ["Check against " + v.id + "-R01"], variationId: v.id, history: [] });
      log(s, { actor: actor.name, jobId: v.jobId, kind: "variation", text: "Client accepted " + v.id + " " + eur(v.revenue, true) + ". Forecast revenue and expected cost updated once. Revised pack held for drawing sign-off.", ref: { page: "Job Costing", tab: "forecast", job: v.jobId } });
      return { ok: true, message: id + " accepted: " + eur(v.revenue, true) + " revenue, " + eur(v.cost, true) + " expected cost" };
    });
  },
  declineVariation(id: string, actor: Actor): Result {
    return run("acceptVariation", actor, (s) => {
      const v = s.variations.find((x) => x.id === id);
      if (!v || v.status !== "pending") return { ok: false, message: "Nothing to decline" };
      v.status = "declined";
      log(s, { actor: actor.name, jobId: v.jobId, kind: "variation", text: "Client declined " + v.id, ref: { page: "Estimates", tab: "variations", job: v.jobId } });
      return { ok: true, message: v.id + " declined" };
    });
  },
  closeSnag(id: string, actor: Actor): Result {
    return run("closeSnag", actor, (s) => {
      const n = s.snags.find((x) => x.id === id);
      if (!n) return { ok: false, message: "Snag not found" };
      if (n.status !== "open") return { ok: false, message: "Snag already closed" };
      n.status = "resolved"; n.resolvedBy = actor.name; n.resolvedAt = demoNow(s);
      log(s, { actor: actor.name, jobId: n.jobId, kind: "snag", text: "Snag resolved: " + n.title, from: "open", to: "resolved", ref: { page: "Jobs", tab: "snags", job: n.jobId } });
      return { ok: true, message: "Snag marked resolved. Client confirms next." };
    });
  },
  confirmSnag(id: string, actor: Actor): Result {
    return run("confirmSnag", actor, (s) => {
      const n = s.snags.find((x) => x.id === id);
      if (!n) return { ok: false, message: "Snag not found" };
      if (n.status === "confirmed") return { ok: false, message: "Already confirmed" };
      if (n.status === "open") return { ok: false, message: "Installer has not closed this snag yet" };
      n.status = "confirmed"; n.confirmedAt = demoNow(s);
      const all = s.snags.filter((x) => x.jobId === n.jobId);
      if (all.every((x) => x.status === "confirmed")) {
        const m = s.milestones.find((x) => x.jobId === n.jobId && x.kind === "final");
        if (m && m.status === "locked") { m.status = "due"; m.dueNote = "Due now: client signed off snags"; }
        const j = jobOf(s, n.jobId)!; j.stage = "Handover";
        log(s, { actor: actor.name, jobId: n.jobId, kind: "snag", text: "Client signed off all snags. Final " + eur(m?.amount ?? 0) + " is now due", ref: { page: "Job Costing", tab: "payments", job: n.jobId } });
      } else {
        log(s, { actor: actor.name, jobId: n.jobId, kind: "snag", text: "Client confirmed snag: " + n.title, ref: { page: "Jobs", tab: "snags", job: n.jobId } });
      }
      return { ok: true, message: "Snag confirmed" };
    });
  },
  passEnquiry(id: string, reason: string, actor: Actor): Result {
    return run("passEnquiry", actor, (s) => {
      const e = s.enquiries.find((x) => x.id === id);
      if (!e) return { ok: false, message: "Enquiry not found" };
      if (e.decision) return { ok: false, message: "Decision already recorded" };
      if (!reason.trim()) return { ok: false, message: "Add a reason for the decision" };
      e.stage = "Passed"; e.decision = { by: actor.name, at: demoNow(s), reason: reason.trim() };
      log(s, { actor: actor.name, kind: "fit", text: "Passed on " + e.id + " " + e.title + ": " + reason.trim(), from: "Discovery", to: "Passed", ref: { page: "Estimates", tab: "fit" } });
      return { ok: true, message: e.title + " passed. Not added to the seven active jobs." };
    });
  },
  reopenEnquiry(id: string, actor: Actor): Result {
    return run("passEnquiry", actor, (s) => {
      const e = s.enquiries.find((x) => x.id === id);
      if (!e || !e.decision) return { ok: false, message: "Nothing to reopen" };
      e.stage = "Discovery"; e.decision = undefined;
      return { ok: true, message: "Enquiry reopened" };
    });
  },
  updateQuoteLine(quoteId: string, v: number, lineId: string, patch: { qty?: number; rate?: number }, actor: Actor): Result {
    return run("quote", actor, (s) => {
      const q = s.quotes.find((x) => x.id === quoteId);
      const ver = q?.versions.find((x) => x.v === v);
      const l = ver?.lines.find((x) => x.id === lineId);
      if (!l) return { ok: false, message: "Line not found" };
      if (patch.qty !== undefined) l.qty = Math.max(0, patch.qty);
      if (patch.rate !== undefined) l.rate = Math.max(0, patch.rate);
      return { ok: true, message: "Line updated" };
    });
  },
  setQuotePrice(quoteId: string, v: number, price: number, actor: Actor): Result {
    return run("quote", actor, (s) => {
      const ver = s.quotes.find((x) => x.id === quoteId)?.versions.find((x) => x.v === v);
      if (!ver) return { ok: false, message: "Version not found" };
      ver.price = Math.max(0, price);
      return { ok: true, message: "Price updated" };
    });
  },
  newQuoteVersion(quoteId: string, actor: Actor): Result {
    return run("quote", actor, (s) => {
      const q = s.quotes.find((x) => x.id === quoteId);
      if (!q) return { ok: false, message: "Quote not found" };
      const last = q.versions[q.versions.length - 1];
      const v = last.v + 1;
      q.versions.push({ v, name: "v" + v + " working copy", note: "Copy of v" + last.v + ". Edit lines to compare.", lines: last.lines.map((l) => ({ ...l })), price: last.price });
      q.currentV = v;
      return { ok: true, message: "Created v" + v };
    });
  },
  completeTask(id: string, actor: Actor): Result {
    return run("task", actor, (s) => {
      const t = s.tasks.find((x) => x.id === id);
      if (!t) return { ok: false, message: "Task not found" };
      if (t.manualDone) return { ok: false, message: "Already done" };
      t.manualDone = true;
      log(s, { actor: actor.name, jobId: t.jobId, kind: "task", text: "Completed: " + t.title, ref: t.link });
      return { ok: true, message: "Task done" };
    });
  },
  markBurgerReviewed(actor: Actor): Result {
    return run("task", actor, (s) => {
      const t = s.tasks.find((x) => x.id === "T-C1")!;
      if (t.manualDone) return { ok: false, message: "Estimate already reviewed" };
      t.manualDone = true;
      log(s, { actor: actor.name, jobId: "FW-261", kind: "task", text: "Reviewed the burger fit-out estimate. Slip attributed to 32 extra workshop hours at €45.", ref: { page: "Job Costing", tab: "forecast", job: "FW-261" } });
      return { ok: true, message: "Estimate marked as reviewed" };
    });
  },
};

export function parseLabour(s: FState, text: string): { jobId: string | null; candidates: string[]; hours: number | null; workerId: PersonId } {
  const t = text.toLowerCase();
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, half: 0.5 };
  let hours: number | null = null;
  const m = t.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\b/) || t.match(/\b(one|two|three|four|five|six|seven|eight)\s*(?:h|hr|hrs|hours?)\b/);
  if (m) hours = words[m[1]] ?? parseFloat(m[1]);
  const keys: [RegExp, string][] = [
    [/fw-?261|burger/, "FW-261"], [/fw-?262|pizza|banquette/, "FW-262"], [/fw-?263|victor/, "FW-263"], [/fw-?264|docklands|pop-?up/, "FW-264"],
    [/fw-?265|rathmines|caf[eé]/, "FW-265"], [/fw-?266|city|shopfront/, "FW-266"], [/fw-?267|garden/, "FW-267"],
  ];
  const candidates = keys.filter(([re]) => re.test(t)).map(([, j]) => j);
  const person = s.people.find((p) => p.id === s.ui.person && p.crew);
  const named = crew(s).find((p) => t.includes(p.name.toLowerCase()));
  return { jobId: candidates.length === 1 ? candidates[0] : null, candidates, hours, workerId: (named ?? person)?.id ?? "eva" };
}

export type { Task, Pack, Cat };
export { clientOf };
