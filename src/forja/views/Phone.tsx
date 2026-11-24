import { useState } from "react";
import { useForja } from "../store";
import { TODAY, crew, currentRev, packOf, personName, WORK_DAYS } from "../derive";
import { hrs } from "../format";
import { fmtDate } from "../dates";
import type { PersonId } from "../types";
import Wordmark from "../Wordmark";
import EodForm from "./workshop.EodForm";

export default function Phone({ job }: { job?: string; tab?: string }) {
  const s = useForja();
  const [lead, setLead] = useState<PersonId>("eva");
  const mine = s.assignments
    .filter((a) => a.crewId === lead && WORK_DAYS.includes(a.day))
    .sort((a, b) => a.day.localeCompare(b.day));
  const today = mine.filter((a) => a.day === TODAY);
  const later = mine.filter((a) => a.day !== TODAY);
  const row = (a: (typeof mine)[number]) => {
    const rev = a.packId ? currentRev(s, a.packId)?.rev : undefined;
    const pk = a.packId ? packOf(s, a.packId) : undefined;
    return (
      <li key={a.id} className={"fjph-task" + (a.jobId === job ? " fjph-focus" : "")}>
        <div className="fjph-task-h"><b className="fjph-code">{a.jobId}</b><span>{hrs(a.hours)}</span></div>
        <div>{a.label}</div>
        <div className="fjph-dim">{a.station}{rev ? ", " + rev : ""}{pk && pk.status === "held" ? ", HELD" : ""}{a.pinned ? ", pinned" : ""}{a.day !== TODAY ? ", " + fmtDate(a.day) : ""}</div>
      </li>
    );
  };
  return (
    <div data-theme="forja" className="fjph">
      <header className="fjph-top">
        <Wordmark height={26} />
        <span className="fjph-demo">Demo data</span>
      </header>
      <label className="fjph-field">
        <span>Crew lead</span>
        <select value={lead} onChange={(e) => setLead(e.target.value as PersonId)}>
          {crew(s).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <section>
        <h2>Today for {personName(s, lead)}</h2>
        {today.length ? <ul className="fjph-list">{today.map(row)}</ul> : <p className="fjph-dim">Nothing booked today.</p>}
        {later.length > 0 && (<><h3>Later this week</h3><ul className="fjph-list">{later.map(row)}</ul></>)}
      </section>
      <section>
        <h2>End of day</h2>
        <div className="fjph-form"><EodForm fixedLead={lead} defaultJob={job} /></div>
      </section>
    </div>
  );
}
