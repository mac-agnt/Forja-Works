/* Date helpers. Dates are "YYYY-MM-DD" strings. Dublin is on GMT in late November,
   so the demo clock uses UTC getters directly. */

const DAY_MS = 86400000;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const DEMO_DAY = "2026-11-24";

export function toMs(d: string): number {
  const [y, m, dd] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, dd);
}
export function addDays(d: string, n: number): string {
  const t = new Date(toMs(d) + n * DAY_MS);
  return t.getUTCFullYear() + "-" + String(t.getUTCMonth() + 1).padStart(2, "0") + "-" + String(t.getUTCDate()).padStart(2, "0");
}
export function diffDays(a: string, b: string): number {
  return Math.round((toMs(a) - toMs(b)) / DAY_MS);
}
/** "Tue 24 Nov" */
export function fmtDate(d: string): string {
  const t = new Date(toMs(d));
  return DOW[t.getUTCDay()] + " " + t.getUTCDate() + " " + MON[t.getUTCMonth()];
}
/** "Tuesday 1 December" */
export function fmtDateLong(d: string): string {
  const t = new Date(toMs(d));
  const L = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return L[t.getUTCDay()] + " " + t.getUTCDate() + " " + M[t.getUTCMonth()];
}
export function fmtShort(d: string): string {
  const t = new Date(toMs(d));
  return t.getUTCDate() + " " + MON[t.getUTCMonth()];
}
export function dowOf(d: string): string {
  return DOW[new Date(toMs(d)).getUTCDay()];
}
/** "Tue 24 Nov, 14:05" from a demo epoch (ms). */
export function fmtStamp(ms: number): string {
  const t = new Date(ms);
  const day = DOW[t.getUTCDay()] + " " + t.getUTCDate() + " " + MON[t.getUTCMonth()];
  return day + ", " + fmtClock(ms);
}
export function fmtClock(ms: number): string {
  const t = new Date(ms);
  return String(t.getUTCHours()).padStart(2, "0") + ":" + String(t.getUTCMinutes()).padStart(2, "0");
}
export function dayOf(ms: number): string {
  const t = new Date(ms);
  return t.getUTCFullYear() + "-" + String(t.getUTCMonth() + 1).padStart(2, "0") + "-" + String(t.getUTCDate()).padStart(2, "0");
}
export function relAgo(nowMs: number, ms: number): string {
  const m = Math.max(0, Math.round((nowMs - ms) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + "h ago";
  return Math.round(h / 24) + "d ago";
}
/** Viewer's real Dublin hour, used for the greeting only. */
export function dublinHour(): number {
  try {
    const s = new Intl.DateTimeFormat("en-IE", { timeZone: "Europe/Dublin", hour: "numeric", hour12: false }).format(new Date());
    return parseInt(s, 10) % 24;
  } catch {
    return new Date().getHours();
  }
}
export function dublinMinutes(): number {
  try {
    const s = new Intl.DateTimeFormat("en-IE", { timeZone: "Europe/Dublin", hour: "numeric", minute: "numeric", hour12: false }).format(new Date());
    const [h, m] = s.split(":").map((x) => parseInt(x, 10));
    return (h % 24) * 60 + m;
  } catch {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
}
