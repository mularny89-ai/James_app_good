import { db } from "@/lib/db";
import CalendarView, { CalEvent } from "@/components/CalendarView";
import AddEventMenu from "@/components/AddEventMenu";
import { PageHeader } from "@/components/ui";
const DEFAULT_INSPECTION_COLOR = "#6b4ec2"; // consistent fallback when a job has no planner colour
const DEFAULT_EVENT_COLOR = "#2563eb";

export const dynamic = "force-dynamic";

function rangeFor(view: string, anchor: Date): { start: Date; end: Date } {
  const start = new Date(anchor);
  const end = new Date(anchor);
  if (view === "month") {
    start.setDate(1); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end.setTime(start.getTime()); end.setDate(end.getDate() + 42);
  } else if (view === "week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end.setTime(start.getTime()); end.setDate(end.getDate() + 7);
  } else if (view === "agenda") {
    end.setDate(end.getDate() + 28);
  } else {
    end.setDate(end.getDate() + 1);
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return { start, end };
}

const toISO = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default async function CalendarPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const view = (["month", "week", "day", "agenda"].includes(searchParams.view ?? "") ? searchParams.view! : "month") as "month" | "week" | "day" | "agenda";
  const anchor = searchParams.date && !isNaN(Date.parse(searchParams.date)) ? new Date(searchParams.date + "T00:00:00") : new Date();
  const { start, end } = rangeFor(view, anchor);

  const [inspections, tasks, jobs, calEvents] = await Promise.all([
    db.siteInspection.findMany({
      where: { date: { gte: start, lt: end }, status: { notIn: ["Cancelled"] } },
      include: { job: { include: { client: true } }, type: true },
    }),
    db.task.findMany({
      where: { dueDate: { gte: start, lt: end }, completed: false },
      include: { job: true },
    }),
    db.job.findMany({
      where: { dueDate: { gte: start, lt: end }, archived: false, status: { name: { notIn: ["Completed", "Cancelled"] } } },
    }),
    db.calendarEvent.findMany({
      where: { date: { gte: start, lt: end } },
      include: { job: true, client: true },
    }),
  ]);

  const events: CalEvent[] = [
    ...inspections.map((i) => ({
      id: i.id,
      kind: "inspection" as const,
      date: toISO(i.date),
      startTime: i.startTime,
      endTime: i.endTime,
      label: i.job ? i.job.jobNumber : (i.type?.name ?? "Inspection"),
      sublabel: i.siteAddress,
      title: i.type?.name ?? "Site Inspection",
      jobNumber: i.job?.jobNumber ?? null,
      address: i.siteAddress,
      clientName: i.job?.client.name ?? i.clientName,
      href: `/inspections/${i.id}`,
      // Manual override → job planner colour → inspection fallback
      color: i.color || i.job?.plannerColor || DEFAULT_INSPECTION_COLOR,
    })),
    ...calEvents.map((e) => ({
      id: e.id,
      kind: "event" as const,
      date: toISO(e.date),
      startTime: e.allDay ? "" : e.startTime,
      endTime: e.allDay ? "" : e.endTime,
      allDay: e.allDay,
      label: e.title,
      sublabel: e.location || e.notes || e.type,
      title: e.type,
      jobNumber: e.job?.jobNumber ?? null,
      address: e.location,
      clientName: e.client?.name ?? undefined,
      href: `/calendar/events/${e.id}`,
      color: e.color || DEFAULT_EVENT_COLOR,
    })),
    ...tasks.map((t) => ({
      id: t.id,
      kind: "task" as const,
      date: toISO(t.dueDate!),
      startTime: t.dueTime || "09:00",
      endTime: "",
      label: t.title,
      sublabel: t.job ? `Job ${t.job.jobNumber}` : "Task",
      title: "Task",
      jobNumber: t.job?.jobNumber ?? null,
      address: t.title,
      clientName: undefined,
      href: "/tasks?filter=today",
      color: "#b45309",
    })),
    ...jobs.map((j) => ({
      id: j.id,
      kind: "job" as const,
      date: toISO(j.dueDate!),
      startTime: "17:00",
      endTime: "",
      label: `Job ${j.jobNumber} due`,
      sublabel: j.name,
      title: "Job Due",
      jobNumber: j.jobNumber,
      address: j.siteAddress || j.name,
      clientName: undefined,
      href: `/jobs/${j.id}`,
      color: "#64748b",
    })),
  ];

  return (
    <div className="p-5">
      <PageHeader
        title="Calendar"
        subtitle="Site inspections, events, task due dates and job deadlines"
        actions={<AddEventMenu />}
      />
      {searchParams.scheduled === "1" && (
        <div className="mb-3 rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--success)", color: "var(--success)", backgroundColor: "#f0fdf4" }}>
          Site inspection scheduled successfully.
        </div>
      )}
      <CalendarView view={view} anchor={toISO(anchor)} events={events} />
    </div>
  );
}
