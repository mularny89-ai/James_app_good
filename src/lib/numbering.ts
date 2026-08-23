import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import type { Prisma } from "@prisma/client";

type SeqKey = "job" | "quote" | "invoice";

// Jobs, quotes and invoices all use prefix + fixed-width digits with a single
// running counter (internal year 0) — the legacy invoice YY#### scheme is gone.
const NO_YEAR = 0;

/**
 * Atomically allocate the next sequence for a key. The optional year argument
 * is ignored — kept only for call-site compatibility.
 */
export async function nextNumber(
  tx: Prisma.TransactionClient,
  key: SeqKey,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _year?: number
): Promise<{ seq: number; year: number }> {
  const row = await tx.numberSequence.upsert({
    where: { key_year: { key, year: NO_YEAR } },
    update: { nextValue: { increment: 1 } },
    create: { key, year: NO_YEAR, nextValue: 2 },
  });
  return { seq: row.nextValue - 1, year: NO_YEAR };
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

/** Invoice number e.g. INV-0001 — same prefix + digits scheme as jobs/quotes. */
export async function formatInvoiceNumber(seq: number): Promise<string> {
  const s = await getSettings();
  return formatNumber(s.invoicePrefix, s.invoiceDigits, seq);
}

async function peek(key: SeqKey): Promise<number> {
  const row = await db.numberSequence.findUnique({ where: { key_year: { key, year: NO_YEAR } } });
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
  return formatNumber(s.invoicePrefix, s.invoiceDigits, await peek("invoice"));
}
