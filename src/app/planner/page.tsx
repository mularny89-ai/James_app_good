import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import PlannerBoard from "@/components/PlannerBoard";
import { startOfDay, endOfDay, fmtDate, sameDay } from "@/lib/format";
import {
  viewWindow, stepAnchor, isoDay, fromIsoDay, addDaysLocal, startOfMonday,
  planningStatus, PLANNING_STATUS_LABELS,
  type PlannerView, PLANNER_VIEWS,
} from "@/lib/planner";

export const dynamic = "force-dynamic";

const VIEW_VALUES: PlannerView[] = ["week", "month", "6weeks", "3months"];

const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const viewParam = one(searchParams.view) as PlannerView;
  const view = VIEW_VALUES.includes(viewParam) ? viewParam : "week";
  const anchor = searchParams.start ? fromIsoDay(one(searchParams.start)) : new Date();
  const { start, days } = viewWindow(view, anchor);
  const windowStart = startOfDay(start);
  const windowEnd = endOfDay(addDaysLocal(start, days - 1));

  // ----- Filters (Sections 47–48) -----
  const engineer = one(searchParams.engineer);
  const statusFilter = one(searchParams.status);
  const planningFilter = one(searchParams.planning);
  const priorityFilter = one(searchParams.priority);
  const typeFilter = one(searchParams.type);
  const clientFilter = one(searchParams.client);
  // Completed jobs are hidden by default; the GET form sends completed=show
  // (hidden input) plus completed=hide when the checkbox is ticked.
  const cp = searchParams.completed;
  const completedVals = Array.isArray(cp) ? cp : cp ? [cp] : [];
  const hideCompleted = completedVals.includes("hide") || !completedVals.includes("show");
  const panelOpen = one(searchParams.panel) === "unscheduled";
  const scheduleJobId = searchParams.schedule ? parseInt(one(searchParams.schedule)) : undefined;

  const [statuses, types, clients, engineerRows] = await Promise.all([
    db.jobStatus.findMany({ orderBy: { order: "asc" } }),
    db.jobType.findMany({ orderBy: { order: "asc" } }),
    db.client.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    db.job.findMany({
      where: { archived: false, assignedEngineer: { not: "" } },
      select: { assignedEngineer: true },
      distinct: ["assignedEngineer"],
      orderBy: { assignedEngineer: "asc" },
    }),
  ]);
  const engineers = engineerRows.map((r) => r.assignedEngineer);

  const baseWhere: any = { archived: false };
  if (statusFilter) baseWhere.status = { name: statusFilter };
  if (priorityFilter) baseWhere.priority = priorityFilter;
  if (typeFilter) baseWhere.projectType = { name: typeFilter };
  if (clientFilter) baseWhere.clientId = parseInt(clientFilter);
  if (engineer) baseWhere.assignedEngineer = engineer;

  // Only jobs whose planned period intersects the current window (Section 66).
  const scheduledRaw = await db.job.findMany({
    where: {
      ...baseWhere,
      plannedStartDate: { not: null, lte: windowEnd },
      plannedEndDate: { not: null, gte: windowStart },
    },
    include: {
      client: true,
      status: true,
      projectType: true,
      _count: { select: { tasks: { where: { completed: false } } } },
    },
    orderBy: [{ plannerSortOrder: "asc" }, { plannedStartDate: "asc" }, { jobNumber: "asc" }],
  });

  const inspections = scheduledRaw.length
    ? await db.siteInspection.findMany({
        where: {
          jobId: { in: scheduledRaw.map((j) => j.id) },
          date: { gte: windowStart, lte: windowEnd },
          status: { notIn: ["Cancelled"] },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      })
    : [];

  const scheduled = scheduledRaw
    .map((j) => {
      const pStatus = planningStatus({
        plannedStartDate: j.plannedStartDate,
        plannedEndDate: j.plannedEndDate,
        statusName: j.status.name,
      });
      return {
        id: j.id,
        jobNumber: j.jobNumber,
        name: j.name,
        siteAddress: j.siteAddress,
        siteStreet: j.siteStreet,
        clientName: j.client.name,
        engineer: j.assignedEngineer,
        priority: j.priority,
        statusName: j.status.name,
        statusColor: j.status.color,
        projectType: j.projectType?.name ?? "",
        startISO: isoDay(j.plannedStartDate!),
        endISO: isoDay(j.plannedEndDate ?? j.plannedStartDate!),
        duration: j.plannedDuration ?? 1,
        unit: j.durationUnit,
        color: j.plannerColor || "#3b5bdb",
        planningStatus: pStatus,
        planningLabel: PLANNING_STATUS_LABELS[pStatus],
        openTasks: j._count.tasks,
        completed: j.status.name === "Completed",
        overdue: pStatus === "overdue",
        inspections: inspections
          .filter((i) => i.jobId === j.id)
          .map((i) => ({
            id: i.id,
            iso: isoDay(i.date),
            label: `${fmtDate(i.date)}, ${i.startTime}`,
          })),
      };
    })
    .filter((j) => (!planningFilter || j.planningStatus === planningFilter))
    .filter((j) => !(hideCompleted && j.completed));

  // ----- Unscheduled Jobs (Sections 31–34) -----
  const unscheduled = (
    await db.job.findMany({
      where: {
        ...baseWhere,
        plannedStartDate: null,
        status: { name: { notIn: ["Completed", "Cancelled"] } },
      },
      include: { client: true, status: true },
      orderBy: [{ unscheduledOrder: "asc" }, { createdAt: "desc" }],
    })
  ).map((j) => ({
    id: j.id,
    jobNumber: j.jobNumber,
    name: j.name,
    siteAddress: j.siteAddress,
    clientName: j.client.name,
    priority: j.priority,
    statusName: j.status.name,
    statusColor: j.status.color,
    engineer: j.assignedEngineer,
    duration: j.plannedDuration,
    unit: j.durationUnit,
  }));

  // ----- Workload indicators for the current week (Section 53) -----
  const today = new Date();
  const weekStart = startOfMonday(today);
  const weekEnd = endOfDay(addDaysLocal(weekStart, 6));
  const activeStatus = { name: { notIn: ["Completed", "Cancelled"] } };
  const [weekJobs, weekStarts, weekFinishes] = await Promise.all([
    db.job.count({
      where: { archived: false, status: activeStatus, plannedStartDate: { not: null, lte: weekEnd }, plannedEndDate: { not: null, gte: startOfDay(weekStart) } },
    }),
    db.job.count({
      where: { archived: false, status: activeStatus, plannedStartDate: { gte: startOfDay(weekStart), lte: weekEnd } },
    }),
    db.job.count({
      where: { archived: false, status: activeStatus, plannedEndDate: { gte: startOfDay(weekStart), lte: weekEnd } },
    }),
  ]);

  // ----- Day columns -----
  const dayCols = Array.from({ length: days }, (_, i) => {
    const d = addDaysLocal(start, i);
    const monthChange = i === 0 || d.getDate() === 1;
    return {
      iso: isoDay(d),
      dayNum: d.getDate(),
      dow: (d.getDay() + 6) % 7, // Monday = 0
      monthLabel: monthChange ? d.toLocaleString("en-AU", { month: "short" }) : "",
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: sameDay(d, today),
    };
  });

  // ----- Schedule modal job options (reuses searchable selector, Section 41) -----
  const jobOptions = (
    await db.job.findMany({
      where: { archived: false, status: { name: { notIn: ["Cancelled"] } } },
      include: { client: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    })
  ).map((j) => ({
    value: String(j.id),
    label: `${j.jobNumber} — ${j.siteAddress || j.name}`,
    hint: `${j.client.name}${j.plannedStartDate ? " · scheduled" : " · unscheduled"}`,
  }));

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string> = {
      view, start: isoDay(startOfDay(start)), engineer, status: statusFilter, planning: planningFilter,
      priority: priorityFilter, type: typeFilter, client: clientFilter,
      completed: hideCompleted ? "hide" : "show",
      ...(panelOpen ? { panel: "unscheduled" } : {}), ...patch,
    };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    return `/planner?${p.toString()}`;
  };

  return (
    <div className="p-5">
      <PageHeader
        title="Job Planner"
        subtitle="Drag bars to reschedule, drag rows to order, drag edges to resize."
      />

      {/* Filters — GET form, manual order in the DB is never touched (Section 48) */}
      <form method="GET" action="/planner" className="mb-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="start" value={isoDay(startOfDay(start))} />
        <div>
          <label className="label">Engineer</label>
          <select name="engineer" defaultValue={engineer} className="input w-40">
            <option value="">All engineers</option>
            {engineers.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Job Status</label>
          <select name="status" defaultValue={statusFilter} className="input w-40">
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Planning Status</label>
          <select name="planning" defaultValue={planningFilter} className="input w-44">
            <option value="">All planning statuses</option>
            {Object.entries(PLANNING_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <select name="priority" defaultValue={priorityFilter} className="input w-28">
            <option value="">All</option>
            {["Low", "Normal", "High", "Urgent"].map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Project Type</label>
          <select name="type" defaultValue={typeFilter} className="input w-40">
            <option value="">All types</option>
            {types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Client</label>
          <select name="client" defaultValue={clientFilter} className="input w-40">
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        </div>
        <input type="hidden" name="completed" value="show" />
        <label className="flex items-center gap-1.5 pb-1.5 text-sm">
          <input type="checkbox" name="completed" value="hide" defaultChecked={hideCompleted} />
          Hide completed
        </label>
        <button className="btn" type="submit">Apply</button>
        <Link href={`/planner?view=${view}&start=${isoDay(startOfDay(start))}`} className="btn">Clear</Link>
      </form>

      <PlannerBoard
        view={view}
        viewOptions={PLANNER_VIEWS.map((v) => ({ ...v, href: qs({ view: v.value }) }))}
        nav={{
          prev: qs({ start: isoDay(stepAnchor(view, start, -1)) }),
          today: qs({ start: isoDay(new Date()) }),
          next: qs({ start: isoDay(stepAnchor(view, start, 1)) }),
        }}
        rangeLabel={`${fmtDate(windowStart)} – ${fmtDate(windowEnd)}`}
        dayCols={dayCols}
        jobs={scheduled}
        unscheduled={unscheduled}
        unscheduledCount={unscheduled.length}
        panelOpen={panelOpen}
        panelHref={qs({ panel: panelOpen ? "" : "unscheduled" })}
        stats={{ weekJobs, weekStarts, weekFinishes, unscheduled: unscheduled.length }}
        jobOptions={jobOptions}
        initialScheduleJobId={scheduleJobId}
        engineers={engineers}
      />
    </div>
  );
}
