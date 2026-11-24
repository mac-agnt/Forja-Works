import { useState } from "react";
import { Page, Card, Pill, Btn, ActBtn, JobLink, Go, Table, Empty, Stat, Grid, Field, Bar, roleHint, type Tone } from "../ui";
import { actions, actorNow, useForja } from "../store";
import { fit, jobCosts, jobOf, personName, eur, pct, hrs } from "../derive";
import { openStandalone } from "../nav";
import type { Enquiry, FState, Quote, QuoteVersion, Variation } from "../types";
import { fmtAt, lineCost, quoteStats } from "./estimates.helpers";

const SUBS: Record<string, string> = {
  enquiries: "Every enquiry in one list, with the path it takes and where it sits. None of these are live jobs until they are won.",
  quotes: "Editable quote lines, live totals, and a side-by-side version compare.",
  fit: "Does this work fit the workshop, and what does it return per workshop hour.",
  variations: "Changes to an agreed scope, priced on their own line. The client accepts them in the portal.",
};

export default function Estimates({ tab, job }: { tab: string; job?: string }) {
  const s = useForja();
  return (
    <Page title="Estimates" sub={SUBS[tab] ?? SUBS.enquiries}>
      {tab === "quotes" ? <Quotes s={s} job={job} />
        : tab === "fit" ? <FitReview s={s} />
        : tab === "variations" ? <Variations s={s} job={job} />
        : <Enquiries s={s} />}
    </Page>
  );
}

/* ── shared bits ─────────────────────────────────────────── */
const stageTone = (st: Enquiry["stage"]): Tone => (st === "Won" ? "ok" : st === "Passed" ? "neutral" : st === "Quoted" ? "info" : st === "Discovery" ? "warn" : "info");
const signed = (n: number) => eur(n, true);
function Delta({ n, goodWhenUp = false, fmt = signed }: { n: number; goodWhenUp?: boolean; fmt?: (n: number) => string }) {
  const rounded = Math.round(n * 100) / 100;
  const cls = rounded === 0 ? "" : (rounded > 0) === goodWhenUp ? "fj-pos" : "fj-neg";
  return <span className={"fj-num " + cls}>{rounded === 0 ? fmt(0).replace("+", "") : fmt(rounded)}</span>;
}

/** Numeric input that commits on blur or Enter, so a toast is not fired per keystroke. */
function NumInput({ value, onCommit, disabled, label, step = 1 }: { value: number; onCommit: (n: number) => void; disabled?: boolean; label: string; step?: number }) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const n = parseFloat(draft);
    if (!Number.isFinite(n)) { setDraft(String(value)); return; }
    if (n !== value) onCommit(n);
  };
  return (
    <input className="fj-numin" type="number" min={0} step={step} aria-label={label} value={draft} disabled={disabled}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} />
  );
}

