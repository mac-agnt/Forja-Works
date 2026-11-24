import { useState } from "react";
import Wordmark from "../Wordmark";
import { actions, useForja } from "../store";
import { designWhatIf, eur, fmtDate, fmtDateLong, portalPayload, type PortalPayload } from "../derive";
import { addDays, fmtStamp } from "../dates";
import { navigate, portalUrl } from "../nav";
import type { Actor } from "../types";
import DrawingView from "./DrawingView";

/* Client view. Reads only portalPayload(); actions run as the client. No staff shell, no other jobs. */

const TABS = [
  { id: "programme", label: "Programme" },
  { id: "drawings", label: "Drawings" },
  { id: "payments", label: "Payments and changes" },
  { id: "snags", label: "Snags" },
];
const WHAT_IF_DATES = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"];

const plain = (t: string) => t.replace(/^Client pays/, "You pay").replace(/^Client approves/, "You approve").replace(/^Client confirms/, "You confirm").replace(/^Client /, "You ");
const chipTone = (st: string) => (st === "Paid" || st === "Accepted" || st === "Approved" || st === "Confirmed" ? "ok" : st === "Due" || st.startsWith("Awaiting") || st.startsWith("Fixed") ? "warn" : st === "Declined" || st === "Changes requested" ? "bad" : "");

export default function Portal({ job, tab }: { job?: string; tab?: string }) {
  const s = useForja();
  const code = job ?? "FW-263";
  const p = portalPayload(s, code);
  const cur = TABS.some((t) => t.id === tab) ? (tab as string) : "programme";

  const exit = () => navigate({ page: "Jobs", tab: "live", job: code });
  return (
    <div className="fjp" data-theme="light">
      <header className="fjp-bar">
        <div className="fjp-bar-in">
          <div className="fjp-row" style={{ gap: 16 }}>
            <Wordmark height={28} />
            <div className="fjp-job">{p ? p.name : "Job not found"}{p && <small>{p.clientName}</small>}</div>
          </div>
          <button type="button" className="fjp-exit" onClick={exit}>Exit preview</button>
        </div>
      </header>
      <main className="fjp-main">
        {!p ? (
          <section className="fjp-card"><h2>We could not find that job</h2><p className="fjp-muted">Check the link you were sent, or ask Forja Works for a new one.</p></section>
        ) : (
          <>
            <p className="fjp-hello">Hello {p.contact.split(" ")[0]}. Here is where your project stands.</p>
            <Hero p={p} />
            <nav className="fjp-tabs" aria-label="Sections">
              {TABS.map((t) => <a key={t.id} href={portalUrl(code, t.id)} aria-current={cur === t.id ? "page" : undefined}>{t.label}</a>)}
            </nav>
            {cur === "programme" && <Programme p={p} />}
            {cur === "drawings" && <Drawings p={p} />}
            {cur === "payments" && <Payments p={p} code={code} />}
            {cur === "snags" && <Snags p={p} />}
            <div className="fjp-foot">Payments are recorded by Forja Works. This is a demo with illustrative data.</div>
          </>
        )}
      </main>
    </div>
  );
}

function Hero({ p }: { p: PortalPayload }) {
  const fee = p.designFee?.outstanding;
  const text = fee ? "Pay the " + eur(p.designFee?.amount ?? 0) + " design fee to start your design" : plain(p.next.text);
  return (
    <section className={"fjp-card fjp-hero" + (p.next.ownedByClient ? "" : " fjp-wait")} aria-label="Your next action">
      <div className="fjp-eyebrow">Your next action</div>
      <p className="big">{text}</p>
      <dl className="fjp-meta">
        <div><dt>Who needs to act</dt><dd>{p.next.owedBy}</dd></div>
        <div><dt>What it affects</dt><dd>{p.next.affects || "Nothing is waiting on you"}</dd></div>
      </dl>
    </section>
  );
}

