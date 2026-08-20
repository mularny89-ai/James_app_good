import Link from "next/link";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/format";
import { refreshOverdueInvoices } from "@/lib/actions/invoices";
import { PageHeader, StatRow } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await refreshOverdueInvoices();

  const [statuses, jobCounts, typeAgg, quoteAgg, invoiceAgg, paidAgg, outstandingInvoices, recentActivity] = await Promise.all([
    db.jobStatus.findMany({ orderBy: { order: "asc" } }),
    db.job.groupBy({ by: ["statusId"], where: { archived: false }, _count: true }),
    db.job.groupBy({ by: ["projectTypeId"], where: { archived: false }, _count: true }),
    db.quote.aggregate({ _count: true, _sum: { total: true }, where: { archived: false, status: { in: ["Sent", "Accepted"] } } }),
    db.invoice.aggregate({ _sum: { total: true }, where: { archived: false, status: { notIn: ["Cancelled", "Draft"] } } }),
    db.invoice.aggregate({ _sum: { amountPaid: true }, where: { archived: false, status: { notIn: ["Cancelled"] } } }),
    db.invoice.findMany({
      where: { archived: false, status: { in: ["Sent", "Part Paid", "Overdue"] } },
      include: { client: true, job: true },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    db.activity.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  const types = await db.jobType.findMany();
  const typeName = (id: number | null) => types.find((t) => t.id === id)?.name ?? "Uncategorised";
  const totalInvoiced = invoiceAgg._sum.total ?? 0;
  const totalPaid = paidAgg._sum.amountPaid ?? 0;

  return (
    <div className="p-5">
      <PageHeader title="Reports" subtitle="Live business position — every figure is derived from your data" />

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Jobs by Status</h3>
          {statuses.map((s) => {
            const n = jobCounts.find((c) => c.statusId === s.id)?._count ?? 0;
            if (n === 0) return null;
            return <StatRow key={s.id} label={s.name} value={<Link className="link" href={`/jobs?status=${encodeURIComponent(s.name)}`}>{n}</Link>} />;
          })}
        </section>

        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Jobs by Type</h3>
          {typeAgg.filter((t) => t._count > 0).map((t) => (
            <StatRow key={String(t.projectTypeId)} label={typeName(t.projectTypeId)} value={t._count} />
          ))}
          {typeAgg.every((t) => t._count === 0) && <p className="px-3 py-3 text-sm text-ink-muted">No jobs yet.</p>}
        </section>

        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Financial Position</h3>
          <StatRow label="Open Quotes (Sent/Accepted)" value={String(quoteAgg._count)} />
          <StatRow label="Open Quote Value" value={fmtMoney(quoteAgg._sum.total ?? 0)} />
          <StatRow label="Total Invoiced" value={fmtMoney(totalInvoiced)} />
          <StatRow label="Total Paid" value={<span className="text-ok">{fmtMoney(totalPaid)}</span>} />
          <StatRow label="Outstanding" value={<span className="text-err">{fmtMoney(totalInvoiced - totalPaid)}</span>} bold />
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Aged Outstanding Invoices</h3>
          {outstandingInvoices.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-muted">No outstanding invoices.</p>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-line">
                <th className="th">Invoice</th><th className="th">Client</th><th className="th">Job</th><th className="th">Due</th><th className="th">Owing</th>
              </tr></thead>
              <tbody>
                {outstandingInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-line">
                    <td className="td font-semibold"><Link href={`/invoices/${inv.id}`} className="link">{inv.invoiceNumber}</Link></td>
                    <td className="td">{inv.client.name}</td>
                    <td className="td">{inv.job ? <Link href={`/jobs/${inv.job.id}`} className="link">{inv.job.jobNumber}</Link> : "—"}</td>
                    <td className={`td ${inv.status === "Overdue" ? "font-semibold text-err" : ""}`}>
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "—"}
                    </td>
                    <td className="td font-medium">{fmtMoney(inv.total - inv.amountPaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Recent Business Activity</h3>
          {recentActivity.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-muted">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentActivity.map((a) => (
                <li key={a.id} className="flex gap-3 px-3 py-1.5 text-sm">
                  <span className="w-28 shrink-0 text-xs text-ink-muted">
                    {new Date(a.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </span>
                  <span>
                    {a.jobId ? <Link href={`/jobs/${a.jobId}`} className="hover:underline">{a.message}</Link> : a.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
