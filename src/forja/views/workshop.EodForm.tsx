import { useState } from "react";
import { actions, actorNow, useForja } from "../store";
import { crew, exceptions, jobOf, personName, tvRows } from "../derive";
import { eur, hrs } from "../format";
import { fmtStamp } from "../dates";
import type { Actor, FState, PersonId } from "../types";
import { ActBtn, Btn, Go, JobLink, Pill, roleHint } from "../ui";

const newKey = () => "eod-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);

function jobOptions(s: FState, extra?: string): string[] {
  const ids = new Set<string>();
  s.packs.filter((p) => p.status !== "complete").forEach((p) => ids.add(p.jobId));
  s.assignments.forEach((a) => ids.add(a.jobId));
  if (extra) ids.add(extra);
  return [...ids].sort();
}

/** Shows what the last submission changed, read back from live state. */
function Effects({ last }: { last: { key: string; jobId: string } }) {
  const s = useForja();
  const eod = s.eods.find((e) => e.id === last.key);
  if (!eod) return null;
  const entry = s.costEntries.find((c) => c.id === "ce-eod-" + last.key);
  const rows = tvRows(s).filter((r) => r.jobId === last.jobId);
  const handover = s.handover[last.jobId];
  const exc = exceptions(s).find((e) => e.id === "x-bl-" + last.jobId);
  const rate = s.people.find((p) => p.id === eod.leadId)?.rate ?? 45;
  return (
    <div className="wk-effects" aria-live="polite">
      <div className="wk-effects-h"><Pill tone="ok">Saved</Pill><strong>What changed for {eod.jobId}</strong></div>
      <dl className="wk-dl">
        <dt>Board and TV next action</dt>
        <dd>{rows.length ? rows.map((r, i) => <div key={i}>{r.next}</div>) : "No board row for this job"} <Go to={{ page: "Workshop", tab: "today", job: last.jobId }}>Open Workshop today</Go></dd>
        <dt>Job ledger labour entry</dt>
        <dd>{entry ? <>{hrs(eod.hours)} x {eur(rate)} = <strong>{eur(entry.amount)}</strong> booked to workshop labour. <Go to={{ page: "Job Costing", tab: "ledger", job: last.jobId }}>Open job ledger</Go></> : "No labour booked (0 hours)"}</dd>
        <dt>Morning handover note</dt>
        <dd>{handover ?? "None"}</dd>
        <dt>Blocker</dt>
        <dd>{exc ? <>Raised as an exception for {exc.owner}: {exc.blocking}. <Go to={{ page: "Work", tab: "exceptions", job: last.jobId }}>Open exception</Go></> : "No blocker reported"}</dd>
      </dl>
    </div>
  );
}

