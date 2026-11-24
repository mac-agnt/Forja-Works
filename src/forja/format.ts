export function eur(n: number, signed = false): string {
  const neg = n < 0;
  const abs = Math.abs(n);
  const whole = Number.isInteger(abs) ? abs.toLocaleString("en-IE") : abs.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (neg ? "-" : signed && n > 0 ? "+" : "") + "€" + whole;
}
export function pct(n: number, digits = 1): string {
  return n.toFixed(digits) + "%";
}
export function hrs(n: number): string {
  return (Number.isInteger(n) ? String(n) : n.toFixed(1)) + "h";
}
