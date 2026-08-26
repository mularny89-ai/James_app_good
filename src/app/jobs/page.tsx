import Link from "next/link";
import { Fragment } from "react";
import { db } from "@/lib/db";
import { fmtDate, isOverdue, displayJobName } from "@/lib/format";
import { PageHeader, EmptyState, SoftBadge } from "@/components/ui";
import KanbanBoard from "@/components/KanbanBoard";
import { priorityColor } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const view = searchParams.view ?? "board";
  const statusFilter = searchParams.status ?? "";
  const typeFilter = searchParams.type ?? "";
  const clientFilter = searchParams.client ?? "";
  const priorityFilter = searchParams.priority ?? "";
  const yearFilter = searchParams.year ?? "";
  const awaiting = searchParams.awaiting === "1";

  const statuses = await db.jobStatus.findMany({ orderBy: { order: "asc" } });
  const types = await db.jobType.findMany({ orderBy: { order: "asc" } });
  const clients = await db.client.findMany({ where: { archived: false }, orderBy: { name: "asc" } });

  const where: any = { archived: false };
  if (statusFilter) where.status = { name: statusFilter };
  if (awaiting) where.status = { name: { startsWith: "Awaiting" } };
  if (typeFilter) where.projectType = { name: typeFilter };
  if (priorityFilter) where.priority = priorityFilter;
  if (clientFilter) where.clientId = parseInt(clientFilter);
  if (yearFilter) {
    const y = parseInt(yearFilter);
    where.createdAt = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
  }

  const jobs = await db.job.findMany({
    where,
    include: {
      client: true,
      status: true,
      projectType: true,
      _count: { select: { tasks: { where: { completed: false } } } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  // Distinct job years for the Year filter (created year == number-prefix year: J55…=2025, J66…=2026)
  const allDates = await db.job.findMany({ where: { archived: false }, select: { createdAt: true } });
  const years = Array.from(new Set(allDates.map((j) => j.createdAt.getFullYear()))).sort((a, b) => b - a);

  // List view groups jobs under year headings, newest year first.
  const jobsByYear = new Map<number, typeof jobs>();
  for (const j of [...jobs].sort((a, b) => b.jobNumber.localeCompare(a.jobNumber, undefined, { numeric: true }))) {
    const y = j.createdAt.getFullYear();
    if (!jobsByYear.has(y)) jobsByYear.set(y, []);
    jobsByYear.get(y)!.push(j);
  }

  const boardColumns = statuses.filter((s) => s.isBoardColumn).sort((a, b) => a.boardOrder - b.boardOrder);
  const kanbanData = boardColumns.map((col) => ({
    id: col.id,
    name: col.name,
    color: col.color,
    jobs: jobs
      .filter((j) => j.statusId === col.id)
      .map((j) => ({
        id: j.id,
        jobNumber: j.jobNumber,
        name: j.name,
        clientName: j.client.name,
        dueDate: j.dueDate ? fmtDate(j.dueDate) : null,
        priority: j.priority,
        statusId: j.statusId,
        openTasks: j._count.tasks,
        overdue: isOverdue(j.dueDate),
      })),
  }));

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { view, status: statusFilter, type: typeFilter, client: clientFilter, priority: priorityFilter, year: yearFilter, ...(awaiting ? { awaiting: "1" } : {}), ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    return `/jobs?${p.toString()}`;
  };

  return (
    <div className="p-5">
      <PageHeader
        title="Jobs"
        subtitle={`${jobs.length} job${jobs.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Link href={qs({ view: "board" })} className={view === "board" ? "btn-primary" : "btn"}>Board</Link>
            <Link href={qs({ view: "list" })} className={view === "list" ? "btn-primary" : "btn"}>List</Link>
            <Link href="/jobs/new" className="btn-primary">+ New Job</Link>
          </>
        }
      />

      {/* Filters — Section 68 */}
      <form method="GET" action="/jobs" className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="view" value={view} />
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={statusFilter} className="input w-44">
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Project Type</label>
          <select name="type" defaultValue={typeFilter} className="input w-44">
            <option value="">All types</option>
            {types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Client</label>
          <select name="client" defaultValue={clientFilter} className="input w-44">
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <select name="priority" defaultValue={priorityFilter} className="input w-32">
            <option value="">All</option>
            {["Low", "Normal", "High", "Urgent"].map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Year</label>
          <select name="year" defaultValue={yearFilter} className="input w-28">
            <option value="">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button className="btn" type="submit">Apply</button>
        <Link href={`/jobs?view=${view}`} className="btn">Clear</Link>
      </form>

      {jobs.length === 0 ? (
        <EmptyState
          message="No jobs match these filters."
          actionHref="/jobs/new"
          actionLabel="+ New Job"
        />
      ) : view === "board" ? (
        <KanbanBoard
          columns={kanbanData}
          allStatuses={statuses.map((s) => ({ id: s.id, name: s.name }))}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="border-b border-line">
                <th className="th">Job №</th>
                <th className="th">Project / Address</th>
                <th className="th">Client</th>
                <th className="th">Type</th>
                <th className="th">Status</th>
                <th className="th">Priority</th>
                <th className="th">Due</th>
                <th className="th">Tasks</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(jobsByYear.entries()).map(([year, yearJobs]) => (
                <Fragment key={year}>
                  <tr className="border-b border-line bg-indigo-50/60">
                    <td colSpan={8} className="td py-1.5">
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--brand-primary)" }}>
                        {year}
                      </span>
                      <span className="ml-2 text-xs text-ink-muted">{yearJobs.length} job{yearJobs.length === 1 ? "" : "s"}</span>
                    </td>
                  </tr>
                  {yearJobs.map((j) => (
                    <tr key={j.id} className="border-b border-line hover:bg-gray-50">
                      <td className="td font-bold">
                        <Link href={`/jobs/${j.id}`} className="link">{j.jobNumber}</Link>
                      </td>
                      <td className="td max-w-64 truncate">
                        <Link href={`/jobs/${j.id}`} className="link">{displayJobName(j)}</Link>
                        {j.siteAddress && <div className="truncate text-xs text-ink-muted">{j.siteAddress}</div>}
                      </td>
                      <td className="td">
                        <Link href={`/clients/${j.clientId}`} className="link">{j.client.name}</Link>
                      </td>
                      <td className="td text-ink-muted">{j.projectType?.name ?? "—"}</td>
                      <td className="td"><SoftBadge label={j.status.name} color={j.status.color} /></td>
                      <td className="td" style={{ color: priorityColor(j.priority) }}>{j.priority}</td>
                      <td className={`td ${isOverdue(j.dueDate) ? "font-semibold text-err" : ""}`}>{fmtDate(j.dueDate)}</td>
                      <td className="td text-ink-muted">{j._count.tasks}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