/* ── programme ── */
function Programme({ p }: { p: PortalPayload }) {
  const [day, setDay] = useState("2026-11-24");
  const [demo, setDemo] = useState(false);
  const fee = p.designFee;
  const w = designWhatIf(day);
  const dependent = p.programme.filter((x, i) => i > 0 && !x.fixed);
  const first = p.programme[0];
  return (
    <>
      {fee?.outstanding && (
        <section className="fjp-card">
          <h2>Pay {eur(fee.amount)} to start design</h2>
          <p className="fjp-muted">Your design is ready 7 calendar days after we receive the fee. The day we receive it is day zero.</p>
          <div role="group" aria-label="What if I pay on" className="fjp-dates">
            {WHAT_IF_DATES.map((d) => <button key={d} type="button" className="fjp-date" aria-pressed={day === d} onClick={() => setDay(d)}>{fmtDate(d)}</button>)}
          </div>
          <div className="fjp-note" aria-live="polite">
            <b>If you pay on {fmtDate(day)}</b>, your design is ready on <b>{fmtDateLong(w.target)}</b>.
            {w.delay > 0 && dependent.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {dependent.map((x) => <li key={x.label}>{x.label}: {fmtDate(addDays(x.date, w.delay))} (now {fmtDate(x.date)})</li>)}
              </ul>
            )}
            {w.delay === 0 && <div>That keeps every date as planned.</div>}
            <div className="fjp-muted" style={{ marginTop: 6 }}>This is only a preview. Nothing is changed or paid.</div>
          </div>
          <div className="fjp-row" style={{ marginTop: 14 }}>
            <button type="button" className="fjp-btn fjp-primary" onClick={() => setDemo(true)}>Pay now (demo)</button>
          </div>
          {demo && <div className="fjp-note warn" role="status" style={{ marginTop: 10 }}>Demo only: no payment is taken here. Forja Works records your payment when it arrives, and your design clock starts that day.</div>}
        </section>
      )}
      {fee && !fee.outstanding && fee.target && (
        <section className="fjp-card">
          <h2>Design started</h2>
          <p style={{ margin: "4px 0" }}>Your design is ready on <b>{fmtDateLong(fee.target)}</b>.</p>
          {first?.baseline && <div className="fjp-note">The original date, {fmtDate(first.baseline)}, is kept on record. {first.reason ? first.reason + "." : ""}</div>}
        </section>
      )}
      <section className="fjp-card">
        <h2>Your programme</h2>
        <ul className="fjp-list">
          {p.programme.map((x, i) => (
            <li key={i}>
              <div>
                <div className="t">{x.label}</div>
                {x.baseline && <div className="s">Was {fmtDate(x.baseline)}. {x.reason}.</div>}
                {x.fixed && <div className="s">This date is fixed and will not move.</div>}
              </div>
              <div className="r">
                <div className="t">{fmtDate(x.date)}</div>
                <span className={"fjp-chip " + (x.state === "done" ? "ok" : x.state === "next" ? "info" : "")}>{x.fixed ? "Fixed date" : x.state === "done" ? "Done" : x.state === "next" ? "Next" : "Planned"}</span>
              </div>
            </li>
          ))}
        </ul>
        {p.programme.length === 0 && <p className="fjp-muted">Your programme is added once your design is agreed.</p>}
      </section>
    </>
  );
}

