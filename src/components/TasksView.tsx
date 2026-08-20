"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  createTask, updateTask, completeTask, reopenTask, deleteTask, duplicateTask,
  toggleImportant, toggleMyDay, moveTaskToList, addSubtask,
} from "@/lib/actions/tasks";
import MoveTo from "@/components/MoveTo";
import ConfirmButton from "@/components/ConfirmButton";
import { priorityColor, PRIORITIES, RECURRENCE_OPTIONS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";

export type TaskDTO = {
  id: number;
  title: string;
  description: string;
  jobId: number | null;
  jobNumber: string | null;
  clientName: string | null;
  listId: number;
  listName: string;
  completed: boolean;
  priority: string;
  important: boolean;
  inMyDay: boolean;
  dueDate: string | null;
  dueTime: string;
  recurrence: string;
  notes: string;
  createdAt: string;
  completedAt: string | null;
  parentId: number | null;
  subtasks: { id: number; title: string; completed: boolean }[];
};

type ListOpt = { id: number; name: string };
type JobOpt = { id: number; jobNumber: string; name: string };

function Group({ title, tone, children }: { title: string; tone?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: tone ?? "var(--text-secondary)" }}>{title}</h3>
      <div className="card divide-y divide-line">{children}</div>
    </div>
  );
}

