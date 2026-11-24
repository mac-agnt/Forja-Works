import type { ReactNode } from "react";
import { Page, Card, Pill, Go, JobLink, Table, DemoBadge } from "../ui";
import type { Tone } from "../ui";
import { useForja } from "../store";
import type { FState, Job, Revision } from "../types";
import {
  WORK_DAYS, clientOf, eur, jobOf, openTasks, personName, receivedQty, shortQty, supplierName, taskDone,
} from "../derive";
import type { Link } from "../derive";

/* ── chain building blocks ─────────────────────────────── */
interface NodeData { kind: string; value: string; status?: string; tone?: Tone; link?: Link }
function Node({ n }: { n: NodeData }) {
  const body = (
    <>
      <span className="fj-node-k">{n.kind}</span>
      <span className="fj-node-v">{n.value}</span>
      {n.status && <span><Pill tone={n.tone ?? "neutral"}>{n.status}</Pill></span>}
    </>
  );
  if (!n.link) return <div className="fj-node">{body}</div>;
  return <Go to={n.link}><span className="fj-node">{body}</span></Go>;
}
function Chain({ nodes }: { nodes: NodeData[] }) {
  return (
    <div className="fj-chain" aria-label="Linked path">
      {nodes.map((n, i) => (
        <span key={i} style={{ display: "contents" }}>
          {i > 0 && <span className="fj-chain-arrow" aria-hidden="true">{"->"}</span>}
          <Node n={n} />
        </span>
      ))}
    </div>
  );
}

const revTone = (r: Revision): Tone => (r.status === "approved" ? "ok" : r.status === "changes" ? "bad" : "warn");
const revWord = (r: Revision) => (r.status === "approved" ? "Approved" : r.status === "changes" ? "Changes requested" : "Awaiting client");

function liveRev(s: FState, jobId: string): Revision | undefined {
  const list = s.revisions.filter((r) => r.jobId === jobId && r.status !== "superseded" && r.status !== "withdrawn");
  return list[list.length - 1];
}
function jobPack(s: FState, jobId: string) {
  const ps = s.packs.filter((p) => p.jobId === jobId && p.status !== "complete");
  return ps[0] ?? s.packs.find((p) => p.jobId === jobId);
}
function jobTask(s: FState, jobId: string) {
  const ts = s.tasks.filter((t) => t.jobId === jobId);
  const slot = ts.find((t) => t.id.startsWith("T-slot-"));
  const open = ts.filter((t) => !taskDone(s, t));
  return slot ?? open[0] ?? ts[0];
}
const packTone = (st: string): Tone => (st === "held" ? "bad" : st === "ready" ? "info" : st === "complete" ? "neutral" : "ok");

function jobChain(s: FState, job: Job): NodeData[] {
  const rev = liveRev(s, job.code);
  const pack = jobPack(s, job.code);
  const task = jobTask(s, job.code);
  const nodes: NodeData[] = [{ kind: "Job", value: job.code + " " + job.name, status: job.stage, tone: "info", link: { page: "Jobs", tab: "live", job: job.code } }];
  if (rev) {
    nodes.push({ kind: "Drawing revision", value: rev.rev, status: revWord(rev), tone: revTone(rev), link: { page: "Jobs", tab: "drawings", job: job.code } });
    nodes.push({ kind: "Approval", value: rev.status === "approved" ? "Approved by " + (rev.approvedBy ?? "client") : "Client to approve", status: rev.status === "approved" ? "Done" : "Open", tone: rev.status === "approved" ? "ok" : "warn", link: { page: "Jobs", tab: "drawings", job: job.code } });
  }
  if (pack) {
    nodes.push({ kind: pack.status === "held" ? "Pack (not released)" : "Released pack", value: pack.id + " v" + pack.version, status: pack.status === "held" ? "Held" : pack.status === "ready" ? "Ready, no slot" : pack.status === "scheduled" ? "Scheduled" : "Complete", tone: packTone(pack.status), link: { page: "Workshop", tab: "packs", job: job.code } });
  }
  if (task) {
    nodes.push({ kind: "Task", value: task.title, status: taskDone(s, task) ? "Done" : "Open", tone: taskDone(s, task) ? "ok" : "warn", link: task.link });
  }
  return nodes;
}

