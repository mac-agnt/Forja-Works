import { useState } from "react";
import { Page, Card, Pill, Go, JobLink, Table, Empty, DemoBadge } from "../ui";
import type { Tone } from "../ui";
import { useForja } from "../store";
import type { FEvent, FState } from "../types";
import { agents, eventsSorted, jobOf } from "../derive";
import { fmtStamp } from "../dates";

type Filter = "all" | "approvals" | "payments" | "receipts" | "packs" | "capacity" | "eod" | "agents";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" }, { id: "approvals", label: "Approvals" }, { id: "payments", label: "Payments" }, { id: "receipts", label: "Receipts" },
  { id: "packs", label: "Packs" }, { id: "capacity", label: "Capacity" }, { id: "eod", label: "End of day" }, { id: "agents", label: "Agents" },
];

const isAgent = (s: FState, e: FEvent) =>
  e.kind === "agent" || e.kind === "alert" || !!e.agent || agents(s).some((a) => a.name === e.actor);

function matches(s: FState, e: FEvent, f: Filter): boolean {
  switch (f) {
    case "all": return true;
    case "approvals": return ["approval", "revision", "variation", "snag"].includes(e.kind);
    case "payments": return e.kind === "payment";
    case "receipts": return e.kind === "receipt" || e.kind === "invoice";
    case "packs": return e.kind === "pack";
    case "capacity": return e.kind === "capacity";
    case "eod": return e.kind === "eod";
    case "agents": return isAgent(s, e);
  }
}

const kindTone = (k: string): Tone =>
  k === "approval" || k === "payment" || k === "receipt" ? "ok" : k === "alert" ? "bad" : k === "pack" || k === "capacity" || k === "agent" ? "info" : "neutral";

function EventRow({ e }: { e: FEvent }) {
  return (
    <div className="fj-ev">
      <div className="fj-ev-t">{fmtStamp(e.at)}</div>
      <div style={{ minWidth: 0 }}>
        <div className="fj-ev-x">{e.text}</div>
        <div className="fj-ev-m">
          <span>{e.actor}</span>
          {e.jobId && <JobLink code={e.jobId} />}
          <Pill tone={kindTone(e.kind)}>{e.kind}</Pill>
          {(e.from || e.to) && <span className="fj-num">{e.from ?? "none"} {"->"} {e.to ?? "none"}</span>}
        </div>
      </div>
      <div>{e.ref ? <Go to={e.ref}>Open record</Go> : null}</div>
    </div>
  );
}

function Feed({ s }: { s: FState }) {
  const [f, setF] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const all = eventsSorted(s);
  const needle = q.trim().toLowerCase();
  const list = all.filter((e) => matches(s, e, f) && (!needle || (e.text + " " + e.actor + " " + (e.jobId ?? "") + " " + e.kind + " " + (e.from ?? "") + " " + (e.to ?? "")).toLowerCase().includes(needle)));
  return (
    <div className="fj-stack">
      <div className="fj-row">
        <div className="fj-chips" role="group" aria-label="Filter by kind">
          {FILTERS.map((x) => (
            <button key={x.id} type="button" className={"fj-chip" + (f === x.id ? " on" : "")} aria-pressed={f === x.id} onClick={() => setF(x.id)}>
              {x.label} <b>{all.filter((e) => matches(s, e, x.id)).length}</b>
            </button>
          ))}
        </div>
        <input className="fj-search" type="search" placeholder="Search the feed" aria-label="Search the feed" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card title={list.length + " events, newest first"} flush right={<Pill tone="ok"><span className="fj-live">Live</span></Pill>}>
        {list.length ? list.map((e) => <EventRow key={e.id} e={e} />) : <Empty text="No events match." hint="Clear the search or pick All." />}
      </Card>
    </div>
  );
}

function ByJob({ s }: { s: FState }) {
  const all = eventsSorted(s);
  const codes = [...s.jobs.map((j) => j.code)];
  const groups = codes.map((c) => ({ c, ev: all.filter((e) => e.jobId === c) }));
  const general = all.filter((e) => !e.jobId);
  return (
    <div className="fj-stack">
      <div className="fj-row"><Pill tone="ok"><span className="fj-live">Live</span></Pill><span className="fj-faint">Grouped by job code, newest first. Open or close each group.</span></div>
      {groups.map((g) => (
        <details key={g.c} className="fj-card fj-details" open={g.ev.length > 0 && g.ev.some((e) => !/^e\d+$/.test(e.id))}>
          <summary>
            <span><JobLink code={g.c} /> {jobOf(s, g.c)?.name}</span>
            <span className="fj-faint">{g.ev.length} events{g.ev[0] ? ", latest " + fmtStamp(g.ev[0].at) : ""}</span>
          </summary>
          <div style={{ borderTop: "1px solid var(--border)" }}>
            {g.ev.length ? g.ev.map((e) => <EventRow key={e.id} e={e} />) : <Empty text="No events yet for this job." />}
          </div>
        </details>
      ))}
      <details className="fj-card fj-details">
        <summary><span>Company wide</span><span className="fj-faint">{general.length} events</span></summary>
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {general.length ? general.map((e) => <EventRow key={e.id} e={e} />) : <Empty text="No company wide events." />}
        </div>
      </details>
    </div>
  );
}

function AgentRuns({ s }: { s: FState }) {
  const runs = eventsSorted(s).filter((e) => isAgent(s, e));
  const cards = agents(s);
  return (
    <div className="fj-stack">
      <Card title="Last run of each agent" flush>
        <Table
          cols={[{ label: "Agent" }, { label: "Last run" }, { label: "What it suggests" }, { label: "Open" }]}
          rows={cards.map((a) => [
            <b key="n" style={{ color: "var(--ink)" }}>{a.name}</b>,
            <span key="r" className="fj-num">{a.lastRun}</span>,
            a.suggestion,
            <Go key="l" to={a.link}>{a.linkLabel}</Go>,
          ])}
        />
      </Card>
      <Card title={"Agent events (" + runs.length + ")"} flush right={<Pill tone="ok"><span className="fj-live">Live</span></Pill>}>
        {runs.length ? runs.map((e) => <EventRow key={e.id} e={e} />) : <Empty text="No agent events yet." />}
      </Card>
      <div className="fj-faint">Agents suggest. People confirm. Nothing here has been sent outside this demo.</div>
    </div>
  );
}

const TITLES: Record<string, { title: string; sub: string }> = {
  feed: { title: "Company feed", sub: "Every approval, payment, receipt, pack release, capacity move and end-of-day report, as it happens." },
  jobs: { title: "Activity by job", sub: "The same events, grouped under each job code." },
  agents: { title: "Agent runs", sub: "What each agent last did, and every event an agent raised." },
};

export default function ActivityView({ tab }: { tab: string; job?: string }) {
  const s = useForja();
  const k = TITLES[tab] ? tab : "feed";
  return (
    <Page title={TITLES[k].title} sub={TITLES[k].sub} actions={<DemoBadge />}>
      {k === "feed" && <Feed s={s} />}
      {k === "jobs" && <ByJob s={s} />}
      {k === "agents" && <AgentRuns s={s} />}
    </Page>
  );
}
