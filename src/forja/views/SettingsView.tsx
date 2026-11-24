import { useState } from "react";
import type { ReactNode } from "react";
import { Page, Card, Pill, Btn, Go, Table, RoleBar, DemoBadge } from "../ui";
import { actions, can, ROLE_LABEL, useForja } from "../store";
import type { Role } from "../types";
import { openStandalone } from "../nav";
import Wordmark from "../Wordmark";

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="fj-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}{hint && <small>{hint}</small>}</span>
    </label>
  );
}

function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <ul className="fj-rowlist">
      {rows.map(([k, v]) => (<li key={k}><span className="fj-dim">{k}</span><span style={{ textAlign: "right", color: "var(--ink)" }}>{v}</span></li>))}
    </ul>
  );
}

function Organisation() {
  return (
    <div className="fj-split">
      <div className="fj-stack">
        <Card title="Forja Works Limited">
          <KV rows={[
            ["Display name", "Forja Works"],
            ["Owner", "Caio Pazini"],
            ["Address", "202 Holly Rd, Fox-and-Geese, Dublin 12, D12 CX27"],
            ["Public email", "hello@forjaworks.com"],
            ["Workspace", <DemoBadge key="d" />],
          ]} />
        </Card>
        <Card title="Related organisations">
          <ul className="fj-rowlist">
            {["Studio Forja", "Forja Home", "Plastico Company"].map((n) => (<li key={n}><span>{n}</span><span className="fj-r-d">Related</span></li>))}
          </ul>
          <div className="fj-note">These are operationally combined for now. A job can carry a service tag (Forja Works, Studio Forja, Forja Home or Plastico Company) so work can be separated later without moving data.</div>
        </Card>
      </div>
      <div className="fj-stack">
        <Card title="Wordmark preview">
          <div className="fj-brand"><Wordmark height={44} /></div>
          <div className="fj-note">Shown on graphite.</div>
        </Card>
        <Card title="Brand tokens" right={<Pill tone="warn">Proposed demo tokens</Pill>}>
          <div className="fj-stack" style={{ gap: 10 }}>
            <div className="fj-swatch"><i style={{ background: "#202326" }} /> Graphite <span className="fj-mono fj-faint">#202326</span></div>
            <div className="fj-swatch"><i style={{ background: "#F7F6F2" }} /> Warm white <span className="fj-mono fj-faint">#F7F6F2</span></div>
            <div className="fj-swatch"><i style={{ background: "#176D67" }} /> Teal <span className="fj-mono fj-faint">#176D67</span></div>
          </div>
          <div className="fj-note">No official palette has been supplied. These are proposed for the demo only.</div>
        </Card>
      </div>
    </div>
  );
}

const MATRIX: { action: string; label: string }[] = [
  { action: "approveRevision", label: "Approve a revision (client preview only)" },
  { action: "confirmPayment", label: "Confirm a mock payment" },
  { action: "assignSlot", label: "Assign workshop slots" },
  { action: "confirmMove", label: "Confirm capacity moves" },
  { action: "issueRevision", label: "Issue a drawing revision" },
  { action: "eod", label: "Submit end of day" },
  { action: "passEnquiry", label: "Pass on an enquiry" },
];
const ROLES: Role[] = ["owner", "ops", "pm", "designer", "lead", "client"];

function Teams() {
  const s = useForja();
  return (
    <div className="fj-stack">
      <Card title="People and roles" flush right={<Pill tone="warn">Sample data, sending disabled</Pill>}>
        <Table
          cols={[{ label: "Name" }, { label: "Title" }, { label: "Role" }, { label: "Sample email alias" }]}
          rows={s.people.map((p) => [
            p.name, p.title, ROLE_LABEL[p.role],
            <span key="e" className="fj-mono">{p.email} <span className="fj-faint">sample data, sending disabled</span></span>,
          ])}
        />
        <div className="fj-note" style={{ padding: "0 18px 16px" }}>
          This roster represents demo users, not confirmed headcount. Caio and Joyce cover daily operations, and two designers remain on the roster.
        </div>
      </Card>
      <Card title="Permissions matrix" flush>
        <Table
          cols={[{ label: "Action" }, ...ROLES.map((r) => ({ label: ROLE_LABEL[r], align: "left" as const }))]}
          rows={MATRIX.map((m) => [
            m.label,
            ...ROLES.map((r) => (can(r, m.action) ? <Pill key={r} tone="ok">Yes</Pill> : <span key={r} className="fj-faint">No</span>)),
          ])}
        />
        <div className="fj-note" style={{ padding: "0 18px 16px" }}>Pass an enquiry is the owner only. Slots and moves are the production manager's call, with the owner able to step in.</div>
      </Card>
    </div>
  );
}

