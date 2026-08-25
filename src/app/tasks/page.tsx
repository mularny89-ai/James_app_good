import Link from "next/link";
import { db } from "@/lib/db";
import TasksView, { TaskDTO } from "@/components/TasksView";
import TaskListsNav from "@/components/TaskListsNav";
import { startOfDay, endOfDay } from "@/lib/format";
import { TASK_CATEGORIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const SMART_VIEWS = [
  { key: "myday", label: "My Day", icon: "☀" },
  { key: "important", label: "Important", icon: "★" },
  { key: "planned", label: "Planned", icon: "◷" },
  { key: "completed", label: "Completed", icon: "✓" },
];

export default async function TasksPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const view = searchParams.view ?? "myday";
  const listId = searchParams.list ? parseInt(searchParams.list) : null;
  const filter = searchParams.filter ?? "";
  const clientId = searchParams.clientId ? parseInt(searchParams.clientId) : undefined;
  const autoFocusNew = searchParams.new === "1";

  const [lists, jobs] = await Promise.all([
    db.taskList.findMany({ orderBy: { order: "asc" } }),
    db.job.findMany({ where: { archived: false }, select: { id: true, jobNumber: true, name: true }, orderBy: { jobNumber: "desc" }, take: 500 }),
  ]);

  // Category groups for the sidebar + Move To dropdown (preserves TASK_CATEGORIES order)
  const knownCats = new Set<string>(TASK_CATEGORIES);
  const extraCats = lists.map((l) => l.category || "General").filter((c, i, a) => !knownCats.has(c) && a.indexOf(c) === i);
  const catNames = [...TASK_CATEGORIES, ...extraCats];
  const categories = catNames
    .map((name) => ({ name, lists: lists.filter((l) => (l.category || "General") === name) }))
    .filter((c) => c.lists.length > 0);

  // Build the query for the active view
  const where: any = {};
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  let activeList = lists[0];
  let heading = "My Day";

  if (view === "myday") {
    where.inMyDay = true;
    where.completed = false;
    heading = "My Day";
  } else if (view === "important") {
    where.important = true;
    where.completed = false;
    heading = "Important";
  } else if (view === "planned") {
    where.completed = false;
    heading = "Planned";
  } else if (view === "completed") {
    // Completed is a cross-category smart view: every completed task, from all lists.
    where.completed = true;
    heading = "Completed";
  } else if (view === "list" && listId) {
    activeList = lists.find((l) => l.id === listId) ?? lists[0];
    heading = activeList.name;
    where.listId = listId;
  }

  if (filter === "overdue") {
    where.completed = false;
    where.dueDate = { lt: todayStart };
    heading = "Overdue Tasks";
  } else if (filter === "today") {
    where.completed = false;
    where.dueDate = { gte: todayStart, lte: todayEnd };
    heading = "Due Today";
  } else if (filter === "week") {
    const weekEnd = endOfDay(new Date(todayStart.getTime() + 6 * 86400000));
    where.completed = false;
    where.dueDate = { gte: todayStart, lte: weekEnd };
    heading = "Due This Week";
  }

  if (clientId) where.clientId = clientId;

  const isCompletedView = view === "completed";
  const raw = await db.task.findMany({
    where,
    include: {
      job: { select: { id: true, jobNumber: true } },
      client: { select: { name: true } },
      list: true,
      subtasks: { select: { id: true, title: true, completed: true } },
    },
    orderBy: isCompletedView
      ? [{ completedAt: "desc" }]
      : [{ completed: "asc" }, { dueDate: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    take: 500,
  });

  const tasks: TaskDTO[] = raw.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    jobId: t.jobId,
    jobNumber: t.job?.jobNumber ?? null,
    clientName: t.client?.name ?? null,
    listId: t.listId,
    listName: t.list.name,
    categoryName: t.list.category || "General",
    completed: t.completed,
    priority: t.priority,
    important: t.important,
    inMyDay: t.inMyDay,
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    dueTime: t.dueTime,
    recurrence: t.recurrence,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    parentId: t.parentId,
    subtasks: t.subtasks,
  }));

  const counts = {
    myday: await db.task.count({ where: { inMyDay: true, completed: false } }),
    important: await db.task.count({ where: { important: true, completed: false } }),
    completed: await db.task.count({ where: { completed: true } }),
    overdue: await db.task.count({ where: { completed: false, dueDate: { lt: todayStart } } }),
  };

  const defaultListId = view === "list" && listId ? listId : (lists.find((l) => l.name === "General To Do")?.id ?? lists[0]?.id);

  return (
    <div className="flex h-full">
      {/* Task lists sidebar */}
      <aside className="w-56 shrink-0 overflow-y-auto border-r border-line bg-white py-3">
        <div className="px-3 pb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Smart Views</div>
        {SMART_VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/tasks?view=${v.key}`}
            className={`mx-2 mb-0.5 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm ${view === v.key ? "font-medium text-white" : "hover:bg-gray-100"}`}
            style={view === v.key ? { backgroundColor: "var(--brand-primary)" } : undefined}
          >
            <span>{v.icon}</span>
            <span className="flex-1">{v.label}</span>
            {v.key === "myday" && counts.myday > 0 && <span className="text-xs">{counts.myday}</span>}
            {v.key === "important" && counts.important > 0 && <span className="text-xs">{counts.important}</span>}
            {v.key === "completed" && counts.completed > 0 && <span className="text-xs">{counts.completed}</span>}
          </Link>
        ))}

        <TaskListsNav
          categories={categories.map((c) => ({ name: c.name, lists: c.lists.map((l) => ({ id: l.id, name: l.name })) }))}
          activeListId={view === "list" ? listId : null}
        />
        <p className="mx-3 mt-2 text-xs text-ink-muted">
          Manage lists in <Link href="/settings?tab=lists" className="link">Settings</Link>.
        </p>

        <div className="mt-3 px-3 pb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Filters</div>
        {[
          { f: "today", label: "Due Today" },
          { f: "week", label: "Due This Week" },
          { f: "overdue", label: `Overdue (${counts.overdue})` },
        ].map((x) => (
          <Link
            key={x.f}
            href={`/tasks?view=list&filter=${x.f}`}
            className={`mx-2 mb-0.5 block rounded-md px-2.5 py-1.5 text-sm ${filter === x.f ? "font-medium" : "hover:bg-gray-100"}`}
            style={filter === x.f ? { color: "var(--brand-primary)" } : undefined}
          >
            {x.label}
          </Link>
        ))}
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-5">
        <h1 className="mb-4 text-lg font-semibold">{heading}</h1>
        <TasksView
          tasks={tasks}
          categories={categories.map((c) => ({ name: c.name, lists: c.lists.map((l) => ({ id: l.id, name: l.name })) }))}
          jobs={jobs}
          jobsById={Object.fromEntries(jobs.map((j) => [j.id, j]))}
          view={view}
          defaultListId={defaultListId}
          clientId={clientId}
          autoFocusNew={autoFocusNew}
        />
      </div>
    </div>
  );
}
