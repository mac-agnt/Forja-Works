import { useEffect, useRef, useState } from "react";
import { useForja, demoNow } from "../store";
import { eventsSorted, tvRows } from "../derive";
import { fmtStamp } from "../dates";
import Wordmark from "../Wordmark";

const DEFAULT_FOCUS = "FW-261";

export default function Tv({ job }: { job?: string; tab?: string }) {
  const s = useForja();
  const [, setTick] = useState(0);
  const focusRef = useRef<HTMLButtonElement | null>(null);
  const focus = job ?? s.ui.tvJob ?? DEFAULT_FOCUS;
  const rows = tvRows(s);
  const last = eventsSorted(s)[0];
  const large = s.settings.tvLargeType;

  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    focusRef.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [focus]);

  const openJob = (code: string) => {
    window.open(window.location.href.split("#")[0] + "#/Jobs/live/" + code, "_blank", "noopener");
  };
  const firstFocus = rows.findIndex((r) => r.jobId === focus);

  return (
    <div data-theme="forja" className={"fjtv" + (large ? " fjtv-large" : "")}>
      <header className="fjtv-top">
        <Wordmark height={40} />
        <div className="fjtv-title">Workshop board</div>
        <div className="fjtv-clock" aria-live="off">{fmtStamp(demoNow(s))}</div>
        <span className="fjtv-demo">Demo data</span>
      </header>
      <main className="fjtv-main">
        <div className="fjtv-head" aria-hidden="true">
          <span>Job</span><span>Work and next action</span><span>Station and lead</span><span>Revision</span><span>State</span><span>Due</span>
        </div>
        {rows.length === 0 && <div className="fjtv-empty">No live packs on the board.</div>}
        {rows.map((r, i) => {
          const isFocus = r.jobId === focus;
          return (
            <button
              key={r.jobId + i}
              type="button"
              ref={i === firstFocus ? focusRef : undefined}
              className={"fjtv-row fjtv-" + r.tone + (isFocus ? " fjtv-focus" : "")}
              onClick={() => openJob(r.jobId)}
              aria-label={"Open " + r.jobId + " in the app"}
            >
              <span className="fjtv-code">{r.jobId}</span>
              <span className="fjtv-what"><b>{r.jobName}</b><span>{r.next}</span></span>
              <span className="fjtv-who"><span>{r.station}</span><span>Lead: {r.lead}</span></span>
              <span className="fjtv-rev">{r.rev}<small>v{r.version}</small></span>
              <span className="fjtv-state"><span className={"fjtv-badge fjtv-b-" + r.tone}>{r.status}</span></span>
              <span className="fjtv-due">{r.due}</span>
            </button>
          );
        })}
      </main>
      <footer className="fjtv-foot">
        <span>{last ? "Last update " + fmtStamp(last.at) + ": " + last.text : "No updates yet"}</span>
        <span>Tap a row to open the job</span>
      </footer>
    </div>
  );
}
