import type { CompanySettings } from "@prisma/client";
import { fmtDate, fmtMoney } from "@/lib/format";
import { DEFAULT_PRINT_OPTS, type PrintOpts } from "@/lib/print-opts";

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
  opts = DEFAULT_PRINT_OPTS,
  jobNumber,
  paymentAdvice,
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
  items: { name?: string; description: string; qty: number; unitPrice: number; amount: number }[];
  subtotal: number;
  gst: number;
  total: number;
  gstRate: number;
  notes?: string;
  exclusions?: string;
  extra?: React.ReactNode;
  opts?: PrintOpts;
  jobNumber?: string;
  paymentAdvice?: string;
}) {
  // If item names are hidden, descriptions become the primary line text.
  const lineParts = (it: { qty: number; unitPrice: number; amount: number }) =>
    [
      opts.itemQty ? `Qty ${it.qty}` : null,
      opts.itemRate ? `Rate ${fmtMoney(it.unitPrice)}` : null,
      opts.itemAmount ? `Amount ${fmtMoney(it.amount)}` : null,
    ].filter((p): p is string => !!p);
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
          {opts.siteAddress && siteAddress && (
            <>
              <div className="label">Site Address</div>
              <div className="font-medium">{siteAddress}</div>
            </>
          )}
          {opts.jobNumber && jobNumber && (
            <>
              <div className="label mt-2">Job No.</div>
              <div className="font-medium">{jobNumber}</div>
            </>
          )}
          {opts.description && project && (
            <>
              <div className="label mt-2">Project</div>
              <div className="font-medium">{project}</div>
            </>
          )}
        </div>
      </div>

      {opts.scope && scope && (
        <div className="mt-4">
          <div className="label">Scope of Works</div>
          <p className="whitespace-pre-wrap">{scope}</p>
        </div>
      )}

      {/* Tasks */}
      <div className="mt-4">
        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--brand-primary)" }}>Tasks</div>
        {items.map((it, i) => {
          const parts = lineParts(it);
          const showName = opts.itemNames ? (it.name || it.description) : "";
          const showDesc = opts.itemDescriptions ? it.description : "";
          return (
            <div key={i} className="border-b border-line py-2">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {showName && <div className="font-bold">{showName}</div>}
                  {showDesc && (!opts.itemNames || it.name) && (
                    <p className={`whitespace-pre-wrap text-xs ${opts.itemNames ? "mt-0.5 text-ink-muted" : "font-bold text-ink"}`}>{showDesc}</p>
                  )}
                </div>
                {parts.length > 0 && (
                  <div className="shrink-0 text-right text-xs text-ink-muted">
                    {parts.slice(0, -1).map((p) => <span key={p}>{p} | </span>)}
                    <span className="font-semibold text-ink">{parts[parts.length - 1]}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div className="ml-auto mt-2 w-64">
          <div className="flex justify-between px-2 py-1 text-right text-ink-muted">
            <span>Subtotal (ex GST)</span><span>{fmtMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between px-2 py-1 text-right text-ink-muted">
            <span>GST ({gstRate}%)</span><span>{fmtMoney(gst)}</span>
          </div>
          <div className="flex justify-between px-2 py-1.5 text-right text-base font-bold" style={{ color: "var(--brand-primary)" }}>
            <span>Total (inc GST)</span><span>{fmtMoney(total)}</span>
          </div>
        </div>
      </div>

      {opts.exclusions && exclusions && (
        <div className="mt-4">
          <div className="label">Exclusions</div>
          <p className="whitespace-pre-wrap text-ink-muted">{exclusions}</p>
        </div>
      )}
      {opts.notes && notes && (
        <div className="mt-4">
          <div className="label">Notes</div>
          <p className="whitespace-pre-wrap">{notes}</p>
        </div>
      )}
      {extra}
      {opts.paymentAdvice && paymentAdvice && (
        <div className="mt-4 rounded border border-line bg-gray-50 px-3 py-2">
          <div className="label">Payment Advice</div>
          <p className="whitespace-pre-wrap text-xs">{paymentAdvice}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 border-t border-line pt-3 text-center text-xs text-ink-muted">
        {settings.companyName}{settings.abn ? ` · ABN ${settings.abn}` : ""} · {settings.website}
      </div>
    </div>
  );
}
