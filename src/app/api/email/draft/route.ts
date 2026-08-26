import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mergeEmailTemplate, getQuoteEmailTemplate } from "@/lib/email-template";
import { fmtMoney, fmtDate } from "@/lib/format";

const QUOTE_FALLBACK = "Dear Sir/Madam";

export async function POST(req: Request) {
  const { jobId, docType } = await req.json();
  if (!jobId || (docType !== "quote" && docType !== "invoice")) {
    return NextResponse.json({ error: "jobId and docType (quote|invoice) are required." }, { status: 400 });
  }

  const job = await db.job.findUnique({
    where: { id: Number(jobId) },
    include: { client: true, quote: true, invoices: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const siteAddress = job.siteAddress || [job.siteStreet, job.siteSuburb].filter(Boolean).join(", ");
  const to = job.client.email || "";

  if (docType === "quote") {
    // Prefer the linked quote (job.quoteId); fall back to the newest quote for the client.
    const quote =
      job.quote ??
      (
        await db.quote.findMany({
          where: { clientId: job.clientId, archived: false },
          orderBy: { id: "desc" },
          take: 1,
        })
      )[0];
    if (!quote) return NextResponse.json({ error: "No quote exists for this job yet — create one from the job's Financial tab." }, { status: 400 });

    const settings = await db.companySettings.findUnique({ where: { id: 1 } });
    const tmpl = await getQuoteEmailTemplate();
    // leadTime/completionTime stay as merge placeholders here — they're filled
    // per-quote in the quote's own email panel.
    const src = {
      clientName: job.client.name,
      contactName: quote.contactName || job.clientContact,
      siteAddress,
      quoteNumber: quote.quoteNumber,
      total: quote.total,
      validUntil: quote.validUntil,
      companyName: settings?.companyName ?? "",
    };
    return NextResponse.json({
      to,
      subject: mergeEmailTemplate(tmpl.subject, src),
      body: mergeEmailTemplate(tmpl.body || QUOTE_FALLBACK, src),
      jobNumber: job.jobNumber,
      clientName: job.client.name,
      docNumber: quote.quoteNumber,
      docId: quote.id,
      docHref: `/quotes/${quote.id}`,
    });
  }

  const invoice = [...job.invoices].sort((a, b) =>
    b.invoiceNumber.localeCompare(a.invoiceNumber, undefined, { numeric: true }),
  )[0];
  if (!invoice) return NextResponse.json({ error: "No invoice exists for this job yet — create one from the job page." }, { status: 400 });

  const settings = await db.companySettings.findUnique({ where: { id: 1 } });
  const first = (job.clientContact || job.client.name || "").trim().split(/\s+/)[0] || "there";
  const outstanding = invoice.total - invoice.amountPaid;
  const vars: Record<string, string> = {
    firstName: first,
    clientName: job.client.name,
    jobNumber: job.jobNumber,
    siteAddress,
    invoiceNumber: invoice.invoiceNumber,
    total: fmtMoney(invoice.total),
    amountPaid: fmtMoney(invoice.amountPaid),
    outstanding: fmtMoney(outstanding),
    dueDate: invoice.dueDate ? fmtDate(invoice.dueDate) : "",
    companyName: settings?.companyName ?? "",
  };
  const fill = (t: string) => t.replace(/\{\{(\w+)\}\}/g, (m, k: string) => vars[k] ?? m);

  return NextResponse.json({
    to,
    subject: fill(`Invoice {{invoiceNumber}} — {{siteAddress}}`),
    body: fill(`Hi {{firstName}},

Please find attached invoice {{invoiceNumber}} for the structural engineering services at {{siteAddress}} (job {{jobNumber}}).

Invoice total: {{total}} (incl GST)
Payment due: {{dueDate}}

Bank details are shown on the invoice. Please use the invoice number as the payment reference.

If you have any questions, just reply to this email.

Cheers,
James`),
    jobNumber: job.jobNumber,
    clientName: job.client.name,
    docNumber: invoice.invoiceNumber,
    docId: invoice.id,
    docHref: `/invoices/${invoice.id}`,
  });
}
