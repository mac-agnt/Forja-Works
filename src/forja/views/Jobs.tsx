import { useState } from "react";
import { Page, Card, Pill, Btn, ActBtn, JobLink, Go, Table, Empty, Stat, Grid, Tabs, Bar, type Tone } from "../ui";
import { actions, actorNow, can, ROLE_LABEL, useForja } from "../store";
import {
  DESIGN_BASELINE_RECEIPT, DESIGN_BASELINE_TARGET, TODAY, clientOf, currentRev, depositOf, designWhatIf, eur, fmtDate, jobOf, jobSummary,
  packGates, packOf, personName, programmeFor, receivedQty, shortQty, suggestSlot, taskDone,
} from "../derive";
import { fmtStamp, diffDays } from "../dates";
import { navigate, openStandalone, portalUrl } from "../nav";
import type { FState, Job, Milestone, Role } from "../types";
import DrawingView from "./DrawingView";
import { Hint, JobSelect, REV_LABEL, RevPill, STAGES, installCrew, installDateOf, keyDates, pkgIdsFor, revsOf } from "./jobs.helpers";

const msTone = (m: Milestone): Tone => (m.status === "received" ? "ok" : m.status === "due" || m.status === "outstanding" ? "warn" : m.status === "locked" ? "neutral" : "info");
const msLabel = (m: Milestone) => (m.status === "received" ? "Received" : m.status === "due" ? "Due" : m.status === "outstanding" ? "Outstanding" : m.status === "locked" ? "After sign-off" : "Scheduled");
const openPreview = (code: string, tab = "programme") => { window.location.hash = portalUrl(code, tab); };

export default function Jobs({ tab, job }: { tab: string; job?: string }) {
  if (tab === "programme") return <ProgrammeTab job={job} />;
  if (tab === "drawings") return <DrawingsTab job={job} />;
  if (tab === "snags") return <SnagsTab job={job} />;
  return job ? <Workspace code={job} /> : <Live />;
}

/* ───────────────────────── Live jobs ───────────────────────── */
type TypeFilter = "all" | "commercial" | "residential";

function Live() {
  const s = useForja();
  const [type, setType] = useState<TypeFilter>("all");
  const [stage, setStage] = useState<string>("all");
  const count = (t: TypeFilter) => s.jobs.filter((j) => t === "all" || j.type === t).length;
  const list = s.jobs.filter((j) => (type === "all" || j.type === type) && (stage === "all" || j.stage === stage));
  const rows = list.map((j) => {
    const sm = jobSummary(s, j);
    const kd = keyDates(s, j.code);
    return [
      <JobLink key="c" code={j.code} />,
      <strong key="n">{j.name}</strong>,
      clientOf(s, j.code)?.name ?? "",
      <span key="t" className="fj-dim">{j.type === "commercial" ? "Commercial" : "Residential"}</span>,
      <span key="sv" className="fj-tag">{j.service}</span>,
      personName(s, j.ownerId),
      <Pill key="st">{j.stage}</Pill>,
      <span key="su"><Pill tone={sm.tone}>{sm.state}</Pill></span>,
      sm.next,
      sm.ownerKind === "client" ? <span key="o"><Pill tone="warn">Client</Pill> {sm.owner}</span> : sm.owner,
      kd ? (
        <div key="d" className="fj-num">
          <div>Committed {fmtDate(kd.committed)}</div>
          <div className={kd.moved > 0 ? "fj-hint" : "fj-faint"}>Forecast {fmtDate(kd.forecast)}{kd.moved > 0 ? " (+" + kd.moved + "d)" : ""}</div>
        </div>
      ) : "",
    ];
  });
  return (
    <Page title="Live jobs" sub="Seven jobs, each with an owner and a next action. Open a row for the full job workspace." actions={<Btn small onClick={() => openStandalone("tv")}>Workshop TV</Btn>}>
      <div className="fj-stack">
        <div className="fj-row">
          <Tabs<TypeFilter> items={[{ id: "all", label: "All (" + count("all") + ")" }, { id: "commercial", label: "Commercial (" + count("commercial") + ")" }, { id: "residential", label: "Residential (" + count("residential") + ")" }]} value={type} onChange={setType} />
          <label className="fj-role">
            <span>Stage</span>
            <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filter by stage">
              <option value="all">All stages</option>
              {STAGES.map((st) => <option key={st} value={st}>{st + " (" + s.jobs.filter((j) => j.stage === st).length + ")"}</option>)}
            </select>
          </label>
          <span className="fj-faint">Showing {list.length} of {s.jobs.length} jobs</span>
        </div>
        <Card flush>
          <Table
            cols={[{ label: "Code" }, { label: "Job" }, { label: "Client" }, { label: "Type" }, { label: "Service" }, { label: "Owner" }, { label: "Stage" }, { label: "Status" }, { label: "Next action" }, { label: "Next action owner" }, { label: "Dates" }]}
            rows={rows}
            empty="No jobs match these filters."
            onRow={(i) => navigate({ page: "Jobs", tab: "live", job: list[i].code })}
          />
        </Card>
      </div>
    </Page>
  );
}

