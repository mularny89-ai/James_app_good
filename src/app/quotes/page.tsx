import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDate, fmtMoney } from "@/lib/format";
import { PageHeader, EmptyState, SoftBadge } from "@/components/ui";
import { quoteStatusColor, QUOTE_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function QuotesPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const status = searchParams.status ?? "";
  const clientFilter = searchParams.client ?? "";

  const where: any = { archived: false };
  if (status) where.status = status;
  if (clientFilter) where.clientId = parseInt(clientFilter);

  const [quotes, clients] = await Promise.all([
    db.quote.findMany({
      where,
      include: { client: true, job: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.client.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-5">
      <PageHeader
        title="Quotes"
        subtitle={`${quotes.length} quote${quotes.length === 1 ? "" : "s"}`}
        actions={<Link href="/quotes/new" className="btn-primary">+ New Quote</Link>}
      />

      <form method="GET" action="/quotes" className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={status} className="input w-40">
            <option value="">All</option>
            {QUOTE_STATUSES.map((s) => <option key={s}>{s}</option>)}
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
        <Link href="/quotes" className="btn">Clear</Link>
      </form>

      {quotes.length === 0 ? (
        <EmptyState message="No quotes match these filters." actionHref="/quotes/new" actionLabel="+ New Quote" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="border-b border-line">
                <th className="th">Quote №</th>
                <th className="th">Date</th>
                <th className="th">Client</th>
                <th className="th">Project / Site</th>
                <th className="th">Total (inc GST)</th>
                <th className="th">Valid Until</th>
                <th className="th">Status</th>
                <th className="th">Job</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-b border-line hover:bg-gray-50">
                  <td className="td font-bold"><Link href={`/quotes/${q.id}`} className="link">{q.quoteNumber}</Link></td>
                  <td className="td">{fmtDate(q.date)}</td>
                  <td className="td"><Link href={`/clients/${q.clientId}`} className="link">{q.client.name}</Link></td>
                  <td className="td max-w-64 truncate">{q.project || q.siteAddress || "—"}</td>
                  <td className="td font-medium">{fmtMoney(q.total)}</td>
                  <td className="td">{fmtDate(q.validUntil)}</td>
                  <td className="td"><SoftBadge label={q.status} color={quoteStatusColor(q.status)} /></td>
                  <td className="td font-semibold">
                    {q.job ? <Link href={`/jobs/${q.job.id}`} className="link">{q.job.jobNumber}</Link> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
