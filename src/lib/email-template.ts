import { db } from "@/lib/db";
import { fmtMoney, fmtDate } from "@/lib/format";

export const QUOTE_EMAIL_FIELDS: { key: string; label: string }[] = [
  { key: "firstName", label: "Client first name" },
  { key: "clientName", label: "Client name" },
  { key: "contactName", label: "Quote contact" },
  { key: "siteAddress", label: "Site address" },
  { key: "quoteNumber", label: "Quote number" },
  { key: "total", label: "Total (incl GST)" },
  { key: "validUntil", label: "Valid until date" },
  { key: "leadTime", label: "Lead time" },
  { key: "completionTime", label: "Completion time" },
  { key: "companyName", label: "Your company" },
];

export const DEFAULT_QUOTE_EMAIL_SUBJECT = "Quote {{quoteNumber}} — {{siteAddress}}";

export const DEFAULT_QUOTE_EMAIL_BODY = `Hi {{firstName}},

Please find attached a quote for the structural engineering services at '{{siteAddress}}'.

The quote includes the full structural design and associated framing, together with a full set of detailed structural drawings.

Site inspections are not included and are charged at $400 + GST per inspection. If all footing works are ready at the same time, only one footing inspection should be required. The same applies to the framing inspection, provided everything is left exposed and ready to inspect at once. If the works are staged, additional inspections may be required.

A Form 15 will be issued with the structural drawings at no additional cost. Form 12s will also be issued at no additional cost once the relevant inspections are complete and the inspection fees have been paid.

My current lead time is approximately '{{leadTime}}'. Once I commence the project, I will require around '{{completionTime}}' to complete the engineering and issue the structural drawings.

Please let me know how you would like to proceed.
Cheers,
James`;

type MergeSource = {
  clientName?: string;
  contactName?: string;
  siteAddress?: string;
  quoteNumber?: string;
  total?: number;
  validUntil?: Date | null;
  leadTime?: string;
  completionTime?: string;
  companyName?: string;
};

export function mergeEmailTemplate(template: string, src: MergeSource): string {
  const first = (src.contactName || src.clientName || "").trim().split(/\s+/)[0] || "there";
  const values: Record<string, string> = {
    firstName: first,
    clientName: src.clientName ?? "",
    contactName: src.contactName ?? "",
    siteAddress: src.siteAddress ?? "",
    quoteNumber: src.quoteNumber ?? "",
    total: typeof src.total === "number" ? fmtMoney(src.total) : "",
    validUntil: src.validUntil ? fmtDate(src.validUntil) : "",
    companyName: src.companyName ?? "",
  };
  // leadTime/completionTime stay as placeholders — filled per-quote in the email panel
  if (src.leadTime !== undefined) values.leadTime = src.leadTime;
  if (src.completionTime !== undefined) values.completionTime = src.completionTime;
  return template.replace(/\{\{(\w+)\}\}/g, (m, key: string) => values[key] ?? m);
}

export async function getQuoteEmailTemplate() {
  const s = await db.companySettings.findUnique({
    where: { id: 1 },
    select: { quoteEmailSubject: true, quoteEmailBody: true },
  });
  return {
    subject: s?.quoteEmailSubject || DEFAULT_QUOTE_EMAIL_SUBJECT,
    body: s?.quoteEmailBody || DEFAULT_QUOTE_EMAIL_BODY,
  };
}