/* ───────────────────────── Job workspace ───────────────────────── */
const PERM_ROWS: { key: string; label: string }[] = [
  { key: "approveRevision", label: "Approve a drawing" }, { key: "requestChanges", label: "Request drawing changes" }, { key: "issueRevision", label: "Issue a revision" },
  { key: "confirmPayment", label: "Record a payment receipt" }, { key: "assignSlot", label: "Assign a workshop slot" }, { key: "receive", label: "Receive materials" },
  { key: "closeSnag", label: "Close a snag" }, { key: "confirmSnag", label: "Confirm a snag fixed" }, { key: "acceptVariation", label: "Accept a variation" },
];
const ROLES: Role[] = ["owner", "ops", "pm", "designer", "lead", "client"];

function Workspace({ code }: { code: string }) {
  const s = useForja();
  const job = jobOf(s, code);
  if (!job) return <Page title="Jobs"><Card><Empty text={"No job with code " + code} /></Card></Page>;
  const sm = jobSummary(s, job);
  const client = clientOf(s, code);
  const pkgs = pkgIdsFor(s, code);
  const rev = pkgs[0] ? currentRev(s, pkgs[0]) : undefined;
  const packs = s.packs.filter((p) => p.jobId === code);
  const mainPack = (pkgs[0] ? packOf(s, pkgs[0]) : undefined) ?? packs[0];
  const gates = mainPack ? packGates(s, mainPack) : [];
  const ms = s.milestones.filter((m) => m.jobId === code);
  const reqs = s.requirements.filter((r) => r.jobId === code);
  const wos = s.workOrders.filter((w) => w.jobId === code);
  const tasks = s.tasks.filter((t) => t.jobId === code);
  const snags = s.snags.filter((x) => x.jobId === code);
  const prog = programmeFor(s, code);
  const role = s.ui.role;

  return (
    <Page title={code + " " + job.name} sub={(client?.name ?? "") + ", " + job.summary}
      actions={<><Btn kind="primary" onClick={() => openStandalone("portal", code)}>Preview client view</Btn><Btn onClick={() => openPreview(code)}>Open client view here</Btn><Btn onClick={() => openStandalone("tv")}>Workshop TV</Btn></>}>
      <div className="fj-stack">
        <div className="fj-crumb">
          <Btn small kind="ghost" onClick={() => navigate({ page: "Jobs", tab: "live" })}>All jobs</Btn>
          <Pill>{job.stage}</Pill><Pill tone={sm.tone}>{sm.state}</Pill><span className="fj-tag">{job.service}</span>
          <span className="fj-dim">Owner {personName(s, job.ownerId)}</span>
        </div>

        <div className={"fj-banner" + (sm.ownerKind === "client" ? " fj-clientowns" : "")}>
          <div>
            <div className="fj-faint">Next action</div>
            <div><b>{sm.next}</b></div>
            <div className="fj-dim">
              Owned by {sm.ownerKind === "client" ? <><Pill tone="warn">Client</Pill> {sm.owner}. We cannot move this for them.</> : sm.owner}
              {sm.affects ? ". Affects: " + sm.affects : ""}
            </div>
          </div>
          <Go to={sm.link} kind="btn">Open</Go>
        </div>

        <div className="fj-split">
          <div className="fj-stack">
            <Card title="Drawing pack" right={<Go to={{ page: "Jobs", tab: "drawings", job: code }}>Open drawings and sign-off</Go>}>
              {rev ? (
                <dl className="fj-kv">
                  <dt>Current revision</dt><dd>{rev.rev}, {rev.title} <RevPill status={rev.status} /></dd>
                  <dt>Approval</dt><dd>{rev.status === "approved" ? "Approved by " + (rev.approvedBy ?? "client") : REV_LABEL[rev.status]}</dd>
                  {mainPack && <><dt>Pack</dt><dd>{mainPack.id} v{mainPack.version}, {mainPack.status}</dd></>}
                </dl>
              ) : <div className="fj-dim">No drawing issued yet. Design starts when the design fee is recorded.</div>}
              {gates.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="fj-faint">Pack gate checklist</div>
                  {gates.map((g) => (
                    <div className="fj-gate" key={g.key}>
                      <Pill tone={g.ok ? "ok" : "bad"}>{g.ok ? "OK" : "Not OK"}</Pill>
                      <div><div>{g.label}</div><div className="fj-faint">{g.detail}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Financial gates" right={<Go to={{ page: "Job Costing", tab: "payments", job: code }}>Payments</Go>}>
              {ms.some((m) => m.kind === "deposit") && <div className="fj-dim" style={{ marginBottom: 8 }}>Deposit must be recorded before the pack is released to the workshop.</div>}
              <Table
                cols={[{ label: "Milestone" }, { label: "Amount", align: "right" }, { label: "Status" }, { label: "Note" }, { label: "" }]}
                rows={ms.map((m) => [
                  m.label, <span key="a" className="fj-num">{eur(m.amount)}</span>, <Pill key="p" tone={msTone(m)}>{msLabel(m)}</Pill>,
                  <span key="n" className="fj-dim">{m.status === "received" && m.ref ? m.ref + ", " + (m.receivedOn ? fmtDate(m.receivedOn) : "") : m.dueNote}</span>,
                  m.status === "outstanding" || m.status === "due" ? <ActBtn key="b" small action="confirmPayment" onClick={() => actions.confirmPayment(m.id, actorNow())}>Record receipt</ActBtn> : "",
                ])}
                empty="No payment milestones."
              />
              <Hint action="confirmPayment" role={role} />
            </Card>

            <Card title="Materials" right={<Go to={{ page: "Purchasing", tab: "requirements", job: code }}>Purchasing</Go>}>
              <Table
                cols={[{ label: "Item" }, { label: "Needed", align: "right" }, { label: "Received", align: "right" }, { label: "Status" }]}
                rows={reqs.map((r) => { const sh = shortQty(s, r.id); return [r.item, r.qty + " " + r.unit + (r.qty === 1 ? "" : "s"), String(receivedQty(s, r.id)), sh === 0 ? <Pill key="p" tone="ok">Received</Pill> : <Pill key="p" tone="bad">{sh + " short"}</Pill>]; })}
                empty="No materials recorded for this job."
              />
            </Card>

            <Card title="Work orders and pack history">
              {wos.length === 0 && <div className="fj-dim">No work order yet. One is created when the pack is released.</div>}
              {wos.map((w) => <div key={w.id} className="fj-row"><Pill tone="ok">Work order</Pill><span className="fj-mono">{w.id}</span><span className="fj-dim">v{w.version} on {w.rev}</span></div>)}
              {packs.map((p) => (
                <div key={p.id} style={{ marginTop: 12 }}>
                  <div className="fj-between"><strong>{p.id} {p.label}</strong><Pill tone={p.status === "held" ? "bad" : p.status === "ready" ? "info" : "ok"}>v{p.version} {p.status}</Pill></div>
                  {p.history.length === 0 ? <div className="fj-faint">No earlier versions.</div> : (
                    <ul className="fj-list">
                      {p.history.map((h, i) => (
                        <li key={i}><span>{h.text}<div className="fj-faint">{fmtStamp(h.at)}</div></span><Pill tone={h.status === "withdrawn" ? "bad" : h.status === "superseded" ? "warn" : "ok"}>{"v" + h.version + " " + h.status}</Pill></li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </Card>
          </div>

          <div className="fj-stack">
            <Card title="Committed and forecast dates">
              <Table
                cols={[{ label: "Milestone" }, { label: "Committed" }, { label: "Forecast" }]}
                rows={prog.map((r) => [r.label, fmtDate(r.baseline), <span key="f" className={r.moved > 0 ? "fj-hint" : ""}>{fmtDate(r.forecast)}{r.moved > 0 ? " (+" + r.moved + "d)" : ""}{r.kind === "fixed" ? " fixed" : ""}</span>])}
                empty="No programme dates."
              />
              <div style={{ marginTop: 8 }}><Go to={{ page: "Jobs", tab: "programme", job: code }}>Open programme</Go></div>
            </Card>

            <Card title="Site tasks">
              {tasks.length === 0 ? <div className="fj-dim">No tasks for this job.</div> : (
                <ul className="fj-list">
                  {tasks.map((t) => { const d = taskDone(s, t); return (
                    <li key={t.id}><span><Go to={t.link}>{t.title}</Go><div className="fj-faint">{personName(s, t.ownerId)}, due {t.dueTime}</div></span><Pill tone={d ? "ok" : "warn"}>{d ? "Done" : "Open"}</Pill></li>
                  ); })}
                </ul>
              )}
            </Card>

            <Card title="Snags" right={<Go to={{ page: "Jobs", tab: "snags", job: code }}>Installation and snags</Go>}>
              {snags.length === 0 ? <div className="fj-dim">No snags recorded.</div> : (
                <ul className="fj-list">{snags.map((x) => <li key={x.id}><span>{x.title}</span><SnagPill status={x.status} /></li>)}</ul>
              )}
            </Card>

            <Card title="Handover note">
              <div className="fj-dim">{s.handover[code] ?? "No end of day note yet. The crew lead's note appears here after End of day."}</div>
            </Card>

            <Card title="Who can do what on this job">
              <Table
                cols={[{ label: "Role" }, { label: "Can" }]}
                rows={ROLES.map((r) => {
                  const ok = PERM_ROWS.filter((p) => can(r, p.key)).map((p) => p.label);
                  return [<span key="r">{ROLE_LABEL[r]}{r === role ? " (you)" : ""}</span>, <span key="c" className="fj-dim">{ok.length ? ok.join(", ") : "View only"}{r === "client" ? ". Only inside the client view." : ""}</span>];
                })}
              />
            </Card>
          </div>
        </div>
      </div>
    </Page>
  );
}

function SnagPill({ status }: { status: "open" | "resolved" | "confirmed" }) {
  return <Pill tone={status === "open" ? "warn" : status === "resolved" ? "info" : "ok"}>{status === "open" ? "Open" : status === "resolved" ? "Resolved" : "Confirmed"}</Pill>;
}

/* ───────────────────────── Programme ───────────────────────── */
function ProgrammeTab({ job }: { job?: string }) {
  const s = useForja();
  const codes = job ? [job] : s.jobs.map((j) => j.code);
  const showClock = !job || job === "FW-263";
  const rows263 = programmeFor(s, "FW-263");
  const conflict = rows263.find((r) => r.conflict);
  const fee = s.milestones.find((m) => m.id === "M-263-D");
  const paid = s.designReceivedOn;
  const w = paid ? designWhatIf(paid) : null;
  const draft = s.drafts[s.drafts.length - 1];
  const role = s.ui.role;
  const rows = codes.flatMap((c) => programmeFor(s, c).map((r) => [
    <JobLink key="j" code={c} tab="programme" />, r.label,
    <Pill key="k" tone={r.kind === "fixed" ? "bad" : r.kind === "design" ? "info" : "neutral"}>{r.kind === "fixed" ? "Fixed" : r.kind === "design" ? "Design" : "Provisional"}</Pill>,
    r.owner, <span key="b" className="fj-num">{fmtDate(r.baseline)}</span>,
    <span key="f" className="fj-num">{r.pendingStart ? fmtDate(r.forecast) + " (clock not started)" : fmtDate(r.forecast)}</span>,
    r.moved > 0 ? <Pill key="m" tone="warn">{"+" + r.moved + " day" + (r.moved > 1 ? "s" : "")}</Pill> : <span key="m" className="fj-faint">0</span>,
    r.conflict ? <Pill key="c" tone="bad">Conflict</Pill> : "",
  ]));
  return (
    <Page title="Programme" sub="Baseline against forecast for every client-facing date. Fixed commitments never move." actions={<JobSelect s={s} value={job ?? ""} tab="programme" codes={s.jobs.map((j) => j.code)} />}>
      <div className="fj-stack">
        {job && <div><Btn small kind="ghost" onClick={() => navigate({ page: "Jobs", tab: "programme" })}>All jobs</Btn></div>}
        {showClock && (
          <Card title="Victor house design clock (FW-263)" right={<Pill tone={paid ? "ok" : "warn"}>{paid ? "Clock running" : "Clock not started"}</Pill>}>
            <p style={{ marginTop: 0 }}>The design target is <b>7 calendar days from receipt</b> of the design fee. Day zero is the payment day, not the day we chase it.</p>
            <Grid cols={4}>
              <Stat label="Baseline assumed" value={fmtDate(DESIGN_BASELINE_RECEIPT)} sub={"Target " + fmtDate(DESIGN_BASELINE_TARGET)} />
              <Stat label="Actual receipt" value={paid ? fmtDate(paid) : "Not received"} sub={fee ? eur(fee.amount) + " design fee" : ""} tone={paid ? "ok" : "warn"} />
              <Stat label="Design target now" value={w ? fmtDate(w.target) : fmtDate(DESIGN_BASELINE_TARGET)} sub={w ? (w.delay > 0 ? "Moved " + w.delay + " day" + (w.delay > 1 ? "s" : "") : "On baseline") : "Starts on receipt"} />
              <Stat label="Original baseline" value={fmtDate(DESIGN_BASELINE_TARGET)} sub="Kept for the record" />
            </Grid>
            {w && w.delay > 0 && <p className="fj-dim">Original baseline {fmtDate(DESIGN_BASELINE_TARGET)} is kept. Reason for the move: the design fee arrived {fmtDate(paid as string)}, {diffDays(paid as string, DESIGN_BASELINE_RECEIPT)} day after the assumed {fmtDate(DESIGN_BASELINE_RECEIPT)}. Dependent provisional dates moved by the same {w.delay} day.</p>}
            {!paid && fee && (
              <div className="fj-row" style={{ marginTop: 10 }}>
                <ActBtn action="confirmPayment" onClick={() => actions.confirmPayment(fee.id, actorNow())}>{"Confirm " + eur(fee.amount) + " mock receipt"}</ActBtn>
                <Hint action="confirmPayment" role={role} extra="Switch to Joyce to confirm the receipt." />
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <div className="fj-faint">Fixed commitments on this job</div>
              <div className="fj-row">{rows263.filter((r) => r.kind === "fixed").map((r) => <Pill key={r.id} tone="bad">{r.label + ", " + fmtDate(r.forecast)}</Pill>)}</div>
            </div>
            {conflict && (
              <div className="fj-banner fj-clientowns" style={{ marginTop: 12 }}>
                <div><b>Conflict: {conflict.label} on {fmtDate(conflict.forecast)} sits on a fixed supplier slot.</b>
                  <div className="fj-dim">Routed to Niamh, the production manager. Capacity is never promised until she confirms.</div></div>
                <Go to={{ page: "Workshop", tab: "capacity", job: "FW-263" }} kind="btn">Open capacity</Go>
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <div className="fj-faint">Client Programme draft (local preview, nothing is sent)</div>
              {draft ? <div className="fj-note-box" style={{ padding: 12, border: "1px solid var(--border-strong)", borderRadius: 10, marginTop: 6 }}>{draft.text}<div className="fj-faint">{draft.trigger}</div></div> : <div className="fj-dim">The draft appears once the design fee is recorded.</div>}
              <div style={{ marginTop: 6 }}><Go to={{ page: "Agents", tab: "programme", job: "FW-263" }}>Open Client Programme agent</Go></div>
            </div>
          </Card>
        )}
        <Card title={job ? job + " programme" : "All jobs"} flush>
          <Table cols={[{ label: "Job" }, { label: "Milestone" }, { label: "Kind" }, { label: "Owner" }, { label: "Baseline" }, { label: "Forecast" }, { label: "Moved" }, { label: "Flag" }]} rows={rows} empty="No programme items." />
        </Card>
      </div>
    </Page>
  );
}

/* ───────────────────────── Drawings & sign-off ───────────────────────── */
function DrawingsTab({ job }: { job?: string }) {
  const s = useForja();
  const code = job ?? "FW-261";
  const [pk, setPk] = useState("");
  const [mm, setMm] = useState("");
  const [note, setNote] = useState("");
  const j = jobOf(s, code);
  const pkgs = pkgIdsFor(s, code);
  const pkg = pkgs.includes(pk) ? pk : pkgs[0];
  const role = s.ui.role;
  if (!j) return <Page title="Drawings and sign-off"><Card><Empty text="Job not found" /></Card></Page>;
  const sm = jobSummary(s, j);
  const revs = pkg ? revsOf(s, pkg) : [];
  const cur = pkg ? currentRev(s, pkg) : undefined;
  const idx = cur ? revs.findIndex((r) => r.id === cur.id) : -1;
  const prev = idx > 0 ? [...revs.slice(0, idx)].reverse().find((r) => r.openingMm !== undefined) : undefined;
  const pack = pkg ? packOf(s, pkg) : undefined;
  const gates = pack ? packGates(s, pack) : [];
  const dep = depositOf(s, code);
  const approved = cur?.status === "approved";
  const paid = dep?.status === "received";
  const state = !approved && !paid ? 0 : approved && !paid ? 1 : !approved && paid ? 2 : 3;
  const hasBothGates = !!pack && pack.gates.includes("drawing") && pack.gates.includes("deposit");
  const slot = pack ? suggestSlot(s, pack.hoursNeeded) : null;
  const wos = pack ? s.workOrders.filter((w) => w.packId === pack.id) : [];
  const legend = [
    "Held: drawing not approved and deposit not recorded",
    "Drawing approved · waiting for " + eur(dep?.amount ?? 0) + " deposit",
    "Deposit recorded · waiting for " + (cur?.rev ?? "drawing") + " approval",
    "Released into the ready queue",
  ];
  const defaultMm = cur?.openingMm ? String(cur.openingMm) : "";
  const mmVal = mm === "" ? defaultMm : mm;

  return (
    <Page title="Drawings and sign-off" sub="Review revisions side by side. Client approval is given in the client preview only." actions={<JobSelect s={s} value={code} tab="drawings" />}>
      <div className="fj-stack">
        {pkgs.length > 1 && (
          <div className="fj-row"><span className="fj-dim">Drawing package</span>
            <Tabs items={pkgs.map((p) => ({ id: p, label: p }))} value={pkg ?? ""} onChange={(v) => setPk(v)} /></div>
        )}
        {!cur ? (
          <Card><Empty text="No drawing issued for this job yet." hint="Design starts when the design fee is recorded." /></Card>
        ) : (
          <>
            <div className={"fj-banner" + (sm.ownerKind === "client" ? " fj-clientowns" : "")}>
              <div><div className="fj-faint">{code} status</div><b>{sm.state}</b><div className="fj-dim">Next: {sm.next}. Owner {sm.ownerKind === "client" ? "(client) " : ""}{sm.owner}.</div></div>
              <div className="fj-row">
                <Btn kind="primary" onClick={() => openStandalone("portal", code, "drawings")}>Open client view to approve</Btn>
                <Btn onClick={() => openPreview(code, "drawings")}>Open here</Btn>
              </div>
            </div>
            <div className="fj-hint" style={{ color: "var(--dim)" }}>Staff cannot approve for the client. Approval is recorded with the client's name and a timestamp from the client view.</div>

            {cur.openingMm !== undefined ? (
              <div className="fj-two">
                {prev && prev.openingMm !== undefined && (
                  <Card title={prev.rev + " " + REV_LABEL[prev.status].toLowerCase()} right={<RevPill status={prev.status} />}>
                    <DrawingView openingMm={prev.openingMm} title={prev.rev + " front elevation"} plain />
                    <p className="fj-dim">{prev.note}</p>
                  </Card>
                )}
                <Card title={cur.rev + " " + REV_LABEL[cur.status].toLowerCase()} right={<RevPill status={cur.status} />}>
                  <DrawingView openingMm={cur.openingMm} fromMm={prev?.openingMm} title={cur.rev + " front elevation"} />
                  <p className="fj-dim">{cur.note}</p>
                </Card>
              </div>
            ) : (
              <Card title={cur.rev + " " + cur.title} right={<RevPill status={cur.status} />}><p className="fj-dim">{cur.note}</p><div className="fj-faint">This package has no service opening dimension to draw.</div></Card>
            )}

            <Card title="Revisions and approval trail" flush>
              <Table
                cols={[{ label: "Rev" }, { label: "Title" }, { label: "Status" }, { label: "Opening", align: "right" }, { label: "Issued" }, { label: "Approved" }]}
                rows={revs.map((r) => [r.rev, r.title, <RevPill key="s" status={r.status} />, r.openingMm ? r.openingMm + " mm" : "", r.issuedBy + ", " + fmtStamp(r.issuedAt), r.approvedBy ? r.approvedBy + ", " + fmtStamp(r.approvedAt ?? 0) : ""])}
              />
              <div className="fj-card-b">
                {revs.map((r) => (
                  <div key={r.id} style={{ marginBottom: 10 }}>
                    <strong>{r.rev}</strong>
                    <ul className="fj-list">{r.trail.map((t, i) => <li key={i}><span>{t.text}<div className="fj-faint">{t.actor}</div></span><span className="fj-faint">{fmtStamp(t.at)}</span></li>)}</ul>
                  </div>
                ))}
              </div>
            </Card>

            <div className="fj-two">
              <Card title={(pack ? pack.id : "Pack") + " gate checklist"}>
                {gates.map((g) => (
                  <div className="fj-gate" key={g.key}><Pill tone={g.ok ? "ok" : "bad"}>{g.ok ? "OK" : "Not OK"}</Pill><div><div>{g.label}</div><div className="fj-faint">{g.detail}</div></div></div>
                ))}
                {!pack && <div className="fj-dim">No work pack for this drawing package.</div>}
                <div style={{ marginTop: 10 }}><div className="fj-faint">Status now</div><b>{pack && pack.status !== "held" ? "Pack released into the ready queue" : sm.state}</b></div>
                {hasBothGates && (
                  <ul className="fj-states" style={{ marginTop: 10 }}>
                    {legend.map((t, i) => <li key={i} className={i === state ? "on" : ""}>{t}</li>)}
                  </ul>
                )}
                {dep && dep.status !== "received" && (
                  <div style={{ marginTop: 12 }}>
                    <ActBtn action="confirmPayment" onClick={() => actions.confirmPayment(dep.id, actorNow())}>{"Confirm " + eur(dep.amount) + " mock receipt"}</ActBtn>
                    <Hint action="confirmPayment" role={role} extra="Switch to Joyce to confirm the receipt." />
                  </div>
                )}
                {dep && dep.status === "received" && <div className="fj-dim" style={{ marginTop: 10 }}>{eur(dep.amount)} deposit recorded {dep.ref ?? ""}{dep.receivedBy ? " by " + dep.receivedBy : ""}.</div>}
              </Card>

              <Card title="Pack release and history">
                {pack && pack.status !== "held" ? (
                  <>
                    <p style={{ marginTop: 0 }}><b>Pack released:</b> {cur.rev}, cut list ({pack.cutList.length}), dimensions ({pack.dimensions.length}), material picks ({pack.materialPicks.length}), QA checklist ({pack.qa.length}), named lead {personName(s, pack.leadId)}, next available slot.</p>
                    <dl className="fj-kv">
                      <dt>Slot</dt><dd>{pack.slotDay ? "Booked " + fmtDate(pack.slotDay) : slot ? "Next free " + fmtDate(slot.day) + ", " + slot.crew.map((c) => personName(s, c)).join(" and ") + ", " + slot.each + "h each" : "No free slot this week"}</dd>
                      <dt>Station</dt><dd>{pack.station}</dd>
                      <dt>Work order</dt><dd>{wos.length ? wos.map((w) => w.id + " (v" + w.version + ")").join(", ") : "None yet"}</dd>
                    </dl>
                    <div className="fj-two" style={{ marginTop: 10 }}>
                      <div><div className="fj-faint">Cut list</div><ul className="fj-states">{pack.cutList.map((c) => <li key={c}>{c}</li>)}</ul></div>
                      <div><div className="fj-faint">Dimensions</div><ul className="fj-states">{pack.dimensions.map((c) => <li key={c}>{c}</li>)}</ul></div>
                    </div>
                  </>
                ) : (
                  <div className="fj-dim">Held. Nothing is released to the workshop until every gate is clear. A work order is created once, on release.{wos.length === 0 ? " No work order yet." : ""}</div>
                )}
                {pack && (
                  <ul className="fj-list" style={{ marginTop: 10 }}>
                    {pack.history.map((h, i) => (
                      <li key={i}><span>{h.text}<div className="fj-faint">{fmtStamp(h.at)}</div></span><Pill tone={h.status === "withdrawn" ? "bad" : h.status === "superseded" ? "warn" : "ok"}>{"v" + h.version + " " + h.status}</Pill></li>
                    ))}
                    <li><span>Current: v{pack.version} on {cur.rev}</span><Pill tone={pack.status === "held" ? "bad" : "ok"}>{pack.status}</Pill></li>
                  </ul>
                )}
              </Card>
            </div>

            <Card title="Issue a new revision">
              {cur.status === "changes" ? (
                <div className="fj-stack">
                  <div className="fj-dim">Client comment: {cur.comment}</div>
                  <label className="fj-field"><span>New service opening (mm)</span><input type="number" value={mmVal} onChange={(e) => setMm(e.target.value)} /></label>
                  <label className="fj-field"><span>Note for the client</span><textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
                  <div className="fj-row">
                    <ActBtn action="issueRevision" disabled={!note.trim() || !Number(mmVal)} why="Add a note and an opening width" onClick={() => {
                      const n = Number(mmVal);
                      const r = actions.issueRevision(code, pkg as string, { title: "Counter, service opening " + n + " mm", note: note.trim(), openingMm: n }, actorNow());
                      if (r.ok) { setNote(""); setMm(""); }
                    }}>Issue new revision</ActBtn>
                    <Hint action="issueRevision" role={role} />
                  </div>
                </div>
              ) : (
                <div className="fj-dim">Available when the client requests changes on the current revision. {cur.rev} is {REV_LABEL[cur.status].toLowerCase()}.</div>
              )}
            </Card>
          </>
        )}
      </div>
    </Page>
  );
}

/* ───────────────────────── Installation & snags ───────────────────────── */
function SnagsTab({ job }: { job?: string }) {
  const s = useForja();
  const code = job ?? "FW-267";
  const j = jobOf(s, code);
  const role = s.ui.role;
  const overview = s.jobs.map((x) => {
    const sn = s.snags.filter((n) => n.jobId === x.code);
    const fin = s.milestones.find((m) => m.jobId === x.code && m.kind === "final");
    return [
      <JobLink key="j" code={x.code} tab="snags" />, x.name, installDateOf(s, x) ? fmtDate(installDateOf(s, x) as string) : "No install date",
      installCrew(s, x.code).join(", "),
      s.tasks.filter((t) => t.jobId === x.code && !taskDone(s, t) && /install|snag/i.test(t.title + t.dept)).length + " open",
      sn.length ? sn.filter((n) => n.status === "open").length + " open, " + sn.filter((n) => n.status === "resolved").length + " resolved, " + sn.filter((n) => n.status === "confirmed").length + " confirmed" : "None",
      fin ? <Pill key="f" tone={fin.status === "received" ? "ok" : fin.status === "due" ? "warn" : "neutral"}>{eur(fin.amount) + " " + (fin.status === "locked" ? "after sign-off" : fin.status)}</Pill> : "",
    ];
  });
  if (!j) return <Page title="Installation and snags"><Card><Empty text="Job not found" /></Card></Page>;
  const snags = s.snags.filter((n) => n.jobId === code);
  const open = snags.filter((n) => n.status === "open").length;
  const resolved = snags.filter((n) => n.status === "resolved").length;
  const confirmed = snags.filter((n) => n.status === "confirmed").length;
  const fin = s.milestones.find((m) => m.jobId === code && m.kind === "final");
  const ms = s.milestones.filter((m) => m.jobId === code);
  const got = ms.filter((m) => m.status === "received").reduce((n, m) => n + m.amount, 0);
  const total = ms.reduce((n, m) => n + m.amount, 0);
  const tasks = s.tasks.filter((t) => t.jobId === code);
  const inst = installDateOf(s, j);
  const waiting = snags.length > 0 && open === 0 && resolved > 0;
  return (
    <Page title="Installation and snags" sub="Install dates, crews and snag sign-off. The final payment waits for the client." actions={<JobSelect s={s} value={code} tab="snags" />}>
      <div className="fj-stack">
        <Card title="All installs" flush>
          <Table cols={[{ label: "Job" }, { label: "Name" }, { label: "Install date" }, { label: "Crew" }, { label: "Install tasks" }, { label: "Snags" }, { label: "Final payment" }]} rows={overview} onRow={(i) => navigate({ page: "Jobs", tab: "snags", job: s.jobs[i].code })} />
        </Card>

        <div className="fj-banner">
          <div><div className="fj-faint">{code} {j.name}</div>
            <b>{snags.length === 0 ? "No snags recorded" : open > 0 ? open + " snag" + (open > 1 ? "s" : "") + " open" : waiting ? "Waiting for client sign-off" : confirmed === snags.length ? "Client signed off every snag" : "Snags in progress"}</b>
            <div className="fj-dim">Install {inst ? fmtDate(inst) : "date not set"}, crew {installCrew(s, code).join(", ") || "not assigned"}.</div></div>
          <div className="fj-row"><Btn kind="primary" onClick={() => openStandalone("portal", code, "snags")}>Preview client view</Btn><Btn onClick={() => openPreview(code, "snags")}>Open here</Btn></div>
        </div>

        <div className="fj-two">
          <Card title="Snag list">
            {snags.length === 0 ? <Empty text="No snags on this job." /> : (
              <ul className="fj-list">
                {snags.map((n) => (
                  <li key={n.id}>
                    <span>{n.title}<div className="fj-faint">{n.status === "resolved" && n.resolvedAt ? "Closed by " + n.resolvedBy + ", " + fmtStamp(n.resolvedAt) : n.status === "confirmed" && n.confirmedAt ? "Client confirmed " + fmtStamp(n.confirmedAt) : "Open"}</div></span>
                    <span className="fj-row"><SnagPill status={n.status} />{n.status === "open" && <ActBtn small action="closeSnag" onClick={() => actions.closeSnag(n.id, actorNow())}>Close snag</ActBtn>}</span>
                  </li>
                ))}
              </ul>
            )}
            {snags.some((n) => n.status === "open") && <Hint action="closeSnag" role={role} />}
            {waiting && <div className="fj-banner fj-clientowns" style={{ marginTop: 10 }}><b>Waiting for client sign-off.</b><span className="fj-dim">The client confirms in their view.</span></div>}
          </Card>

          <Card title="Payment status">
            <Bar value={got} max={total} tone="ok" />
            <p><b>{eur(got)}</b> of {eur(total)} received.</p>
            {fin && (
              <div className="fj-gate"><Pill tone={fin.status === "received" ? "ok" : fin.status === "due" ? "warn" : "neutral"}>{fin.status === "received" ? "Received" : fin.status === "due" ? "Due now" : "Not yet due"}</Pill>
                <div><div>Final {eur(fin.amount)}</div><div className="fj-faint">{fin.status === "locked" ? "Due only after client sign-off" : fin.dueNote}</div></div></div>
            )}
            {fin && fin.status === "due" && (
              <div style={{ marginTop: 8 }}>
                <ActBtn action="confirmPayment" onClick={() => actions.confirmPayment(fin.id, actorNow())}>{"Confirm " + eur(fin.amount) + " mock receipt"}</ActBtn>
                <Hint action="confirmPayment" role={role} />
              </div>
            )}
            <div style={{ marginTop: 10 }}><Go to={{ page: "Job Costing", tab: "payments", job: code }}>Open payments</Go></div>
          </Card>
        </div>

        <Card title="Install tasks">
          {tasks.length === 0 ? <div className="fj-dim">No tasks for this job.</div> : (
            <ul className="fj-list">{tasks.map((t) => { const d = taskDone(s, t); return <li key={t.id}><span><Go to={t.link}>{t.title}</Go><div className="fj-faint">{personName(s, t.ownerId)}, due {t.dueTime}</div></span><Pill tone={d ? "ok" : "warn"}>{d ? "Done" : "Open"}</Pill></li>; })}</ul>
          )}
        </Card>
      </div>
    </Page>
  );
}

export type { FState, Job };
void TODAY;
