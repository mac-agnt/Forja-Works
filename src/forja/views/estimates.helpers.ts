import type { Cat, QuoteLine, QuoteVersion } from "../types";
import { quoteTotals } from "../derive";

/** Dublin wall-clock for a demo timestamp, e.g. "Tue 24 Nov, 14:05". */
export function fmtAt(ms: number): string {
  return new Date(ms).toLocaleString("en-IE", { timeZone: "Europe/Dublin", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

export const lineCost = (l: QuoteLine) => l.qty * l.rate;

export interface QuoteStats { cost: number; price: number; profit: number; margin: number; hours: number; perHour: number }
export function quoteStats(v: QuoteVersion): QuoteStats {
  const { cost, hours } = quoteTotals(v.lines);
  const profit = v.price - cost;
  return { cost, price: v.price, profit, margin: v.price ? (profit / v.price) * 100 : 0, hours, perHour: hours ? profit / hours : 0 };
}

/** Quote line categories mapped onto the five job-costing categories. */
export const QUOTE_CAT_TO_COST: Record<QuoteLine["cat"], Cat> = {
  Materials: "materials", "Workshop hours": "workshop", Finishing: "workshop", Install: "install", Transport: "logistics", Overhead: "overhead",
};
export const CAT_LABEL: Record<Cat, string> = { materials: "Materials", workshop: "Workshop", install: "Install", overhead: "Overhead", logistics: "Logistics" };

export function newKey(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
