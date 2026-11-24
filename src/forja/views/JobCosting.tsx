import { useState, type ReactNode } from "react";
import { Page, Card, Pill, Btn, ActBtn, JobLink, Go, Table, Empty, Stat, Grid, Field, roleHint, type Tone } from "../ui";
import { actions, actorNow, can, parseLabour, useForja } from "../store";
import { CATS, type Cat, type CostEntry, type FState, type Milestone } from "../types";
import { crew, currentRev, eur, fmtDate, hrs, jobCosts, jobOf, packGates, pct, personName, receivedQty, supplierName, TODAY } from "../derive";
import { navigate } from "../nav";
import { CAT_LABEL, newKey, QUOTE_CAT_TO_COST, lineCost, quoteStats } from "./estimates.helpers";

const SUBS: Record<string, string> = {
  forecast: "Quote against actuals to date, what is still expected, and where each job will land.",
  ledger: "Every cost entry on a job, what is still expected, and how the two add up.",
  payments: "What the client owes and what has been received, with variations kept on their own lines.",
  capture: "Book labour by typing it, and post a supplier invoice without double counting.",
};

export default function JobCosting({ tab, job }: { tab: string; job?: string }) {
  const s = useForja();
  const jobId = job && jobOf(s, job) ? job : "FW-261";
  return (
    <Page title="Job costing" sub={SUBS[tab] ?? SUBS.forecast}>
      {tab === "ledger" ? <Ledger s={s} jobId={jobId} />
        : tab === "payments" ? <Payments s={s} jobId={jobId} />
        : tab === "capture" ? <Capture s={s} />
        : <Forecast s={s} jobId={jobId} />}
    </Page>
  );
}

/* ── shared ──────────────────────────────────────────────── */
const signed = (n: number) => eur(n, true);
const pts = (n: number) => (n > 0 ? "+" : n < 0 ? "-" : "") + Math.abs(n).toFixed(1) + " pts";
const right = { textAlign: "right" as const };
const num = (n: ReactNode) => <span className="fj-num">{n}</span>;

function JobPicker({ s, jobId, tab }: { s: FState; jobId: string; tab: string }) {
  return (
    <Field label="Job">
      <select value={jobId} onChange={(e) => navigate({ page: "Job Costing", tab, job: e.target.value })}>
        {s.jobs.map((j) => <option key={j.code} value={j.code}>{j.code} {j.name}</option>)}
      </select>
    </Field>
  );
}
function JobHead({ s, jobId, tab }: { s: FState; jobId: string; tab: string }) {
  const job = jobOf(s, jobId)!;
  return (
    <Card>
      <div className="fj-between">
        <JobPicker s={s} jobId={jobId} tab={tab} />
        <div className="fj-dim" style={{ fontSize: 13 }}>
          <JobLink code={jobId} /> {job.name}. Owner {personName(s, job.ownerId)}. Contract {eur(job.contractValue)}.
        </div>
      </div>
    </Card>
  );
}

