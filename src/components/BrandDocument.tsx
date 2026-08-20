import type { CompanySettings } from "@prisma/client";
import { fmtDate, fmtMoney } from "@/lib/format";

/**
 * Section 91: one reusable branded document layout for quotes, invoices,
 * reports, inspection reports and job summaries. Print to PDF via browser.
 */
export default function BrandDocument({
  settings,
  docType,
  docNumber,
  date,
  dueOrValid,
  clientName,
  clientCompany,
  billingAddress,
  siteAddress,
  project,
  scope,
  items,
  subtotal,
  gst,
  total,
  gstRate,
  notes,
  exclusions,
  extra,
}: {
  settings: CompanySettings;
  docType: string;
  docNumber: string;
  date: Date | string | null;
  dueOrValid?: { label: string; value: Date | string | null };
  clientName: string;
  clientCompany?: string;
  billingAddress?: string;
  siteAddress?: string;
  project?: string;
  scope?: string;
  items: { description: string; qty: number; unitPrice: number; amount: number }[];
  subtotal: number;
  gst: number;
  total: number;
  gstRate: number;
  notes?: string;
  exclusions?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="print-doc mx-auto max-w-3xl bg-white p-8 text-sm shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between border-b-4 pb-4" style={{ borderColor: "var(--brand-primary)" }}>
        <div>
          {settings.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoPath} alt={settings.companyName} className="max-h-16 w-auto object-contain" />
          ) : (
            <div className="text-xl font-bold" style={{ color: "var(--brand-primary)" }}>{settings.companyName}</div>
          )}
          <div className="mt-1 text-xs text-ink-muted">
            {settings.abn && <div>ABN: {settings.abn}</div>}
            {settings.address && <div>{settings.address}</div>}
            <div>
              {[settings.phone, settings.email, settings.website].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold uppercase tracking-wide" style={{ color: "var(--brand-primary)" }}>{docType}</div>
          <div className="mt-1 text-sm font-semibold">{docNumber}</div>
          <div className="text-xs text-ink-muted">Date: {fmtDate(date)}</div>
          {dueOrValid && <div className="text-xs text-ink-muted">{dueOrValid.label}: {fmtDate(dueOrValid.value)}</div>}
        </div>
      </div>

      {/* Parties */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div className="label">To</div>
          <div className="font-semibold">{clientName}</div>
          {clientCompany && <div>{clientCompany}</div>}
          {billingAddress && <div className="text-ink-muted">{billingAddress}</div>}
        </div>
        <div>
          {siteAddress && (
            <>
              <div className="label">Site Address</div>
              <div className="font-medium">{siteAddress}</div>
            </>
          )}
          {project && (
            <>
              <div className="label mt-2">Project</div>
              <div className="font-medium">{project}</div>
            </>
          )}
        </div>
      </div>

      {scope && (
        <div className="mt-4">
          <div className="label">Scope of Works</div>
          <p className="whitespace-pre-wrap">{scope}</p>
        </div>
      )}

      {/* Line items */}
      <table className="mt-4 w-full">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-white" style={{ backgroundColor: "var(--brand-primary)" }}>
            <th className="px-2 py-1.5">Description</th>
            <th className="w-16 px-2 py-1.5 text-right">Qty</th>
            <th className="w-28 px-2 py-1.5 text-right">Unit Price</th>
            <th className="w-28 px-2 py-1.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-b border-line">
              <td className="px-2 py-1.5">{it.description}</td>
              <td className="px-2 py-1.5 text-right">{it.qty}</td>
              <td className="px-2 py-1.5 text-right">{fmtMoney(it.unitPrice)}</td>
              <td className="px-2 py-1.5 text-right font-medium">{fmtMoney(it.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="px-2 py-1 text-right text-ink-muted">Subtotal (ex GST)</td>
            <td className="px-2 py-1 text-right">{fmtMoney(subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={3} className="px-2 py-1 text-right text-ink-muted">GST ({gstRate}%)</td>
            <td className="px-2 py-1 text-right">{fmtMoney(gst)}</td>
          </tr>
          <tr className="text-base font-bold" style={{ color: "var(--brand-primary)" }}>
            <td colSpan={3} className="px-2 py-1.5 text-right">Total (inc GST)</td>
            <td className="px-2 py-1.5 text-right">{fmtMoney(total)}</td>
          </tr>
        </tfoot>
      </table>

      {exclusions && (
        <div className="mt-4">
          <div className="label">Exclusions</div>
          <p className="whitespace-pre-wrap text-ink-muted">{exclusions}</p>
        </div>
      )}
      {notes && (
        <div className="mt-4">
          <div className="label">Notes</div>
          <p className="whitespace-pre-wrap">{notes}</p>
        </div>
      )}
      {extra}

      {/* Footer */}
      <div className="mt-8 border-t border-line pt-3 text-center text-xs text-ink-muted">
        {settings.companyName}{settings.abn ? ` · ABN ${settings.abn}` : ""} · {settings.website}
      </div>
    </div>
  );
}