interface SysRow { name: string; group: string; status: string; note: string; link?: { page: string; tab?: string; label: string } }
const SYSTEMS: SysRow[] = [
  { name: "Gmail enquiries", group: "Current input", status: "Sample import", note: "Enquiries arrive by email today.", link: { page: "Estimates", tab: "enquiries", label: "Enquiry records" } },
  { name: "Instagram enquiries", group: "Current input", status: "Sample import", note: "Direct messages are copied across by hand.", link: { page: "Estimates", tab: "enquiries", label: "Enquiry records" } },
  { name: "Google Forms brief", group: "Current input", status: "Sample import", note: "Client brief form feeds the enquiry.", link: { page: "Estimates", tab: "enquiries", label: "Enquiry records" } },
  { name: "Drive drawings", group: "Current input", status: "Sample import", note: "Drawings live in shared folders.", link: { page: "Jobs", tab: "drawings", label: "Drawing records" } },
  { name: "WhatsApp and printed packs", group: "Current input", status: "Current handoff channel", note: "How the workshop gets work today.", link: { page: "Workshop", tab: "packs", label: "Work packs" } },
  { name: "Existing AI workflow", group: "Current input", status: "Self-built, platform name unclear", note: "Runs outside this demo." },
  { name: "Client sign-off", group: "Current input", status: "Provider uncertain", note: "Approval is simulated in the client preview.", link: { page: "Jobs", tab: "drawings", label: "Sign-off records" } },
  { name: "Trello", group: "Prior tool", status: "Historical", note: "Used before. Not connected." },
  { name: "Odoo", group: "Prior tool", status: "Unconfirmed", note: "Tried and described as complex. Connection status unconfirmed." },
  { name: "Finance system", group: "Prior tool", status: "Unclear", note: "Not confirmed. Nothing is connected." },
  { name: "Mock payment receipts", group: "Simulation", status: "Simulated", note: "Receipts are generated here with an RC reference.", link: { page: "Job Costing", tab: "payments", label: "Payments" } },
  { name: "Mock supplier invoice", group: "Simulation", status: "Simulated", note: "Invoice QT-5521 for the pizza birch ply.", link: { page: "Job Costing", tab: "capture", label: "Cost capture" } },
  { name: "Mock deliveries", group: "Simulation", status: "Simulated", note: "Delivery notes are created on receipt.", link: { page: "Purchasing", tab: "deliveries", label: "Deliveries" } },
];

function Systems() {
  const group = (g: string) => SYSTEMS.filter((x) => x.group === g);
  const rows = (g: string) => group(g).map((x) => [
    <b key="n" style={{ color: "var(--ink)" }}>{x.name}</b>,
    <Pill key="s" tone={x.group === "Simulation" ? "info" : x.status.startsWith("Sample") ? "neutral" : "warn"}>{x.status}</Pill>,
    x.note,
    x.link ? <span key="l" className="fj-mini">{x.status === "Sample import" && <Pill tone="neutral">sample import</Pill>}<Go to={{ page: x.link.page, tab: x.link.tab }}>{x.link.label}</Go></span> : <span key="l" className="fj-faint">Not linked</span>,
  ]);
  const cols = [{ label: "System" }, { label: "Status" }, { label: "Note" }, { label: "Fixture records" }];
  return (
    <div className="fj-stack">
      <Card title="What this demo does not do">
        <ul className="fj-rowlist">
          {["No live sync with any system.", "No external payment collection.", "No emails are sent.", "No credentials are stored or requested.", "No WhatsApp delivery."].map((x) => <li key={x}><span>{x}</span><Pill tone="warn">Off</Pill></li>)}
        </ul>
      </Card>
      <Card title="Current inputs" flush><Table cols={cols} rows={rows("Current input")} /></Card>
      <Card title="Prior tools" flush><Table cols={cols} rows={[...rows("Prior tool")]} /></Card>
      <Card title="Simulations" flush><Table cols={cols} rows={rows("Simulation")} /></Card>
    </div>
  );
}