/* ── tabs ───────────────────────────────────────────────── */
function Jobs({ s }: { s: FState }) {
  const j261 = jobOf(s, "FW-261");
  return (
    <div className="fj-stack">
      {j261 && (
        <Card title="FW-261 Burger fit-out: from job to task" right={<Pill tone="info">Live status</Pill>}>
          <Chain nodes={jobChain(s, j261)} />
          <div className="fj-note">Each step is a link. When the client approves R03 and the deposit is recorded, the pack releases and a slot task appears for Niamh.</div>
        </Card>
      )}
      <Card title={"Jobs (" + s.jobs.length + ")"} flush>
        <Table
          cols={[{ label: "Job" }, { label: "Client" }, { label: "Owner" }, { label: "Designer" }, { label: "Stage" }, { label: "Contract", align: "right" }, { label: "Drawing" }, { label: "Pack" }, { label: "Work order" }, { label: "Path" }]}
          rows={s.jobs.map((j) => {
            const rev = liveRev(s, j.code);
            const packs = s.packs.filter((p) => p.jobId === j.code && p.status !== "complete");
            const wos = s.workOrders.filter((w) => w.jobId === j.code);
            const task = jobTask(s, j.code);
            return [
              <span key="j"><JobLink code={j.code} /><div className="fj-faint">{j.name}</div></span>,
              clientOf(s, j.code)?.name ?? "",
              personName(s, j.ownerId),
              personName(s, j.designerId),
              j.stage,
              <span key="v" className="fj-num">{eur(j.contractValue)}</span>,
              rev ? <Pill key="r" tone={revTone(rev)}>{rev.rev} {revWord(rev).toLowerCase()}</Pill> : <span key="r" className="fj-faint">No drawing</span>,
              packs.length ? <span key="p" className="fj-mini">{packs.map((p) => <Pill key={p.id} tone={packTone(p.status)}>{p.id} {p.status}</Pill>)}</span> : <span key="p" className="fj-faint">None open</span>,
              wos.length ? wos.map((w) => w.id).join(", ") : <span key="w" className="fj-faint">None yet</span>,
              <span key="c" className="fj-mini">
                {rev && <Pill tone={rev.status === "approved" ? "ok" : "warn"}>approval {rev.status === "approved" ? "done" : "open"}</Pill>}
                {task && <Go to={task.link}>{taskDone(s, task) ? "task done" : "open task"}</Go>}
              </span>,
            ];
          })}
        />
      </Card>
    </div>
  );
}

function Clients({ s }: { s: FState }) {
  return (
    <Card title={"Clients (" + s.clients.length + ")"} flush>
      <Table
        cols={[{ label: "Client" }, { label: "Type" }, { label: "Contact" }, { label: "Email" }, { label: "Jobs" }, { label: "Contract value", align: "right" }]}
        rows={s.clients.map((c) => {
          const js = s.jobs.filter((j) => j.clientId === c.id);
          return [
            <b key="n" style={{ color: "var(--ink)" }}>{c.name}</b>,
            c.type === "commercial" ? "Commercial" : "Residential",
            c.contact,
            <span key="e" className="fj-mono">{c.email}</span>,
            <span key="j" className="fj-mini">{js.map((j) => <JobLink key={j.code} code={j.code} />)}</span>,
            <span key="v" className="fj-num">{eur(js.reduce((n, j) => n + j.contractValue, 0))}</span>,
          ];
        })}
      />
    </Card>
  );
}

function People({ s }: { s: FState }) {
  const open = openTasks(s);
  return (
    <Card title={"People (" + s.people.length + ")"} flush right={<Pill tone="warn">Demo roster</Pill>}>
      <Table
        cols={[{ label: "Name" }, { label: "Role" }, { label: "Title" }, { label: "Hours this week", align: "right" }, { label: "Assignments" }, { label: "Open tasks" }]}
        rows={s.people.map((p) => {
          const as = s.assignments.filter((a) => a.crewId === p.id && WORK_DAYS.includes(a.day));
          const hours = as.reduce((n, a) => n + a.hours, 0);
          const byJob = [...new Set(as.map((a) => a.jobId))].map((c) => ({ c, h: as.filter((a) => a.jobId === c).reduce((n, a) => n + a.hours, 0) }));
          const mine = open.filter((t) => t.ownerId === p.id);
          return [
            <b key="n" style={{ color: "var(--ink)" }}>{p.name}</b>,
            p.role === "lead" ? (p.crew ? "Workshop" : "Lead") : p.role === "pm" ? "Production manager" : p.role === "ops" ? "Operations" : p.role === "owner" ? "Owner" : "Designer",
            p.title,
            <span key="h" className="fj-num">{p.crew ? hours + "h" : "-"}</span>,
            byJob.length ? <span key="a" className="fj-mini">{byJob.map((x) => <span key={x.c}><JobLink code={x.c} /> {x.h}h</span>)}</span> : <span key="a" className="fj-faint">{p.crew ? "None booked" : "Not on the workshop grid"}</span>,
            mine.length ? <ul key="t" className="fj-rowlist">{mine.map((t) => <li key={t.id}><Go to={t.link}>{t.title}</Go></li>)}</ul> : <span key="t" className="fj-faint">None</span>,
          ];
        })}
      />
    </Card>
  );
}

