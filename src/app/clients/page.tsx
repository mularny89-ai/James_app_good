import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDate, fmtMoney } from "@/lib/format";
import { PageHeader, EmptyState, SoftBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const showArchived = searchParams.archived === "1";
  const clients = await db.client.findMany({
    where: { archived: showArchived },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { jobs: { where: { archived: false } }, quotes: { where: { archived: false } } } },
      invoices: { where: { archived: false, status: { in: ["Sent", "Part Paid", "Overdue"] } }, select: { total: true, amountPaid: true } },
    },
  });

  return (
    <div className="p-5">
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} ${showArchived ? "archived " : ""}client${clients.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Link href={showArchived ? "/clients" : "/clients?archived=1"} className="btn">
              {showArchived ? "Show Active" : "Show Archived"}
            </Link>
            <Link href="/clients/new" className="btn-primary">+ New Client</Link>
          </>
        }
      />
      {clients.length === 0 ? (
        <EmptyState message="No clients yet. Add your first client to begin quoting and creating jobs." actionHref="/clients/new" actionLabel="+ New Client" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="border-b border-line">
                <th className="th">Client</th>
                <th className="th">Company</th>
                <th className="th">Contact</th>
                <th className="th">Email</th>
                <th className="th">Phone</th>
                <th className="th">Jobs</th>
                <th className="th">Quotes</th>
                <th className="th">Outstanding</th>
                <th className="th">Created</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const outstanding = c.invoices.reduce((s, i) => s + (i.total - i.amountPaid), 0);
                return (
                  <tr key={c.id} className="border-b border-line hover:bg-gray-50">
                    <td className="td font-semibold"><Link href={`/clients/${c.id}`} className="link">{c.name}</Link></td>
                    <td className="td">{c.company || "—"}</td>
                    <td className="td">{c.contactPerson || "—"}</td>
                    <td className="td">{c.email || "—"}</td>
                    <td className="td">{c.phone || c.mobile || "—"}</td>
                    <td className="td">{c._count.jobs}</td>
                    <td className="td">{c._count.quotes}</td>
                    <td className={`td font-medium ${outstanding > 0 ? "text-err" : "text-ink-muted"}`}>
                      {outstanding > 0 ? fmtMoney(outstanding) : "—"}
                    </td>
                    <td className="td text-ink-muted">{fmtDate(c.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