/** End-of-day entry. `fixedLead` is used on the phone, where the lead is picked above the form. */
export default function EodForm({ fixedLead, defaultJob }: { fixedLead?: PersonId; defaultJob?: string }) {
  const s = useForja();
  const [key, setKey] = useState(newKey);
  const [leadSel, setLeadSel] = useState<PersonId>("eva");
  const [jobId, setJobId] = useState(defaultJob ?? "FW-262");
  const [hours, setHours] = useState("4");
  const [pieces, setPieces] = useState("6");
  const [done, setDone] = useState(false);
  const [blocker, setBlocker] = useState("");
  const [tomorrow, setTomorrow] = useState("Second coat on oven surround");
  const [last, setLast] = useState<{ key: string; jobId: string } | null>(null);

  const lead = fixedLead ?? leadSel;
  const options = jobOptions(s, defaultJob);
  const h = Number(hours);
  const p = Number(pieces);
  const problem =
    hours.trim() === "" || !Number.isFinite(h) || h < 0 || h > 16 ? "Hours worked must be between 0 and 16."
    : pieces.trim() === "" || !Number.isInteger(p) || p < 0 ? "Pieces completed must be a whole number."
    : !tomorrow.trim() ? "Add tomorrow's first task so the board and TV have a next action."
    : "";
  const actor: Actor = fixedLead ? { role: "lead", name: personName(s, lead) } : actorNow(s);

  const submit = () => {
    const res = actions.submitEod({ key, jobId, leadId: lead, hours: h, pieces: p, taskCompleted: done, blocker: blocker.trim(), tomorrow: tomorrow.trim() }, actor);
    if (res.ok) {
      setLast({ key, jobId });
      setKey(newKey());
    }
  };

  const btnLabel = "Save end of day";
  return (
    <div className="wk-eod">
      <div className="wk-form">
        <label className="fj-field">
          <span>Job</span>
          <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
            {options.map((id) => <option key={id} value={id}>{id} {jobOf(s, id)?.name ?? ""}</option>)}
          </select>
        </label>
        {!fixedLead && (
          <label className="fj-field">
            <span>Crew lead</span>
            <select value={leadSel} onChange={(e) => setLeadSel(e.target.value as PersonId)}>
              {crew(s).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        <label className="fj-field">
          <span>Hours worked</span>
          <input type="number" inputMode="decimal" min={0} max={16} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} />
        </label>
        <label className="fj-field">
          <span>Pieces completed</span>
          <input type="number" inputMode="numeric" min={0} step={1} value={pieces} onChange={(e) => setPieces(e.target.value)} />
        </label>
        <div className="wk-wide">
          <label className="wk-check">
            <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
            <span>Task complete</span>
          </label>
          <div className="fj-faint">Task completion and hours consumed are recorded separately. Ticking this does not change the hours, and the hours do not close the task.</div>
        </div>
        <label className="fj-field wk-wide">
          <span>Blocker (optional)</span>
          <input type="text" value={blocker} placeholder="For example: waiting on 6 birch-ply sheets" onChange={(e) => setBlocker(e.target.value)} />
          <em>A blocker is raised as an exception for the production manager.</em>
        </label>
        <label className="fj-field wk-wide">
          <span>Tomorrow's first task</span>
          <input type="text" value={tomorrow} onChange={(e) => setTomorrow(e.target.value)} />
        </label>
      </div>
      {problem && <div className="wk-warn" role="alert">{problem}</div>}
      <div className="fj-row" style={{ marginTop: 12 }}>
        {fixedLead ? (
          <Btn kind="primary" onClick={submit} disabled={!!problem} why={problem}>{btnLabel}</Btn>
        ) : (
          <ActBtn action="eod" onClick={submit} disabled={!!problem} why={problem}>{btnLabel}</ActBtn>
        )}
        {!fixedLead && roleHint("eod", s.ui.role) && <span className="fj-faint">{roleHint("eod", s.ui.role)}</span>}
        <span className="fj-faint">Entry reference {key.slice(-6)}. Pressing save twice cannot book the labour twice.</span>
      </div>
      {last && <Effects last={last} />}
    </div>
  );
}

export function RecentEods({ limit = 6, jobId }: { limit?: number; jobId?: string }) {
  const s = useForja();
  const list = [...s.eods].filter((e) => !jobId || e.jobId === jobId).sort((a, b) => b.at - a.at).slice(0, limit);
  if (!list.length) return <div className="fj-empty">No end-of-day entries yet today.</div>;
  return (
    <ul className="fj-list">
      {list.map((e) => (
        <li key={e.id}>
          <div style={{ minWidth: 0 }}>
            <div><JobLink code={e.jobId} /> <span className="fj-dim">{personName(s, e.leadId)}, {hrs(e.hours)}, {e.pieces} pieces</span></div>
            <div className="fj-faint">Tomorrow: {e.tomorrow || "not set"}{e.blocker ? ". Blocker: " + e.blocker : ""}</div>
          </div>
          <div className="fj-row">
            <Pill tone={e.taskCompleted ? "ok" : "neutral"}>{e.taskCompleted ? "Task complete" : "Task open"}</Pill>
            <span className="fj-faint">{fmtStamp(e.at)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
