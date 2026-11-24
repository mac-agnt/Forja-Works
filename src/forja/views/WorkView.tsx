import { useState } from "react";
import { Page, Card, Pill, Btn, ActBtn, Go, JobLink, Empty, DemoBadge, Bar } from "../ui";
import type { Tone } from "../ui";
import { actions, actorNow, useForja } from "../store";
import type { FState, Task } from "../types";
import { openStandalone } from "../nav";
import { TODAY, WORK_DAYS, clientOf, dayAvail, dayPlanned, exceptions, fmtDate, jobOf, personName, taskDone } from "../derive";

const prioTone = (p: Task["priority"]): Tone => (p === "High" ? "bad" : p === "Medium" ? "warn" : "neutral");
const byDue = (a: Task, b: Task) => (a.due + a.dueTime).localeCompare(b.due + b.dueTime);

function autoNote(t: Task): string | null {
  const d = t.doneWhen;
  if (!d) return null;
  if (d === "shortage262") return "Ticks off when all 18 birch-ply sheets are received.";
  if (d === "r03Approved") return "Ticks off when the client approves R03 in the client preview.";
  if (d === "cityMoved") return "Ticks off when the production manager confirms the City shopfront move.";
  if (d === "snagsResolved") return "Ticks off when both Garden room snags are closed.";
  if (d === "passDecided") return "Ticks off when the owner records go or pass on the enquiry.";
  if (d === "burgerReviewed") return "Ticks off when the estimate review is marked done.";
  if (d.startsWith("slot:")) return "Ticks off when a slot is chosen in Work packs.";
  if (d.startsWith("rev:")) return "Ticks off when the designer issues the next revision.";
  return null;
}

function TaskRow({ s, t }: { s: FState; t: Task }) {
  const done = taskDone(s, t);
  const manual = !t.doneWhen || t.id === "T-C1";
  const job = t.jobId ? jobOf(s, t.jobId) : undefined;
  const note = autoNote(t);
  const finish = () => {
    if (t.id === "T-C1") actions.markBurgerReviewed(actorNow());
    else actions.completeTask(t.id, actorNow());
  };
  return (
    <div className={"fj-task" + (done ? " fj-done" : "")}>
      <div style={{ minWidth: 0 }}>
        <div className="fj-task-t">{t.title}</div>
        <div className="fj-task-m">
          <span>{personName(s, t.ownerId)}</span>
          <span className="fj-num">Due {fmtDate(t.due)}, {t.dueTime}</span>
          <Pill tone={prioTone(t.priority)}>{t.priority}</Pill>
          <Pill>{t.dept}</Pill>
          <Pill tone={done ? "ok" : "info"}>{done ? "Done" : t.kind === "approval" ? "Open, approval" : "Open"}</Pill>
          {t.jobId && <JobLink code={t.jobId} label={t.jobId + (job ? " " + job.name : "")} />}
        </div>
        {t.note && <div className="fj-note">{t.note}</div>}
        {!done && note && <div className="fj-note">{note}</div>}
      </div>
      <div className="fj-task-a">
        <Go to={t.link} kind="btn">Open</Go>
        {!done && manual && <ActBtn action="task" kind="primary" small onClick={finish}>Mark done</ActBtn>}
      </div>
    </div>
  );
}

function TaskGroups({ s, tasks, emptyText }: { s: FState; tasks: Task[]; emptyText: string }) {
  const open = tasks.filter((t) => !taskDone(s, t)).sort(byDue);
  const done = tasks.filter((t) => taskDone(s, t)).sort(byDue);
  return (
    <div className="fj-stack">
      <Card title={"Open (" + open.length + ")"} flush>
        {open.length ? open.map((t) => <TaskRow key={t.id} s={s} t={t} />) : <Empty text={emptyText} />}
      </Card>
      {done.length > 0 && (
        <Card title={"Done (" + done.length + ")"} flush>
          {done.map((t) => <TaskRow key={t.id} s={s} t={t} />)}
        </Card>
      )}
    </div>
  );
}

