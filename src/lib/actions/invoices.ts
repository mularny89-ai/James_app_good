"use server";

import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { nextNumber, formatInvoiceNumber } from "@/lib/numbering";
import { getSettings } from "@/lib/settings";
import { parseInputDate } from "@/lib/format";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

type LineItem = { name: string; description: string; qty: number; unitPrice: number; gst: boolean };

/** Tasks are serialised by the TaskItemsEditor as JSON in `itemsJson`.
 *  Each task snapshots its values at save time — later preset edits never
 *  rewrite historical invoices. */
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

function revalidateAll(jobId?: number | null, invoiceId?: number) {
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  if (jobId) revalidatePath(`/jobs/${jobId}`);
  if (invoiceId) revalidatePath(`/invoices/${invoiceId}`);
}

/** Section 57: invoices are created from jobs and inherit everything. */
export async function createInvoice(fd: FormData) {
  const jobId = parseInt(str(fd, "jobId")) || null;
  const job = jobId
    ? await db.job.findUnique({ where: { id: jobId }, include: { client: true } })
    : null;
  const clientId = job?.clientId ?? parseInt(str(fd, "clientId"));
  if (!clientId) throw new Error("Select a client or a job.");
  const client = job?.client ?? (await db.client.findUniqueOrThrow({ where: { id: clientId } }));
  const settings = await getSettings();
  const items = parseItems(fd);
  const t = totals(items, settings.gstRate);

  const invoice = await db.$transaction(async (tx) => {
    const { seq, year } = await nextNumber(tx, "invoice");
    const invoiceNumber = await formatInvoiceNumber(seq, year);
    return tx.invoice.create({
      data: {
        invoiceNumber,
        clientId,
        jobId: job?.id ?? null,
        billingAddress: str(fd, "billingAddress") || job?.billingAddress || client.billingAddress,
        siteAddress: str(fd, "siteAddress") || job?.siteAddress || "",
        description: str(fd, "description") || job?.name || "",
        dueDate: parseInputDate(str(fd, "dueDate")),
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
  await logActivity(`Invoice ${invoice.invoiceNumber} created${job ? ` for Job ${job.jobNumber}` : ""} — $${invoice.total.toFixed(2)}`, {
    invoiceId: invoice.id, clientId, jobId: job?.id,
  });
  revalidateAll(job?.id);
  redirect(`/invoices/${invoice.id}`);
}

export async function updateInvoice(id: number, fd: FormData) {
  const settings = await getSettings();
  const items = parseItems(fd);
  const t = totals(items, settings.gstRate);
  const inv = await db.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
    return tx.invoice.update({
      where: { id },
      data: {
        billingAddress: str(fd, "billingAddress"),
        siteAddress: str(fd, "siteAddress"),
        description: str(fd, "description"),
        dueDate: parseInputDate(str(fd, "dueDate")),
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
  revalidateAll(inv.jobId, id);
}

export async function setInvoiceStatus(id: number, status: string) {
  const inv = await db.invoice.update({ where: { id }, data: { status } });
  revalidateAll(inv.jobId, id);
}

export async function addPayment(invoiceId: number, fd: FormData) {
  const amount = parseFloat(str(fd, "amount")) || 0;
  if (amount <= 0) throw new Error("Payment amount must be greater than zero.");
  const result = await db.$transaction(async (tx) => {
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (inv.status === "Cancelled") throw new Error("Cannot add a payment to a cancelled invoice.");
    await tx.payment.create({
      data: {
        invoiceId,
        amount,
        method: str(fd, "method"),
        note: str(fd, "note"),
        date: parseInputDate(str(fd, "date")) ?? new Date(),
      },
    });
    const amountPaid = inv.amountPaid + amount;
    const status =
      amountPaid >= inv.total - 0.005 ? "Paid" : inv.status === "Draft" ? "Draft" : "Part Paid";
    const updated = await tx.invoice.update({ where: { id: invoiceId }, data: { amountPaid, status } });
    return { inv: updated };
  });
  const inv = result.inv;
  await logActivity(
    `Payment of $${amount.toFixed(2)} recorded on Invoice ${inv.invoiceNumber}${inv.status === "Paid" ? " — invoice fully paid" : ""}`,
    { invoiceId, clientId: inv.clientId, jobId: inv.jobId ?? undefined }
  );
  revalidateAll(inv.jobId, invoiceId);
}

/** Overdue detection is automatic (Section 109): call on invoice list load. */
export async function refreshOverdueInvoices() {
  const now = new Date();
  await db.invoice.updateMany({
    where: { status: { in: ["Sent", "Part Paid"] }, dueDate: { lt: now } },
    data: { status: "Overdue" },
  });
}

export async function archiveInvoice(id: number) {
  const inv = await db.invoice.update({ where: { id }, data: { archived: true } });
  revalidateAll(inv.jobId);
}
