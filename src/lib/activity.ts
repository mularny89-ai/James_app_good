import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function logActivity(
  message: string,
  refs: { jobId?: number; clientId?: number; quoteId?: number; invoiceId?: number; taskId?: number } = {},
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? db;
  await client.activity.create({ data: { message, ...refs } });
}
