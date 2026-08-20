import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fmtDate, fmtMoney, toInputDate } from "@/lib/format";
import { updateInvoice, setInvoiceStatus, addPayment, archiveInvoice } from "@/lib/actions/invoices";
import { PageHeader, SoftBadge, StatRow, Field } from "@/components/ui";
import BrandDocument from "@/components/BrandDocument";
import ConfirmButton from "@/components/ConfirmButton";
import PrintButton from "@/components/PrintButton";
import InvoiceForm from "@/components/InvoiceForm";
import { presetOpts } from "@/lib/presets";
import { invoiceStatusColor } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  const id = parseInt(params.id);
  const mode = searchParams.mode ?? "preview";

  const [invoice, settings, jobs, presets] = await Promise.all([
    db.invoice.findUnique({
      where: { id },
      include: {
        items: { orderBy: { order: "asc" } },
        client: true,
        job: true,
        payments: { orderBy: { date: "desc" } },
      },
    }),
    getSettings(),
    db.job.findMany({
      where: { archived: false },
      include: { client: true, invoices: { where: { archived: false, status: { notIn: ["Cancelled"] } } } },
      orderBy: { jobNumber: "desc" },
      take: 500,
    }),
    presetOpts(),
  ]);
  if (!invoice) notFound();

  const outstanding = invoice.total - invoice.amountPaid;
  const editable = mode === "edit" && !["Paid", "Cancelled"].includes(invoice.status);

  const jobOpts = jobs.map((j) => {
    const invoiced = j.invoices.reduce((s, i) => s + i.total / (1 + settings.gstRate / 100), 0);
    return {
      id: j.id, jobNumber: j.jobNumber, name: j.name, siteAddress: j.siteAddress,
      billingAddress: j.billingAddress || j.client.billingAddress,
      remainingFee: j.quotedFee + j.variations - invoiced,
    };
  });

  async function updateBound(fd: FormData) {
    "use server";
    await updateInvoice(id, fd);
  }

  return (
    <div className="p-5">
      <div className="no-print">
        <PageHeader
          title={<span style={{ color: "var(--brand-primary)" }}>{invoice.invoiceNumber}</span>}
          subtitle={
            <span className="flex items-center gap-3">
              <SoftBadge label={invoice.status} color={invoiceStatusColor(invoice.status)} />
              <span>Client: <Link href={`/clients/${invoice.clientId}`} className="link">{invoice.client.name}</Link></span>
              {invoice.job && <span>Job: <Link href={`/jobs/${invoice.job.id}`} className="link font-semibold">{invoice.job.jobNumber}</Link></span>}
            </span>
          }
          actions={
            <>
              {editable ? (
                <Link href={`/invoices/${id}`} className="btn">Preview</Link>
              ) : (
                !["Paid", "Cancelled"].includes(invoice.status) && <Link href={`/invoices/${id}?mode=edit`} className="btn">Edit</Link>
              )}
              <PrintButton />
              {invoice.status === "Draft" && (
                <form action={async () => { "use server"; await setInvoiceStatus(id, "Sent"); }}>
                  <button type="submit" className="btn-primary">Mark Sent</button>
                </form>
              )}
              {!["Paid", "Cancelled"].includes(invoice.status) && (
                <ConfirmButton
                  label="Cancel Invoice"
                  message="Cancel this invoice? Its amount will be excluded from job financials."
                  onConfirm={async () => { "use server"; await setInvoiceStatus(id, "Cancelled"); }}
                />
              )}
              <ConfirmButton label="Archive" message="Archive this invoice?" onConfirm={async () => { "use server"; await archiveInvoice(id); }} />
            </>
          }
        />
      </div>

      {editable ? (
        <div className="mx-auto max-w-4xl">
          <InvoiceForm
            action={updateBound}
            jobs={jobOpts}
            gstRate={settings.gstRate} presets={presets}
            submitLabel="Save Changes"
            invoice={{
              jobId: invoice.jobId,
              siteAddress: invoice.siteAddress,
              billingAddress: invoice.billingAddress,
              description: invoice.description,
              dueDate: toInputDate(invoice.dueDate),
              notes: invoice.notes,
              items: invoice.items.map((i) => ({ description: i.description, qty: i.qty, unitPrice: i.unitPrice })),
            }}
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <BrandDocument
              settings={settings}
              docType="Tax Invoice"
              docNumber={invoice.invoiceNumber}
              date={invoice.date}
              dueOrValid={{ label: "Due Date", value: invoice.dueDate }}
              clientName={invoice.client.name}
              clientCompany={invoice.client.company}
              billingAddress={invoice.billingAddress}
              siteAddress={invoice.siteAddress}
              project={invoice.description}
              items={invoice.items}
              subtotal={invoice.subtotal}
              gst={invoice.gst}
              total={invoice.total}
              gstRate={settings.gstRate}
              notes={invoice.notes}
              extra={
                invoice.amountPaid > 0 ? (
                  <div className="mt-4 rounded border border-line bg-gray-50 px-3 py-2">
                    <span className="text-ink-muted">Paid to date:</span>{" "}
                    <strong className="text-ok">{fmtMoney(invoice.amountPaid)}</strong>
                    <span className="ml-4 text-ink-muted">Balance due:</span>{" "}
                    <strong className={outstanding > 0 ? "text-err" : "text-ok"}>{fmtMoney(Math.max(outstanding, 0))}</strong>
                  </div>
                ) : undefined
              }
            />
          </div>

          <div className="no-print space-y-4">
            <div className="card">
              <h3 className="section-title border-b border-line px-3 py-2">Payment Summary</h3>
              <StatRow label="Total" value={fmtMoney(invoice.total)} />
              <StatRow label="Paid" value={<span className="text-ok">{fmtMoney(invoice.amountPaid)}</span>} />
              <StatRow label="Outstanding" value={<span className={outstanding > 0 ? "text-err" : "text-ok"}>{fmtMoney(outstanding)}</span>} bold />
            </div>

            {!["Paid", "Cancelled"].includes(invoice.status) && (
              <form action={addPayment.bind(null, id)} className="card space-y-3 p-3">
                <h3 className="section-title">Record Payment</h3>
                <Field label="Amount">
                  <input type="number" step="0.01" min="0.01" max={outstanding.toFixed(2)} name="amount" className="input" defaultValue={outstanding.toFixed(2)} required />
                </Field>
                <Field label="Date"><input type="date" name="date" className="input" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
                <Field label="Method">
                  <select name="method" className="input" defaultValue="Bank Transfer">
                    {["Bank Transfer", "Cash", "Cheque", "Card", "Other"].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Note"><input name="note" className="input" /></Field>
                <button type="submit" className="btn-primary w-full justify-center">Record Payment</button>
              </form>
            )}

            {invoice.payments.length > 0 && (
              <div className="card">
                <h3 className="section-title border-b border-line px-3 py-2">Payment History</h3>
                <ul className="divide-y divide-line">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span>{fmtDate(p.date)}{p.method ? ` · ${p.method}` : ""}</span>
                      <span className="font-medium text-ok">{fmtMoney(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