/* ── drawings ── */
function Drawings({ p }: { p: PortalPayload }) {
  const [asking, setAsking] = useState(false);
  const [comment, setComment] = useState("");
  const d = p.drawing;
  const client: Actor = { role: "client", name: p.contact };
  if (!d) return <section className="fjp-card"><h2>Drawings</h2><p className="fjp-muted">Your first drawing will appear here when your design is ready.</p></section>;
  const approvedAt = d.approvedOn && /^\d+$/.test(d.approvedOn) ? fmtStamp(Number(d.approvedOn)) : "";
  return (
    <>
      <section className="fjp-card">
        <div className="fjp-row" style={{ justifyContent: "space-between" }}>
          <h2>{d.rev}: {d.title}</h2>
          <span className={"fjp-chip " + chipTone(d.status)}>{d.status}</span>
        </div>
        {d.openingMm !== undefined && <DrawingView openingMm={d.openingMm} title={d.rev + " front elevation"} plain />}
        <p>{d.note}</p>
        {d.status === "Approved" && (
          <div className="fjp-row"><span className="fjp-stamp">Approved by {p.contact}</span><span className="fjp-muted">{approvedAt}</span></div>
        )}
        {d.status === "Changes requested" && (
          <div className="fjp-note warn"><b>Sent back to your designer.</b> They act next and will send a new version for you to review.{d.comment ? " Your comment: " + d.comment : ""}</div>
        )}
        {d.actionable && !asking && (
          <div className="fjp-row" style={{ marginTop: 8 }}>
            <button type="button" className="fjp-btn fjp-primary" onClick={() => actions.approveRevision(d.id, client)}>Approve {d.rev}</button>
            <button type="button" className="fjp-btn" onClick={() => setAsking(true)}>Request changes</button>
          </div>
        )}
        {d.actionable && asking && (
          <div style={{ marginTop: 10 }}>
            <label className="lbl" htmlFor="chg">What should change? (required)</label>
            <textarea id="chg" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="fjp-row" style={{ marginTop: 10 }}>
              <button type="button" className="fjp-btn fjp-primary" disabled={!comment.trim()} onClick={() => { const r = actions.requestChanges(d.id, comment, client); if (r.ok) { setAsking(false); setComment(""); } }}>Send to my designer</button>
              <button type="button" className="fjp-btn fjp-plain" onClick={() => setAsking(false)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
      <section className="fjp-card">
        <h2>Earlier versions</h2>
        <ul className="fjp-list">
          {p.drawingHistory.map((h, i) => <li key={i}><span className="t">{h.rev}</span><span className={"fjp-chip " + chipTone(h.status)}>{h.status}</span></li>)}
        </ul>
      </section>
    </>
  );
}

/* ── payments and changes ── */
function Payments({ p, code }: { p: PortalPayload; code: string }) {
  const client: Actor = { role: "client", name: p.contact };
  const varIds = p.variations.map((v) => v.id);
  const isVar = (id: string) => varIds.some((v) => id.endsWith(v));
  const design = p.payments.filter((x) => x.isDesignFee);
  const agreed = p.payments.filter((x) => !x.isDesignFee && isVar(x.id));
  const build = p.payments.filter((x) => !x.isDesignFee && !isVar(x.id));
  const Row = ({ x }: { x: PortalPayload["payments"][number] }) => (
    <li><div><div className="t">{x.label}</div><div className="s">{x.note}</div></div><div className="r"><div className="t">{eur(x.amount, true && x.amount < 0)}</div><span className={"fjp-chip " + chipTone(x.status)}>{x.status}</span></div></li>
  );
  return (
    <>
      <section className="fjp-card">
        <h2>Payments</h2>
        <p className="fjp-muted">No card details are taken here. Forja Works records each payment when it arrives.</p>
        {design.length > 0 && <><h3 style={{ marginTop: 14 }}>Design fee</h3><ul className="fjp-list">{design.map((x) => <Row key={x.id} x={x} />)}</ul></>}
        {build.length > 0 && <><h3 style={{ marginTop: 14 }}>Build payments</h3><ul className="fjp-list">{build.map((x) => <Row key={x.id} x={x} />)}</ul></>}
        {agreed.length > 0 && <><h3 style={{ marginTop: 14 }}>Agreed changes</h3><ul className="fjp-list">{agreed.map((x) => <Row key={x.id} x={x} />)}</ul></>}
        {p.payments.length === 0 && <p className="fjp-muted">Your payment schedule is added once the quote is agreed.</p>}
      </section>
      <section className="fjp-card">
        <h2>Changes to your job</h2>
        {p.variations.length === 0 ? <p className="fjp-muted">No changes proposed.</p> : (
          <ul className="fjp-list">
            {p.variations.map((v) => (
              <li key={v.id} style={{ flexDirection: "column" }}>
                <div className="fjp-row" style={{ justifyContent: "space-between", width: "100%" }}>
                  <div><div className="t">{v.title}</div><div className="s">{v.note}</div></div>
                  <div className="r"><div className="t">{(v.amount >= 0 ? "+" : "") + eur(v.amount)}</div><span className={"fjp-chip " + chipTone(v.status)}>{v.status}</span></div>
                </div>
                {v.status === "Awaiting your decision" && (
                  <div className="fjp-row">
                    <button type="button" className="fjp-btn fjp-primary" onClick={() => actions.acceptVariation(v.id, client)}>Accept {eur(v.amount)}</button>
                    <button type="button" className="fjp-btn fjp-plain" onClick={() => actions.declineVariation(v.id, client)}>Decline</button>
                  </div>
                )}
                {v.status === "Accepted" && (
                  <div className="fjp-note ok" style={{ width: "100%" }}>Agreed additional price {eur(v.amount)}, paid on its own line above. A revised drawing needs your sign-off. <a href={portalUrl(code, "drawings")}>Review the drawing</a></div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/* ── snags ── */
function Snags({ p }: { p: PortalPayload }) {
  const client: Actor = { role: "client", name: p.contact };
  const all = p.snags.length > 0 && p.snags.every((x) => x.status === "Confirmed");
  const final = p.payments.find((x) => x.label.toLowerCase().includes("snag sign-off"));
  if (p.snags.length === 0) return <section className="fjp-card"><h2>Snags</h2><p className="fjp-muted">No snags to confirm.</p></section>;
  return (
    <section className="fjp-card">
      <h2>Snags</h2>
      <p className="fjp-muted">Confirm each item once you are happy it is fixed.</p>
      <ul className="fjp-list">
        {p.snags.map((x) => (
          <li key={x.id}>
            <div><div className="t">{x.title}</div><span className={"fjp-chip " + chipTone(x.status)}>{x.status}</span></div>
            <button type="button" className="fjp-btn fjp-primary" disabled={x.status !== "Fixed, please confirm"} onClick={() => actions.confirmSnag(x.id, client)}>{x.status === "Confirmed" ? "Confirmed" : "Confirm fixed"}</button>
          </li>
        ))}
      </ul>
      {all && <div className="fjp-note ok" role="status">Thank you, every snag is confirmed.{final ? " Your final payment of " + eur(final.amount) + " is now " + (final.status === "Paid" ? "paid" : "due") + "." : ""}</div>}
    </section>
  );
}
