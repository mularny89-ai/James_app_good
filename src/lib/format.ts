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

/** 12-hour time label, e.g. "09:30" -> "9:30 AM". */
export function fmtTime(t?: string | null): string {
  if (!t) return "";
  const [hs, ms] = t.split(":");
  const h = parseInt(hs);
  if (isNaN(h)) return t;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${(ms ?? "00").padStart(2, "0")} ${ampm}`;
}

export type AddressParts = {
  street?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  country?: string | null;
};

/** Single reusable display formatter: "14 Example Street, Broadbeach QLD 4218". */
export function fmtAddress(p: AddressParts): string {
  const street = (p.street ?? "").trim();
  const locality = [p.suburb, p.state, p.postcode]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const out = [street, locality].filter(Boolean).join(", ");
  const country = (p.country ?? "").trim();
  return country && country !== "Australia" ? (out ? `${out}, ${country}` : country) : out;
}

/**
 * Best-effort split of a free-form address into structured parts.
 * Splits on the last comma; anything unparsable stays in street so nothing is lost.
 */
export function splitAddress(full: string): { street: string; suburb: string } {
  const v = (full ?? "").trim();
  if (!v) return { street: "", suburb: "" };
  const i = v.lastIndexOf(",");
  if (i === -1) return { street: v, suburb: "" };
  return { street: v.slice(0, i).trim(), suburb: v.slice(i + 1).trim() };
}
