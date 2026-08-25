import Link from "next/link";
import { db } from "@/lib/db";
import { toInputDate, fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import RoutePlanner, { RouteStop } from "@/components/RoutePlanner";

export const dynamic = "force-dynamic";

export default async function RoutePlannerPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const date = searchParams.date ?? toInputDate(new Date());

  const [inspections, settings] = await Promise.all([
    db.siteInspection.findMany({
      where: {
        date: { gte: new Date(date + "T00:00:00"), lte: new Date(date + "T23:59:59") },
        status: { notIn: ["Cancelled"] },
      },
      include: { job: { select: { id: true, jobNumber: true, plannerColor: true } }, type: true },
      orderBy: [{ startTime: "asc" }, { id: "asc" }],
    }),
    db.companySettings.findUnique({ where: { id: 1 } }),
  ]);

  const stops: RouteStop[] = inspections.map((i) => ({
    id: i.id,
    jobNumber: i.job?.jobNumber ?? "",
    address: i.siteAddress,
    clientName: i.clientName,
    typeName: i.type?.name ?? "",
    startTime: i.startTime,
    endTime: i.endTime,
    status: i.status,
    color: i.color || i.job?.plannerColor || "",
  }));

  return (
    <div className="flex h-full flex-col p-5">
      <PageHeader
        title="Inspection Route Planner"
        subtitle={`${stops.length} inspection${stops.length === 1 ? "" : "s"} on ${fmtDate(new Date(date + "T00:00:00"))}`}
        actions={
          <form method="GET" action="/inspections/route" className="flex items-end gap-2">
            <div>
              <label className="label">Date</label>
              <input type="date" name="date" defaultValue={date} className="input w-40" />
            </div>
            <button className="btn" type="submit">Go</button>
            <Link href="/inspections" className="btn">All Inspections</Link>
          </form>
        }
      />
      <div className="min-h-0 flex-1">
        <RoutePlanner date={date} stops={stops} officeAddress={settings?.address ?? ""} />
      </div>
    </div>
  );
}
