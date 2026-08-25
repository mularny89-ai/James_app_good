import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { generateDocumentPdf, type DocPayload } from "@/lib/doc-pdf";
import { DEFAULT_PRINT_OPTS } from "@/lib/print-opts";

/**
 * Live PDF preview from the New Quote/Invoice editor (no record created).
 * POST { doc: DocPayload } → application/pdf rendered inline.
 */
export async function POST(req: NextRequest) {
  const settings = await getSettings();
  const body = await req.json().catch(() => null);
  const doc = body?.doc as DocPayload | undefined;
  if (!doc || !Array.isArray(doc.items)) return new NextResponse("Bad request", { status: 400 });
  const bytes = await generateDocumentPdf(settings, doc, DEFAULT_PRINT_OPTS);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.docNumber || "preview"}.pdf"`,
    },
  });
}