function Suppliers({ s }: { s: FState }) {
  return (
    <div className="fj-stack">
      {s.suppliers.map((sp) => {
        const reqs = s.requirements.filter((r) => r.supplierId === sp.id);
        const pos = s.pos.filter((p) => p.supplierId === sp.id);
        const ordered = reqs.reduce((n, r) => n + r.qty * r.unitCost, 0);
        const outstanding = reqs.reduce((n, r) => n + shortQty(s, r.id) * r.unitCost, 0);
        return (
          <Card key={sp.id} title={sp.name} right={<Pill tone={outstanding ? "warn" : "ok"}>{outstanding ? eur(outstanding) + " still to receive" : "Nothing outstanding"}</Pill>}>
            <div className="fj-dim" style={{ fontSize: 13 }}>Supplies: {sp.supplies}. Lead time {sp.leadDays} days. Contact: {sp.contact}.</div>
            <div style={{ margin: "10px 0 0" }}>
              <Table
                cols={[{ label: "Order" }, { label: "Job" }, { label: "Requirement" }, { label: "Received", align: "right" }, { label: "Short", align: "right" }, { label: "Ordered value", align: "right" }, { label: "Outstanding", align: "right" }]}
                empty="No orders with this supplier."
                rows={reqs.map((r) => [
                  r.poId ?? "No PO",
                  <JobLink key="j" code={r.jobId} />,
                  r.item,
                  <span key="a" className="fj-num">{receivedQty(s, r.id)} of {r.qty}</span>,
                  <span key="b" className="fj-num" style={{ color: shortQty(s, r.id) ? "var(--warn)" : undefined }}>{shortQty(s, r.id)}</span>,
                  <span key="c" className="fj-num">{eur(r.qty * r.unitCost)}</span>,
                  <span key="d" className="fj-num">{eur(shortQty(s, r.id) * r.unitCost)}</span>,
                ])}
              />
            </div>
            {reqs.map((r) => {
              const rcs = s.receipts.filter((x) => x.reqId === r.id).sort((a, b) => b.at - a.at);
              const sh = shortQty(s, r.id);
              const nodes: NodeData[] = [
                { kind: "Supplier", value: supplierName(s, sp.id), status: pos.find((p) => p.id === r.poId)?.id, tone: "info", link: { page: "Purchasing", tab: "orders", job: r.jobId } },
                { kind: "Receipt", value: rcs.length ? rcs.length + " delivery, latest " + rcs[0].ref : "None yet", status: receivedQty(s, r.id) + " of " + r.qty + " received", tone: sh ? "warn" : "ok", link: { page: "Purchasing", tab: "deliveries", job: r.jobId } },
                { kind: "Material requirement", value: r.item, status: sh ? sh + " short" : "Complete", tone: sh ? "bad" : "ok", link: { page: "Purchasing", tab: "requirements", job: r.jobId } },
                { kind: "Job", value: r.jobId + " " + (jobOf(s, r.jobId)?.name ?? ""), status: sh ? "Cutting held" : "Cutting can proceed", tone: sh ? "warn" : "ok", link: { page: "Jobs", tab: "live", job: r.jobId } },
              ];
              return <div key={r.id} style={{ marginTop: 14 }}><Chain nodes={nodes} /></div>;
            })}
            <div className="fj-note">Ordered value across open lines: {eur(ordered)}. Outstanding is the value of units not yet received.</div>
          </Card>
        );
      })}
    </div>
  );
}

const TITLES: Record<string, { title: string; sub: string }> = {
  jobs: { title: "Job records", sub: "Every job with its drawing, approval, pack and task, live." },
  clients: { title: "Client records", sub: "Clients with their jobs and contacts." },
  people: { title: "People records", sub: "Roles, workshop hours this week and open tasks." },
  suppliers: { title: "Supplier records", sub: "What each supplier supplies, orders, deliveries and balances." },
};

export default function RecordsView({ tab }: { tab: string; job?: string }) {
  const s = useForja();
  const k = TITLES[tab] ? tab : "jobs";
  let body: ReactNode = null;
  if (k === "jobs") body = <Jobs s={s} />;
  if (k === "clients") body = <Clients s={s} />;
  if (k === "people") body = <People s={s} />;
  if (k === "suppliers") body = <Suppliers s={s} />;
  return <Page title={TITLES[k].title} sub={TITLES[k].sub} actions={<DemoBadge />}>{body}</Page>;
}
