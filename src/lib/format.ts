/** Australian formatting helpers (Sections 81–83). */

const dFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" });
const dtFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});
const curFmt = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function fmtDate(d?: Date | string | null): string {
  if (!d) return "—";
  return dFmt.format(new Date(d));
}

export function fmtDateTime(d?: Date | string | null): string {
  if (!d) return "—";
  return dtFmt.format(new Date(d));
}

export function fmtMoney(n?: number | null): string {
  return curFmt.format(n ?? 0);
}

export function toInputDate(d?: Date | string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function parseInputDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

export function isToday(d?: Date | string | null): boolean {
  if (!d) return false;
  const a = new Date(d), b = new Date();
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isOverdue(d?: Date | string | null): boolean {
  if (!d) return false;
  const a = new Date(d); a.setHours(23, 59, 59, 999);
  return a.getTime() < Date.now() && !isToday(d);
}

export function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  return addDays(x, -day);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
