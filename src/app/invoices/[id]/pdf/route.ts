import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { generateDocumentPdf } from "@/lib/doc-pdf";
import { parsePrintOpts } from "@/lib/print-opts";

/** Saved invoice as a real PDF; honours ?hide= print options. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const [invoice, settings] = await Promise.all([
    db.invoice.findUnique({ where: { id }, include: { items: { orderBy: { order: "asc" } }, client: true, job: true } }),
    getSettings(),
  ]);
  if (!invoice) notFound();
  const opts = parsePrintOpts(Object.fromEntries(req.nextUrl.searchParams));
  const bytes = await generateDocumentPdf(settings, {
    docType: "Tax Invoice",
    docNumber: invoice.invoiceNumber,
    date: invoice.date,
    dueOrValid: { label: "Due Date", value: invoice.dueDate },
    clientName: invoice.client.name,
    clientCompany: invoice.client.company,
    billingAddress: invoice.billingAddress,
    siteAddress: invoice.siteAddress,
    jobNumber: invoice.job?.jobNumber,
    description: invoice.description,
    notes: invoice.notes,
    paymentAdvice: settings.paymentAdvice,
    items: invoice.items,
    subtotal: invoice.subtotal,
    gst: invoice.gst,
    total: invoice.total,
    gstRate: settings.gstRate,
  }, opts);
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"` },
  });
}
