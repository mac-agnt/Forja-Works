import type { ReactNode } from "react";
import type { FState, Job, Revision } from "../types";
import { TODAY, programmeFor, personName } from "../derive";
import { diffDays } from "../dates";
import { can } from "../store";
import { roleHint, Pill, type Tone } from "../ui";
import { navigate } from "../nav";

export const STAGES: Job["stage"][] = ["Design", "Awaiting release", "Production", "Install", "Snagging", "Handover"];

/** package ids that have drawing revisions for a job, in issue order */
export function pkgIdsFor(s: FState, jobId: string): string[] {
  const out: string[] = [];
  s.revisions.filter((r) => r.jobId === jobId).forEach((r) => { if (!out.includes(r.packageId)) out.push(r.packageId); });
  return out;
}
export const revsOf = (s: FState, pkgId: string): Revision[] => s.revisions.filter((r) => r.packageId === pkgId);

export const REV_LABEL: Record<Revision["status"], string> = {
  awaiting: "Awaiting sign-off", approved: "Approved", changes: "Changes requested", superseded: "Superseded", withdrawn: "Withdrawn",
};
export const REV_TONE: Record<Revision["status"], Tone> = { awaiting: "warn", approved: "ok", changes: "bad", superseded: "neutral", withdrawn: "neutral" };
export function RevPill({ status }: { status: Revision["status"] }) { return <Pill tone={REV_TONE[status]}>{REV_LABEL[status]}</Pill>; }

/** next milestone: committed (baseline) vs forecast */
export function keyDates(s: FState, code: string) {
  const rows = programmeFor(s, code);
  const row = rows.find((r) => r.forecast >= TODAY) ?? rows[rows.length - 1];
  if (!row) return null;
  return { label: row.label, committed: row.baseline, forecast: row.forecast, moved: diffDays(row.forecast, row.baseline), kind: row.kind };
}
export function installDateOf(s: FState, job: Job): string | undefined {
  return job.installDate ?? programmeFor(s, job.code).find((r) => r.label.toLowerCase().startsWith("install"))?.forecast;
}
export function installCrew(s: FState, code: string): string[] {
  const ids = Array.from(new Set(s.assignments.filter((a) => a.jobId === code && a.kind === "install").map((a) => a.crewId)));
  if (ids.length) return ids.map((i) => personName(s, i));
  const lead = s.packs.find((p) => p.jobId === code)?.leadId;
  return lead ? [personName(s, lead)] : [];
}

/** one-line, visible reason when a role cannot act */
export function Hint({ action, role, extra }: { action: string; role: FState["ui"]["role"]; extra?: ReactNode }) {
  const h = roleHint(action, role);
  if (!h && !extra) return null;
  return <div className="fj-hint">{h}{h && extra ? " " : ""}{extra}</div>;
}
export const roleAllowed = can;

export function JobSelect({ value, tab, codes, s }: { value: string; tab: string; codes?: string[]; s: FState }) {
  const list = codes ?? s.jobs.map((j) => j.code);
  return (
    <label className="fj-role">
      <span>Job</span>
      <select value={value} onChange={(e) => navigate({ page: "Jobs", tab, job: e.target.value })} aria-label="Choose a job">
        {list.map((c) => <option key={c} value={c}>{c + " " + (s.jobs.find((j) => j.code === c)?.name ?? "")}</option>)}
      </select>
    </label>
  );
}
