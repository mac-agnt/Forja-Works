import { useEffect, useState } from "react";

export interface Route { page: string; tab?: string; job?: string }
export type Parsed =
  | { kind: "app"; route: Route }
  | { kind: "tv"; job?: string }
  | { kind: "phone"; job?: string }
  | { kind: "portal"; job: string; tab: string };

export const TABS: Record<string, { id: string; label: string }[]> = {
  Estimates: [{ id: "enquiries", label: "Enquiries" }, { id: "quotes", label: "Quotes" }, { id: "fit", label: "Fit review" }, { id: "variations", label: "Variations" }],
  Jobs: [{ id: "live", label: "Live jobs" }, { id: "programme", label: "Programme" }, { id: "drawings", label: "Drawings & sign-off" }, { id: "snags", label: "Installation & snags" }],
  Workshop: [{ id: "today", label: "Today" }, { id: "capacity", label: "Capacity" }, { id: "packs", label: "Work packs" }, { id: "eod", label: "End of day" }],
  Purchasing: [{ id: "requirements", label: "Requirements" }, { id: "orders", label: "Orders" }, { id: "deliveries", label: "Deliveries" }, { id: "shortages", label: "Shortages" }],
  "Job Costing": [{ id: "forecast", label: "Forecast" }, { id: "ledger", label: "Job ledger" }, { id: "payments", label: "Payments" }, { id: "capture", label: "Cost capture" }],
  Dashboard: [{ id: "owner", label: "Owner" }, { id: "production", label: "Production" }, { id: "commercial", label: "Commercial" }],
  Work: [{ id: "mine", label: "My work" }, { id: "approvals", label: "Approvals" }, { id: "exceptions", label: "Exceptions" }, { id: "schedule", label: "Schedule" }],
  Agents: [{ id: "briefing", label: "Briefing" }, { id: "watchdog", label: "Ops Watchdog" }, { id: "planner", label: "Workshop Planner" }, { id: "materials", label: "Materials" }, { id: "margin", label: "Margin Review" }, { id: "programme", label: "Client Programme" }],
  Activity: [{ id: "feed", label: "Company feed" }, { id: "jobs", label: "By job" }, { id: "agents", label: "Agent runs" }],
  Settings: [{ id: "organisation", label: "Organisation" }, { id: "teams", label: "Teams & permissions" }, { id: "systems", label: "Systems & integrations" }, { id: "governance", label: "Governance & AI" }, { id: "experience", label: "Experience" }],
};
export const RECORD_TABS = [{ id: "ontology", label: "Ontology" }, { id: "files", label: "Files" }, { id: "contacts", label: "Contacts" }, { id: "jobs", label: "Jobs" }, { id: "clients", label: "Clients" }, { id: "people", label: "People" }, { id: "suppliers", label: "Suppliers" }];
export const FORJA_RECORD_TABS = ["jobs", "clients", "people", "suppliers"];
export const FORJA_PAGES = Object.keys(TABS);

export function hashFor(r: Route): string {
  const parts = [r.page, r.tab, r.job].filter(Boolean).map((x) => encodeURIComponent(x as string));
  return "#/" + parts.join("/");
}
export function parseHash(h: string): Parsed {
  const parts = h.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "tv") return { kind: "tv", job: parts[1] };
  if (parts[0] === "phone") return { kind: "phone", job: parts[1] };
  if (parts[0] === "portal") return { kind: "portal", job: parts[1] ?? "FW-263", tab: parts[2] ?? "programme" };
  if (!parts.length) return { kind: "app", route: { page: "Home" } };
  return { kind: "app", route: { page: parts[0], tab: parts[1], job: parts[2] } };
}
export function navigate(r: Route) {
  if (typeof window === "undefined") return;
  const h = hashFor(r);
  if (window.location.hash !== h) window.location.hash = h;
  else window.dispatchEvent(new HashChangeEvent("hashchange"));
}
export function portalUrl(job: string, tab = "programme") { return "#/portal/" + job + "/" + tab; }
export function openStandalone(kind: "tv" | "phone" | "portal", job?: string, tab?: string) {
  const h = kind === "portal" ? portalUrl(job ?? "FW-263", tab) : "#/" + kind + (job ? "/" + job : "");
  const url = window.location.href.split("#")[0] + h;
  window.open(url, "_blank", "noopener");
}
export function useHash(): Parsed {
  const [p, setP] = useState<Parsed>(() => parseHash(typeof window === "undefined" ? "" : window.location.hash));
  useEffect(() => {
    const fn = () => setP(parseHash(window.location.hash));
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  return p;
}
export const defaultTab = (page: string) => TABS[page]?.[0]?.id;