/* ── enquiries ───────────────────────────────────────────── */
function Enquiries({ s }: { s: FState }) {
  const [sel, setSel] = useState<string>(s.enquiries[0]?.id ?? "");
  const cur = s.enquiries.find((e) => e.id === sel);
  const live = s.enquiries.filter((e) => e.stage !== "Passed");
  return (
    <div className="fj-stack">
      <Grid cols={4}>
        <Stat label="Enquiries" value={s.enquiries.length} sub="not in the live jobs" />
        <Stat label="Open" value={live.length} sub="still being worked" tone="info" />
        <Stat label="Passed" value={s.enquiries.length - live.length} sub="kept for the record" />
        <Stat label="Live jobs" value={s.jobs.length} sub="FW-261 to FW-267" />
      </Grid>
      <Card title="Two ways in">
        <div className="fj-cmp">
          <div>
            <Pill tone="info">Paid design first</Pill>
            <p className="fj-note" style={{ marginTop: 8 }}>The brief is loose. We scope it, the client pays a design fee, the design is signed off, then we quote against the signed design. The design fee is its own line and never part of the build price.</p>
          </div>
          <div>
            <Pill tone="info">Quote from supplied drawings</Pill>
            <p className="fj-note" style={{ marginTop: 8 }}>The client already has drawings. We price straight from them, with no design fee. The quote is only as good as the drawings, so anything missing is listed as an assumption.</p>
          </div>
        </div>
      </Card>
      <div className="fj-split">
        <Card title="Enquiries" flush>
          <div className="fj-table-wrap">
            <table className="fj-table">
              <thead><tr><th>Enquiry</th><th>Source</th><th>Owner</th><th>Received</th><th>Path</th><th>Stage</th><th style={{ textAlign: "right" }}>Value</th></tr></thead>
              <tbody>
                {s.enquiries.map((e) => (
                  <tr key={e.id} className={(e.stage === "Passed" ? "fj-dimrow " : "") + (e.id === sel ? "fj-sel" : "")}>
                    <td><button className="fj-rowbtn" onClick={() => setSel(e.id)} aria-pressed={e.id === sel}><strong>{e.id}</strong> {e.title}</button><div className="fj-faint">{e.client}</div></td>
                    <td>{e.source}</td>
                    <td>{personName(s, e.ownerId)}</td>
                    <td>{e.receivedDaysAgo === 0 ? "Today" : e.receivedDaysAgo + (e.receivedDaysAgo === 1 ? " day ago" : " days ago")}</td>
                    <td>{e.path}</td>
                    <td><Pill tone={stageTone(e.stage)}>{e.stage}</Pill></td>
                    <td style={{ textAlign: "right" }} className="fj-num">{eur(e.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {cur ? <EnquiryDetail s={s} e={cur} /> : <Card><Empty text="Pick an enquiry to see the brief." /></Card>}
      </div>
    </div>
  );
}

function EnquiryDetail({ s, e }: { s: FState; e: Enquiry }) {
  const f = fit(s, e.id);
  const quote = s.quotes.find((q) => q.enquiryId === e.id);
  return (
    <Card title={e.id + " " + e.title} right={<Pill tone={stageTone(e.stage)}>{e.stage}</Pill>}>
      <div className="fj-stack" style={{ gap: 12 }}>
        <p className="fj-note" style={{ margin: 0 }}>{e.brief}</p>
        <dl className="fj-kv">
          <dt>Client</dt><dd>{e.client}</dd>
          <dt>Source</dt><dd>{e.source}</dd>
          <dt>Owner</dt><dd>{personName(s, e.ownerId)}</dd>
          <dt>Path</dt><dd>{e.path}</dd>
          <dt>Type</dt><dd>{e.type === "commercial" ? "Commercial" : "Residential"}</dd>
          <dt>Estimated value</dt><dd>{eur(e.revenue)}</dd>
          <dt>Estimated cost</dt><dd>{eur(e.cost)} over {hrs(e.hours)} of workshop time</dd>
          <dt>Return per workshop hour</dt><dd>{eur(f.perHour)}</dd>
        </dl>
        {e.stage === "Passed" && e.decision && (
          <div className="fj-callout">
            <strong>Passed by {e.decision.by}</strong>, {fmtAt(e.decision.at)}. Reason: {e.decision.reason}. It stays out of the {s.jobs.length} live jobs.
          </div>
        )}
        <div className="fj-row">
          <Go to={{ page: "Estimates", tab: "fit" }} kind="btn">Open fit review</Go>
          {quote && <Go to={{ page: "Estimates", tab: "quotes" }} kind="btn">Quote {quote.id}</Go>}
        </div>
      </div>
    </Card>
  );
}

/* ── quotes ──────────────────────────────────────────────── */
function Quotes({ s, job }: { s: FState; job?: string }) {
  const first = s.quotes.find((q) => q.jobId === job) ?? s.quotes[0];
  const [qid, setQid] = useState<string>(first?.id ?? "");
  const q = s.quotes.find((x) => x.id === qid) ?? s.quotes[0];
  if (!q) return <Card><Empty text="No quotes yet." /></Card>;
  return (
    <div className="fj-stack">
      <Card title="Quote" right={<span className="fj-faint">{s.quotes.length} quotes</span>}>
        <div className="fj-row">
          <Field label="Pick a quote">
            <select value={q.id} onChange={(e) => setQid(e.target.value)}>
              {s.quotes.map((x) => <option key={x.id} value={x.id}>{x.id} {x.name}</option>)}
            </select>
          </Field>
          <span className="fj-dim" style={{ fontSize: 13 }}>
            {q.jobId ? <>Job <JobLink code={q.jobId} /></> : <>Enquiry {q.enquiryId}</>}
          </span>
        </div>
      </Card>
      <QuoteEditor key={q.id} s={s} q={q} />
      {q.versions.length > 1 && <VersionCompare s={s} q={q} />}
      <PremiumHistory s={s} onOpen={(id) => setQid(id)} />
    </div>
  );
}

function QuoteEditor({ q }: { s: FState; q: Quote }) {
  const s = useForja();
  const [ver, setVer] = useState<number>(q.currentV);
  const v = q.versions.find((x) => x.v === ver) ?? q.versions[q.versions.length - 1];
  const st = quoteStats(v);
  const canEdit = roleHint("quote", s.ui.role) === null;
  const act = actorNow();
  const workshop = v.lines.find((l) => l.cat === "Workshop hours");
  return (
    <Card title={q.name} right={
      <div className="fj-row">
        <select className="fj-input" aria-label="Quote version" value={v.v} onChange={(e) => setVer(Number(e.target.value))}>
          {q.versions.map((x) => <option key={x.v} value={x.v}>{x.name}{x.v === q.currentV ? " (current)" : ""}</option>)}
        </select>
        <ActBtn action="quote" kind="secondary" small onClick={() => { const r = actions.newQuoteVersion(q.id, act); if (r.ok) setVer(q.versions[q.versions.length - 1].v + 1); }}>New version</ActBtn>
      </div>}>
      <div className="fj-stack">
        <p className="fj-note" style={{ margin: 0 }}>{v.note}</p>
        <Grid cols={5} gap={10}>
          <Stat label="Cost" value={eur(st.cost)} />
          <Stat label="Price" value={eur(st.price)} />
          <Stat label="Profit" value={eur(st.profit)} sub={pct(st.margin) + " margin"} tone={st.margin < 28 ? "warn" : "ok"} />
          <Stat label="Workshop hours" value={hrs(st.hours)} />
          <Stat label="Profit per workshop hour" value={eur(st.perHour)} />
        </Grid>
        <div className="fj-table-wrap">
          <table className="fj-table">
            <thead><tr><th>Category</th><th>Line</th><th style={{ textAlign: "right" }}>Qty</th><th>Unit</th><th style={{ textAlign: "right" }}>Rate</th><th style={{ textAlign: "right" }}>Cost</th></tr></thead>
            <tbody>
              {v.lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.cat}</td>
                  <td>{l.label}</td>
                  <td style={{ textAlign: "right" }}><NumInput key={l.id + ":q:" + l.qty} label={l.label + " quantity"} value={l.qty} disabled={!canEdit} onCommit={(n) => actions.updateQuoteLine(q.id, v.v, l.id, { qty: n }, act)} /></td>
                  <td>{l.unit}</td>
                  <td style={{ textAlign: "right" }}><NumInput key={l.id + ":r:" + l.rate} label={l.label + " rate"} value={l.rate} disabled={!canEdit} onCommit={(n) => actions.updateQuoteLine(q.id, v.v, l.id, { rate: n }, act)} /></td>
                  <td style={{ textAlign: "right" }} className="fj-num">{eur(lineCost(l))}</td>
                </tr>
              ))}
              <tr className="fj-tfoot"><td colSpan={5}>Total cost</td><td style={{ textAlign: "right" }} className="fj-num">{eur(st.cost)}</td></tr>
              <tr>
                <td colSpan={5}><strong>Price to client</strong></td>
                <td style={{ textAlign: "right" }}><NumInput key={"p:" + v.price} label="Price to client" step={100} value={v.price} disabled={!canEdit} onCommit={(n) => actions.setQuotePrice(q.id, v.v, n, act)} /></td>
              </tr>
            </tbody>
          </table>
        </div>
        {!canEdit && <div className="fj-faint">{roleHint("quote", s.ui.role)} Switch to Caio, Joyce or Ana to edit lines.</div>}
        <div className="fj-callout">
          <strong>Cost assumptions.</strong> {workshop ? "Workshop labour is costed at " + eur(workshop.rate) + " per hour on " + hrs(workshop.qty) + ". " : ""}
          Materials, finishing, install and transport are carried at cost with no markup. Overhead is allocated as one line ({eur(v.lines.filter((l) => l.cat === "Overhead").reduce((n, l) => n + lineCost(l), 0))}), so profit shown is after overhead.
        </div>
      </div>
    </Card>
  );
}

function VersionCompare({ q }: { s: FState; q: Quote }) {
  const last = q.versions[q.versions.length - 1];
  const [a, setA] = useState<number>(q.versions[0].v);
  const [b, setB] = useState<number>(last.v);
  const va = q.versions.find((x) => x.v === a) ?? q.versions[0];
  const vb = q.versions.find((x) => x.v === b) ?? last;
  const sa = quoteStats(va), sb = quoteStats(vb);
  const ids = Array.from(new Set([...va.lines.map((l) => l.id), ...vb.lines.map((l) => l.id)]));
  const sel = (val: number, set: (n: number) => void, label: string) => (
    <Field label={label}>
      <select value={val} onChange={(e) => set(Number(e.target.value))}>{q.versions.map((x) => <option key={x.v} value={x.v}>{x.name}</option>)}</select>
    </Field>
  );
  const totalRows: [string, string, string, ReturnType<typeof Delta>][] = [
    ["Total cost", eur(sa.cost), eur(sb.cost), <Delta key="c" n={sb.cost - sa.cost} />],
    ["Price", eur(sa.price), eur(sb.price), <Delta key="p" n={sb.price - sa.price} goodWhenUp />],
    ["Expected profit", eur(sa.profit), eur(sb.profit), <Delta key="pr" n={sb.profit - sa.profit} goodWhenUp />],
    ["Margin", pct(sa.margin), pct(sb.margin), <Delta key="m" n={sb.margin - sa.margin} goodWhenUp fmt={(n) => (n > 0 ? "+" : n < 0 ? "-" : "") + Math.abs(n).toFixed(1) + " pts"} />],
    ["Workshop hours", hrs(sa.hours), hrs(sb.hours), <Delta key="h" n={sb.hours - sa.hours} fmt={(n) => (n > 0 ? "+" : n < 0 ? "-" : "") + Math.abs(n) + "h"} />],
  ];
  return (
    <Card title="Compare versions" right={<span className="fj-faint">Per-line change, then totals</span>}>
      <div className="fj-stack">
        <div className="fj-row">{sel(a, setA, "From")}{sel(b, setB, "To")}</div>
        <div className="fj-table-wrap">
          <table className="fj-table">
            <thead><tr><th>Line</th><th style={{ textAlign: "right" }}>{va.name}</th><th style={{ textAlign: "right" }}>{vb.name}</th><th style={{ textAlign: "right" }}>Change</th></tr></thead>
            <tbody>
              {ids.map((id) => {
                const la = va.lines.find((l) => l.id === id), lb = vb.lines.find((l) => l.id === id);
                const ca = la ? lineCost(la) : 0, cb = lb ? lineCost(lb) : 0;
                const label = (lb ?? la)!.label;
                const detail = la && lb && (la.qty !== lb.qty || la.rate !== lb.rate) ? la.qty + " to " + lb.qty + " " + lb.unit + " at " + eur(lb.rate) : "";
                return (
                  <tr key={id}>
                    <td>{label}{detail && <div className="fj-faint">{detail}</div>}</td>
                    <td style={{ textAlign: "right" }} className="fj-num">{eur(ca)}</td>
                    <td style={{ textAlign: "right" }} className="fj-num">{eur(cb)}</td>
                    <td style={{ textAlign: "right" }}><Delta n={cb - ca} /></td>
                  </tr>
                );
              })}
              {totalRows.map(([label, x, y, d]) => (
                <tr key={label} className="fj-tfoot"><td>{label}</td><td style={{ textAlign: "right" }} className="fj-num">{x}</td><td style={{ textAlign: "right" }} className="fj-num">{y}</td><td style={{ textAlign: "right" }}>{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {q.jobId && sb.cost !== sa.cost && (
          <div className="fj-row">
            <span className="fj-note">The change is a cost forecast, not a new price. The client price stays {eur(sb.price)}.</span>
            <Go to={{ page: "Job Costing", tab: "forecast", job: q.jobId }} kind="btn">See it in the forecast</Go>
          </div>
        )}
      </div>
    </Card>
  );
}

function PremiumHistory({ s, onOpen }: { s: FState; onOpen: (id: string) => void }) {
  const q = s.quotes.find((x) => x.id === "Q-264");
  if (!q) return null;
  return (
    <Card title="Premium activation estimate history" right={<Btn small kind="ghost" onClick={() => onOpen(q.id)}>Open quote</Btn>}>
      <p className="fj-note" style={{ marginTop: 0 }}>{q.name}. The accepted Docklands pop-up is the reference for pricing a premium brand activation. Compare it with E-402 in the fit review.</p>
      <Table
        cols={[{ label: "Version" }, { label: "Note" }, { label: "Cost", align: "right" }, { label: "Price", align: "right" }, { label: "Margin", align: "right" }, { label: "Workshop", align: "right" }, { label: "Profit per hour", align: "right" }]}
        rows={q.versions.map((v: QuoteVersion) => { const t = quoteStats(v); return [v.name, v.note, eur(t.cost), eur(t.price), pct(t.margin), hrs(t.hours), eur(t.perHour)]; })}
      />
    </Card>
  );
}

/* ── fit review ──────────────────────────────────────────── */
function FitReview({ s }: { s: FState }) {
  const a = fit(s, "E-401"), b = fit(s, "E-402");
  const ranked = s.enquiries.map((e) => fit(s, e.id)).sort((x, y) => y.perHour - x.perHour);
  const top = Math.max(1, ...ranked.map((r) => r.perHour));
  return (
    <div className="fj-stack">
      <Card title="One-off against activation">
        <p className="fj-note" style={{ marginTop: 0 }}>
          Same workshop, two ways to spend it. {a.e.title} returns {eur(a.perHour)} per workshop hour; {b.e.title} returns {eur(b.perHour)}
          {a.perHour > 0 ? ", " + (b.perHour / a.perHour).toFixed(1) + " times as much" : ""}.
        </p>
        <div className="fj-cmp">
          <FitCard s={s} f={a} max={top} passable />
          <FitCard s={s} f={b} max={top} />
        </div>
      </Card>
      <Card title="All enquiries ranked by return per workshop hour" flush>
        <div className="fj-table-wrap">
          <table className="fj-table">
            <thead><tr><th>#</th><th>Enquiry</th><th>Stage</th><th style={{ textAlign: "right" }}>Sale price</th><th style={{ textAlign: "right" }}>Profit after overhead</th><th style={{ textAlign: "right" }}>Margin</th><th style={{ textAlign: "right" }}>Workshop</th><th style={{ textAlign: "right" }}>Per hour</th></tr></thead>
            <tbody>
              {ranked.map((r, i) => (
                <tr key={r.e.id} className={r.e.stage === "Passed" ? "fj-dimrow" : undefined}>
                  <td>{i + 1}</td>
                  <td><strong>{r.e.id}</strong> {r.e.title}<div className="fj-faint">{r.e.client}</div></td>
                  <td><Pill tone={stageTone(r.e.stage)}>{r.e.stage}</Pill></td>
                  <td style={{ textAlign: "right" }} className="fj-num">{eur(r.e.revenue)}</td>
                  <td style={{ textAlign: "right" }} className="fj-num">{eur(r.profit)}</td>
                  <td style={{ textAlign: "right" }} className="fj-num">{pct(r.marginPct)}</td>
                  <td style={{ textAlign: "right" }} className="fj-num">{hrs(r.e.hours)}</td>
                  <td style={{ textAlign: "right", minWidth: 130 }}><span className="fj-num">{eur(Math.round(r.perHour * 100) / 100)}</span><Bar value={r.perHour} max={top} tone={r.perHour >= 100 ? "ok" : "info"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function FitCard({ s, f, max, passable }: { s: FState; f: ReturnType<typeof fit>; max: number; passable?: boolean }) {
  const e = f.e;
  const [reason, setReason] = useState("");
  const act = actorNow();
  const over = Math.max(0, e.hours - f.weekFree);
  const hint = roleHint("passEnquiry", s.ui.role);
  return (
    <section className="fj-card" style={{ background: "var(--surface-2)" }} aria-label={e.title}>
      <header className="fj-card-h"><h2>{e.id} {e.title}</h2><div><Pill tone={stageTone(e.stage)}>{e.stage}</Pill></div></header>
      <div className="fj-card-b fj-stack" style={{ gap: 12 }}>
        <div className="fj-faint">{e.client}. {e.path}.</div>
        <dl className="fj-kv">
          <dt>Sale price</dt><dd>{eur(e.revenue)}</dd>
          <dt>Cost with overhead</dt><dd>{eur(e.cost)}</dd>
          <dt>Profit after overhead</dt><dd>{eur(f.profit)} ({pct(f.marginPct)})</dd>
          <dt>Workshop hours used</dt><dd>{hrs(e.hours)}</dd>
          <dt>Return per workshop hour</dt><dd><strong>{eur(Math.round(f.perHour * 100) / 100)}</strong></dd>
        </dl>
        <Bar value={f.perHour} max={max} tone={f.perHour >= 100 ? "ok" : "warn"} />
        <div className={"fj-callout " + (f.fits ? "fj-ok" : "fj-warn")}>
          <strong>Demand check.</strong> {hrs(f.weekFree)} free in the planner this week to Mon 30 Nov. {hrs(e.hours)} needed.{" "}
          {over === 0 ? "It fits inside this week." : f.fits ? "It overflows by " + hrs(over) + " and fits only by running into the following week." : "It does not fit: short by " + hrs(over) + "."}{" "}
          <Go to={{ page: "Workshop", tab: "capacity" }}>Open capacity</Go>
        </div>
        {e.decision ? (
          <div className="fj-callout">
            <div><strong>Decision: passed.</strong> {e.decision.reason}</div>
            <div className="fj-faint">By {e.decision.by}, {fmtAt(e.decision.at)}. Stays out of the {s.jobs.length} live jobs.</div>
            {passable && (
              <div style={{ marginTop: 8 }}>
                <ActBtn action="passEnquiry" kind="secondary" small onClick={() => actions.reopenEnquiry(e.id, act)}>Reopen enquiry</ActBtn>
                {hint && <div className="fj-faint" style={{ marginTop: 6 }}>{hint}</div>}
              </div>
            )}
          </div>
        ) : passable ? (
          <div className="fj-stack" style={{ gap: 8 }}>
            <Field label="Reason for passing" hint="Required. It is saved with the decision.">
              <textarea value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Why this one does not earn its place in the workshop this month" />
            </Field>
            <div className="fj-row">
              <ActBtn action="passEnquiry" kind="danger" disabled={!reason.trim()} why="Add a reason first" onClick={() => { const r = actions.passEnquiry(e.id, reason, act); if (r.ok) setReason(""); }}>Pass on this one</ActBtn>
              {hint && <span className="fj-faint">{hint} Switch to Caio.</span>}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ── variations ──────────────────────────────────────────── */
function effectOf(s: FState, v: Variation) {
  const c = jobCosts(s, v.jobId);
  const accepted = v.status === "accepted";
  const beforeRev = accepted ? c.revenue - v.revenue : c.revenue;
  const beforeCost = accepted ? c.forecast - v.cost : c.forecast;
  const afterRev = accepted ? c.revenue : c.revenue + v.revenue;
  const afterCost = accepted ? c.forecast : c.forecast + v.cost;
  const row = (rev: number, cost: number) => ({ rev, cost, profit: rev - cost, margin: rev ? ((rev - cost) / rev) * 100 : 0 });
  return { before: row(beforeRev, beforeCost), after: row(afterRev, afterCost) };
}

function Variations({ s, job }: { s: FState; job?: string }) {
  const initial = s.variations.find((v) => v.jobId === job) ?? s.variations[0];
  const [sel, setSel] = useState<string>(initial?.id ?? "");
  const v = s.variations.find((x) => x.id === sel) ?? s.variations[0];
  return (
    <div className="fj-stack">
      <Card title="Variations" flush>
        <Table
          empty="No variations yet. Draft one below."
          cols={[{ label: "Variation" }, { label: "Job" }, { label: "Type" }, { label: "Revenue", align: "right" }, { label: "Expected cost", align: "right" }, { label: "Status" }]}
          onRow={(i) => setSel(s.variations[i].id)}
          rows={s.variations.map((x) => [
            <span key="t"><strong>{x.id}</strong> {x.title}</span>,
            <span key="j" onClick={(e) => e.stopPropagation()}><JobLink code={x.jobId} /></span>,
            x.kind === "omission" ? "Omission" : "Extra",
            signed(x.revenue), signed(x.cost),
            <Pill key="s" tone={x.status === "accepted" ? "ok" : x.status === "declined" ? "neutral" : "warn"}>{x.status === "pending" ? "Pending" : x.status === "accepted" ? "Accepted" : "Declined"}</Pill>,
          ])}
        />
      </Card>
      {v && <VariationEffect s={s} v={v} />}
      <DraftVariation s={s} job={job} onCreated={setSel} />
    </div>
  );
}

function VariationEffect({ s, v }: { s: FState; v: Variation }) {
  const job = jobOf(s, v.jobId);
  const { before, after } = effectOf(s, v);
  const pending = v.status === "pending";
  const accepted = v.status === "accepted";
  const ms = s.milestones.find((m) => m.variationId === v.id);
  const rev = s.revisions.find((r) => r.jobId === v.jobId && r.rev.startsWith(v.id + "-"));
  const row = (label: string, a: string, b: string, d: ReactDelta) => (
    <tr key={label}><td>{label}</td><td style={{ textAlign: "right" }} className="fj-num">{a}</td><td style={{ textAlign: "right" }} className="fj-num">{b}</td><td style={{ textAlign: "right" }}>{d}</td></tr>
  );
  return (
    <Card title={v.id + " " + v.title + (job ? " on " + job.code : "")} right={<Pill tone={accepted ? "ok" : pending ? "warn" : "neutral"}>{pending ? "Pending client decision" : accepted ? "Accepted" : "Declined"}</Pill>}>
      <div className="fj-stack">
        <p className="fj-note" style={{ margin: 0 }}>{v.note}</p>
        {pending ? (
          <div className="fj-callout fj-warn"><strong>Scenario preview only.</strong> Nothing in the job forecast has changed. These figures show what happens if the client accepts {v.id}.</div>
        ) : accepted ? (
          <div className="fj-callout fj-ok"><strong>Accepted{v.acceptedBy ? " by " + v.acceptedBy : ""}{v.acceptedAt ? ", " + fmtAt(v.acceptedAt) : ""}.</strong> These are the actual revised forecast figures, counted once.</div>
        ) : (
          <div className="fj-callout">Declined. No effect on the forecast.</div>
        )}
        {v.status !== "declined" && (
          <div className="fj-table-wrap">
            <table className="fj-table">
              <thead><tr><th>Forecast</th><th style={{ textAlign: "right" }}>{accepted ? "Before " + v.id : "Now"}</th><th style={{ textAlign: "right" }}>{accepted ? "With " + v.id + " (actual)" : "If accepted (preview)"}</th><th style={{ textAlign: "right" }}>Change</th></tr></thead>
              <tbody>
                {row("Revenue", eur(before.rev), eur(after.rev), <Delta n={after.rev - before.rev} goodWhenUp />)}
                {row("Expected cost", eur(before.cost), eur(after.cost), <Delta n={after.cost - before.cost} />)}
                {row("Expected profit", eur(before.profit), eur(after.profit), <Delta n={after.profit - before.profit} goodWhenUp />)}
                {row("Margin", pct(before.margin), pct(after.margin), <Delta n={after.margin - before.margin} goodWhenUp fmt={(n) => (n > 0 ? "+" : n < 0 ? "-" : "") + Math.abs(n).toFixed(1) + " pts"} />)}
              </tbody>
            </table>
          </div>
        )}
        <div className="fj-cmp">
          <div className="fj-callout">
            <strong>Client acceptance.</strong>
            <p className="fj-note" style={{ margin: "6px 0 10px" }}>Only the client can accept a variation, from the portal. It then appears as its own payment line, separate from the {job ? eur(job.contractValue) : "base"} agreement.</p>
            <Btn kind="secondary" small onClick={() => openStandalone("portal", v.jobId, "payments")}>Preview client view</Btn>
            {ms && <div className="fj-faint" style={{ marginTop: 8 }}>Payment line: {eur(ms.amount, true)}, {ms.status}. {ms.dueNote}. <Go to={{ page: "Job Costing", tab: "payments", job: v.jobId }}>Open payments</Go></div>}
          </div>
          <div className="fj-callout">
            <strong>Revised drawing.</strong>
            <p className="fj-note" style={{ margin: "6px 0 10px" }}>
              {accepted ? "Accepting " + v.id + " issued a revised drawing" + (rev ? " (" + rev.rev + ", " + rev.status + ")" : "") + ". It needs its own sign-off before the extra work is released." : "Once accepted, a revised drawing is issued. It needs its own client approval before any of this work is cut."}
            </p>
            <Go to={{ page: "Jobs", tab: "drawings", job: v.jobId }} kind="btn">Open drawings</Go>
          </div>
        </div>
      </div>
    </Card>
  );
}
type ReactDelta = ReturnType<typeof Delta>;

function DraftVariation({ s, job, onCreated }: { s: FState; job?: string; onCreated: (id: string) => void }) {
  const [jobId, setJobId] = useState<string>(job && jobOf(s, job) ? job : "FW-261");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"extra" | "omission">("extra");
  const [rev, setRev] = useState("");
  const [cost, setCost] = useState("");
  const r = Math.abs(parseFloat(rev) || 0), c = Math.abs(parseFloat(cost) || 0);
  const sign = kind === "omission" ? -1 : 1;
  const hint = roleHint("createVariation", s.ui.role);
  const submit = () => {
    const res = actions.createVariation(jobId, title, kind, r, c, actorNow());
    if (res.ok) {
      const id = "V" + String(s.variations.length + 1).padStart(2, "0");
      onCreated(id); setTitle(""); setRev(""); setCost("");
    }
  };
  return (
    <Card title="Draft a variation">
      <div className="fj-stack">
        <Grid cols={4} gap={12}>
          <Field label="Job">
            <select value={jobId} onChange={(e) => setJobId(e.target.value)}>{s.jobs.map((j) => <option key={j.code} value={j.code}>{j.code} {j.name}</option>)}</select>
          </Field>
          <Field label="Type">
            <select value={kind} onChange={(e) => setKind(e.target.value === "omission" ? "omission" : "extra")}>
              <option value="extra">Extra (adds scope)</option>
              <option value="omission">Omission (removes scope)</option>
            </select>
          </Field>
          <Field label="Revenue (EUR)"><input type="number" min={0} value={rev} onChange={(e) => setRev(e.target.value)} /></Field>
          <Field label="Expected cost (EUR)"><input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        </Grid>
        <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fluted frontage to counter" /></Field>
        <div className="fj-row">
          <span className="fj-note">Saved as revenue {signed(sign * r)} and expected cost {signed(sign * c)}.{kind === "omission" ? " An omission is a credit, shown negative." : ""}</span>
        </div>
        <div className="fj-row">
          <ActBtn action="createVariation" disabled={!title.trim()} why="Name the variation first" onClick={submit}>Draft variation</ActBtn>
          {hint && <span className="fj-faint">{hint}</span>}
          <span className="fj-faint">Drafting changes nothing in the forecast. The client decides in the portal.</span>
        </div>
      </div>
    </Card>
  );
}