function Mine({ s }: { s: FState }) {
  const [everyone, setEveryone] = useState(false);
  const me = s.ui.person;
  const tasks = s.tasks.filter((t) => everyone || t.ownerId === me);
  return (
    <div className="fj-stack">
      <div className="fj-between">
        <div className="fj-dim" style={{ fontSize: 13 }}>
          {everyone ? "Everyone's tasks" : "Tasks for " + personName(s, me)}. Change who you are viewing as with the role selector.
        </div>
        <Btn small kind={everyone ? "primary" : "secondary"} onClick={() => setEveryone(!everyone)}>{everyone ? "Showing everyone" : "Show everyone"}</Btn>
      </div>
      <TaskGroups s={s} tasks={tasks} emptyText={everyone ? "No open tasks." : "Nothing open for " + personName(s, me) + "."} />
    </div>
  );
}

function Approvals({ s }: { s: FState }) {
  const tasks = s.tasks.filter((t) => t.kind === "approval");
  const awaiting = s.revisions.filter((r) => r.status === "awaiting");
  const pending = s.variations.filter((v) => v.status === "pending");
  return (
    <div className="fj-stack">
      <TaskGroups s={s} tasks={tasks} emptyText="No staff approvals open." />
      <Card title={"Client approvals (" + (awaiting.length + pending.length) + ")"} flush right={<Pill tone="info">Read only</Pill>}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)" }} className="fj-dim">
          Staff cannot approve for a client. Approvals happen only in the client preview.
        </div>
        {awaiting.length + pending.length === 0 && <Empty text="No client approvals waiting." />}
        {awaiting.map((r) => {
          const c = clientOf(s, r.jobId);
          return (
            <div key={r.id} className="fj-task">
              <div style={{ minWidth: 0 }}>
                <div className="fj-task-t">Drawing {r.rev} awaiting client approval</div>
                <div className="fj-task-m">
                  <JobLink code={r.jobId} tab="drawings" />
                  <span>Must act: {c?.contact ?? "client"} (client)</span>
                  <Pill tone="warn">Awaiting</Pill>
                  <span>Issued by {r.issuedBy}</span>
                </div>
              </div>
              <div className="fj-task-a">
                <Go to={{ page: "Jobs", tab: "drawings", job: r.jobId }} kind="btn">Open drawing</Go>
                <Btn small kind="primary" onClick={() => openStandalone("portal", r.jobId)}>Preview client view</Btn>
              </div>
            </div>
          );
        })}
        {pending.map((v) => {
          const c = clientOf(s, v.jobId);
          return (
            <div key={v.id} className="fj-task">
              <div style={{ minWidth: 0 }}>
                <div className="fj-task-t">Variation {v.id} pending: {v.title}</div>
                <div className="fj-task-m">
                  <JobLink code={v.jobId} />
                  <span>Must act: {c?.contact ?? "client"} (client)</span>
                  <Pill tone="warn">Pending</Pill>
                </div>
              </div>
              <div className="fj-task-a">
                <Go to={{ page: "Estimates", tab: "variations", job: v.jobId }} kind="btn">Open variation</Go>
                <Btn small kind="primary" onClick={() => openStandalone("portal", v.jobId)}>Preview client view</Btn>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function Exceptions({ s }: { s: FState }) {
  const list = exceptions(s);
  const routes = ["Niamh", "Caio", "Joyce", "Client"] as const;
  return (
    <div className="fj-stack">
      <div className="fj-row">
        {routes.map((r) => <Pill key={r} tone={list.some((e) => e.route === r) ? "info" : "neutral"}>{r}: {list.filter((e) => e.route === r).length}</Pill>)}
        <span className="fj-faint">Routine items go to Niamh. An unresolved commercial decision goes to Caio.</span>
      </div>
      <Card title={"Open exceptions (" + list.length + ")"} flush>
        {list.length === 0 && <Empty text="No open exceptions." hint="Everything on the board is clear." />}
        {list.map((e) => (
          <div key={e.id} className="fj-task">
            <div style={{ minWidth: 0 }}>
              <div className="fj-task-t">{e.title}</div>
              <div className="fj-task-m">
                <Pill tone={e.severity === "high" ? "bad" : "warn"}>{e.severity === "high" ? "High" : "Medium"}</Pill>
                {e.jobId && <JobLink code={e.jobId} />}
                <span>Owner: {e.owner}</span>
                <Pill tone="info">Route: {e.route === "Niamh" ? "production manager (Niamh)" : e.route}</Pill>
              </div>
              <div className="fj-note"><b>Blocking:</b> {e.blocking}</div>
              <div className="fj-note"><b>Evidence:</b> {e.evidence}</div>
              {e.unaffected && <div className="fj-note"><b>Unaffected:</b> {e.unaffected}</div>}
            </div>
            <div className="fj-task-a"><Go to={e.link} kind="btn">Open</Go></div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function Schedule({ s }: { s: FState }) {
  const installs = (day: string) => {
    const ids = new Set<string>();
    s.assignments.filter((a) => a.kind === "install" && a.day === day).forEach((a) => ids.add(a.jobId));
    s.jobs.filter((j) => j.installDate === day).forEach((j) => ids.add(j.code));
    return [...ids];
  };
  return (
    <div className="fj-stack">
      {WORK_DAYS.map((d) => {
        const p = dayPlanned(s, d), a = dayAvail(s, d);
        const due = s.tasks.filter((t) => t.due === d).sort(byDue);
        const ins = installs(d);
        const disp = s.assignments.filter((x) => x.kind === "dispatch" && x.day === d);
        const dispJobs = [...new Set(disp.map((x) => x.jobId))];
        return (
          <Card key={d} title={fmtDate(d) + (d === TODAY ? ", today" : "")} right={<span className="fj-num fj-dim" style={{ fontSize: 12.5 }}>Crew {p}/{a}h</span>}>
            <div className="fj-capday" style={{ paddingTop: 0 }}>
              <span className="fj-faint">Capacity</span>
              <Bar value={p} max={Math.max(a, p)} tone={p > a ? "bad" : "ok"} />
              <span className="fj-num" style={{ textAlign: "right", color: p > a ? "var(--bad)" : undefined }}>{p > a ? "over by " + (p - a) + "h" : a - p + "h free"}</span>
            </div>
            {ins.length > 0 && (
              <div className="fj-row" style={{ marginTop: 8 }}>
                <Pill tone="info">Install</Pill>
                {ins.map((c) => <span key={c}><JobLink code={c} label={c + " " + (jobOf(s, c)?.name ?? "")} /></span>)}
              </div>
            )}
            {dispJobs.length > 0 && (
              <div className="fj-row" style={{ marginTop: 8 }}>
                <Pill tone="info">Dispatch</Pill>
                {dispJobs.map((c) => <span key={c}><JobLink code={c} label={c + " " + (jobOf(s, c)?.name ?? "")} /></span>)}
              </div>
            )}
            <ul className="fj-rowlist" style={{ marginTop: 8 }}>
              {due.length === 0 && <li><span className="fj-faint">No tasks due.</span></li>}
              {due.map((t) => {
                const done = taskDone(s, t);
                return (
                  <li key={t.id}>
                    <span style={{ textDecoration: done ? "line-through" : undefined, color: done ? "var(--faint)" : undefined }}>
                      <Go to={t.link}>{t.title}</Go>
                    </span>
                    <span className="fj-r-d">{t.dueTime}, {personName(s, t.ownerId)}{done ? ", done" : ""}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

const TITLES: Record<string, { title: string; sub: string }> = {
  mine: { title: "My work", sub: "Tasks owned by the person you are viewing as. Automatic tasks tick off when their condition is met." },
  approvals: { title: "Approvals", sub: "Staff approvals to confirm, and client approvals that can only be given in the client preview." },
  exceptions: { title: "Exceptions", sub: "Each one names the blocking condition, who owns it, the evidence and what is unaffected." },
  schedule: { title: "Schedule", sub: "Tasks due day by day, crew capacity Monday to Friday, and the installs." },
};

export default function WorkView({ tab }: { tab: string; job?: string }) {
  const s = useForja();
  const key = TITLES[tab] ? tab : "mine";
  return (
    <Page title={TITLES[key].title} sub={TITLES[key].sub} actions={<DemoBadge />}>
      {key === "mine" && <Mine s={s} />}
      {key === "approvals" && <Approvals s={s} />}
      {key === "exceptions" && <Exceptions s={s} />}
      {key === "schedule" && <Schedule s={s} />}
    </Page>
  );
}
