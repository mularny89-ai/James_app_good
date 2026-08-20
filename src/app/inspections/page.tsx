import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDate, toInputDate } from "@/lib/format";
import { PageHeader, EmptyState, SoftBadge } from "@/components/ui";
import { inspectionStatusColor, INSPECTION_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function InspectionsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const status = searchParams.status ?? "";
  const from = searchParams.from ?? "";
  const to = searchParams.to ?? "";

  const where: any = {};
  if (status) where.status = status;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from + "T00:00:00");
    if (to) where.date.lte = new Date(to + "T23:59:59");
  }

  const inspections = await db.siteInspection.findMany({
    where,
    include: { job: true, type: true },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
    take: 500,
  });

  return (
    <div className="p-5">
      <PageHeader
        title="Site Inspections"
        subtitle={`${inspections.length} inspection${inspections.length === 1 ? "" : "s"}`}
        actions={<Link href="/inspections/new" className="btn-primary">+ Schedule Inspection</Link>}
      />

      <form method="GET" action="/inspections" className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={status} className="input w-40">
            <option value="">All</option>
            {INSPECTION_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div><label className="label">From</label><input type="date" name="from" defaultValue={from} className="input w-40" /></div>
        <div><label className="label">To</label><input type="date" name="to" defaultValue={to} className="input w-40" /></div>
        <button className="btn" type="submit">Apply</button>
        <Link href="/inspections" className="btn">Clear</Link>
      </form>

      {inspections.length === 0 ? (
        <EmptyState message="No site inspections match these filters." actionHref="/inspections/new" actionLabel="+ Schedule Inspection" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="border-b border-line">
                <th className="th">Date</th>
                <th className="th">Time</th>
                <th className="th">Job №</th>
                <th className="th">Site Address</th>
                <th className="th">Type</th>
                <th className="th">Client</th>
                <th className="th">Contact</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {inspections.map((i) => (
                <tr key={i.id} className="border-b border-line hover:bg-gray-50">
                  <td className="td font-medium"><Link href={`/inspections/${i.id}`} className="link">{fmtDate(i.date)}</Link></td>
                  <td className="td">{i.startTime}–{i.endTime}</td>
                  <td className="td font-bold">
                    {i.job ? <Link href={`/jobs/${i.job.id}`} className="link">{i.job.jobNumber}</Link> : "—"}
                  </td>
                  <td className="td max-w-64 truncate font-medium">{i.siteAddress}</td>
                  <td className="td">{i.type?.name ?? "—"}</td>
                  <td className="td">{i.clientName || "—"}</td>
                  <td className="td text-xs text-ink-muted">{i.contactPerson}{i.contactPhone ? ` · ${i.contactPhone}` : ""}</td>
                  <td className="td"><SoftBadge label={i.status} color={inspectionStatusColor(i.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
