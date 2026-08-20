"use server";

import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { fmtDate, parseInputDate } from "@/lib/format";
import { addDuration, durationBetween, assignPlannerColor, unitLabel, nextWorkingDay } from "@/lib/planner";
import { revalidatePath } from "next/cache";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function revalidate(jobId: number) {
  revalidatePath("/planner");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
}

/** Assign a persistent palette colour on first scheduling; never overwrite an existing one. */
async function ensureColor(jobId: number, current: string): Promise<string> {
  if (current) return current;
  const others = await db.job.findMany({
    where: { plannerColor: { not: "" }, id: { not: jobId } },
    select: { plannerColor: true },
  });
  const color = assignPlannerColor(others.map((o) => o.plannerColor));
  await db.job.update({ where: { id: jobId }, data: { plannerColor: color } });
  return color;
}

async function appendToPlannerOrder(jobId: number) {
  const max = await db.job.aggregate({ _max: { plannerSortOrder: true } });
  await db.job.update({
    where: { id: jobId },
    data: { plannerSortOrder: (max._max.plannerSortOrder ?? 0) + 10 },
  });
}

/**
 * Schedule a job: start date + either duration or explicit end date.
 * Keeps Start / End / Duration consistent (Sections 5–8).
 * orderedIds, when given, rewrites the full manual planner order (drag-insert).
 */
export async function scheduleJob(
  jobId: number,
  startISO: string,
  opts: { duration?: number; endISO?: string; unit?: string; orderedIds?: number[] } = {}
) {
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
  const unit = opts.unit === "calendar" ? "calendar" : "working";
  const raw = parseInputDate(startISO);
  if (!raw) throw new Error("A planned start date is required.");
  // Working-day jobs never start on a weekend — roll forward to Monday.
  const start = unit === "working" ? nextWorkingDay(raw) : raw;

  let end: Date;
  let duration: number;
  if (opts.endISO) {
    end = parseInputDate(opts.endISO)!;
    if (end.getTime() < start.getTime()) throw new Error("Planned end cannot be before planned start.");
    duration = durationBetween(start, end, unit);
  } else {
    duration = Math.max(1, Math.round(opts.duration ?? job.plannedDuration ?? 0) || 1);
    end = addDuration(start, duration, unit);
  }

  await ensureColor(jobId, job.plannerColor);
  await db.job.update({
    where: { id: jobId },
    data: { plannedStartDate: start, plannedEndDate: end, plannedDuration: duration, durationUnit: unit },
  });
  if (opts.orderedIds?.length) await applyPlannerOrder(opts.orderedIds);
  else if (!job.plannedStartDate) await appendToPlannerOrder(jobId);

  const verb = job.plannedStartDate ? "rescheduled" : "scheduled";
  await logActivity(
    `Job ${job.jobNumber} ${verb}: ${fmtDate(start)} – ${fmtDate(end)} (${unitLabel(unit, duration)})`,
    { jobId, clientId: job.clientId }
  );
  revalidate(jobId);
}

/** Compact scheduler form (+ Schedule Job / drag-without-duration prompt). */
export async function scheduleJobForm(fd: FormData) {
  const jobId = parseInt(str(fd, "jobId"));
  if (!jobId) throw new Error("Choose a job to schedule.");
  const startISO = str(fd, "plannedStart");
  const unit = str(fd, "unit") || "working";
  const mode = str(fd, "mode");
  await scheduleJob(jobId, startISO, {
    unit,
    ...(mode === "end" ? { endISO: str(fd, "plannedEnd") } : { duration: parseInt(str(fd, "duration")) || 1 }),
  });
}

/** Horizontal drag: move the whole bar to a new start date, preserving duration. */
export async function moveJobToDate(jobId: number, startISO: string) {
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
  const raw = parseInputDate(startISO);
  if (!raw || !job.plannedStartDate) return;
  const start = job.durationUnit === "working" ? nextWorkingDay(raw) : raw;
  const duration = job.plannedDuration ?? 1;
  const end = addDuration(start, duration, job.durationUnit);
  await db.job.update({
    where: { id: jobId },
    data: { plannedStartDate: start, plannedEndDate: end },
  });
  await logActivity(`Job ${job.jobNumber} rescheduled to ${fmtDate(start)} – ${fmtDate(end)}`, {
    jobId,
    clientId: job.clientId,
  });
  revalidate(jobId);
}

/** Resize the right edge of the bar: new duration in the job's own unit. */
export async function resizeJobDuration(jobId: number, newDuration: number) {
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
  if (!job.plannedStartDate) return;
  const duration = Math.max(1, Math.round(newDuration));
  const end = addDuration(job.plannedStartDate, duration, job.durationUnit);
  await db.job.update({
    where: { id: jobId },
    data: { plannedDuration: duration, plannedEndDate: end },
  });
  if (duration !== job.plannedDuration) {
    await logActivity(
      `Job ${job.jobNumber} planned duration changed from ${job.plannedDuration ?? "—"} to ${duration} ${job.durationUnit === "calendar" ? "calendar" : "working"} days`,
      { jobId, clientId: job.clientId }
    );
  }
  revalidate(jobId);
}

/** Clear planned dates; the job keeps its colour and moves to Unscheduled Jobs. */
export async function unscheduleJob(jobId: number) {
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
  const max = await db.job.aggregate({ _max: { unscheduledOrder: true } });
  await db.job.update({
    where: { id: jobId },
    data: {
      plannedStartDate: null,
      plannedEndDate: null,
      unscheduledOrder: (max._max.unscheduledOrder ?? 0) + 10,
    },
  });
  await logActivity(`Job ${job.jobNumber} removed from the planner (unscheduled)`, {
    jobId,
    clientId: job.clientId,
  });
  revalidate(jobId);
}

export async function setPlannerColor(jobId: number, color: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
  await db.job.update({ where: { id: jobId }, data: { plannerColor: color } });
  revalidate(jobId);
}

async function applyPlannerOrder(ids: number[]) {
  await db.$transaction(
    ids.map((id, i) => db.job.update({ where: { id }, data: { plannerSortOrder: (i + 1) * 10 } }))
  );
}

/** Persist the full manual vertical order (drag or Move Up/Down). No activity noise. */
export async function reorderPlanner(ids: number[]) {
  if (!ids.length) return;
  await applyPlannerOrder(ids);
  revalidatePath("/planner");
}

export async function reorderUnscheduled(ids: number[]) {
  if (!ids.length) return;
  await db.$transaction(
    ids.map((id, i) => db.job.update({ where: { id }, data: { unscheduledOrder: (i + 1) * 10 } }))
  );
  revalidatePath("/planner");
}

/** Quick planner actions — engineer / priority without opening the full job form. */
export async function setJobEngineer(jobId: number, engineer: string) {
  await db.job.update({ where: { id: jobId }, data: { assignedEngineer: engineer.trim() } });
  revalidate(jobId);
}

export async function setJobPriority(jobId: number, priority: string) {
  await db.job.update({ where: { id: jobId }, data: { priority } });
  revalidate(jobId);
}
