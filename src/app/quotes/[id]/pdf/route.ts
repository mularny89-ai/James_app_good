import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { generateDocumentPdf } from "@/lib/doc-pdf";
import { parsePrintOpts } from "@/lib/print-opts";

/** Saved quote as a real PDF; honours ?hide= print options. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const [quote, settings] = await Promise.all([
    db.quote.findUnique({ where: { id }, include: { items: { orderBy: { order: "asc" } }, client: true, job: true } }),
    getSettings(),
  ]);
  if (!quote) notFound();
  const opts = parsePrintOpts(Object.fromEntries(req.nextUrl.searchParams));
  const bytes = await generateDocumentPdf(settings, {
    docType: "Quotation",
    docNumber: quote.quoteNumber,
    date: quote.date,
    dueOrValid: { label: "Valid Until", value: quote.validUntil },
    clientName: quote.client.name,
    clientCompany: quote.client.company,
    billingAddress: quote.client.billingAddress,
    siteAddress: quote.siteAddress,
    jobNumber: quote.job?.jobNumber,
    description: quote.project,
    scope: quote.scope,
    exclusions: quote.exclusions,
    notes: quote.notes,
    items: quote.items,
    subtotal: quote.subtotal,
    gst: quote.gst,
    total: quote.total,
    gstRate: settings.gstRate,
  }, opts);
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${quote.quoteNumber}.pdf"` },
  });
}
