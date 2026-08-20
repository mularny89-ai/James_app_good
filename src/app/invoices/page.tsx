import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDate, fmtMoney } from "@/lib/format";
import { refreshOverdueInvoices } from "@/lib/actions/invoices";
import { PageHeader, EmptyState, SoftBadge } from "@/components/ui";
import { invoiceStatusColor, INVOICE_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await refreshOverdueInvoices();
  const status = searchParams.status ?? "";
  const clientFilter = searchParams.client ?? "";

  const where: any = { archived: false };
  if (status === "outstanding") where.status = { in: ["Sent", "Part Paid", "Overdue"] };
  else if (status) where.status = status;
  if (clientFilter) where.clientId = parseInt(clientFilter);

  const [invoices, clients] = await Promise.all([
    db.invoice.findMany({
      where,
      include: { client: true, job: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.client.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
  ]);

  const outstandingTotal = invoices.reduce((s, i) => s + (i.total - i.amountPaid), 0);

  return (
    <div className="p-5">
      <PageHeader
        title="Invoices"
        subtitle={status === "outstanding" ? `Outstanding: ${fmtMoney(outstandingTotal)}` : `${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`}
        actions={<Link href="/invoices/new" className="btn-primary">+ New Invoice</Link>}
      />

      <form method="GET" action="/invoices" className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={status} className="input w-40">
            <option value="">All</option>
            <option value="outstanding">Outstanding</option>
            {INVOICE_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Client</label>
          <select name="client" defaultValue={clientFilter} className="input w-48">
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button className="btn" type="submit">Apply</button>
        <Link href="/invoices" className="btn">Clear</Link>
      </form>

      {invoices.length === 0 ? (
        <EmptyState message="No invoices match these filters." actionHref="/invoices/new" actionLabel="+ New Invoice" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="border-b border-line">
                <th className="th">Invoice №</th>
                <th className="th">Date</th>
                <th className="th">Client</th>
                <th className="th">Job</th>
                <th className="th">Total</th>
                <th className="th">Paid</th>
                <th className="th">Outstanding</th>
                <th className="th">Due</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-line hover:bg-gray-50">
                  <td className="td font-bold"><Link href={`/invoices/${inv.id}`} className="link">{inv.invoiceNumber}</Link></td>
                  <td className="td">{fmtDate(inv.date)}</td>
                  <td className="td"><Link href={`/clients/${inv.clientId}`} className="link">{inv.client.name}</Link></td>
                  <td className="td font-semibold">
                    {inv.job ? <Link href={`/jobs/${inv.job.id}`} className="link">{inv.job.jobNumber}</Link> : "—"}
                  </td>
                  <td className="td">{fmtMoney(inv.total)}</td>
                  <td className="td text-ok">{fmtMoney(inv.amountPaid)}</td>
                  <td className={`td font-medium ${inv.total - inv.amountPaid > 0 ? "text-err" : "text-ink-muted"}`}>
                    {fmtMoney(inv.total - inv.amountPaid)}
                  </td>
                  <td className={`td ${inv.status === "Overdue" ? "font-semibold text-err" : ""}`}>{fmtDate(inv.dueDate)}</td>
                  <td className="td"><SoftBadge label={inv.status} color={invoiceStatusColor(inv.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
