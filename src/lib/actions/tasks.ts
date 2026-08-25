"use server";

import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { parseInputDate, addDays } from "@/lib/format";
import { revalidatePath } from "next/cache";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function defaultListId(): Promise<number> {
  const l = await db.taskList.findUnique({ where: { name: "General To Do" } });
  if (!l) throw new Error("Default task list missing.");
  return l.id;
}

function revalidateTasks() {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function createTask(fd: FormData) {
  const title = str(fd, "title");
  if (!title) return;
  const jobId = parseInt(str(fd, "jobId")) || null;
  const listId = parseInt(str(fd, "listId")) || (await defaultListId());
  const job = jobId ? await db.job.findUnique({ where: { id: jobId } }) : null;

  const task = await db.task.create({
    data: {
      title,
      description: str(fd, "description"),
      jobId: job?.id ?? null,
      clientId: job?.clientId ?? (parseInt(str(fd, "clientId")) || null),
      listId,
      priority: str(fd, "priority") || "Normal",
      important: str(fd, "important") === "on",
      dueDate: parseInputDate(str(fd, "dueDate")),
      dueTime: str(fd, "dueTime"),
      recurrence: str(fd, "recurrence"),
      notes: str(fd, "notes"),
      parentId: parseInt(str(fd, "parentId")) || null,
    },
  });
  if (job) {
    await logActivity(`Task created on Job ${job.jobNumber}: ${title}`, { taskId: task.id, jobId: job.id });
  }
  revalidateTasks();
  if (job) revalidatePath(`/jobs/${job.id}`);
}

export async function updateTask(id: number, fd: FormData) {
  const jobId = parseInt(str(fd, "jobId")) || null;
  const job = jobId ? await db.job.findUnique({ where: { id: jobId } }) : null;
  await db.task.update({
    where: { id },
    data: {
      title: str(fd, "title"),
      description: str(fd, "description"),
      jobId: job?.id ?? null,
      clientId: job?.clientId ?? (parseInt(str(fd, "clientId")) || null),
      listId: parseInt(str(fd, "listId")) || (await defaultListId()),
      priority: str(fd, "priority") || "Normal",
      important: str(fd, "important") === "on",
      dueDate: parseInputDate(str(fd, "dueDate")),
      dueTime: str(fd, "dueTime"),
      recurrence: str(fd, "recurrence"),
      notes: str(fd, "notes"),
    },
  });
  revalidateTasks();
}

export async function completeTask(id: number) {
  const task = await db.task.findUniqueOrThrow({ where: { id }, include: { job: true } });
  await db.task.update({ where: { id }, data: { completed: true, completedAt: new Date() } });
  if (task.job) {
    await logActivity(`Task completed on Job ${task.job.jobNumber}: ${task.title}`, { taskId: id, jobId: task.jobId! });
  }
  // Recurrence: spawn the next occurrence (Section 33).
  if (task.recurrence && task.dueDate) {
    const step = { daily: 1, weekly: 7, monthly: 30, yearly: 365 }[task.recurrence] ?? 7;
    let next = addDays(task.dueDate, step);
    if (task.recurrence === "monthly") {
      next = new Date(task.dueDate); next.setMonth(next.getMonth() + 1);
    } else if (task.recurrence === "yearly") {
      next = new Date(task.dueDate); next.setFullYear(next.getFullYear() + 1);
    }
    await db.task.create({
      data: {
        title: task.title, description: task.description, jobId: task.jobId, clientId: task.clientId,
        listId: task.listId, priority: task.priority, important: task.important,
        dueDate: next, dueTime: task.dueTime, recurrence: task.recurrence, notes: task.notes,
      },
    });
  }
  revalidateTasks();
  if (task.jobId) revalidatePath(`/jobs/${task.jobId}`);
}

export async function reopenTask(id: number) {
  await db.task.update({ where: { id }, data: { completed: false, completedAt: null } });
  revalidateTasks();
}

export async function deleteTask(id: number) {
  // Subtasks are deleted with their parent.
  await db.task.deleteMany({ where: { OR: [{ id }, { parentId: id }] } });
  revalidateTasks();
}

export async function duplicateTask(id: number) {
  const t = await db.task.findUniqueOrThrow({ where: { id } });
  await db.task.create({
    data: {
      title: t.title + " (copy)", description: t.description, jobId: t.jobId, clientId: t.clientId,
      listId: t.listId, priority: t.priority, important: t.important, dueDate: t.dueDate,
      dueTime: t.dueTime, recurrence: t.recurrence, notes: t.notes,
    },
  });
  revalidateTasks();
}

export async function toggleImportant(id: number) {
  const t = await db.task.findUniqueOrThrow({ where: { id } });
  await db.task.update({ where: { id }, data: { important: !t.important } });
  revalidateTasks();
}

/** My Day (Section 35): tag, never move from original list. */
export async function toggleMyDay(id: number) {
  const t = await db.task.findUniqueOrThrow({ where: { id } });
  await db.task.update({
    where: { id },
    data: { inMyDay: !t.inMyDay, myDayDate: !t.inMyDay ? new Date() : null },
  });
  revalidateTasks();
}

export async function moveTaskToList(id: number, listId: number) {
  await db.task.update({ where: { id }, data: { listId } });
  revalidateTasks();
}

export async function addSubtask(parentId: number, title: string) {
  if (!title.trim()) return;
  const parent = await db.task.findUniqueOrThrow({ where: { id: parentId } });
  await db.task.create({
    data: { title: title.trim(), parentId, jobId: parent.jobId, clientId: parent.clientId, listId: parent.listId },
  });
  revalidateTasks();
}

/** Persist a new display order for the task lists within one category (sidebar drag-and-drop). */
export async function reorderTaskLists(orderedIds: number[]) {
  await db.$transaction(
    orderedIds.map((id, i) => db.taskList.update({ where: { id }, data: { order: i + 1 } })),
  );
  revalidateTasks();
}
