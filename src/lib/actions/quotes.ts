"use server";

import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { nextNumber, formatQuoteNumber, formatJobNumber } from "@/lib/numbering";
import { getSettings } from "@/lib/settings";
import { parseInputDate, splitAddress } from "@/lib/format";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

type LineItem = { name: string; description: string; qty: number; unitPrice: number; gst: boolean };

/** Tasks are serialised by the TaskItemsEditor as JSON in `itemsJson`.
 *  Each task snapshots its values at save time — later preset edits never
 *  rewrite historical quotes. */
function parseItems(fd: FormData): LineItem[] {
  const raw = String(fd.get("itemsJson") ?? "");
  if (raw) {
    try {
      const arr = JSON.parse(raw) as any[];
      return arr
        .map((it) => ({
          name: String(it.name ?? "").trim(),
          description: String(it.description ?? "").trim(),
          qty: Number(it.qty) || 0,
          unitPrice: Number(it.unitPrice) || 0,
          gst: it.gst !== false,
        }))
        .filter((it) => it.name !== "" || it.description !== "");
    } catch { /* fall through to legacy parsing */ }
  }
  // Legacy line-item fields (old editor)
  const descriptions = fd.getAll("itemDescription").map(String);
  const qtys = fd.getAll("itemQty").map((v) => parseFloat(String(v)) || 0);
  const prices = fd.getAll("itemPrice").map((v) => parseFloat(String(v)) || 0);
  return descriptions
    .map((d, i) => ({ name: "", description: d.trim(), qty: qtys[i] ?? 1, unitPrice: prices[i] ?? 0, gst: true }))
    .filter((it) => it.description !== "");
}

function totals(items: LineItem[], gstRate: number) {
  const subtotal = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const gst = items.reduce((s, it) => s + (it.gst ? it.qty * it.unitPrice : 0), 0) * (gstRate / 100);
  return { subtotal, gst, total: subtotal + gst };
}

export async function createQuote(fd: FormData) {
  const clientId = parseInt(str(fd, "clientId"));
  if (!clientId) throw new Error("Select a client.");
  const client = await db.client.findUniqueOrThrow({ where: { id: clientId } });
  const settings = await getSettings();
  const items = parseItems(fd);
  const t = totals(items, settings.gstRate);

  const quote = await db.$transaction(async (tx) => {
    const { seq } = await nextNumber(tx, "quote");
    const quoteNumber = await formatQuoteNumber(seq);
    return tx.quote.create({
      data: {
        quoteNumber,
        clientId,
        contactName: str(fd, "contactName") || client.contactPerson,
        siteAddress: str(fd, "siteAddress"),
        // Project removed from the entry workflow; column kept for historical data.
        projectType: str(fd, "projectType"),
        scope: str(fd, "scope"),
        exclusions: str(fd, "exclusions"),
        validUntil: parseInputDate(str(fd, "validUntil")),
        notes: str(fd, "notes"),
        subtotal: t.subtotal,
        gst: t.gst,
        total: t.total,
        items: {
          create: items.map((it, i) => ({
            name: it.name, description: it.description, qty: it.qty, unitPrice: it.unitPrice, gst: it.gst,
            amount: it.qty * it.unitPrice, order: i,
          })),
        },
      },
    });
  });
  await logActivity(`Quote ${quote.quoteNumber} created for ${client.name}`, { quoteId: quote.id, clientId });
  revalidatePath("/quotes");
  revalidatePath("/dashboard");
  redirect(`/quotes/${quote.id}`);
}

export async function updateQuote(id: number, fd: FormData) {
  const settings = await getSettings();
  const items = parseItems(fd);
  const t = totals(items, settings.gstRate);
  const clientId = parseInt(str(fd, "clientId"));

  await db.$transaction(async (tx) => {
    await tx.quoteItem.deleteMany({ where: { quoteId: id } });
    await tx.quote.update({
      where: { id },
      data: {
        clientId,
        contactName: str(fd, "contactName"),
        siteAddress: str(fd, "siteAddress"),
        project: str(fd, "project"),
        projectType: str(fd, "projectType"),
        scope: str(fd, "scope"),
        exclusions: str(fd, "exclusions"),
        validUntil: parseInputDate(str(fd, "validUntil")),
        notes: str(fd, "notes"),
        subtotal: t.subtotal,
        gst: t.gst,
        total: t.total,
        items: {
          create: items.map((it, i) => ({
            name: it.name, description: it.description, qty: it.qty, unitPrice: it.unitPrice, gst: it.gst,
            amount: it.qty * it.unitPrice, order: i,
          })),
        },
      },
    });
  });
  revalidatePath(`/quotes/${id}`);
  revalidatePath("/quotes");
}

