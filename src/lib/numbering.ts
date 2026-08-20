import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import type { Prisma } from "@prisma/client";

type SeqKey = "job" | "quote" | "invoice";

/**
 * Atomically allocate the next number for the current year.
 * Uses an upsert + increment inside the caller's transaction so
 * duplicates are impossible (Section 75).
 */
export async function nextNumber(
  tx: Prisma.TransactionClient,
  key: SeqKey,
  year?: number
): Promise<{ seq: number; year: number }> {
  const y = year ?? new Date().getFullYear();
  const row = await tx.numberSequence.upsert({
    where: { key_year: { key, year: y } },
    update: { nextValue: { increment: 1 } },
    create: { key, year: y, nextValue: 2 },
  });
  return { seq: row.nextValue - 1, year: y };
}

function applyFormat(format: string, seq: number, year: number): string {
  const yy = String(year).slice(-2);
  return format.replace(/YY/g, yy).replace(/#+/g, (m) => String(seq).padStart(m.length, "0"));
}

/** Job number e.g. 26001 (YY### by default). Returned as integer. */
export async function formatJobNumber(seq: number, year: number): Promise<number> {
  const s = await getSettings();
  return parseInt(applyFormat(s.jobNumberFormat, seq, year), 10);
}

/** Quote number e.g. Q-26001. */
export async function formatQuoteNumber(seq: number, year: number): Promise<string> {
  const s = await getSettings();
  return s.quotePrefix + applyFormat(s.quoteFormat, seq, year);
}

/** Invoice number e.g. INV-260001. */
export async function formatInvoiceNumber(seq: number, year: number): Promise<string> {
  const s = await getSettings();
  return s.invoicePrefix + applyFormat(s.invoiceFormat, seq, year);
}

export async function peekNextJobNumber(): Promise<number> {
  const s = await getSettings();
  const y = new Date().getFullYear();
  const row = await db.numberSequence.findUnique({ where: { key_year: { key: "job", year: y } } });
  return parseInt(applyFormat(s.jobNumberFormat, row?.nextValue ?? 1, y), 10);
}

export async function peekNextQuoteNumber(): Promise<string> {
  const s = await getSettings();
  const y = new Date().getFullYear();
  const row = await db.numberSequence.findUnique({ where: { key_year: { key: "quote", year: y } } });
  return s.quotePrefix + applyFormat(s.quoteFormat, row?.nextValue ?? 1, y);
}
