import { useState } from "react";
import { Page, Card, Pill, Stat, Grid, Table, Bar, DemoBadge, Go, JobLink, Empty } from "../ui";
import type { Tone } from "../ui";
import { useForja } from "../store";
import { kpis, jobSummary, jobCosts, dayPlanned, dayAvail, WORK_DAYS, pct, fmtDate, TODAY } from "../derive";

type DashTab = "owner" | "production" | "commercial";

const TITLES: Record<DashTab, { title: string; sub: string }> = {
  owner: { title: "Owner dashboard", sub: "Decisions waiting on Caio, margin slips, held jobs and the seven live jobs." },
  production: { title: "Production dashboard", sub: "Ready packs, today's load, the week's demand against crew hours, and shortages." },
  commercial: { title: "Commercial dashboard", sub: "Forecast margin, changes awaiting client acceptance, payments due and open enquiries." },
};

const tone = (t: "ok" | "warn" | "bad" | "info"): Tone => t;

export default function DashboardView({ tab }: { tab: string; job?: string }) {
  const s = useForja();
  const t: DashTab = tab === "production" || tab === "commercial" ? tab : "owner";
  const [openKey, setOpenKey] = useState<string | null>(null);
  const list = kpis(s)[t];
  const open = list.find((k) => openKey === t + ":" + k.id) ?? null;
  const showMargin = t !== "production";

  const jobRows = s.jobs.map((j) => {
    const sm = jobSummary(s, j);
    const c = jobCosts(s, j.code);
    return [
      <JobLink key="c" code={j.code} />,
      j.name,
      <Pill key="s" tone={tone(sm.tone)}>{sm.state}</Pill>,
      sm.next,
      sm.owner,
      ...(showMargin ? [j.code === "FW-263" ? <span key="m" className="fj-faint">Design fee only</span> : <span key="m" className="fj-num">{pct(c.forecastMargin)}{c.slip >= 1 ? " (quoted " + pct(c.quoteMargin) + ")" : ""}</span>] : []),
    ];
  });
  const jobCols = [{ label: "Job" }, { label: "Name" }, { label: "Status" }, { label: "Next action" }, { label: "Owner" }, ...(showMargin ? [{ label: "Forecast margin" }] : [])];

  return (
    <Page
      title={TITLES[t].title}
      sub={TITLES[t].sub}
      actions={<><DemoBadge /><Pill>Tue 24 Nov 2026</Pill></>}
    >
      <div className="fj-stack">
        <Grid cols={4}>
          {list.map((k) => (
            <Stat
              key={k.id}
              label={k.label}
              value={k.value}
              sub={k.sub + (openKey === t + ":" + k.id ? " (showing rows)" : "")}
              tone={k.tone}
              onClick={() => setOpenKey(openKey === t + ":" + k.id ? null : t + ":" + k.id)}
            />
          ))}
        </Grid>

        {open ? (
          <Card
            className="fj-kpi-panel"
            title={open.label + ": " + open.rows.length + (open.rows.length === 1 ? " row" : " rows")}
            right={<button type="button" className="fj-btn fj-ghost fj-small" onClick={() => setOpenKey(null)}>Close</button>}
          >
            {open.rows.length === 0 ? (
              <Empty text="Nothing behind this number right now." />
            ) : (
              <ul className="fj-rowlist">
                {open.rows.map((r, i) => (
                  <li key={i}>
                    <Go to={r.link}>{r.label}</Go>
                    <span className="fj-r-d">{r.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <div className="fj-faint">Select a number to see the rows behind it.</div>
        )}

        {t === "production" && (
          <Card title="Booked against available crew hours" right={<Go to={{ page: "Workshop", tab: "capacity" }}>Open capacity</Go>}>
            {WORK_DAYS.map((d) => {
              const p = dayPlanned(s, d), a = dayAvail(s, d);
              const over = p > a;
              return (
                <div key={d} className="fj-capday">
                  <span>{fmtDate(d)}{d === TODAY ? " (today)" : ""}</span>
                  <Bar value={p} max={Math.max(a, p)} tone={over ? "bad" : p === a ? "warn" : "ok"} />
                  <span className="fj-num" style={{ textAlign: "right", color: over ? "var(--bad)" : undefined }}>{p}/{a}h{over ? ", over " + (p - a) + "h" : ""}</span>
                </div>
              );
            })}
          </Card>
        )}

        {t === "owner" && (
          <Card title="Jobs requiring a decision" right={<Go to={{ page: "Work", tab: "exceptions" }}>All exceptions</Go>}>
            {list[0].rows.length === 0 ? (
              <Empty text="No decisions waiting on Caio." />
            ) : (
              <ul className="fj-rowlist">
                {list[0].rows.map((r, i) => (<li key={i}><Go to={r.link}>{r.label}</Go><span className="fj-r-d">{r.detail}</span></li>))}
              </ul>
            )}
          </Card>
        )}

        <Card title="All seven jobs" flush right={<Go to={{ page: "Jobs", tab: "live" }}>Open live jobs</Go>}>
          <Table cols={jobCols} rows={jobRows} />
        </Card>
      </div>
    </Page>
  );
}
