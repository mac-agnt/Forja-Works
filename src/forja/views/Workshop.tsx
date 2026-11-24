import { useState } from "react";
import type { ReactNode } from "react";
import { actions, actorNow, useForja } from "../store";
import {
  TODAY, WORK_DAYS, DAY_HOURS, briefing, clientOf, crew, currentRev, dayAvail, dayPlanned, gatesClear, jobOf, packGates,
  personLoad, personName, previewMove, shortQty, suggestSlot, tvRows,
} from "../derive";
import type { Link } from "../derive";
import { hrs } from "../format";
import { fmtDate, fmtStamp } from "../dates";
import { openStandalone } from "../nav";
import type { Assignment, FState, Pack, PersonId } from "../types";
import { ActBtn, Btn, Card, Go, Grid, JobLink, Page, Pill, Stat, roleHint } from "../ui";
import EodForm, { RecentEods } from "./workshop.EodForm";

const TOMORROW = WORK_DAYS[1];
const weekday = (d: string) => fmtDate(d).split(" ")[0];
const longDay = (d: string) => ({ Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" } as Record<string, string>)[weekday(d)] ?? weekday(d);

const KIND_SKILL: Record<Assignment["kind"], string> = { bench: "Bench joinery", finishing: "Finishing", install: "Installation", dispatch: "Dispatch loading" };
function skillFor(s: FState, p: Pack): string {
  const kinds = [...new Set(s.assignments.filter((a) => a.packId === p.id).map((a) => KIND_SKILL[a.kind]))];
  return kinds.length ? kinds.join(", ") : p.station.toLowerCase().includes("saw") ? "Panel saw and CNC" : "Bench joinery";
}

interface GateOwner { who: string; to: Link; cta: string }
function gateOwner(s: FState, p: Pack, key: string): GateOwner {
  const client = clientOf(s, p.jobId);
  switch (key) {
    case "drawing": return { who: (client?.contact ?? "Client") + " (client)", to: { page: "Jobs", tab: "drawings", job: p.jobId }, cta: "Open drawings" };
    case "deposit": return { who: "Joyce (operations)", to: { page: "Job Costing", tab: "payments", job: p.jobId }, cta: "Open payments" };
    case "materials": {
      const short = s.requirements.find((r) => r.packId === p.id && shortQty(s, r.id) > 0);
      const buyer = short ? s.pos.find((x) => x.id === short.poId)?.buyerId : undefined;
      return { who: buyer ? personName(s, buyer) + " (buyer)" : "Joyce (buyer)", to: { page: "Purchasing", tab: "shortages", job: p.jobId }, cta: "Open shortages" };
    }
    case "variation": return { who: (client?.contact ?? "Client") + " (client)", to: { page: "Estimates", tab: "variations", job: p.jobId }, cta: "Open variations" };
    default: return { who: "Caio (owner)", to: { page: "Estimates", tab: "quotes", job: p.jobId }, cta: "Open quotes" };
  }
}

function PackStatusPill({ p, s }: { p: Pack; s: FState }) {
  if (p.status === "held") return <Pill tone="bad">Held</Pill>;
  if (p.status === "ready") return <Pill tone="info">Ready, no slot yet</Pill>;
  if (p.status === "scheduled") return <Pill tone="ok">Scheduled{p.slotDay ? " " + fmtDate(p.slotDay) : ""}</Pill>;
  void s;
  return <Pill>Complete</Pill>;
}

/* ── Today ───────────────────────────────────────────────── */
function PackCard({ p, focus }: { p: Pack; focus?: boolean }) {
  const s = useForja();
  const job = jobOf(s, p.jobId);
  const rev = currentRev(s, p.id);
  const missing = packGates(s, p).filter((g) => !g.ok);
  return (
    <article className={"wk-pack" + (focus ? " fj-hl" : "")}>
      <div className="fj-between">
        <div className="fj-row"><JobLink code={p.jobId} /><strong>{p.label}</strong></div>
        <PackStatusPill p={p} s={s} />
      </div>
      <div className="fj-faint">{job?.name}</div>
      <dl className="wk-dl wk-dl-tight">
        <dt>Revision</dt><dd><strong>{rev?.rev ?? "None"}</strong> pack v{p.version}{rev ? ", " + (rev.status === "approved" ? "approved" : rev.status === "awaiting" ? "awaiting approval" : rev.status) : ""}</dd>
        <dt>Issued</dt><dd>{rev ? rev.rev + " by " + rev.issuedBy + ", " + fmtStamp(rev.issuedAt) : "No drawing issued"}{p.workOrderId ? ", work order " + p.workOrderId : ""}</dd>
        <dt>Lead</dt><dd>{personName(s, p.leadId)}</dd>
        <dt>Station</dt><dd>{p.station}</dd>
        <dt>Skill needed</dt><dd>{skillFor(s, p)}, {hrs(p.hoursNeeded)} planned</dd>
      </dl>
      {p.status === "held" && (
        <div className="wk-held">
          <div className="wk-held-h">Do not cut. Blocking conditions:</div>
          <ul className="fj-list">
            {missing.map((g) => {
              const o = gateOwner(s, p, g.key);
              return (
                <li key={g.key}>
                  <div><strong>{g.label}</strong><div className="fj-faint">{g.detail}. With {o.who}.</div></div>
                  <Go to={o.to} kind="btn">{o.cta}</Go>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {p.status === "ready" && (
        <div className="fj-row"><span className="fj-dim">Released. Joining the ready queue does not assign capacity.</span><Go to={{ page: "Workshop", tab: "packs", job: p.jobId }} kind="btn">Choose a slot</Go></div>
      )}
    </article>
  );
}

function Queue({ title, tone, count, children, empty }: { title: string; tone: "ok" | "bad" | "info"; count: number; children: ReactNode; empty: string }) {
  return (
    <Card title={<span className="fj-row">{title} <Pill tone={tone}>{count}</Pill></span>}>
      <div className="wk-queue">{count ? children : <div className="fj-empty">{empty}</div>}</div>
    </Card>
  );
}

function TvStrip() {
  const s = useForja();
  const rows = tvRows(s);
  return (
    <div className="wk-strip" aria-label="Workshop TV preview">
      {rows.map((r, i) => (
        <button key={i} type="button" className={"wk-chip wk-chip-" + r.tone} onClick={() => openStandalone("tv", r.jobId)} title="Open the TV on this job">
          <span className="fj-mono"><b>{r.jobId}</b> {r.rev}</span>
          <span className="wk-chip-s">{r.status}</span>
          <span className="wk-chip-n">{r.next}</span>
        </button>
      ))}
    </div>
  );
}

function Today({ job }: { job?: string }) {
  const s = useForja();
  const active = s.packs.filter((p) => p.status !== "complete");
  const todayIds = new Set(s.assignments.filter((a) => a.day === TODAY && a.packId).map((a) => a.packId));
  const bench = active.filter((p) => (p.status === "ready" && gatesClear(s, p)) || (p.status === "scheduled" && gatesClear(s, p) && todayIds.has(p.id)));
  const held = active.filter((p) => p.status === "held");
  const upcoming = active.filter((p) => p.status === "scheduled" && !todayIds.has(p.id));
  const brief = briefing(s);
  const planned = dayPlanned(s, TODAY), avail = dayAvail(s, TODAY);
  return (
    <div className="fj-stack">
      <Card>
        <div className="wk-launch">
          <div style={{ minWidth: 0 }}>
            <div className="wk-load"><span className={planned > avail ? "wk-bad" : "wk-okc"}>{longDay(TODAY)} {planned}/{avail}h</span>
              <Pill tone={planned > avail ? "bad" : "ok"}>{planned > avail ? "Over capacity by " + (planned - avail) + "h" : "Within capacity"}</Pill></div>
            <ul className="wk-brief">
              {brief.map((c, i) => (
                <li key={i}>
                  <Pill tone={c.done ? "ok" : "warn"}>{c.done ? "Clear" : "Open"}</Pill>
                  <span>{c.text}</span> <Go to={c.link}>Open</Go>
                </li>
              ))}
            </ul>
          </div>
          <div className="wk-launch-b">
            <Btn kind="primary" onClick={() => openStandalone("tv", job)}>Open workshop TV</Btn>
            <Btn kind="secondary" onClick={() => openStandalone("phone", job)}>Open phone view</Btn>
          </div>
        </div>
        <TvStrip />
      </Card>
      <Grid cols={3}>
        <Queue title="Bench-ready" tone="ok" count={bench.length} empty="Nothing is released for the bench.">
          {bench.map((p) => <PackCard key={p.id} p={p} focus={p.jobId === job} />)}
        </Queue>
        <Queue title="Held" tone="bad" count={held.length} empty="No held packs.">
          {held.map((p) => <PackCard key={p.id} p={p} focus={p.jobId === job} />)}
        </Queue>
        <Queue title="Upcoming" tone="info" count={upcoming.length} empty="Nothing scheduled for later days.">
          {upcoming.map((p) => <PackCard key={p.id} p={p} focus={p.jobId === job} />)}
        </Queue>
      </Grid>
    </div>
  );
}

/* ── Capacity ────────────────────────────────────────────── */
function Cell({ s, id, day }: { s: FState; id: PersonId; day: string }) {
  const load = personLoad(s, id, day);
  const list = s.assignments.filter((a) => a.crewId === id && a.day === day);
  const over = load > DAY_HOURS;
  return (
    <td className={over ? "wk-over" : ""}>
      <div className="wk-cell-h"><b className="fj-num">{load}/{DAY_HOURS}h</b>{over && <Pill tone="bad">Over by {load - DAY_HOURS}h</Pill>}{!list.length && <span className="fj-faint">Free</span>}</div>
      {list.map((a) => (
        <div key={a.id} className="wk-alloc">
          <JobLink code={a.jobId} />
          <span>{a.label.replace(/^City shopfront |^Docklands /, "")} {a.hours}h</span>
          {a.pinned && <Pill tone="warn" title="Fixed commitment, cannot be moved">Pinned, locked</Pill>}
        </div>
      ))}
    </td>
  );
}

function ClashPanel({ onClose }: { onClose: () => void }) {
  const s = useForja();
  const jobsToday = [...new Set(s.assignments.filter((a) => a.day === TODAY).map((a) => a.jobId))];
  const cands = jobsToday.map((id) => ({ id, pv: previewMove(s, id, TODAY, TOMORROW) })).filter((c) => c.pv.items.length > 0);
  const target = cands.find((c) => c.pv.eligible);
  const moved = s.moves.filter((m) => m.from === TODAY);
  const over = dayPlanned(s, TODAY) - dayAvail(s, TODAY);
  const okIds = new Set(target?.pv.items.filter((i) => i.ok).map((i) => i.a.id));
  const after = target ? s.assignments.map((a) => (okIds.has(a.id) ? { ...a, day: TOMORROW } : a)) : s.assignments;
  return (
    <Card title={over > 0 ? "Tuesday clash: " + over + "h over capacity" : "Tuesday is within capacity"} right={<Btn small kind="ghost" onClick={onClose}>Cancel</Btn>}>
      {moved.length > 0 && (
        <div className="wk-success" role="status">
          <Pill tone="ok">Move confirmed</Pill>
          <div>Tuesday is now {dayPlanned(s, TODAY)}/{dayAvail(s, TODAY)}h and {weekday(TOMORROW)} {dayPlanned(s, TOMORROW)}/{dayAvail(s, TOMORROW)}h. Thursday dispatch is unchanged.</div>
          <ul className="fj-list">
            {crew(s).map((c) => (
              <li key={c.id}><span>{c.name}</span><span className="fj-row"><span className="fj-num">Tue {personLoad(s, c.id, TODAY)}h, Wed {personLoad(s, c.id, TOMORROW)}h</span><Pill tone={personLoad(s, c.id, TODAY) <= DAY_HOURS && personLoad(s, c.id, TOMORROW) <= DAY_HOURS ? "ok" : "bad"}>{personLoad(s, c.id, TODAY) <= DAY_HOURS && personLoad(s, c.id, TOMORROW) <= DAY_HOURS ? "Within 8h" : "Over 8h"}</Pill></span></li>
            ))}
          </ul>
        </div>
      )}
      {moved.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="wk-h">Move log</div>
          <ul className="fj-list">
            {[...moved, ...s.moves.filter((m) => m.from !== TODAY)].sort((a, b) => b.at - a.at).map((m) => (
              <li key={m.id}><span><JobLink code={m.jobId} /> moved {fmtDate(m.from)} to {fmtDate(m.to)}</span><span className="fj-faint">{m.by}, {fmtStamp(m.at)}</span></li>
            ))}
          </ul>
        </div>
      )}
      {cands.length > 0 && (
        <>
          <div className="wk-h">Tuesday blocks and whether they can move to {fmtDate(TOMORROW)}</div>
          <div className="wk-cands">
            {cands.map((c) => {
              const pinned = c.pv.items.every((i) => i.a.pinned);
              const isTarget = target?.id === c.id;
              return (
                <div key={c.id} className={"wk-cand" + (isTarget ? " fj-hl" : "")}>
                  <div className="fj-between">
                    <div className="fj-row"><JobLink code={c.id} /><span>{jobOf(s, c.id)?.name}</span></div>
                    <Pill tone={c.pv.eligible ? "ok" : pinned ? "warn" : "bad"}>{c.pv.eligible ? "Eligible to move" : pinned ? "Pinned, cannot move" : "Not eligible"}</Pill>
                  </div>
                  <ul className="fj-list">
                    {c.pv.items.map((i) => (
                      <li key={i.a.id}>
                        <span>{i.a.label}, {personName(s, i.a.crewId)}, {i.a.hours}h, {i.a.station}</span>
                        <span className={i.ok ? "wk-okc" : "fj-dim"}>{i.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
      {target && (
        <div className="wk-preview">
          <div className="wk-h">Preview: move {target.pv.hours}h of {jobOf(s, target.id)?.name} to {fmtDate(TOMORROW)}</div>
          <div className="fj-table-wrap">
            <table className="fj-table">
              <thead><tr><th>Day</th><th>Now</th><th>After move</th></tr></thead>
              <tbody>
                {WORK_DAYS.slice(0, 4).map((d) => (
                  <tr key={d} className={d === TODAY || d === TOMORROW ? "fj-hl" : ""}>
                    <td>{fmtDate(d)}</td>
                    <td className="fj-num">{target.pv.before[d]}/{dayAvail(s, d)}h</td>
                    <td className="fj-num"><strong>{target.pv.after[d]}/{dayAvail(s, d)}h</strong>{target.pv.after[d] === target.pv.before[d] ? " unchanged" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="fj-list">
            <li><span>Thursday dispatch {target.pv.dispatchDay ? "(" + fmtDate(target.pv.dispatchDay) + ")" : ""}</span><Pill tone={target.pv.dispatchKept ? "ok" : "bad"}>{target.pv.dispatchKept ? "Dispatch unchanged" : "Dispatch at risk"}</Pill></li>
            <li><span>Every person within 8h on both days</span><Pill tone={target.pv.personOk ? "ok" : "bad"}>{target.pv.personOk ? "Yes" : "No"}</Pill></li>
            {crew(s).map((c) => (
              <li key={c.id}><span>{c.name}</span><span className="fj-num">Tue {personLoad(s, c.id, TODAY)}h to {personLoad(s, c.id, TODAY, after)}h, Wed {personLoad(s, c.id, TOMORROW)}h to {personLoad(s, c.id, TOMORROW, after)}h</span></li>
            ))}
          </ul>
          <div className="fj-row">
            <ActBtn action="confirmMove" disabled={!target.pv.eligible || !target.pv.personOk || !target.pv.dispatchKept} why="This move is not eligible" onClick={() => { actions.confirmMove(target.id, TODAY, TOMORROW, actorNow(s)); }}>Confirm move</ActBtn>
            <Btn kind="secondary" onClick={onClose}>Cancel</Btn>
            <span className="fj-faint">{roleHint("confirmMove", s.ui.role) ?? "Nothing changes until you confirm. Cancel leaves the plan as it is."}</span>
          </div>
        </div>
      )}
      {!target && moved.length === 0 && <div className="fj-empty">No Tuesday block can move to {fmtDate(TOMORROW)}.</div>}
    </Card>
  );
}

function Capacity({ job }: { job?: string }) {
  const s = useForja();
  const over = dayPlanned(s, TODAY) - dayAvail(s, TODAY);
  const [open, setOpen] = useState(job === "FW-266");
  const sorted = [...s.assignments].sort((a, b) => a.day.localeCompare(b.day) || a.jobId.localeCompare(b.jobId) || a.crewId.localeCompare(b.crewId));
  const week = WORK_DAYS.reduce((n, d) => n + dayPlanned(s, d), 0), weekAv = WORK_DAYS.reduce((n, d) => n + dayAvail(s, d), 0);
  const moved = s.moves.some((m) => m.jobId === "FW-266");
  return (
    <div className="fj-stack">
      <Grid cols={4}>
        <Stat label={"Tuesday " + fmtDate(TODAY)} value={dayPlanned(s, TODAY) + "/" + dayAvail(s, TODAY) + "h"} sub={over > 0 ? "Over by " + over + "h" : "Within capacity"} tone={over > 0 ? "bad" : "ok"} />
        <Stat label={"Wednesday " + fmtDate(TOMORROW)} value={dayPlanned(s, TOMORROW) + "/" + dayAvail(s, TOMORROW) + "h"} sub={dayAvail(s, TOMORROW) - dayPlanned(s, TOMORROW) + "h free"} tone="info" />
        <Stat label="Week to Mon 30 Nov" value={week + "/" + weekAv + "h"} sub="booked against available" />
        <Stat label="Pinned blocks" value={s.assignments.filter((a) => a.pinned).length} sub="Docklands fixed install, never moved" />
      </Grid>
      <div className="fj-row">
        {over > 0 ? <Btn kind="primary" onClick={() => setOpen((v) => !v)}>{open ? "Close the " + over + "h clash" : "Open the " + over + "h clash"}</Btn>
          : <Btn kind="secondary" onClick={() => setOpen((v) => !v)}>{open ? "Hide Tuesday review" : moved ? "Review the move" : "Review Tuesday"}</Btn>}
        <span className="fj-faint">{over > 0 ? "Rui and Ben are each over eight hours on Tuesday." : "Tuesday is within eight hours for everyone."}</span>
      </div>
      {open && <ClashPanel onClose={() => setOpen(false)} />}
      <Card title="Crew by day" flush>
        <div className="fj-table-wrap">
          <table className="fj-table wk-grid">
            <thead>
              <tr><th>Crew</th>{WORK_DAYS.map((d) => <th key={d}>{fmtDate(d)}</th>)}</tr>
            </thead>
            <tbody>
              {crew(s).map((c) => (
                <tr key={c.id}><th scope="row" className="wk-rowh">{c.name}</th>{WORK_DAYS.map((d) => <Cell key={d} s={s} id={c.id} day={d} />)}</tr>
              ))}
              <tr className="wk-total">
                <th scope="row" className="wk-rowh">Day total</th>
                {WORK_DAYS.map((d) => {
                  const pl = dayPlanned(s, d), av = dayAvail(s, d);
                  return <td key={d}><b className="fj-num">{pl}/{av}h</b> {pl > av ? <Pill tone="bad">Over by {pl - av}h</Pill> : <Pill tone="ok">{av - pl}h free</Pill>}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Every assignment" flush>
        <div className="fj-table-wrap">
          <table className="fj-table">
            <thead><tr><th>Day</th><th>Job</th><th>Task</th><th>Crew</th><th style={{ textAlign: "right" }}>Hours</th><th>Station</th><th>Type</th><th>Status</th></tr></thead>
            <tbody>
              {sorted.map((a) => (
                <tr key={a.id} className={a.jobId === job ? "fj-hl" : ""}>
                  <td>{fmtDate(a.day)}</td>
                  <td><JobLink code={a.jobId} /></td>
                  <td>{a.label}</td>
                  <td>{personName(s, a.crewId)}</td>
                  <td className="fj-num" style={{ textAlign: "right" }}>{a.hours}h</td>
                  <td>{a.station}</td>
                  <td>{a.kind}</td>
                  <td>{a.pinned ? <Pill tone="warn">Pinned, locked</Pill> : <Pill>Movable</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── Work packs ──────────────────────────────────────────── */
function SlotPanel({ p }: { p: Pack }) {
  const s = useForja();
  const sug = suggestSlot(s, p.hoursNeeded);
  const [day, setDay] = useState(sug?.day ?? WORK_DAYS[0]);
  const [a, setA] = useState<PersonId>(sug?.crew[0] ?? "rui");
  const [b, setB] = useState<PersonId>(sug?.crew[1] ?? "ben");
  const [each, setEach] = useState(String(sug?.each ?? p.hoursNeeded / 2));
  const e = Number(each);
  const ids = [...new Set([a, b])];
  let problem = "";
  if (!(e > 0) || e > DAY_HOURS) problem = "Hours each must be between 0 and " + DAY_HOURS + ".";
  else {
    for (const c of ids) {
      if (personLoad(s, c, day) + e > DAY_HOURS) { problem = personName(s, c) + " would be over eight hours on " + fmtDate(day) + " (already " + personLoad(s, c, day) + "h)."; break; }
      if (s.assignments.some((x) => x.crewId === c && x.day === day && x.kind === "install")) { problem = personName(s, c) + " is on an install on " + fmtDate(day) + "."; break; }
    }
  }
  const sel = (v: PersonId, set: (x: PersonId) => void, label: string) => (
    <label className="fj-field"><span>{label}</span>
      <select value={v} onChange={(ev) => set(ev.target.value as PersonId)}>{crew(s).map((c) => <option key={c.id} value={c.id}>{c.name} ({personLoad(s, c.id, day)}h booked)</option>)}</select>
    </label>
  );
  return (
    <div className="wk-slot">
      <div className="wk-h">Choose a slot</div>
      <p className="fj-dim wk-note">
        {sug ? <>Next available slot: <strong>{fmtDate(sug.day)}</strong>, {sug.crew.map((c) => personName(s, c)).join(" and ")}, {hrs(sug.each)} each. </> : "No two-person slot is free this week. "}
        Joining the ready queue does not assign capacity. The production manager (Niamh) owns the queue and chooses day and crew.
      </p>
      <div className="wk-form">
        <label className="fj-field"><span>Day</span>
          <select value={day} onChange={(ev) => setDay(ev.target.value)}>{WORK_DAYS.map((d) => <option key={d} value={d}>{fmtDate(d)} ({dayPlanned(s, d)}/{dayAvail(s, d)}h)</option>)}</select>
        </label>
        {sel(a, setA, "First crew member")}
        {sel(b, setB, "Second crew member")}
        <label className="fj-field"><span>Hours each</span><input type="number" min={1} max={DAY_HOURS} step={0.5} value={each} onChange={(ev) => setEach(ev.target.value)} /></label>
      </div>
      <div className="fj-faint">Total {hrs((Number.isFinite(e) ? e : 0) * ids.length)} against {hrs(p.hoursNeeded)} needed.</div>
      {problem && <div className="wk-warn" role="alert">{problem}</div>}
      <div className="fj-row" style={{ marginTop: 10 }}>
        <ActBtn action="assignSlot" disabled={!!problem} why={problem} onClick={() => { actions.assignSlot(p.id, day, ids, e, actorNow(s)); }}>Assign slot</ActBtn>
        {sug && <Btn kind="ghost" onClick={() => { setDay(sug.day); setA(sug.crew[0]); setB(sug.crew[1]); setEach(String(sug.each)); }}>Use suggestion</Btn>}
        <span className="fj-faint">{roleHint("assignSlot", s.ui.role) ?? ""}</span>
      </div>
    </div>
  );
}

function PackFull({ p, focus }: { p: Pack; focus: boolean }) {
  const s = useForja();
  const rev = currentRev(s, p.id);
  const gates = packGates(s, p);
  const contents: [string, string[]][] = [["Cut list", p.cutList], ["Dimensions", p.dimensions], ["Material picks", p.materialPicks], ["QA checklist", p.qa]];
  return (
    <Card className={focus ? "fj-hl" : ""} title={<span className="fj-row"><JobLink code={p.jobId} /> {p.label} <PackStatusPill p={p} s={s} /></span>}
      right={<span className="fj-faint">{p.id} v{p.version}{p.workOrderId ? ", " + p.workOrderId : ""}</span>}>
      <div className="wk-pack-top">
        <dl className="wk-dl wk-dl-tight">
          <dt>Job</dt><dd>{jobOf(s, p.jobId)?.name}</dd>
          <dt>Issued revision</dt><dd><strong>{rev?.rev ?? "None"}</strong> (pack version {p.version}){rev ? ", " + rev.status : ""}</dd>
          <dt>Named lead</dt><dd>{personName(s, p.leadId)}</dd>
          <dt>Station</dt><dd>{p.station}, {hrs(p.hoursNeeded)} planned</dd>
          {p.slotDay && <><dt>Slot</dt><dd>{fmtDate(p.slotDay)}</dd></>}
        </dl>
        <div>
          <div className="wk-h">Gates</div>
          <ul className="fj-list">
            {gates.map((g) => (
              <li key={g.key}><span>{g.label}<div className="fj-faint">{g.detail}</div></span><Pill tone={g.ok ? "ok" : "bad"}>{g.ok ? "Clear" : "Blocking"}</Pill></li>
            ))}
          </ul>
        </div>
      </div>
      {p.status === "held" && (
        <div className="wk-held">
          <div className="wk-held-h"><Pill tone="bad">Held</Pill> Do not cut until every gate is clear.</div>
          <ul className="fj-list">
            {gates.filter((g) => !g.ok).map((g) => { const o = gateOwner(s, p, g.key); return <li key={g.key}><span>{g.detail}. With {o.who}.</span><Go to={o.to} kind="btn">{o.cta}</Go></li>; })}
          </ul>
        </div>
      )}
      {contents.some(([, l]) => l.length) && (
        <div className="wk-contents">
          {contents.map(([t, l]) => l.length ? <div key={t}><div className="wk-h">{t}</div><ul className="wk-bul">{l.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null)}
        </div>
      )}
      {p.history.length > 0 && (
        <div>
          <div className="wk-h">History</div>
          <ul className="fj-list">
            {p.history.map((h, i) => (
              <li key={i}><span>{h.text}</span><span className="fj-row"><Pill tone={h.status === "withdrawn" ? "bad" : h.status === "released" ? "ok" : "neutral"}>{h.status === "withdrawn" ? "Withdrawn, superseded" : h.status}</Pill><span className="fj-faint">{h.rev} v{h.version}, {fmtStamp(h.at)}</span></span></li>
            ))}
          </ul>
        </div>
      )}
      {p.status === "ready" && <SlotPanel p={p} />}
    </Card>
  );
}

function Packs({ job }: { job?: string }) {
  const s = useForja();
  const order = (p: Pack) => (p.jobId === job ? 0 : p.id === "PK-261" || p.id === "PK-262-1" ? 1 : p.status === "complete" ? 3 : 2);
  const list = [...s.packs].sort((a, b) => order(a) - order(b));
  const watch = (p: Pack) => (job ? p.jobId === job : p.id === "PK-261" || p.id === "PK-262-1");
  return (
    <div className="fj-stack">
      <Grid cols={4}>
        <Stat label="Held" value={s.packs.filter((p) => p.status === "held").length} sub="packs not released" tone="bad" />
        <Stat label="Ready, no slot" value={s.packs.filter((p) => p.status === "ready").length} sub="waiting for Niamh" tone="info" />
        <Stat label="Scheduled" value={s.packs.filter((p) => p.status === "scheduled").length} sub="have capacity assigned" tone="ok" />
        <Stat label="Complete" value={s.packs.filter((p) => p.status === "complete").length} sub="handed over" />
      </Grid>
      {list.map((p) => <PackFull key={p.id} p={p} focus={watch(p) && p.status !== "complete"} />)}
    </div>
  );
}

/* ── End of day ──────────────────────────────────────────── */
function Eod({ job }: { job?: string }) {
  return (
    <div className="fj-split">
      <Card title="End of day entry"><EodForm defaultJob={job} /></Card>
      <Card title="Recent entries"><RecentEods limit={8} /></Card>
    </div>
  );
}

export default function Workshop({ tab, job }: { tab: string; job?: string }) {
  const s = useForja();
  const planned = dayPlanned(s, TODAY), avail = dayAvail(s, TODAY);
  return (
    <Page title="Workshop" sub={"Bench queue, capacity and work packs. " + longDay(TODAY) + " " + planned + "/" + avail + "h booked."}>
      {tab === "capacity" ? <Capacity job={job} /> : tab === "packs" ? <Packs job={job} /> : tab === "eod" ? <Eod job={job} /> : <Today job={job} />}
    </Page>
  );
}