/* ── forecast ────────────────────────────────────────────── */
function Forecast({ s, jobId }: { s: FState; jobId: string }) {
  const job = jobOf(s, jobId)!;
  const c = jobCosts(s, jobId);
  const [open, setOpen] = useState<Cat | null>(null);
  const quote = s.quotes.find((q) => q.jobId === jobId);
  const base = quote?.versions[0];
  const latest = quote?.versions[quote.versions.length - 1];
  const reviewed = !!s.tasks.find((t) => t.id === "T-C1")?.manualDone;
  const isBurger = jobId === "FW-261";
  const accepted = s.variations.filter((v) => v.jobId === jobId && v.status === "accepted");
  const pending = s.variations.filter((v) => v.jobId === jobId && v.status === "pending");
  const heldPacks = s.packs.filter((p) => p.jobId === jobId && p.status === "held" && !p.variationId);

  /* what changed between the first and latest quote version */
  let explain: ReactNode = null;
  if (base && latest && quote && quote.versions.length > 1) {
    const dCost = quoteStats(latest).cost - quoteStats(base).cost;
    const wa = base.lines.find((l) => l.cat === "Workshop hours"), wb = latest.lines.find((l) => l.cat === "Workshop hours");
    if (dCost !== 0 && wa && wb) {
      explain = (
        <div className="fj-callout fj-warn">
          <strong>Why the forecast moved.</strong> The {eur(Math.abs(dCost))} {dCost > 0 ? "increase" : "reduction"} is {hrs(Math.abs(wb.qty - wa.qty))} {wb.qty >= wa.qty ? "extra" : "fewer"} expected workshop hours at {eur(wb.rate)}.
          {" "}Quote {quote.id} {base.name} costs {eur(quoteStats(base).cost)}; {latest.name} costs {eur(quoteStats(latest).cost)}.{" "}
          <Go to={{ page: "Estimates", tab: "quotes", job: jobId }}>Open the extra allowance in the quote compare</Go>
        </div>
      );
    }
  }

  return (
    <div className="fj-stack">
      <JobHead s={s} jobId={jobId} tab="forecast" />
      <Grid cols={4}>
        <Stat label="Revenue" value={eur(c.revenue)} sub={c.varRevenue ? eur(c.baseRevenue) + " base " + signed(c.varRevenue) + " variations" : "Base agreement"} />
        <Stat label="Quote" value={eur(c.quoteCost)} sub={"cost. Profit " + eur(c.quoteProfit) + " at " + pct(c.quoteMargin)} />
        <Stat label="Forecast at completion" value={eur(c.forecast)} sub={"cost. Profit " + eur(c.forecastProfit) + " at " + pct(c.forecastMargin)} tone={c.slip >= 1 ? "warn" : "ok"} />
        <Stat label="Margin slip" value={pts(-c.slip)} sub={c.slip >= 1 ? "against the quote" : "on quote"} tone={c.slip >= 1 ? "bad" : "ok"} />
      </Grid>
      {explain}
      <Card title="Quote against actuals and forecast" flush>
        <div className="fj-table-wrap">
          <table className="fj-table">
            <thead><tr><th>Category</th><th style={right}>Quote</th><th style={right}>Actual to date</th><th style={right}>Remaining</th><th style={right}>Forecast</th><th style={right}>Against quote</th></tr></thead>
            <tbody>
              {CATS.map((k) => {
                const fc = c.actualBy[k] + c.remainingBy[k];
                const q = job.quoteCost[k];
                const entries = s.costEntries.filter((e) => e.jobId === jobId && e.cat === k);
                const lines = (base?.lines ?? []).filter((l) => QUOTE_CAT_TO_COST[l.cat] === k);
                const isOpen = open === k;
                return [
                  <tr key={k}>
                    <td><button className="fj-rowbtn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : k)}>{isOpen ? "Hide" : "Show"} {CAT_LABEL[k].toLowerCase()}</button></td>
                    <td style={right} className="fj-num">{eur(q)}</td>
                    <td style={right} className="fj-num">{eur(c.actualBy[k])}</td>
                    <td style={right} className="fj-num">{eur(c.remainingBy[k])}</td>
                    <td style={right} className="fj-num">{eur(fc)}</td>
                    <td style={right}><span className={"fj-num " + (fc > q ? "fj-neg" : fc < q ? "fj-pos" : "")}>{fc === q ? eur(0) : signed(fc - q)}</span></td>
                  </tr>,
                  isOpen && (
                    <tr key={k + "-d"}>
                      <td colSpan={6}>
                        <div className="fj-cmp">
                          <div>
                            <div className="fj-faint">Quote breakdown</div>
                            {lines.length ? <ul className="fj-list">{lines.map((l) => <li key={l.id}><span>{l.label}</span>{num(eur(lineCost(l)))}</li>)}</ul> : <div className="fj-note">No quote lines recorded for this category.</div>}
                          </div>
                          <div>
                            <div className="fj-faint">Actuals booked</div>
                            {entries.length ? <ul className="fj-list">{entries.map((e) => <li key={e.id}><span>{e.desc}{e.hours ? ", " + hrs(e.hours) : ""}</span>{num(eur(e.amount))}</li>)}</ul> : <div className="fj-note">Nothing booked yet.</div>}
                            <div className="fj-note" style={{ marginTop: 6 }}>Still expected: {eur(c.remainingBy[k])}.</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
              <tr className="fj-tfoot">
                <td>Base work</td><td style={right} className="fj-num">{eur(c.quoteCost)}</td><td style={right} className="fj-num">{eur(c.actual)}</td><td style={right} className="fj-num">{eur(c.remaining)}</td><td style={right} className="fj-num">{eur(c.actual + c.remaining)}</td>
                <td style={right}><span className={"fj-num " + (c.actual + c.remaining > c.quoteCost ? "fj-neg" : "")}>{signed(c.actual + c.remaining - c.quoteCost)}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="fj-cmp">
        <Card title="Accepted variations, separate from base">
          {accepted.length ? (
            <div className="fj-stack" style={{ gap: 8 }}>
              <Table cols={[{ label: "Variation" }, { label: "Revenue", align: "right" }, { label: "Expected cost", align: "right" }]}
                rows={accepted.map((v) => [v.id + " " + v.title, signed(v.revenue), signed(v.cost)])} />
              <div className="fj-note">Base {eur(c.baseRevenue)} plus variations {signed(c.varRevenue)} gives revenue {eur(c.revenue)}. Variation cost {signed(c.varCost)} is counted once in the forecast.</div>
            </div>
          ) : (
            <div className="fj-stack" style={{ gap: 8 }}>
              <div className="fj-note">No accepted variations. The forecast above is the base agreement only.</div>
              {pending.map((v) => <div key={v.id} className="fj-callout fj-warn">{v.id} {v.title} is pending ({signed(v.revenue)} revenue, {signed(v.cost)} expected cost). Preview only, not in these totals.</div>)}
            </div>
          )}
        </Card>
        <Card title="Next steps">
          <div className="fj-stack" style={{ gap: 10 }}>
            {isBurger && (
              <div className="fj-row">
                {reviewed ? <Pill tone="ok">Estimate reviewed</Pill> : (
                  <ActBtn action="task" disabled={s.ui.role !== "owner"} why="Switch to Caio: the estimate review is the owner's decision" onClick={() => actions.markBurgerReviewed(actorNow())}>Review estimate</ActBtn>
                )}
                {!reviewed && s.ui.role !== "owner" && <span className="fj-faint">Switch to Caio to review the estimate.</span>}
              </div>
            )}
            <div className="fj-row">
              <Btn kind="secondary" onClick={() => navigate({ page: "Estimates", tab: "variations", job: jobId })}>Start priced variation</Btn>
              <span className="fj-faint">Absorb the slip or price it on its own line.</span>
            </div>
            {heldPacks.map((p) => {
              const rev = currentRev(s, p.id)?.rev ?? "";
              const open = packGates(s, p).filter((g) => !g.ok);
              const hasLabour = s.costEntries.some((e) => e.jobId === jobId && e.source !== "seed" && e.cat === "workshop");
              return (
                <div key={p.id} className="fj-callout">
                  {hasLabour ? "Labour booked against " : "No cut work recorded on the unreleased "}{rev} pack ({p.id}). {open.length ? "Held: " + open.map((g) => g.detail.toLowerCase()).join("; ") + "." : ""}{" "}
                  <Go to={{ page: "Jobs", tab: "drawings", job: jobId }}>Open drawings</Go>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title="Forecast margin, all jobs" flush>
        <Table
          onRow={(i) => navigate({ page: "Job Costing", tab: "forecast", job: s.jobs[i].code })}
          cols={[{ label: "Job" }, { label: "Revenue", align: "right" }, { label: "Forecast cost", align: "right" }, { label: "Forecast profit", align: "right" }, { label: "Quoted", align: "right" }, { label: "Forecast", align: "right" }, { label: "Slip", align: "right" }]}
          rows={s.jobs.map((j) => {
            const x = jobCosts(s, j.code);
            return [
              <span key="j" className={j.code === jobId ? "fj-pos" : undefined}><strong>{j.code}</strong> {j.name}</span>,
              eur(x.revenue), eur(x.forecast), eur(x.forecastProfit), pct(x.quoteMargin),
              <strong key="f">{pct(x.forecastMargin)}</strong>,
              <span key="s" className={x.slip >= 1 ? "fj-neg" : undefined}>{x.slip >= 0.05 ? pts(-x.slip) : "on quote"}</span>,
            ];
          })}
        />
        <div className="fj-faint" style={{ padding: "8px 18px 12px" }}>FW-263 is a design-fee job so far, so its figures are small. Select a row to open that job.</div>
      </Card>
    </div>
  );
}

/* ── ledger ──────────────────────────────────────────────── */
const SRC_LABEL: Record<CostEntry["source"], string> = { seed: "Opening actuals", conversation: "Conversation", invoice: "Invoice", "end-of-day": "End of day", manual: "Manual" };

function Ledger({ s, jobId }: { s: FState; jobId: string }) {
  const c = jobCosts(s, jobId);
  const entries = s.costEntries.filter((e) => e.jobId === jobId).slice().sort((a, b) => a.date.localeCompare(b.date));
  let run = 0;
  const rows = entries.map((e) => { run += e.amount; return [
    fmtDate(e.date), CAT_LABEL[e.cat], <Pill key="s" tone={e.source === "seed" ? "neutral" : "info"}>{SRC_LABEL[e.source]}</Pill>,
    e.desc, e.hours ? hrs(e.hours) : "", e.workerId ? personName(s, e.workerId) : "", eur(e.amount), eur(run),
  ]; });
  const ms = s.milestones.filter((m) => m.jobId === jobId);
  const sum = (f: (m: Milestone) => boolean) => ms.filter(f).reduce((n, m) => n + m.amount, 0);
  const vars = s.variations.filter((v) => v.jobId === jobId);
  return (
    <div className="fj-stack">
      <JobHead s={s} jobId={jobId} tab="ledger" />
      <Card title="Actual cost entries" flush>
        <Table cols={[{ label: "Date" }, { label: "Category" }, { label: "Source" }, { label: "Description" }, { label: "Hours", align: "right" }, { label: "Who" }, { label: "Amount", align: "right" }, { label: "Running total", align: "right" }]} rows={rows} empty="No actual cost booked on this job yet." />
        <div className="fj-faint" style={{ padding: "8px 18px 12px" }}>Actuals to date {eur(c.actual)}.</div>
      </Card>
      <div className="fj-cmp">
        <Card title="Expected remaining cost">
          <Table cols={[{ label: "Category" }, { label: "Still expected", align: "right" }]}
            rows={[...CATS.map((k) => [CAT_LABEL[k], eur(c.remainingBy[k])]), [<strong key="t">Total expected remaining</strong>, <strong key="v">{eur(c.remaining)}</strong>]]} />
          <div className="fj-callout" style={{ marginTop: 12 }}>
            <strong>Forecast {eur(c.forecast)}</strong> = actual {eur(c.actual)} + expected remaining {eur(c.remaining)}{c.varCost ? " + accepted variation cost " + eur(c.varCost) : ""}.
            <p className="fj-note" style={{ margin: "6px 0 0" }}>Posting an expected cost moves that amount out of Expected remaining and into Actual. The forecast does not change, so nothing is counted twice. <Go to={{ page: "Job Costing", tab: "capture", job: jobId }}>Open cost capture</Go></p>
          </div>
        </Card>
        <Card title="Variations and milestones">
          <div className="fj-stack" style={{ gap: 12 }}>
            <div>
              <div className="fj-faint">Variations, separate lines</div>
              {vars.length ? (
                <ul className="fj-list">{vars.map((v) => (
                  <li key={v.id}><span>{v.id} {v.title}<div className="fj-faint">{v.status === "accepted" ? "Counted in forecast" : v.status === "pending" ? "Pending, not counted" : "Declined, not counted"}</div></span><span className="fj-num">{signed(v.revenue)} revenue, {signed(v.cost)} cost</span></li>
                ))}</ul>
              ) : <div className="fj-note">None on this job.</div>}
            </div>
            <dl className="fj-kv">
              <dt>Build milestones</dt><dd>{eur(sum((m) => m.kind !== "design" && m.kind !== "variation"))}</dd>
              <dt>Design fee (separate)</dt><dd>{eur(sum((m) => m.kind === "design"))}</dd>
              <dt>Variation lines</dt><dd>{eur(sum((m) => m.kind === "variation"))}</dd>
              <dt>Received</dt><dd>{eur(sum((m) => m.status === "received"))}</dd>
              <dt>Not yet received</dt><dd>{eur(sum((m) => m.status !== "received"))}</dd>
            </dl>
            <Go to={{ page: "Job Costing", tab: "payments", job: jobId }}>Open payment schedule</Go>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ── payments ────────────────────────────────────────────── */
const MS_TONE: Record<Milestone["status"], Tone> = { received: "ok", outstanding: "bad", due: "warn", scheduled: "info", locked: "neutral" };
const MS_LABEL: Record<Milestone["status"], string> = { received: "Received", outstanding: "Outstanding", due: "Due", scheduled: "Scheduled", locked: "Locked" };

function Payments({ s, jobId }: { s: FState; jobId: string }) {
  const job = jobOf(s, jobId)!;
  const ms = s.milestones.filter((m) => m.jobId === jobId);
  const groups: { title: string; note: string; items: Milestone[] }[] = [
    { title: "Design fee", note: "Paid on its own, never part of the build price.", items: ms.filter((m) => m.kind === "design") },
    { title: "Build milestones", note: "The agreed build price, paid in stages.", items: ms.filter((m) => m.kind === "deposit" || m.kind === "installation" || m.kind === "final") },
    { title: "Variations", note: "Accepted changes, each on its own payment line.", items: ms.filter((m) => m.kind === "variation") },
  ];
  const build = groups[1].items;
  const actionable = ms.filter((m) => m.status === "outstanding" || m.status === "due");
  const allowed = can(s.ui.role, "confirmPayment");
  const depositGates = s.packs.filter((p) => p.jobId === jobId && p.gates.includes("deposit")).map((p) => ({ p, gate: packGates(s, p).find((g) => g.key === "deposit") }));
  const pendingGate = depositGates.find((x) => x.gate && !x.gate.ok);
  return (
    <div className="fj-stack">
      <JobHead s={s} jobId={jobId} tab="payments" />
      <div className="fj-callout fj-warn"><strong>Simulated.</strong> No external payment collection. Confirm mock receipt only records a receipt in this demo. No card, bank or payment provider is touched.</div>
      {build.length > 0 && (
        <Card title="Original agreement">
          <div className="fj-row">
            <strong className="fj-num">{eur(build.reduce((n, m) => n + m.amount, 0))}</strong>
            <span className="fj-dim">=</span>
            {build.map((m, i) => <span key={m.id} className="fj-num">{i ? "/ " : ""}{eur(m.amount)} <span className="fj-faint">{m.label.toLowerCase()}</span></span>)}
          </div>
          <div className="fj-faint" style={{ marginTop: 6 }}>Contract value {eur(job.contractValue)}. Variations and the design fee sit outside this figure.</div>
        </Card>
      )}
      {depositGates.length > 0 && (
        <div className={"fj-callout " + (pendingGate ? "fj-warn" : "fj-ok")}>
          <strong>The deposit gates pack release.</strong>{" "}
          {depositGates.map(({ p, gate }) => <span key={p.id}>{p.id} {p.label}: {gate?.ok ? "deposit recorded, gate clear." : (gate?.detail ?? "deposit outstanding") + ", pack " + p.status + "."} </span>)}
          <Go to={{ page: "Jobs", tab: "drawings", job: jobId }}>Open drawings</Go>
        </div>
      )}
      {actionable.length > 0 && !allowed && <div className="fj-faint">{roleHint("confirmPayment", s.ui.role)} Switch to Joyce to confirm the receipt.</div>}
      {groups.map((g) => (
        <Card key={g.title} title={g.title} right={<span className="fj-faint">{eur(g.items.reduce((n, m) => n + m.amount, 0), g.title === "Variations")}</span>}>
          <p className="fj-note" style={{ marginTop: 0 }}>{g.note}</p>
          {g.items.length === 0 ? <Empty text={g.title === "Variations" ? "No accepted variations on this job." : "None."} /> : (
            <div className="fj-table-wrap">
              <table className="fj-table">
                <thead><tr><th>Payment</th><th style={right}>Amount</th><th>Status</th><th>Detail</th><th>Receipt</th><th>Recorded by</th><th /></tr></thead>
                <tbody>
                  {g.items.map((m) => (
                    <tr key={m.id}>
                      <td>{m.label}</td>
                      <td style={right} className="fj-num">{eur(m.amount, m.kind === "variation")}</td>
                      <td><Pill tone={MS_TONE[m.status]}>{MS_LABEL[m.status]}</Pill></td>
                      <td>{m.dueNote}</td>
                      <td className="fj-mono">{m.ref ?? ""}</td>
                      <td>{m.receivedBy ? m.receivedBy + (m.receivedOn ? ", " + fmtDate(m.receivedOn) : "") : ""}</td>
                      <td style={right}>
                        {m.status === "received" ? <span className="fj-faint">Recorded</span>
                          : m.status === "outstanding" || m.status === "due" ? <ActBtn action="confirmPayment" small onClick={() => actions.confirmPayment(m.id, actorNow())}>Confirm mock receipt</ActBtn>
                          : <span className="fj-faint">{m.status === "locked" ? "After sign-off" : "Not due yet"}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

/* ── capture ─────────────────────────────────────────────── */
function Capture({ s }: { s: FState }) {
  return (
    <div className="fj-stack">
      <LabourCapture s={s} />
      <InvoiceCapture s={s} />
      <Card title="Recent cost entries" flush>
        <Table
          empty="No cost entries yet."
          cols={[{ label: "Date" }, { label: "Job" }, { label: "Category" }, { label: "Source" }, { label: "Description" }, { label: "Amount", align: "right" }]}
          rows={s.costEntries.filter((e) => e.source !== "seed").slice(-8).reverse().map((e) => [fmtDate(e.date), <JobLink key="j" code={e.jobId} tab="live" />, CAT_LABEL[e.cat], SRC_LABEL[e.source], e.desc, eur(e.amount)])}
        />
        <div className="fj-faint" style={{ padding: "8px 18px 12px" }}>Opening actuals are not listed here. <Go to={{ page: "Job Costing", tab: "ledger" }}>Open the job ledger</Go></div>
      </Card>
    </div>
  );
}

function LabourCapture({ s }: { s: FState }) {
  const [text, setText] = useState("");
  const [pick, setPick] = useState<string>("");
  const [hoursIn, setHoursIn] = useState("");
  const [workerOv, setWorkerOv] = useState<string>("");
  const [fromRem, setFromRem] = useState(true);
  const [key, setKey] = useState<string>(() => newKey());
  const p = parseLabour(s, text);
  const options = p.candidates.length > 1 ? p.candidates : s.jobs.map((j) => j.code);
  const jobId = p.jobId ?? (options.includes(pick) ? pick : null);
  const typedHours = parseFloat(hoursIn);
  const hours = p.hours ?? (Number.isFinite(typedHours) && typedHours > 0 ? typedHours : null);
  const workerId = crew(s).find((w) => w.id === workerOv)?.id ?? p.workerId;
  const worker = s.people.find((w) => w.id === workerId);
  const rate = worker?.rate || 45;
  const amount = (hours ?? 0) * rate;
  const job = jobId ? jobOf(s, jobId) : undefined;
  const c = jobId ? jobCosts(s, jobId) : null;
  const ready = !!text.trim() && !!jobId && hours !== null && hours > 0;
  const hint = roleHint("cost", s.ui.role);
  const book = () => {
    if (!jobId || hours === null) return;
    const res = actions.postLabour(key, jobId, workerId, hours, text.trim(), fromRem, actorNow());
    if (res.ok) { setText(""); setPick(""); setHoursIn(""); setWorkerOv(""); setFromRem(true); setKey(newKey()); }
  };
  return (
    <Card title="Book labour by typing it">
      <div className="fj-stack">
        <Field label="What did you work on" hint="Name the job, say how long, and who if it was not you.">
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="I spent four hours finishing the pizza banquette today." />
        </Field>
        {text.trim() && (
          <div className="fj-callout" aria-live="polite">
            <div className="fj-stack" style={{ gap: 10 }}>
              {!p.jobId && (
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="fj-note" style={{ padding: 0, marginBottom: 6 }}>{p.candidates.length > 1 ? "That could be more than one job. Which one?" : "Which job is this for?"}</legend>
                  <div className="fj-row">
                    {options.map((code) => (
                      <label key={code} className="fj-radio"><input type="radio" name="labour-job" value={code} checked={pick === code} onChange={() => setPick(code)} />{code} {jobOf(s, code)?.name}</label>
                    ))}
                  </div>
                </fieldset>
              )}
              {p.hours === null && (
                <Field label="How many hours? I could not find a number in that.">
                  <input type="number" min={0} step={0.5} value={hoursIn} onChange={(e) => setHoursIn(e.target.value)} />
                </Field>
              )}
              <dl className="fj-kv">
                <dt>Job</dt><dd>{job ? job.code + " " + job.name : "Choose a job"}</dd>
                <dt>Worker</dt>
                <dd>
                  <select className="fj-input" aria-label="Worker" value={workerId} onChange={(e) => setWorkerOv(e.target.value)}>
                    {crew(s).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </dd>
                <dt>Date</dt><dd>{fmtDate(TODAY)}</dd>
                <dt>Hours</dt><dd>{hours !== null ? hrs(hours) : "Needed"}</dd>
                <dt>Rate</dt><dd>{eur(rate)} per hour</dd>
                <dt>Amount</dt><dd><strong>{hours !== null ? eur(amount) : "Needed"}</strong></dd>
              </dl>
              <label className="fj-radio"><input type="checkbox" checked={fromRem} onChange={(e) => setFromRem(e.target.checked)} />Take from expected cost</label>
              {c && hours !== null && (
                <div className="fj-note">
                  {fromRem
                    ? "Expected workshop cost on " + jobId + " goes from " + eur(c.remainingBy.workshop) + " to " + eur(Math.max(0, c.remainingBy.workshop - amount)) + " as the actual rises, so the forecast holds."
                    : "This is unplanned spend. Actual rises by " + eur(amount) + " and the forecast rises with it."}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="fj-row">
          <ActBtn action="cost" disabled={!ready} why={!text.trim() ? "Type what you worked on" : !jobId ? "Choose a job first" : "Add the hours first"} onClick={book}>Book labour</ActBtn>
          {hint && <span className="fj-faint">{hint} Switch to Joyce or a crew lead.</span>}
          <span className="fj-faint">Booking twice is blocked: each entry has one key.</span>
        </div>
      </div>
    </Card>
  );
}

function InvoiceCapture({ s }: { s: FState }) {
  const inv = s.invoices[0];
  const hint = roleHint("cost", s.ui.role);
  const c = inv ? jobCosts(s, inv.jobId) : null;
  const posted = inv?.status === "posted";
  const entry = inv ? s.costEntries.find((e) => e.ref === inv.id) : undefined;
  return (
    <Card title="Photograph a supplier invoice">
      <div className="fj-stack">
        <p className="fj-note" style={{ margin: 0 }}>Photograph the paper invoice. It is read and matched to the purchase order and the delivery receipt. The receipt sets the quantity, the invoice sets the cost.</p>
        <div className="fj-row">
          <ActBtn action="cost" kind="secondary" disabled={!!inv} why="An invoice is already captured" onClick={() => actions.photographInvoice(actorNow())}>Photograph invoice</ActBtn>
          {hint && <span className="fj-faint">{hint}</span>}
        </div>
        {inv && c && (
          <div className={"fj-callout " + (posted ? "fj-ok" : "")}>
            <div className="fj-between" style={{ marginBottom: 8 }}>
              <strong>{supplierName(s, inv.supplierId)}, invoice {inv.ref}</strong>
              <Pill tone={posted ? "ok" : "warn"}>{posted ? "Posted" : "Review before posting"}</Pill>
            </div>
            <dl className="fj-kv">
              <dt>Matched job</dt><dd><JobLink code={inv.jobId} /> {jobOf(s, inv.jobId)?.name}</dd>
              <dt>Purchase order</dt><dd>{inv.poId}</dd>
              <dt>Delivery receipt</dt><dd>{receivedQty(s, inv.reqId)} received so far. Invoice covers {inv.qty}.</dd>
              <dt>Invoice</dt><dd>{inv.qty} sheets x {eur(inv.unitCost)} = <strong>{eur(inv.total)}</strong></dd>
            </dl>
            {!posted ? (
              <div className="fj-row" style={{ marginTop: 10 }}>
                <ActBtn action="cost" onClick={() => actions.postInvoice(inv.id, actorNow())}>Post invoice</ActBtn>
                <span className="fj-faint">Posting moves {eur(inv.total)} from expected materials to actual materials.</span>
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <div>Posted once. Materials actual rose by {eur(entry?.amount ?? inv.total)} to {eur(c.actualBy.materials)} and expected materials fell by {eur(inv.total)} to {eur(c.remainingBy.materials)}.</div>
                <div className="fj-note">Forecast cost stays {eur(c.forecast)} and margin {pct(c.forecastMargin)}: the quantity came from the receipt, so nothing is counted twice.{" "}
                  <Go to={{ page: "Job Costing", tab: "ledger", job: inv.jobId }}>Open the ledger</Go></div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
