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
  items: { name?: string; description: string; qty: number; unitPrice: number; amount: number }[];
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

      {/* Tasks */}
      <div className="mt-4">
        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--brand-primary)" }}>Tasks</div>
        {items.map((it, i) => (
          <div key={i} className="border-b border-line py-2">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-bold">{it.name || it.description}</div>
                {it.name && it.description && (
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink-muted">{it.description}</p>
                )}
              </div>
              <div className="shrink-0 text-right text-xs text-ink-muted">
                Qty {it.qty} | Rate {fmtMoney(it.unitPrice)} | Amount <span className="font-semibold text-ink">{fmtMoney(it.amount)}</span>
              </div>
            </div>
          </div>
        ))}
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
