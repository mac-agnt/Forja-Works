import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { navigate, type Route } from "./nav";
import { actions, actorNow, can, ROLE_LABEL, useForja, useToasts } from "./store";
import type { PersonId, Role } from "./types";
import type { Link } from "./derive";

/* Shared building blocks. Everything uses Pulse tokens so themes keep working. */

export function Page({ title, sub, actions: act, children }: { title: string; sub?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="fj-page">
      <div className="fj-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="fj-h1">{title}</h1>
          {sub && <div className="fj-sub">{sub}</div>}
        </div>
        <div className="fj-head-r"><RoleBar />{act}</div>
      </div>
      {children}
    </div>
  );
}

export function Card({ title, right, children, className, style, flush }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; style?: CSSProperties; flush?: boolean }) {
  return (
    <section className={"fj-card " + (className ?? "")} style={style}>
      {(title || right) && (
        <header className="fj-card-h"><h2>{title}</h2><div>{right}</div></header>
      )}
      <div className={flush ? "" : "fj-card-b"}>{children}</div>
    </section>
  );
}

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral";
export function Pill({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span className={"fj-pill fj-" + tone} title={title}>{children}</span>;
}

export function Btn({ children, onClick, kind = "secondary", disabled, why, title, type = "button", small }: { children: ReactNode; onClick?: () => void; kind?: "primary" | "secondary" | "ghost" | "danger"; disabled?: boolean; why?: string; title?: string; type?: "button" | "submit"; small?: boolean }) {
  return (
    <button type={type} className={"fj-btn fj-" + kind + (small ? " fj-small" : "")} onClick={onClick} disabled={disabled} title={disabled && why ? why : title} aria-disabled={disabled}>
      {children}
    </button>
  );
}

/** Button gated by role. Shows the reason as a tooltip and a small hint when blocked. */
export function ActBtn({ action, children, onClick, kind = "primary", disabled, why, small }: { action: string; children: ReactNode; onClick: () => void; kind?: "primary" | "secondary" | "ghost" | "danger"; disabled?: boolean; why?: string; small?: boolean }) {
  const s = useForja();
  const allowed = can(s.ui.role, action);
  return (
    <Btn kind={kind} small={small} onClick={onClick} disabled={!allowed || disabled} why={!allowed ? "Switch role: this needs " + rolesFor(action) : why}>
      {children}
    </Btn>
  );
}
const NEEDS: Record<string, string> = {
  approveRevision: "the client preview", requestChanges: "the client preview", acceptVariation: "the client preview", confirmSnag: "the client preview",
  confirmPayment: "operations (Joyce) or the owner", confirmMove: "the production manager (Niamh)", assignSlot: "the production manager (Niamh)",
  receive: "operations, production manager or owner", eod: "a crew lead", issueRevision: "a designer", passEnquiry: "the owner (Caio)",
  closeSnag: "an installer, operations or owner", createVariation: "owner, operations or designer", cost: "operations, owner or crew lead", quote: "owner, operations or designer",
};
const rolesFor = (a: string) => NEEDS[a] ?? "a different role";

export function JobLink({ code, tab = "live", label }: { code: string; tab?: string; label?: string }) {
  return <a className="fj-joblink" href={"#/Jobs/" + tab + "/" + code} onClick={(e) => { e.preventDefault(); navigate({ page: "Jobs", tab, job: code }); }}>{label ?? code}</a>;
}
export function Go({ to, children, kind = "link" }: { to: Link | Route; children: ReactNode; kind?: "link" | "btn" }) {
  return <a className={kind === "btn" ? "fj-btn fj-secondary fj-small" : "fj-link"} href={"#/" + [to.page, to.tab, to.job].filter((x): x is string => !!x).map(encodeURIComponent).join("/")} onClick={(e) => { e.preventDefault(); navigate(to); }}>{children}</a>;
}

export function Table({ cols, rows, empty, onRow }: { cols: { label: string; align?: "right" | "left"; w?: string }[]; rows: ReactNode[][]; empty?: string; onRow?: (i: number) => void }) {
  if (!rows.length) return <Empty text={empty ?? "Nothing here yet."} />;
  return (
    <div className="fj-table-wrap">
      <table className="fj-table">
        <thead><tr>{cols.map((c, i) => <th key={i} style={{ textAlign: c.align ?? "left", width: c.w }}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} onClick={onRow ? () => onRow(i) : undefined} className={onRow ? "fj-click" : undefined}>
              {r.map((c, j) => <td key={j} style={{ textAlign: cols[j]?.align ?? "left" }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Empty({ text, hint }: { text: string; hint?: string }) {
  return <div className="fj-empty"><div>{text}</div>{hint && <div className="fj-faint">{hint}</div>}</div>;
}
export function Stat({ label, value, sub, tone, onClick }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={"fj-stat" + (onClick ? " fj-stat-click" : "") + (tone ? " fj-t-" + tone : "")} onClick={onClick}>
      <span className="fj-stat-l">{label}</span>
      <span className="fj-stat-v">{value}</span>
      {sub && <span className="fj-stat-s">{sub}</span>}
    </Tag>
  );
}
export function Grid({ cols = 3, children, gap = 14 }: { cols?: number; children: ReactNode; gap?: number }) {
  return <div className="fj-grid" style={{ ["--cols" as string]: cols, gap }}>{children}</div>;
}
export function Tabs<T extends string>({ items, value, onChange }: { items: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="fj-tabs" role="tablist">
      {items.map((t) => <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? "on" : ""} onClick={() => onChange(t.id)}>{t.label}</button>)}
    </div>
  );
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="fj-field"><span>{label}</span>{children}{hint && <em>{hint}</em>}</label>;
}
export function Bar({ value, max, tone }: { value: number; max: number; tone?: Tone }) {
  const w = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return <div className="fj-bar" role="img" aria-label={value + " of " + max}><i className={"fj-" + (tone ?? "info")} style={{ width: w + "%" }} /></div>;
}

/* role switcher, shown on every staff page */
const ROLE_PEOPLE: { role: Role; person: PersonId; label: string }[] = [
  { role: "owner", person: "caio", label: "Caio (owner)" },
  { role: "ops", person: "joyce", label: "Joyce (operations)" },
  { role: "pm", person: "niamh", label: "Niamh (production manager)" },
  { role: "designer", person: "ana", label: "Ana (designer)" },
  { role: "lead", person: "rui", label: "Rui (crew lead)" },
  { role: "lead", person: "eva", label: "Eva (crew lead)" },
];
export function RoleBar() {
  const s = useForja();
  const cur = s.ui.person;
  return (
    <label className="fj-role" title="Role preview: changes what you can confirm. Authentication is unchanged.">
      <span>Viewing as</span>
      <select value={cur} onChange={(e) => { const m = ROLE_PEOPLE.find((r) => r.person === e.target.value)!; actions.setRole(m.role, m.person); }} aria-label="Viewing as">
        {ROLE_PEOPLE.map((r) => <option key={r.person} value={r.person}>{r.label}</option>)}
      </select>
    </label>
  );
}
export function roleHint(action: string, role: Role): string | null {
  return can(role, action) ? null : "Needs " + (NEEDS[action] ?? "another role") + ". You are viewing as " + ROLE_LABEL[role].toLowerCase() + ".";
}

export function Toaster() {
  const ts = useToasts();
  return (
    <div className="fj-toasts" role="status" aria-live="polite">
      {ts.map((t) => <div key={t.id} className={"fj-toast fj-" + t.kind}>{t.text}</div>)}
    </div>
  );
}
export function DemoBadge() { return <span className="fj-demo">Demo data</span>; }

export function useLocal<T>(init: T): [T, (v: T) => void] { return useState<T>(init); }
export { actorNow };
