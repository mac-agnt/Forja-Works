import { useEffect, useState } from "react";
import { actions, actorNow, useForja } from "../store";
import { TODAY, exceptions, jobOf, packOf, personName, receivedQty, shortQty, supplierName, totalShort } from "../derive";
import { eur } from "../format";
import { fmtDate, fmtStamp } from "../dates";
import type { FState, PO, Requirement } from "../types";
import { ActBtn, Bar, Card, Empty, Go, Grid, JobLink, Page, Pill, Stat, roleHint } from "../ui";

const PIZZA = "rq-262-ply";

function JobFilter({ value, onChange, s }: { value: string; onChange: (v: string) => void; s: FState }) {
  const ids = [...new Set(s.requirements.map((r) => r.jobId))].sort();
  return (
    <label className="fj-role">
      <span>Job</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Filter by job">
        <option value="all">All jobs</option>
        {ids.map((id) => <option key={id} value={id}>{id} {jobOf(s, id)?.name}</option>)}
      </select>
    </label>
  );
}
function useFilter(job?: string): [string, (v: string) => void] {
  const [f, setF] = useState(job ?? "all");
  useEffect(() => { setF(job ?? "all"); }, [job]);
  return [f, setF];
}

function poOf(s: FState, r: Requirement): PO | undefined { return s.pos.find((x) => x.id === r.poId); }