function TaskRow({
  task,
  lists,
  jobs,
  onExpand,
  expanded,
}: {
  task: TaskDTO;
  lists: ListOpt[];
  jobs: JobOpt[];
  expanded: boolean;
  onExpand: (id: number | null) => void;
}) {
  const [, start] = useTransition();
  const [subtaskText, setSubtaskText] = useState("");

  const overdue = task.dueDate && !task.completed && new Date(task.dueDate) < new Date(new Date().toDateString());

  return (
    <div className="px-3 py-1.5">
      <div className="flex items-center gap-2">
        <button
          aria-label={task.completed ? "Reopen task" : "Complete task"}
          onClick={() => start(async () => (task.completed ? reopenTask(task.id) : completeTask(task.id)))}
          className={`flex h-4.5 w-4.5 h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[10px] ${
            task.completed ? "text-white" : "border-line hover:border-brand"
          }`}
          style={task.completed ? { backgroundColor: "var(--success)", borderColor: "var(--success)" } : undefined}
        >
          {task.completed && "✓"}
        </button>

        <button className="min-w-0 flex-1 text-left" onClick={() => onExpand(expanded ? null : task.id)}>
          <span className={`block truncate text-sm ${task.completed ? "text-ink-muted line-through" : ""}`}>{task.title}</span>
          <span className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            {task.jobNumber && (
              <Link href={`/jobs/${task.jobId}`} className="link font-semibold" onClick={(e) => e.stopPropagation()}>
                {task.jobNumber}
              </Link>
            )}
            {task.clientName && !task.jobNumber && <span>{task.clientName}</span>}
            {task.listName && <span>{task.listName}</span>}
            {task.dueDate && (
              <span className={overdue ? "font-semibold text-err" : ""}>
                {overdue ? "Overdue: " : "Due "}{fmtDate(task.dueDate)}{task.dueTime ? ` ${task.dueTime}` : ""}
              </span>
            )}
            {task.recurrence && <span>↻ {task.recurrence}</span>}
            {task.subtasks.length > 0 && (
              <span>{task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} subtasks</span>
            )}
            <span style={{ color: priorityColor(task.priority) }}>{task.priority !== "Normal" ? task.priority : ""}</span>
          </span>
        </button>

        <button
          aria-label="Add to My Day"
          title={task.inMyDay ? "Remove from My Day" : "Add to My Day"}
          onClick={() => start(async () => toggleMyDay(task.id))}
          className={`text-sm ${task.inMyDay ? "" : "text-ink-muted hover:text-ink"}`}
          style={task.inMyDay ? { color: "var(--brand-primary)" } : undefined}
        >
          {task.inMyDay ? "◉" : "○"}
        </button>
        <button
          aria-label="Toggle important"
          onClick={() => start(async () => toggleImportant(task.id))}
          className={`text-sm ${task.important ? "text-warn" : "text-ink-muted hover:text-warn"}`}
        >
          {task.important ? "★" : "☆"}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 rounded-md border border-line bg-gray-50 p-3">
          <form
            action={async (fd: FormData) => { await updateTask(task.id, fd); onExpand(null); }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <label className="label">Task</label>
              <input name="title" className="input" defaultValue={task.title} required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea name="description" rows={2} className="input" defaultValue={task.description} />
            </div>
            <div>
              <label className="label">Job</label>
              <select name="jobId" className="input" defaultValue={task.jobId ?? ""}>
                <option value="">No job (general task)</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.jobNumber} — {j.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">List</label>
              <select name="listId" className="input" defaultValue={task.listId}>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" name="dueDate" className="input" defaultValue={task.dueDate ?? ""} />
            </div>
            <div>
              <label className="label">Due Time</label>
              <input type="time" name="dueTime" className="input" defaultValue={task.dueTime} />
            </div>
            <div>
              <label className="label">Priority</label>
              <select name="priority" className="input" defaultValue={task.priority}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Repeats</label>
              <select name="recurrence" className="input" defaultValue={task.recurrence}>
                {RECURRENCE_OPTIONS.map((r) => <option key={r} value={r}>{r || "Never"}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="important" defaultChecked={task.important} /> Important
            </label>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea name="notes" rows={2} className="input" defaultValue={task.notes} />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <button type="submit" className="btn-primary">Save</button>
              <MoveTo
                options={lists.map((l) => ({ id: l.id, label: `Move to ${l.name}` }))}
                current={task.listId}
                onMove={async (listId: number) => moveTaskToList(task.id, listId)}
              />
              <button type="button" className="btn" onClick={() => start(async () => duplicateTask(task.id))}>Duplicate</button>
              <ConfirmButton label="Delete" message="Delete this task and its subtasks?" className="btn-danger"
                onConfirm={async () => deleteTask(task.id)} />
            </div>
          </form>

          {/* Subtasks */}
          <div className="mt-3 border-t border-line pt-2">
            <span className="label">Subtasks</span>
            <ul className="mb-2 space-y-1">
              {task.subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <button
                    onClick={() => start(async () => (s.completed ? reopenTask(s.id) : completeTask(s.id)))}
                    className="flex h-[16px] w-[16px] items-center justify-center rounded-full border border-line text-[9px]"
                    style={s.completed ? { backgroundColor: "var(--success)", borderColor: "var(--success)", color: "#fff" } : undefined}
                  >
                    {s.completed && "✓"}
                  </button>
                  <span className={s.completed ? "text-ink-muted line-through" : ""}>{s.title}</span>
                </li>
              ))}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!subtaskText.trim()) return;
                const t = subtaskText;
                setSubtaskText("");
                start(async () => addSubtask(task.id, t));
              }}
            >
              <input className="input" placeholder="Add a subtask…" value={subtaskText} onChange={(e) => setSubtaskText(e.target.value)} />
              <button className="btn" type="submit">Add</button>
            </form>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Created {fmtDate(task.createdAt)}{task.completedAt ? ` · Completed ${fmtDate(task.completedAt)}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

export default function TasksView({
  tasks,
  lists,
  jobs,
  jobsById,
  view,
  defaultListId,
  clientId,
  autoFocusNew,
}: {
  tasks: TaskDTO[];
  lists: ListOpt[];
  jobs: JobOpt[];
  jobsById: Record<number, JobOpt>;
  view: string;
  defaultListId: number;
  clientId?: number;
  autoFocusNew?: boolean;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [search, setSearch] = useState("");
  const [, start] = useTransition();

  const visible = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase();
    return tasks.filter((t) =>
      [t.title, t.description, t.notes, t.clientName ?? "", String(t.jobNumber ?? "")].join(" ").toLowerCase().includes(q)
    );
  }, [tasks, search]);

  const parents = visible.filter((t) => !t.parentId);

  const groups = useMemo(() => {
    if (view !== "planned") return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
    const g: Record<string, TaskDTO[]> = { Overdue: [], Today: [], Tomorrow: [], "This Week": [], Later: [], "No Date": [] };
    for (const t of parents) {
      if (t.completed) continue;
      if (!t.dueDate) { g["No Date"].push(t); continue; }
      const d = new Date(t.dueDate);
      if (d < today) g["Overdue"].push(t);
      else if (d.getTime() === today.getTime()) g["Today"].push(t);
      else if (d.getTime() === tomorrow.getTime()) g["Tomorrow"].push(t);
      else if (d <= weekEnd) g["This Week"].push(t);
      else g["Later"].push(t);
    }
    return g;
  }, [parents, view]);

  const renderRow = (t: TaskDTO) => (
    <TaskRow key={t.id} task={t} lists={lists} jobs={jobs} expanded={expanded === t.id} onExpand={setExpanded} />
  );

  return (
    <div>
      {/* Quick add — Enter saves (Section 111) */}
      <form
        className="card mb-4 flex items-center gap-2 px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newTitle.trim()) return;
          const fd = new FormData();
          fd.set("title", newTitle.trim());
          fd.set("listId", String(defaultListId));
          if (clientId) fd.set("clientId", String(clientId));
          setNewTitle("");
          start(async () => createTask(fd));
        }}
      >
        <span className="text-lg leading-none" style={{ color: "var(--brand-primary)" }}>+</span>
        <input
          className="w-full bg-transparent text-sm outline-none"
          placeholder={`Add a task to ${lists.find((l) => l.id === defaultListId)?.name ?? "list"}… (Enter to save)`}
          value={newTitle}
          autoFocus={autoFocusNew}
          onChange={(e) => setNewTitle(e.target.value)}
        />
      </form>

      <input
        className="input mb-3 max-w-xs"
        placeholder="Filter tasks…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {groups ? (
        (Object.entries(groups) as [string, TaskDTO[]][]).map(([name, items]) =>
          items.length === 0 ? null : (
            <Group key={name} title={`${name} (${items.length})`} tone={name === "Overdue" ? "var(--error)" : undefined}>
              {items.map(renderRow)}
            </Group>
          )
        )
      ) : parents.length === 0 ? (
        <div className="card px-4 py-8 text-center text-sm text-ink-muted">
          {view === "myday" ? "Nothing planned for today. Add tasks to My Day using the ◉ button on any task."
            : view === "important" ? "No important tasks. Star a task with ★ to see it here."
            : view === "completed" ? "No completed tasks yet."
            : "No tasks here yet."}
        </div>
      ) : (
        <div className="card divide-y divide-line">{parents.map(renderRow)}</div>
      )}
    </div>
  );
}
