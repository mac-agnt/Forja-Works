import { useState } from "react";
import { Page, Card, Pill, Btn, Go, JobLink, Table, Empty, DemoBadge } from "../ui";
import { useForja } from "../store";
import type { FState } from "../types";
import { navigate, openStandalone } from "../nav";
import { fmtStamp } from "../dates";
import {
  TODAY, agents, answer, briefing, dayAvail, eur, exceptions, fmtDate, jobCosts, pct, personName, previewMove, receivedQty, shortQty,
} from "../derive";
import type { AgentCard } from "../derive";

const WED = "2026-11-25";

function Briefing({ s }: { s: FState }) {
  const list = briefing(s);
  return (
    <Card title="Today's three clauses" flush>
      <ul className="fj-rowlist" style={{ padding: "0 18px" }}>
        {list.map((c, i) => (
          <li key={i}>
            <Go to={c.link}>{c.text}</Go>
            <Pill tone={c.done ? "ok" : "warn"}>{c.done ? "Done" : "Open"}</Pill>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Watchdog({ s }: { s: FState }) {
  const list = exceptions(s);
  return (
    <Card title={"Open exceptions (" + list.length + ")"} flush right={<Go to={{ page: "Work", tab: "exceptions" }}>Open exceptions</Go>}>
      {list.length === 0 && <Empty text="No open exceptions." />}
      {list.map((e) => (
        <div key={e.id} className="fj-task">
          <div style={{ minWidth: 0 }}>
            <div className="fj-task-t">{e.title}</div>
            <div className="fj-task-m">
              <Pill tone={e.severity === "high" ? "bad" : "warn"}>{e.severity === "high" ? "High" : "Medium"}</Pill>
              {e.jobId && <JobLink code={e.jobId} />}
              <span>Responsible: {e.owner}</span>
            </div>
            <div className="fj-note"><b>Blocking:</b> {e.blocking}</div>
            <div className="fj-note"><b>Evidence:</b> {e.evidence}</div>
          </div>
          <div className="fj-task-a"><Go to={e.link} kind="btn">Open</Go></div>
        </div>
      ))}
    </Card>
  );
}

function Planner({ s, card }: { s: FState; card: AgentCard }) {
  const pv = previewMove(s, "FW-266", TODAY, WED);
  const moved = s.moves.some((m) => m.jobId === "FW-266");
  return (
    <Card title={moved ? "Move confirmed" : "Preview: City shopfront Tuesday to Wednesday"} right={<Pill tone={moved ? "ok" : "info"}>{moved ? "Applied by the production manager" : "Preview only"}</Pill>}>
      {moved ? (
        <div className="fj-dim">The move is booked. Capacity now reads Tuesday {pv.before[TODAY]}/{dayAvail(s, TODAY)}h and Wednesday {pv.before[WED]}/{dayAvail(s, WED)}h.</div>
      ) : (
        <>
          <Table
            cols={[{ label: "Day" }, { label: "Now", align: "right" }, { label: "After move", align: "right" }]}
            rows={[TODAY, WED].map((d) => [fmtDate(d), <span key="b" className="fj-num">{pv.before[d]}/{dayAvail(s, d)}h</span>, <b key="a" className="fj-num" style={{ color: "var(--ink)" }}>{pv.after[d]}/{dayAvail(s, d)}h</b>])}
          />
          <div className="fj-note">Moves {pv.hours}h ({pv.items.filter((i) => i.ok).length} blocks). Thursday dispatch {pv.dispatchKept ? "is kept" : "would be missed"}. {pv.eligible ? "Eligible." : "Not eligible."}</div>
        </>
      )}
      <div className="fj-row" style={{ marginTop: 12 }}>
        <Go to={card.link} kind="btn">Open the preview</Go>
        <span className="fj-faint">Only the production manager confirms the move.</span>
      </div>
    </Card>
  );
}

function Materials({ s }: { s: FState }) {
  const req = s.requirements.find((r) => r.id === "rq-262-ply");
  const rcpts = s.receipts.filter((r) => r.reqId === "rq-262-ply");
  const inv = s.invoices.filter((i) => i.poId === "PO-262-01");
  if (!req) return null;
  return (
    <Card title="PO-262-01 receipt matching" right={<Go to={{ page: "Purchasing", tab: "deliveries", job: "FW-262" }}>Open deliveries</Go>}>
      <div className="fj-row" style={{ marginBottom: 10 }}>
        <Pill tone={shortQty(s, req.id) ? "warn" : "ok"}>{receivedQty(s, req.id)} of {req.qty} {req.unit}s received</Pill>
        <span className="fj-dim">{req.item}, FW-262, buyer {personName(s, s.pos.find((p) => p.id === req.poId)?.buyerId ?? "joyce")}</span>
      </div>
      <Table
        cols={[{ label: "Receipt" }, { label: "Qty", align: "right" }, { label: "By" }, { label: "When" }]}
        rows={rcpts.map((r) => [r.ref, r.qty, r.by, fmtStamp(r.at)])}
        empty="No deliveries matched yet."
      />
      {inv.length > 0 && <div className="fj-note">Invoice {inv[0].ref}: {inv[0].qty} sheets, {eur(inv[0].total)}, {inv[0].status}. The receipt sets the quantity and the invoice sets the cost, so nothing is counted twice.</div>}
    </Card>
  );
}

function Margin({ s }: { s: FState }) {
  const c = jobCosts(s, "FW-261");
  return (
    <Card title="Burger fit-out: quote against forecast" right={<Go to={{ page: "Job Costing", tab: "forecast", job: "FW-261" }}>Open the extra 32h allowance</Go>}>
      <Table
        cols={[{ label: "" }, { label: "Cost", align: "right" }, { label: "Margin", align: "right" }]}
        rows={[
          ["Quote", <span key="a" className="fj-num">{eur(c.quoteCost)}</span>, <span key="b" className="fj-num">{pct(c.quoteMargin)}</span>],
          ["Forecast", <span key="c" className="fj-num">{eur(c.forecast)}</span>, <b key="d" className="fj-num" style={{ color: c.slip >= 1 ? "var(--bad)" : "var(--ok)" }}>{pct(c.forecastMargin)}</b>],
          ["Difference", <span key="e" className="fj-num">{eur(c.forecast - c.quoteCost, true)}</span>, <span key="f" className="fj-num">{c.slip.toFixed(1)} points</span>],
        ]}
      />
      <div className="fj-note">32 extra workshop hours at {eur(45)} = {eur(1440)}. Review the estimate or start a priced variation.</div>
    </Card>
  );
}

function Programme({ s }: { s: FState }) {
  const draft = s.drafts[s.drafts.length - 1];
  const card = agents(s).find((a) => a.id === "programme");
  const text = draft ? draft.text : card?.suggestion ?? "";
  return (
    <Card title="Local draft message to Victor" right={<Pill tone="warn">{s.settings.sendingEnabled ? "Sending on" : "Sending disabled in this demo"}</Pill>}>
      <blockquote className="fj-quote">{text}</blockquote>
      {draft ? <div className="fj-note">Trigger: {draft.trigger}</div> : <div className="fj-note">Pending suggestion. It becomes a draft once the design fee is recorded.</div>}
      <div className="fj-row" style={{ marginTop: 12 }}>
        <Btn kind="primary" onClick={() => openStandalone("portal", "FW-263", "programme")}>Preview client entry</Btn>
        <span className="fj-faint">Opens the client programme in a new window. Nothing is sent.</span>
      </div>
    </Card>
  );
}

function Ask({ s, name }: { s: FState; name: string }) {
  const [text, setText] = useState("");
  const [asked, setAsked] = useState("");
  const a = asked ? answer(s, asked) : null;
  return (
    <Card title={"Ask " + name}>
      <form className="fj-row" onSubmit={(e) => { e.preventDefault(); setAsked(text.trim()); }}>
        <input className="fj-search" style={{ maxWidth: "none" }} value={text} onChange={(e) => setText(e.target.value)} aria-label={"Ask " + name} placeholder="What can we build today?" />
        <Btn type="submit" kind="primary" disabled={!text.trim()}>Ask</Btn>
      </form>
      {a && (
        <div style={{ marginTop: 12 }}>
          <div className="fj-quote">{a.text}</div>
          <div className="fj-faint" style={{ margin: "6px 0 8px" }}>Answered locally from the records ({a.tool}). No outside service.</div>
          {a.cols && a.rows && a.rows.length > 0 && <Table cols={a.cols.map((c) => ({ label: c }))} rows={a.rows} />}
          <div className="fj-row" style={{ marginTop: 8 }}>{a.actions.map((x) => <Go key={x.label} to={x.link} kind="btn">{x.label}</Go>)}</div>
        </div>
      )}
    </Card>
  );
}

export default function AgentsView({ tab }: { tab: string; job?: string }) {
  const s = useForja();
  const all = agents(s);
  const card = all.find((a) => a.id === tab) ?? all[0];
  return (
    <Page title={card.name} sub={card.remit} actions={<DemoBadge />}>
      <div className="fj-ag">
        <Card>
          <nav className="fj-ag-nav" aria-label="Agents">
            {all.map((a) => (
              <button key={a.id} type="button" className={a.id === card.id ? "on" : ""} aria-current={a.id === card.id ? "page" : undefined} onClick={() => navigate({ page: "Agents", tab: a.id })}>
                <span>{a.name}</span>
                <span className="fj-faint">{a.lastRun}</span>
              </button>
            ))}
          </nav>
        </Card>
        <div className="fj-stack">
          <Card title="Latest run" right={<span className="fj-num fj-dim" style={{ fontSize: 12.5 }}>{card.lastRun}</span>}>
            <div className="fj-quote">{card.suggestion}</div>
            <div className="fj-note">{card.body}</div>
            <h3 style={{ margin: "14px 0 6px", fontSize: 12, color: "var(--faint)", letterSpacing: ".06em", textTransform: "uppercase" }}>Evidence</h3>
            <ul className="fj-rowlist">
              {card.evidence.map((e, i) => <li key={i}><span>{e}</span></li>)}
            </ul>
            <div style={{ marginTop: 12 }}><Go to={card.link} kind="btn">{card.linkLabel}</Go></div>
            <div className="fj-faint" style={{ marginTop: 10 }}>Agents suggest and people confirm. Responses come from the records in this demo only.</div>
          </Card>
          {card.id === "briefing" && <Briefing s={s} />}
          {card.id === "watchdog" && <Watchdog s={s} />}
          {card.id === "planner" && <Planner s={s} card={card} />}
          {card.id === "materials" && <Materials s={s} />}
          {card.id === "margin" && <Margin s={s} />}
          {card.id === "programme" && <Programme s={s} />}
          <Ask s={s} name={card.name} />
        </div>
      </div>
    </Page>
  );
}
