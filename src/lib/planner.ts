/** Job Planner helpers — working-day maths, colour palette, planning status. */

import { startOfDay } from "./format";

export type DurationUnit = "working" | "calendar";

export const DURATION_UNITS: { value: DurationUnit; label: string }[] = [
  { value: "working", label: "Working Days" },
  { value: "calendar", label: "Calendar Days" },
];

export function unitLabel(unit: string, n?: number): string {
  const base = unit === "calendar" ? "calendar day" : "working day";
  return n === undefined ? base : `${n} ${base}${n === 1 ? "" : "s"}`;
}

export function isWeekend(d: Date): boolean {
  const g = d.getDay();
  return g === 0 || g === 6;
}

/** Roll a date forward to the next Monday–Friday day (returns input if already a working day). */
export function nextWorkingDay(d: Date): Date {
  const x = startOfDay(d);
  while (isWeekend(x)) x.setDate(x.getDate() + 1);
  return x;
}

/**
 * End date for a job starting on `start` with the given duration.
 * The start day counts as day 1. Working-day durations skip weekends;
 * a weekend start rolls forward to Monday first.
 */
export function addDuration(start: Date, duration: number, unit: string): Date {
  const n = Math.max(1, Math.round(duration));
  if (unit === "calendar") {
    const x = startOfDay(start);
    x.setDate(x.getDate() + n - 1);
    return x;
  }
  let x = nextWorkingDay(start);
  let remaining = n - 1;
  while (remaining > 0) {
    x.setDate(x.getDate() + 1);
    if (!isWeekend(x)) remaining--;
  }
  return x;
}

/** Inclusive duration between start and end in the given unit (0 if end < start). */
export function durationBetween(start: Date, end: Date, unit: string): number {
  const a = startOfDay(start);
  const b = startOfDay(end);
  if (b.getTime() < a.getTime()) return 0;
  if (unit === "calendar") return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  let count = 0;
  const x = new Date(a);
  while (x.getTime() <= b.getTime()) {
    if (!isWeekend(x)) count++;
    x.setDate(x.getDate() + 1);
  }
  return count;
}

/**
 * Professional planner palette — clearly distinguishable, no neon, white-text readable.
 * Colours are assigned from here in order of least use; never random RGB.
 */
export const PLANNER_PALETTE: { name: string; color: string }[] = [
  { name: "Blue", color: "#3b5bdb" },
  { name: "Orange", color: "#e8590c" },
  { name: "Green", color: "#2f9e44" },
  { name: "Purple", color: "#9c36b5" },
  { name: "Amber", color: "#e8890c" },
  { name: "Teal", color: "#0c8599" },
  { name: "Raspberry", color: "#c2255c" },
  { name: "Violet", color: "#6741d9" },
  { name: "Brown", color: "#8d6e4c" },
  { name: "Slate", color: "#4a6582" },
  { name: "Crimson", color: "#c92a2a" },
  { name: "Olive", color: "#5c940d" },
];

/** Pick the least-used palette colour given colours already assigned to other jobs. */
export function assignPlannerColor(usedColors: string[]): string {
  const used = new Set(usedColors.map((c) => c.toLowerCase()));
  const free = PLANNER_PALETTE.find((p) => !used.has(p.color.toLowerCase()));
  if (free) return free.color;
  return PLANNER_PALETTE[used.size % PLANNER_PALETTE.length].color;
}

export type PlanningStatusKey =
  | "completed"
  | "unscheduled"
  | "scheduled"
  | "starting-today"
  | "in-period"
  | "overdue";

export const PLANNING_STATUS_LABELS: Record<PlanningStatusKey, string> = {
  completed: "Completed",
  unscheduled: "Unscheduled",
  scheduled: "Scheduled",
  "starting-today": "Starting Today",
  "in-period": "In Planned Period",
  overdue: "Planned Finish Passed",
};

/** Derived planning status — separate from the Job Status lifecycle. */
export function planningStatus(job: {
  plannedStartDate: Date | null;
  plannedEndDate: Date | null;
  statusName: string;
}): PlanningStatusKey {
  if (job.statusName === "Completed") return "completed";
  if (!job.plannedStartDate) return "unscheduled";
  const today = startOfDay(new Date());
  const start = startOfDay(new Date(job.plannedStartDate));
  const end = startOfDay(new Date(job.plannedEndDate ?? job.plannedStartDate));
  if (today.getTime() < start.getTime()) return "scheduled";
  if (today.getTime() === start.getTime()) return "starting-today";
  if (today.getTime() <= end.getTime()) return "in-period";
  return "overdue";
}

/** Small date helpers for the planner grid (local-time, ISO yyyy-mm-dd keys). */
export function isoDay(d: Date): string {
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromIsoDay(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

export function addDaysLocal(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfMonday(d: Date): Date {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7;
  return addDaysLocal(x, -day);
}

export type PlannerView = "week" | "month" | "6weeks" | "3months";

export const PLANNER_VIEWS: { value: PlannerView; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "6weeks", label: "6 Weeks" },
  { value: "3months", label: "3 Months" },
];

/** Column width (px) per view — bars get narrower as the zoom goes out. */
export const VIEW_COL_W: Record<PlannerView, number> = {
  week: 128,
  month: 44,
  "6weeks": 32,
  "3months": 18,
};

/** Window [start, days] for a view anchored at `anchor`. */
export function viewWindow(view: PlannerView, anchor: Date): { start: Date; days: number } {
  if (view === "week") return { start: startOfMonday(anchor), days: 7 };
  if (view === "month") {
    const s = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const days = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    return { start: s, days };
  }
  if (view === "6weeks") return { start: startOfMonday(anchor), days: 42 };
  const s = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 3, 0);
  return { start: s, days: Math.round((end.getTime() - s.getTime()) / 86400000) + 1 };
}

/** Advance/rewind the anchor by one view-length step. */
export function stepAnchor(view: PlannerView, anchor: Date, dir: 1 | -1): Date {
  if (view === "week") return addDaysLocal(anchor, 7 * dir);
  if (view === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  if (view === "6weeks") return addDaysLocal(anchor, 42 * dir);
  return new Date(anchor.getFullYear(), anchor.getMonth() + 3 * dir, 1);
}