function Governance() {
  const s = useForja();
  return (
    <div className="fj-split">
      <div className="fj-stack">
        <Card title="Approval controls">
          <Toggle
            checked={s.settings.approvalControls}
            onChange={(v) => actions.setSetting("approvalControls", v)}
            label="Require approvals before work is released"
            hint="When on, a pack stays held until its gates are clear. Client approvals are given in the client preview only."
          />
          <div className="fj-note">Status now: {s.settings.approvalControls ? "on" : "off"}. Sending is always disabled in this demo.</div>
        </Card>
        <Card title="Audit note">
          <div className="fj-dim" style={{ fontSize: 13 }}>Every approval, payment, receipt, pack release, capacity move and end-of-day report is written to the activity feed with who did it and when. Changes are never silent.</div>
          <div style={{ marginTop: 10 }}><Go to={{ page: "Activity", tab: "feed" }}>Open the company feed</Go></div>
        </Card>
      </div>
      <Card title="AI and agent controls">
        <div className="fj-dim" style={{ fontSize: 13, marginBottom: 8 }}>Agents suggest. Humans confirm.</div>
        <Table
          cols={[{ label: "Agent" }, { label: "Who confirms" }]}
          rows={[
            ["Briefing", "Caio reads it, nothing to confirm"],
            ["Ops Watchdog", "Niamh for routine items, Caio for commercial decisions"],
            ["Workshop Planner", "Niamh confirms every move and slot"],
            ["Materials", "Joyce confirms quantities received"],
            ["Margin Review", "Caio reviews the estimate or starts a variation"],
            ["Client Programme", "Joyce previews, nothing is sent"],
          ]}
        />
      </Card>
    </div>
  );
}

function Experience() {
  const s = useForja();
  const [armed, setArmed] = useState(false);
  return (
    <div className="fj-split">
      <div className="fj-stack">
        <Card title="TV display">
          <div className="fj-stack" style={{ gap: 12 }}>
            <Toggle checked={s.settings.tvLargeType} onChange={(v) => actions.setSetting("tvLargeType", v)} label="Large type" hint="Bigger text for reading across the workshop." />
            <Toggle checked={s.settings.tvRotate} onChange={(v) => actions.setSetting("tvRotate", v)} label="Rotate jobs" hint="Cycles through jobs on the board." />
          </div>
          <div className="fj-row" style={{ marginTop: 14 }}>
            <Btn onClick={() => openStandalone("tv")}>Open TV board</Btn>
            <Btn onClick={() => openStandalone("phone")}>Open phone view</Btn>
          </div>
        </Card>
        <Card title="Theme">
          <div className="fj-dim" style={{ fontSize: 13 }}>Light and dark follow the workspace theme. The teal accent is a proposed demo token, not an official brand colour.</div>
        </Card>
      </div>
      <div className="fj-stack">
        <Card title="Role preview"><RoleBar /><div className="fj-note">Changes what you can confirm. It does not change who is signed in.</div></Card>
        <Card title="Reset demo">
          <div className="fj-dim" style={{ fontSize: 13, marginBottom: 12 }}>Puts every job, task, receipt and event back to Tuesday 24 November.</div>
          <div className="fj-row">
            <Btn kind="danger" onClick={() => { if (armed) { actions.reset(); setArmed(false); } else setArmed(true); }}>{armed ? "Click again to reset" : "Reset demo"}</Btn>
            {armed && <Btn kind="ghost" onClick={() => setArmed(false)}>Cancel</Btn>}
          </div>
        </Card>
      </div>
    </div>
  );
}

const TITLES: Record<string, { title: string; sub: string }> = {
  organisation: { title: "Organisation", sub: "Company details, related organisations and proposed brand tokens." },
  teams: { title: "Teams and permissions", sub: "Who is on the demo roster and who can do what." },
  systems: { title: "Systems and integrations", sub: "What the business uses today, what it used before, and what is simulated here." },
  governance: { title: "Governance and AI", sub: "Approval controls, agent boundaries and the audit trail." },
  experience: { title: "Experience", sub: "TV and phone views, role preview and resetting the demo." },
};

export default function SettingsView({ tab }: { tab: string; job?: string }) {
  const k = TITLES[tab] ? tab : "organisation";
  return (
    <Page title={TITLES[k].title} sub={TITLES[k].sub} actions={<DemoBadge />}>
      {k === "organisation" && <Organisation />}
      {k === "teams" && <Teams />}
      {k === "systems" && <Systems />}
      {k === "governance" && <Governance />}
      {k === "experience" && <Experience />}
    </Page>
  );
}
