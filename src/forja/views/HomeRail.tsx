import type { ReactNode } from "react";
import { Go, JobLink, Pill } from "../ui";
import { useForja } from "../store";
import type { FState, Pack } from "../types";
import { TODAY, briefing, eventsSorted, exceptions, fmtDate, fmtDateLong, jobOf, openTasks, packGates, personName } from "../derive";
import type { Link } from "../derive";
import { fmtStamp } from "../dates";

function RailCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="fj-rail-card"><h3>{title}</h3>{children}</section>;
}

function readyPack(s: FState): { pack: Pack | null; ready: boolean; why: string } {
  const live = s.packs.filter((p) => p.status !== "complete");
  const today = live.find((p) => (p.status === "ready" || p.status === "scheduled") && s.assignments.some((a) => a.packId === p.id && a.day === TODAY));
  if (today) return { pack: today, ready: true, why: "Booked for today" };
  const ready = live.find((p) => p.status === "ready");
  if (ready) return { pack: ready, ready: true, why: "Released, needs a slot" };
  const held = live.filter((p) => p.status === "held").sort((a, b) => packGates(s, a).filter((g) => !g.ok).length - packGates(s, b).filter((g) => !g.ok).length)[0];
  if (held) return { pack: held, ready: false, why: packGates(s, held).filter((g) => !g.ok).map((g) => g.detail).join("; ") };
  return { pack: null, ready: false, why: "" };
}

export default function HomeRail() {
  const s = useForja();
  const clauses = briefing(s);
  const exc = exceptions(s);
  const decisions: { label: string; link: Link }[] = [
    ...exc.filter((e) => e.route === "Caio").map((e) => ({ label: e.title, link: e.link })),
    ...openTasks(s).filter((t) => t.ownerId === "caio").map((t) => ({ label: t.title, link: t.link as Link })),
  ];
  const alerts = exc.filter((e) => e.severity === "high").slice(0, 2);
  const rp = readyPack(s);

  const installs = new Map<string, string>();
  s.assignments.filter((a) => a.kind === "install" && a.day >= TODAY).forEach((a) => { const d = installs.get(a.jobId); if (!d || a.day < d) installs.set(a.jobId, a.day); });
  s.jobs.filter((j) => j.installDate && j.installDate >= TODAY).forEach((j) => { if (!installs.has(j.code)) installs.set(j.code, j.installDate as string); });
  const upcoming = [...installs.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const evs = eventsSorted(s);
  const latest = evs.find((e) => !/^e\d+$/.test(e.id));
  const last = latest ?? evs[0];

  return (
    <aside style={{ position: "relative", zIndex: 1, width: "352px", flex: "none", minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px", padding: "2px 0 6px 20px" }}>
      <RailCard title="Briefing">
        <div className="fj-rail-d">{fmtDateLong(TODAY)}</div>
        <ul>
          {clauses.map((c, i) => (
            <li key={i}><Go to={c.link}>{c.text}</Go> <Pill tone={c.done ? "ok" : "warn"}>{c.done ? "Done" : "Open"}</Pill></li>
          ))}
        </ul>
      </RailCard>

      <RailCard title={"Decisions due (" + decisions.length + ")"}>
        {decisions.length === 0 ? <div className="fj-dim" style={{ fontSize: 12.5 }}>Nothing waiting on Caio.</div> : (
          <ul>{decisions.slice(0, 4).map((d, i) => <li key={i}><Go to={d.link}>{d.label}</Go></li>)}</ul>
        )}
      </RailCard>

      <RailCard title="Priority alerts">
        {alerts.length === 0 ? <div className="fj-dim" style={{ fontSize: 12.5 }}>No high priority alerts.</div> : (
          <ul>{alerts.map((e) => <li key={e.id}><Go to={e.link}>{e.title}</Go></li>)}</ul>
        )}
      </RailCard>

      <RailCard title={rp.ready ? "Ready for the floor" : "Ready for the floor: none yet"}>
        {rp.pack ? (
          <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
            <div><JobLink code={rp.pack.jobId} /> <Go to={{ page: "Workshop", tab: "packs", job: rp.pack.jobId }}>{rp.pack.label}</Go></div>
            <div className="fj-dim">{rp.ready ? rp.why : "Closest: " + rp.why}</div>
          </div>
        ) : <div className="fj-dim" style={{ fontSize: 12.5 }}>No open packs.</div>}
      </RailCard>

      <RailCard title="Upcoming installs">
        {upcoming.length === 0 ? <div className="fj-dim" style={{ fontSize: 12.5 }}>No installs booked.</div> : (
          <ul>{upcoming.map(([code, day]) => <li key={code}><JobLink code={code} /> {jobOf(s, code)?.name} <span className="fj-dim">{fmtDate(day)}</span></li>)}</ul>
        )}
      </RailCard>

      <RailCard title={latest ? "Latest completed action" : "Latest in the log"}>
        {last ? (
          <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
            <div>{last.ref ? <Go to={last.ref}>{last.text}</Go> : last.text}</div>
            <div className="fj-dim">{last.actor}, {fmtStamp(last.at)}{last.jobId ? "" : ""}</div>
          </div>
        ) : <div className="fj-dim" style={{ fontSize: 12.5 }}>Nothing logged yet.</div>}
      </RailCard>

      <RailCard title="Try asking in the chat">
        <ul className="fj-dim">
          <li>What can we build today?</li>
          <li>Which job is losing margin?</li>
          <li>What are we waiting on clients for?</li>
        </ul>
        <span className="fj-faint">{personName(s, s.ui.person)} is viewing.</span>
      </RailCard>
    </aside>
  );
}
