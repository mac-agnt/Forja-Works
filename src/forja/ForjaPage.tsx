import type { ReactNode } from "react";
import { TABS, FORJA_RECORD_TABS } from "./nav";
import { Toaster } from "./ui";
import Estimates from "./views/Estimates";
import Jobs from "./views/Jobs";
import Workshop from "./views/Workshop";
import Purchasing from "./views/Purchasing";
import JobCosting from "./views/JobCosting";
import DashboardView from "./views/DashboardView";
import WorkView from "./views/WorkView";
import ActivityView from "./views/ActivityView";
import AgentsView from "./views/AgentsView";
import SettingsView from "./views/SettingsView";
import RecordsView from "./views/RecordsView";

export { FORJA_RECORD_TABS };

/** Renders one Forja screen. `page` and `tab` come from the shell. */
export default function ForjaPage({ page, tab, job }: { page: string; tab?: string; job?: string }) {
  const t = tab && (TABS[page] ?? []).some((x) => x.id === tab) ? tab : TABS[page]?.[0]?.id ?? "";
  let body: ReactNode = null;
  switch (page) {
    case "Estimates": body = <Estimates tab={t} job={job} />; break;
    case "Jobs": body = <Jobs tab={t} job={job} />; break;
    case "Workshop": body = <Workshop tab={t} job={job} />; break;
    case "Purchasing": body = <Purchasing tab={t} job={job} />; break;
    case "Job Costing": body = <JobCosting tab={t} job={job} />; break;
    case "Dashboard": body = <DashboardView tab={t} job={job} />; break;
    case "Work": body = <WorkView tab={t} job={job} />; break;
    case "Activity": body = <ActivityView tab={t} job={job} />; break;
    case "Agents": body = <AgentsView tab={t} job={job} />; break;
    case "Settings": body = <SettingsView tab={t} job={job} />; break;
    case "Records": body = <RecordsView tab={tab ?? "jobs"} job={job} />; break;
  }
  return <>{body}<Toaster /></>;
}