export async function setQuoteStatus(id: number, status: string) {
  const quote = await db.quote.findUniqueOrThrow({ where: { id } });
  await db.quote.update({ where: { id }, data: { status } });
  await logActivity(`Quote ${quote.quoteNumber} marked ${status}`, { quoteId: id, clientId: quote.clientId });
  revalidatePath(`/quotes/${id}`);
  revalidatePath("/quotes");
  revalidatePath("/dashboard");
}

export async function duplicateQuote(id: number) {
  const src = await db.quote.findUniqueOrThrow({ where: { id }, include: { items: true } });
  const copy = await db.$transaction(async (tx) => {
    const { seq } = await nextNumber(tx, "quote");
    const quoteNumber = await formatQuoteNumber(seq);
    return tx.quote.create({
      data: {
        quoteNumber,
        clientId: src.clientId,
        contactName: src.contactName,
        siteAddress: src.siteAddress,
        project: src.project,
        projectType: src.projectType,
        scope: src.scope,
        exclusions: src.exclusions,
        validUntil: src.validUntil,
        notes: src.notes,
        subtotal: src.subtotal,
        gst: src.gst,
        total: src.total,
        status: "Draft",
        items: {
          create: src.items.map((it, i) => ({
            name: it.name, description: it.description, qty: it.qty, unitPrice: it.unitPrice, gst: it.gst, amount: it.amount, order: i,
          })),
        },
      },
    });
  });
  await logActivity(`Quote ${src.quoteNumber} duplicated as ${copy.quoteNumber}`, { quoteId: copy.id, clientId: copy.clientId });
  revalidatePath("/quotes");
  redirect(`/quotes/${copy.id}`);
}

/**
 * SECTION 52 — Accept Quote & Create Job.
 * One atomic transaction: quote → Accepted, next job number allocated,
 * job created with all inherited data, permanent quote↔job link,
 * status To Start, activity recorded on both records.
 * Section 97 — refuses double conversion.
 */
export async function acceptQuoteAndCreateJob(id: number) {
  const result = await db.$transaction(async (tx) => {
    const quote = await tx.quote.findUniqueOrThrow({ where: { id }, include: { job: true, client: true } });
    if (quote.job) {
      return { existing: quote.job.id, jobNumber: quote.job.jobNumber };
    }
    await tx.quote.update({ where: { id }, data: { status: "Accepted" } });

    const { seq } = await nextNumber(tx, "job");
    const jobNumber = await formatJobNumber(seq);
    const toStart = await tx.jobStatus.findUniqueOrThrow({ where: { name: "To Start" } });
    const type = quote.projectType
      ? await tx.jobType.findUnique({ where: { name: quote.projectType } })
      : null;

    const siteParts = splitAddress(quote.siteAddress);
    const job = await tx.job.create({
      data: {
        jobNumber,
        name: quote.project || quote.siteAddress || `Job for ${quote.client.name}`,
        clientId: quote.clientId,
        clientContact: quote.contactName,
        siteAddress: quote.siteAddress,
        siteStreet: siteParts.street,
        siteSuburb: siteParts.suburb,
        billingAddress: quote.client.billingAddress,
        scope: quote.scope,
        projectTypeId: type?.id ?? null,
        statusId: toStart.id,
        quotedFee: quote.subtotal,
        quoteId: quote.id,
      },
    });

    await tx.activity.create({
      data: { message: `Quote ${quote.quoteNumber} accepted`, quoteId: quote.id, clientId: quote.clientId, jobId: job.id },
    });
    await tx.activity.create({
      data: { message: `Job ${jobNumber} created from Quote ${quote.quoteNumber} (${quote.quoteNumber} → Job ${jobNumber})`, jobId: job.id, clientId: quote.clientId, quoteId: quote.id },
    });
    return { existing: null as number | null, jobId: job.id, jobNumber };
  });

  revalidatePath("/jobs");
  revalidatePath("/quotes");
  revalidatePath("/dashboard");
  if (result.existing) redirect(`/jobs/${result.existing}`);
  redirect(`/jobs/${result.jobId}`);
}

export async function archiveQuote(id: number) {
  await db.quote.update({ where: { id }, data: { archived: true } });
  revalidatePath("/quotes");
  revalidatePath("/dashboard");
}