/* ── Requirements ────────────────────────────────────────── */
function Requirements({ job }: { job?: string }) {
  const s = useForja();
  const [f, setF] = useFilter(job);
  const rows = s.requirements.filter((r) => f === "all" || r.jobId === f);
  const short = rows.reduce((n, r) => n + shortQty(s, r.id), 0);
  return (
    <div className="fj-stack">
      <Grid cols={3}>
        <Stat label="Requirement lines" value={rows.length} sub={f === "all" ? "across all jobs" : f} />
        <Stat label="Units short" value={short} sub={short ? "open shortages below" : "nothing short"} tone={short ? "bad" : "ok"} />
        <Stat label="Next need-by" value={rows.length ? fmtDate([...rows].sort((a, b) => a.needBy.localeCompare(b.needBy))[0].needBy) : "None"} sub="earliest line shown" />
      </Grid>
      <Card title="Material requirements by job" right={<JobFilter value={f} onChange={setF} s={s} />} flush>
        {rows.length === 0 ? <Empty text="No requirements for this job." /> : (
          <div className="fj-table-wrap">
            <table className="fj-table">
              <thead><tr><th>Job</th><th>Item</th><th>Supplier</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>Received</th><th style={{ textAlign: "right" }}>Short</th><th>Lead time</th><th>Need by</th><th>Linked pack</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const sh = shortQty(s, r.id);
                  const pk = r.packId ? packOf(s, r.packId) : undefined;
                  return (
                    <tr key={r.id} className={sh > 0 ? "fj-hl" : ""}>
                      <td><JobLink code={r.jobId} /></td>
                      <td><strong>{r.item}</strong><div className="fj-faint">{r.poId}, {eur(r.unitCost)} per {r.unit}</div></td>
                      <td>{supplierName(s, r.supplierId)}</td>
                      <td className="fj-num" style={{ textAlign: "right" }}>{r.qty} {r.unit}{r.qty === 1 ? "" : "s"}</td>
                      <td className="fj-num" style={{ textAlign: "right" }}>{receivedQty(s, r.id)}</td>
                      <td style={{ textAlign: "right" }}>{sh > 0 ? <Pill tone="bad">{sh} short</Pill> : <Pill tone="ok">Complete</Pill>}</td>
                      <td>{r.leadDays} days</td>
                      <td>{fmtDate(r.needBy)}</td>
                      <td>{pk ? <Go to={{ page: "Workshop", tab: "packs", job: r.jobId }}>{pk.label}</Go> : <span className="fj-faint">None</span>}{pk && <div className="fj-faint">{pk.status === "held" ? "Held" : pk.status === "ready" ? "Ready" : pk.status}</div>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── Orders ──────────────────────────────────────────────── */
function Orders({ job }: { job?: string }) {
  const s = useForja();
  const [f, setF] = useFilter(job);
  const pos = s.pos.filter((p) => f === "all" || p.jobId === f);
  return (
    <div className="fj-stack">
      <Card title="Purchase orders" right={<JobFilter value={f} onChange={setF} s={s} />} flush>
        {pos.length === 0 ? <Empty text="No purchase orders for this job." /> : (
          <div className="fj-table-wrap">
            <table className="fj-table">
              <thead><tr><th>PO</th><th>Job</th><th>Supplier</th><th>Buyer</th><th>Ordered</th><th>Lines</th><th style={{ textAlign: "right" }}>Ordered</th><th style={{ textAlign: "right" }}>Received</th><th style={{ textAlign: "right" }}>Short</th><th style={{ textAlign: "right" }}>Value</th><th>Status</th></tr></thead>
              <tbody>
                {pos.map((p) => {
                  const lines = s.requirements.filter((r) => r.poId === p.id);
                  const ord = lines.reduce((n, r) => n + r.qty, 0);
                  const rec = lines.reduce((n, r) => n + receivedQty(s, r.id), 0);
                  const sh = lines.reduce((n, r) => n + shortQty(s, r.id), 0);
                  const value = lines.reduce((n, r) => n + r.qty * r.unitCost, 0);
                  const tone = sh === 0 ? "ok" : rec > 0 ? "warn" : "bad";
                  return (
                    <tr key={p.id} className={sh > 0 ? "fj-hl" : ""}>
                      <td><strong className="fj-mono">{p.id}</strong><div className="fj-faint">{p.note}</div></td>
                      <td><JobLink code={p.jobId} /></td>
                      <td>{supplierName(s, p.supplierId)}</td>
                      <td>{personName(s, p.buyerId)}</td>
                      <td>{fmtDate(p.orderedOn)}</td>
                      <td>{lines.map((r) => <div key={r.id}>{r.item}: {r.qty} {r.unit}{r.qty === 1 ? "" : "s"} at {eur(r.unitCost)} = {eur(r.qty * r.unitCost)}</div>)}</td>
                      <td className="fj-num" style={{ textAlign: "right" }}>{ord}</td>
                      <td className="fj-num" style={{ textAlign: "right" }}>{rec}</td>
                      <td className="fj-num" style={{ textAlign: "right" }}>{sh}</td>
                      <td className="fj-num" style={{ textAlign: "right" }}>{eur(value)}</td>
                      <td><Pill tone={tone}>{sh === 0 ? "Fully received" : rec > 0 ? "Part received" : "Awaiting delivery"}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── Deliveries ──────────────────────────────────────────── */
function ReceivePanel() {
  const s = useForja();
  const r = s.requirements.find((x) => x.id === PIZZA);
  const [custom, setCustom] = useState("1");
  if (!r) return null;
  const rec = receivedQty(s, r.id), sh = shortQty(s, r.id);
  const cq = Number(custom);
  const customBad = !Number.isInteger(cq) || cq <= 0;
  const why = (q: number) => (sh === 0 ? "Fully received. Nothing outstanding." : q > sh ? "Over-receipt: only " + sh + " outstanding" : "");
  const doReceive = (q: number) => { actions.receive(r.id, q, actorNow(s)); };
  return (
    <Card title={"Receive delivery: " + r.item + " on " + r.poId} right={<JobLink code={r.jobId} />}>
      <div className="wk-recv">
        <div>
          <div className="wk-load"><span className={sh ? "wk-bad" : "wk-okc"}>{rec} of {r.qty} received</span>{sh > 0 ? <Pill tone="bad">{sh} short</Pill> : <Pill tone="ok">Order complete</Pill>}</div>
          <Bar value={rec} max={r.qty} tone={sh ? "warn" : "ok"} />
          <p className="fj-dim wk-note">Rehearsal sequence: 12 of 18, receive 4 to reach 16 (2 short), receive 2 to reach 18. Or reset and receive 6 in one go. Over-receipt is rejected.</p>
        </div>
        <div>
          <div className="fj-row">
            {[4, 2, 6].map((q) => (
              <ActBtn key={q} action="receive" kind={q === 6 ? "secondary" : "primary"} disabled={!!why(q)} why={why(q)} onClick={() => doReceive(q)}>Receive {q}</ActBtn>
            ))}
          </div>
          <div className="fj-row" style={{ marginTop: 10 }}>
            <label className="fj-field"><span>Custom quantity</span>
              <input type="number" min={1} step={1} value={custom} onChange={(e) => setCustom(e.target.value)} style={{ width: 110 }} />
            </label>
            <ActBtn action="receive" kind="secondary" disabled={customBad || !!why(cq)} why={customBad ? "Enter a whole number above zero" : why(cq)} onClick={() => doReceive(cq)}>Receive {customBad ? "custom" : cq}</ActBtn>
          </div>
          <div className="fj-faint" style={{ marginTop: 8 }}>
            {sh === 0 ? "Fully received: the buttons are off because nothing is outstanding." : "Buttons for more than " + sh + " are off because that would be an over-receipt."}{" "}
            {roleHint("receive", s.ui.role) ?? "Receiving as " + actorNow(s).name + ". This books a mock goods-received note, no email is sent."}
          </div>
          <div style={{ marginTop: 12 }}>
            <ActBtn action="receive" kind="ghost" small onClick={() => { actions.resetPizzaReceipts(actorNow(s)); }}>Reset pizza delivery (for rehearsals)</ActBtn>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Deliveries({ job }: { job?: string }) {
  const s = useForja();
  const list = [...s.receipts].filter((x) => !job || s.requirements.find((r) => r.id === x.reqId)?.jobId === job).sort((a, b) => b.at - a.at);
  return (
    <div className="fj-stack">
      <ReceivePanel />
      <Card title="Delivery receipts, newest first" flush>
        {list.length === 0 ? <Empty text="No receipts yet." /> : (
          <div className="fj-table-wrap">
            <table className="fj-table">
              <thead><tr><th>Reference</th><th>PO</th><th>Job</th><th>Item</th><th style={{ textAlign: "right" }}>Qty</th><th>Received by</th><th>When</th></tr></thead>
              <tbody>
                {list.map((x) => {
                  const r = s.requirements.find((q) => q.id === x.reqId);
                  return (
                    <tr key={x.id}>
                      <td className="fj-mono">{x.ref}</td>
                      <td className="fj-mono">{x.poId}</td>
                      <td>{r ? <JobLink code={r.jobId} /> : ""}</td>
                      <td>{r?.item}</td>
                      <td className="fj-num" style={{ textAlign: "right" }}>{x.qty} {r?.unit}{x.qty === 1 ? "" : "s"}</td>
                      <td>{x.by}</td>
                      <td>{fmtStamp(x.at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── Shortages ───────────────────────────────────────────── */
function Shortages({ job }: { job?: string }) {
  const s = useForja();
  const exc = exceptions(s);
  const open = s.requirements.filter((r) => shortQty(s, r.id) > 0);
  const pizza = s.requirements.find((r) => r.id === PIZZA);
  const cleared = !!pizza && shortQty(s, PIZZA) === 0;
  const pack = packOf(s, "PK-262-1");
  return (
    <div className="fj-stack">
      <Grid cols={3}>
        <Stat label="Units short" value={totalShort(s)} sub="across open purchase orders" tone={totalShort(s) ? "bad" : "ok"} />
        <Stat label="Open shortage lines" value={open.length} sub={open.length ? "named buyer on each" : "all cleared"} tone={open.length ? "warn" : "ok"} />
        <Stat label="Pizza birch ply" value={receivedQty(s, PIZZA) + "/" + (pizza?.qty ?? 18)} sub="PO-262-01 sheets received" tone={cleared ? "ok" : "warn"} />
      </Grid>
      {cleared && pack && (
        <Card title="Shortage cleared" right={<Pill tone="ok">Cleared</Pill>} className="wk-clear">
          <div role="status" className="wk-success">
            <div><strong>All 18 birch-ply sheets are in.</strong> The hold on banquette cutting is cleared.</div>
            <ul className="fj-list">
              <li><span>Banquette cutting pack ({pack.id}, v{pack.version})</span><Pill tone={pack.status === "held" ? "bad" : "ok"}>{pack.status === "held" ? "Still held on another gate" : pack.status === "ready" ? "Released to the ready queue" : "Scheduled " + (pack.slotDay ? fmtDate(pack.slotDay) : "")}</Pill></li>
              <li><span>Capacity</span><span>{pack.status === "ready" ? "Not assigned yet. The next decision belongs to Niamh, the production manager." : pack.status === "scheduled" ? "Assigned by the production manager." : "Not released."}</span></li>
            </ul>
            <div className="fj-row"><Go to={{ page: "Workshop", tab: "packs", job: "FW-262" }} kind="btn">Open Workshop packs</Go></div>
          </div>
        </Card>
      )}
      {open.length === 0 && !cleared && <Card><Empty text="No open shortages." /></Card>}
      {open.map((r) => {
        const sh = shortQty(s, r.id);
        const po = poOf(s, r);
        const pk = r.packId ? packOf(s, r.packId) : undefined;
        const x = exc.find((e) => e.id === "x-sh-" + r.id);
        const finishing = s.packs.find((p) => p.jobId === r.jobId && p.id !== r.packId && p.status === "scheduled");
        return (
          <Card key={r.id} className={r.jobId === job ? "fj-hl" : ""} title={<span className="fj-row"><Pill tone="bad">{sh} short</Pill> {r.item} for <JobLink code={r.jobId} /></span>} right={<span className="fj-faint">{r.poId}</span>}>
            <div className="wk-short">
              <dl className="wk-dl">
                <dt>Short</dt><dd><strong>{sh} {r.unit}{sh === 1 ? "" : "s"}</strong> ({receivedQty(s, r.id)} of {r.qty} received)</dd>
                <dt>Buyer</dt><dd>{po ? personName(s, po.buyerId) : "Unassigned"}, {supplierName(s, r.supplierId)}</dd>
                <dt>Need by</dt><dd>{fmtDate(r.needBy)} (supplier lead time {r.leadDays} days)</dd>
                <dt>Affected task</dt><dd>{pk ? <>{pk.label} <Pill tone={pk.status === "held" ? "bad" : "ok"}>{pk.status === "held" ? "Held" : pk.status}</Pill> <Go to={{ page: "Workshop", tab: "packs", job: r.jobId }}>Open work pack</Go></> : "None linked"}</dd>
                <dt>Not affected</dt><dd>{finishing ? <>{s.assignments.filter((a) => a.packId === finishing.id && a.day === TODAY).reduce((n, a) => n + a.hours, 0)}h of {finishing.label.toLowerCase()} on different materials continues. <Go to={{ page: "Workshop", tab: "today", job: r.jobId }}>See the bench</Go></> : "Other work on this job continues."}</dd>
                <dt>Exception</dt><dd>{x ? <>Open, routed to {x.route}: {x.title}. <Go to={{ page: "Work", tab: "exceptions", job: r.jobId }}>Open exception</Go></> : "None open"}</dd>
              </dl>
              <div className="wk-short-a">
                <Go to={{ page: "Purchasing", tab: "deliveries", job: r.jobId }} kind="btn">Receive the delivery</Go>
                <div className="fj-faint">Joyce or the production manager records the receipt. Over-receipt is blocked.</div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export default function Purchasing({ tab, job }: { tab: string; job?: string }) {
  const s = useForja();
  const short = totalShort(s);
  return (
    <Page title="Purchasing" sub={short ? short + " units short across open purchase orders." : "Every ordered quantity has been received."}>
      {tab === "orders" ? <Orders job={job} /> : tab === "deliveries" ? <Deliveries job={job} /> : tab === "shortages" ? <Shortages job={job} /> : <Requirements job={job} />}
    </Page>
  );
}
