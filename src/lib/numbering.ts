import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import type { Prisma } from "@prisma/client";

type SeqKey = "job" | "quote" | "invoice";

// Job and quote numbering is prefix + fixed-width digits (e.g. J66 + 001).
// Invoices keep the legacy YY#### format, so their sequence rows are year-keyed.
const NO_YEAR = 0;

/**
 * Atomically allocate the next sequence for a key. Year-based keys (invoice)
 * pass their year; plain-sequence keys (job, quote) run against internal year 0.
 */
export async function nextNumber(
  tx: Prisma.TransactionClient,
  key: SeqKey,
  year?: number
): Promise<{ seq: number; year: number }> {
  const y = key === "invoice" ? (year ?? new Date().getFullYear()) : NO_YEAR;
  const row = await tx.numberSequence.upsert({
    where: { key_year: { key, year: y } },
    update: { nextValue: { increment: 1 } },
    create: { key, year: y, nextValue: 2 },
  });
  return { seq: row.nextValue - 1, year: y };
}

/** prefix + zero-padded sequence, e.g. formatNumber("J66", 3, 1) -> "J66001" */
export function formatNumber(prefix: string, digits: number, seq: number): string {
  return prefix + String(seq).padStart(Math.max(1, digits), "0");
}

/** Job number e.g. J66001 (prefix + digits from Settings). */
export async function formatJobNumber(seq: number): Promise<string> {
  const s = await getSettings();
  return formatNumber(s.jobPrefix, s.jobDigits, seq);
}

/** Quote number e.g. Q66001. */
export async function formatQuoteNumber(seq: number): Promise<string> {
  const s = await getSettings();
  return formatNumber(s.quotePrefix, s.quoteDigits, seq);
}

function applyLegacyFormat(format: string, seq: number, year: number): string {
  const yy = String(year).slice(-2);
  return format.replace(/YY/g, yy).replace(/#+/g, (m) => String(seq).padStart(m.length, "0"));
}

/** Invoice number e.g. INV-260001 (legacy YY#### scheme). */
export async function formatInvoiceNumber(seq: number, year: number): Promise<string> {
  const s = await getSettings();
  return s.invoicePrefix + applyLegacyFormat(s.invoiceFormat, seq, year);
}

async function peek(key: SeqKey): Promise<number> {
  const y = key === "invoice" ? new Date().getFullYear() : NO_YEAR;
  const row = await db.numberSequence.findUnique({ where: { key_year: { key, year: y } } });
  return row?.nextValue ?? 1;
}

export async function peekNextJobNumber(): Promise<string> {
  const s = await getSettings();
  return formatNumber(s.jobPrefix, s.jobDigits, await peek("job"));
}

export async function peekNextQuoteNumber(): Promise<string> {
  const s = await getSettings();
  return formatNumber(s.quotePrefix, s.quoteDigits, await peek("quote"));
}

export async function peekNextInvoiceNumber(): Promise<string> {
  const s = await getSettings();
  const y = new Date().getFullYear();
  return s.invoicePrefix + applyLegacyFormat(s.invoiceFormat, await peek("invoice"), y);
}
