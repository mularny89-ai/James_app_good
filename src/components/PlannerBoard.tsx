"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition, useEffect } from "react";
import SearchableSelect from "@/components/SearchableSelect";
import { fmtDate, displayJobName } from "@/lib/format";
import {
  PLANNER_PALETTE, VIEW_COL_W, chunkWeeks, durationBetween, fromIsoDay, unitLabel, type PlannerView,
} from "@/lib/planner";
import {
  scheduleJob, scheduleJobForm, moveJobToDate, resizeJobDuration, unscheduleJob,
  setPlannerColor, reorderPlanner, reorderUnscheduled, setJobEngineer, setJobPriority,
} from "@/lib/actions/planner";
import { PlannerMonthView, PlannerSixWeekView, PlannerThreeMonthView } from "@/components/PlannerWrappedView";

export type PlannerJobData = {
  id: number;
  jobNumber: string;
  name: string;
  siteAddress: string;
  siteStreet: string;
  clientName: string;
  engineer: string;
  priority: string;
  statusName: string;
  statusColor: string;
  projectType: string;
  startISO: string;
  endISO: string;
  duration: number;
  unit: string;
  color: string;
  planningStatus: string;
  planningLabel: string;
  openTasks: number;
  completed: boolean;
  overdue: boolean;
  inspections: { id: number; iso: string; label: string }[];
};

export type UnscheduledJobData = {
  id: number;
  jobNumber: string;
  name: string;
  siteAddress: string;
  clientName: string;
  priority: string;
  statusName: string;
  statusColor: string;
  engineer: string;
  duration: number | null;
  unit: string;
};

export type DayCol = {
  iso: string;
  dayNum: number;
  dow: number; // Monday = 0
  monthLabel: string;
  isWeekend: boolean;
  isToday: boolean;
};

const LABEL_W = 240;
const DOW_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const DOW_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function diffDays(aISO: string, bISO: string): number {
  return Math.round((fromIsoDay(bISO).getTime() - fromIsoDay(aISO).getTime()) / 86400000);
}

type SortKey = "manual" | "start" | "end" | "number" | "priority" | "engineer" | "engineer-group";
const PRIORITY_RANK: Record<string, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 };

export default function PlannerBoard({
  view,
  viewOptions,
  nav,
  rangeLabel,
  dayCols,
  jobs,
  unscheduled,
  unscheduledCount,
  panelOpen,
  panelHref,
  stats,
  jobOptions,
  initialScheduleJobId,
  engineers,
}: {
  view: PlannerView;
  viewOptions: { value: string; label: string; href: string }[];
  nav: { prev: string; today: string; next: string };
  rangeLabel: string;
  dayCols: DayCol[];
  jobs: PlannerJobData[];
  unscheduled: UnscheduledJobData[];
  unscheduledCount: number;
  panelOpen: boolean;
  panelHref: string;
  stats: { weekJobs: number; weekStarts: number; weekFinishes: number; unscheduled: number };
  jobOptions: { value: string; label: string; hint?: string }[];
  initialScheduleJobId?: number;
  engineers: string[];
}) {
  const colW = VIEW_COL_W[view];
  const nDays = dayCols.length;
  const windowStartISO = dayCols[0]?.iso ?? "";
  const [, start] = useTransition();

  // ----- Manual vertical order (local mirror of the persisted DB order) -----
  const propOrder = useMemo(() => jobs.map((j) => j.id), [jobs]);
  const [localOrder, setLocalOrder] = useState<number[]>(propOrder);
  useEffect(() => setLocalOrder(propOrder), [propOrder]);

  const propUnsOrder = useMemo(() => unscheduled.map((j) => j.id), [unscheduled]);
  const [unsOrder, setUnsOrder] = useState<number[]>(propUnsOrder);
  useEffect(() => setUnsOrder(propUnsOrder), [propUnsOrder]);

  const [sort, setSort] = useState<SortKey>("manual");
  const [popoverId, setPopoverId] = useState<number | null>(null);
  const [dropRowId, setDropRowId] = useState<number | null>(null);
  const [dropUnsId, setDropUnsId] = useState<number | null>(null);
  const [scheduleModal, setScheduleModal] = useState<{
    open: boolean; presetJobId?: number; presetStart?: string; durationOnly?: boolean;
  }>({ open: !!initialScheduleJobId, presetJobId: initialScheduleJobId });
  const [resizePrev, setResizePrev] = useState<{ jobId: number; endIdx: number } | null>(null);
  const [err, setErr] = useState("");
  const resizing = useRef(false);

  // ----- Mouse-wheel navigation: scroll over the calendar always steps ±1 week
  // (not by view length) so overlapping jobs at month boundaries are never skipped.
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);
  const wheelAcc = useRef(0);
  const wheelLockUntil = useRef(0);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const weekHref = (dir: 1 | -1): string => {
      // Use the Prev href only as a query-shape template (it carries the live
      // filters). Anchor = the current URL's `start` (the unpadded anchor the
      // page used), stepped by exactly 7 days regardless of view length.
      const [path, qs] = (dir === 1 ? nav.next : nav.prev).split("?");
      const params = new URLSearchParams(qs);
      const current = new URLSearchParams(window.location.search).get("start") || windowStartISO;
      const d = new Date(`${current}T00:00:00`);
      d.setDate(d.getDate() + dir * 7);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      params.set("start", iso);
      params.set("view", view);
      return `${path}?${params.toString()}`;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now < wheelLockUntil.current) return;
      if (Math.sign(e.deltaY) !== Math.sign(wheelAcc.current)) wheelAcc.current = 0;
      wheelAcc.current += e.deltaY;
      if (Math.abs(wheelAcc.current) < 60) return;
      const href = weekHref(wheelAcc.current > 0 ? 1 : -1);
      wheelAcc.current = 0;
      wheelLockUntil.current = now + 500;
      router.push(href);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [nav.prev, nav.next, router, view, windowStartISO]);

  // ----- Rows: manual order is the source of truth; other sorts are views only -----
  const byId = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
  const manualRows = useMemo(
    () => localOrder.map((id) => byId.get(id)).filter((j): j is PlannerJobData => !!j),
    [localOrder, byId]
  );
  const sortedRows = useMemo(() => {
    const arr = [...manualRows];
    switch (sort) {
      case "start": return arr.sort((a, b) => a.startISO.localeCompare(b.startISO));
      case "end": return arr.sort((a, b) => a.endISO.localeCompare(b.endISO));
      case "number": return arr.sort((a, b) => a.jobNumber.localeCompare(b.jobNumber));
      case "priority": return arr.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9));
      case "engineer":
      case "engineer-group":
        return arr.sort((a, b) => (a.engineer || "￿").localeCompare(b.engineer || "￿"));
      default: return arr;
    }
  }, [manualRows, sort]);

  const groups = useMemo(() => {
    if (sort !== "engineer-group") return [{ label: "", rows: sortedRows }];
    const out: { label: string; rows: PlannerJobData[] }[] = [];
    for (const j of sortedRows) {
      const label = j.engineer || "Unassigned";
      const g = out[out.length - 1];
      if (g && g.label === label) g.rows.push(j);
      else out.push({ label, rows: [j] });
    }
    return out;
  }, [sortedRows, sort]);

  const unsById = useMemo(() => new Map(unscheduled.map((j) => [j.id, j])), [unscheduled]);
  const unsRows = unsOrder.map((id) => unsById.get(id)).filter((j): j is UnscheduledJobData => !!j);

  // Month / 6 Weeks / 3 Months render as stacked Monday–Sunday week rows.
  const weeks = useMemo(() => chunkWeeks(dayCols), [dayCols]);

  const moveInList = (list: number[], id: number, beforeId: number) => {
    const arr = list.filter((x) => x !== id);
    const idx = arr.indexOf(beforeId);
    arr.splice(idx === -1 ? arr.length : idx, 0, id);
    return arr;
  };

  const moveByOffset = (id: number, offset: -1 | 1) => {
    const idx = localOrder.indexOf(id);
    const swap = idx + offset;
    if (idx === -1 || swap < 0 || swap >= localOrder.length) return;
    const arr = [...localOrder];
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setLocalOrder(arr);
    start(async () => reorderPlanner(arr));
  };

  const popoverJob = popoverId != null ? byId.get(popoverId) ?? null : null;
  const todayIdx = dayCols.findIndex((d) => d.isToday);

  // ----- Timeline drop targets (bars + unscheduled jobs) -----
  const dayIndexAt = (e: React.DragEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return Math.min(nDays - 1, Math.max(0, Math.floor((e.clientX - rect.left) / colW)));
  };

  // Shared by the Week timeline and the wrapped Month/6-Week/3-Month grids.
  const handleMoveBar = (jobId: number, iso: string) => {
    start(async () => moveJobToDate(jobId, iso));
  };

  const handleDropUnscheduled = (unsId: number, iso: string, rowJobId: number | null) => {
    const u = unsById.get(unsId);
    if (!u) return;
    if (u.duration) {
      // Duration already known — schedule immediately, inserted at the drop row.
      const anchorIdx = rowJobId ? localOrder.indexOf(rowJobId) : localOrder.length - 1;
      const arr = [...localOrder];
      arr.splice((anchorIdx === -1 ? arr.length - 1 : anchorIdx) + 1, 0, unsId);
      setLocalOrder(arr);
      start(async () => scheduleJob(unsId, iso, { duration: u.duration ?? undefined, unit: u.unit, orderedIds: arr }));
    } else {
      setScheduleModal({ open: true, presetJobId: unsId, presetStart: iso, durationOnly: true });
    }
  };

  const handleResizeCommit = (jobId: number, endISO: string) => {
    const j = byId.get(jobId);
    if (!j) return;
    const newDuration = durationBetween(fromIsoDay(j.startISO), fromIsoDay(endISO), j.unit);
    if (newDuration > 0 && newDuration !== j.duration) {
      start(async () => resizeJobDuration(jobId, newDuration));
    }
  };

  const handleReorder = (arr: number[]) => {
    setLocalOrder(arr);
    start(async () => reorderPlanner(arr));
  };

  const onTimelineDrop = (rowJobId: number | null) => (e: React.DragEvent) => {
    const types = e.dataTransfer.types;
    if (!types.includes("text/x-planner-bar") && !types.includes("text/x-unscheduled-job")) return;
    e.preventDefault();
    e.stopPropagation();
    const iso = dayCols[dayIndexAt(e)].iso;
    const barId = parseInt(e.dataTransfer.getData("text/x-planner-bar"));
    if (barId) {
      handleMoveBar(barId, iso);
      return;
    }
    const unsId = parseInt(e.dataTransfer.getData("text/x-unscheduled-job"));
    if (unsId) handleDropUnscheduled(unsId, iso, rowJobId);
  };

  const acceptsTimeline = (e: React.DragEvent) =>
    e.dataTransfer.types.includes("text/x-planner-bar") || e.dataTransfer.types.includes("text/x-unscheduled-job");

  // ----- Bar geometry -----
  const barSpan = (j: PlannerJobData) => {
    const s = diffDays(windowStartISO, j.startISO);
    const e = diffDays(windowStartISO, j.endISO);
    let endIdx = Math.min(nDays - 1, e);
    if (resizePrev?.jobId === j.id) endIdx = resizePrev.endIdx;
    const startIdx = Math.max(0, s);
    return {
      startIdx,
      endIdx,
      clippedLeft: s < 0,
      clippedRight: e > nDays - 1 || (resizePrev?.jobId === j.id && diffDays(windowStartISO, j.endISO) > resizePrev.endIdx),
      visible: e >= 0 && s <= nDays - 1,
    };
  };

  const onResizeStart = (j: PlannerJobData) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const { startIdx, endIdx } = barSpan(j);
    let current = endIdx;
    const onMove = (ev: PointerEvent) => {
      const delta = Math.round((ev.clientX - startX) / colW);
      current = Math.min(nDays - 1, Math.max(Math.max(0, diffDays(windowStartISO, j.startISO)), endIdx + delta));
      setResizePrev({ jobId: j.id, endIdx: current });
    };
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      resizing.current = false;
      setResizePrev(null);
      const newDuration = durationBetween(fromIsoDay(j.startISO), fromIsoDay(dayCols[current].iso), j.unit);
      if (newDuration > 0 && newDuration !== j.duration) {
        start(async () => resizeJobDuration(j.id, newDuration));
      }
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  };

  const openSchedule = (preset?: { presetJobId?: number; presetStart?: string; durationOnly?: boolean }) =>
    setScheduleModal({ open: true, ...preset });

  const doSchedule = async (fd: FormData) => {
    setErr("");
    try {
      await scheduleJobForm(fd);
      setScheduleModal({ open: false });
    } catch {
      setErr("Could not schedule — check the start date and duration/end date.");
    }
  };

  const presetJob = scheduleModal.presetJobId
    ? jobOptions.find((o) => o.value === String(scheduleModal.presetJobId))
    : undefined;

  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        {/* Toolbar (Section 60) */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link href={nav.prev} className="btn">‹ Prev</Link>
          <Link href={nav.today} className="btn">Today</Link>
          <Link href={nav.next} className="btn">Next ›</Link>
          <span className="mx-1 text-sm font-medium text-ink-muted">{rangeLabel}</span>
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          {viewOptions.map((v) => (
            <Link key={v.value} href={v.href} className={v.value === view ? "btn-primary" : "btn"}>{v.label}</Link>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <label className="flex items-center gap-1.5 text-sm text-ink-muted">
            Sort By
            <select
              className="input w-40"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              title="Temporary sort — your manual order is preserved"
            >
              <option value="manual">Manual Order</option>
              <option value="start">Start Date</option>
              <option value="end">End Date</option>
              <option value="number">Job Number</option>
              <option value="priority">Priority</option>
              <option value="engineer">Assigned Engineer</option>
              <option value="engineer-group">View By Engineer</option>
            </select>
          </label>
          <span className="flex-1" />
          <button className="btn-primary" onClick={() => openSchedule()}>+ Schedule Job</button>
          <Link href={panelHref} className={panelOpen ? "btn-primary" : "btn"}>
            Unscheduled Jobs ({unscheduledCount})
          </Link>
        </div>

        {/* Workload indicators (Section 53) */}
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded border border-line bg-white px-2 py-1">This week: <b>{stats.weekJobs}</b> scheduled</span>
          <span className="rounded border border-line bg-white px-2 py-1"><b>{stats.weekStarts}</b> starting</span>
          <span className="rounded border border-line bg-white px-2 py-1"><b>{stats.weekFinishes}</b> finishing</span>
          <span className="rounded border border-line bg-white px-2 py-1"><b>{stats.unscheduled}</b> unscheduled</span>
        </div>

        {/* Week = horizontal timeline; Month/6 Weeks/3 Months = wrapped weekly rows.
            Mouse-wheel over this area steps Prev/Next. */}
        <div ref={gridRef}>
        {view !== "week" && (() => {
          const gridProps = {
            weeks,
            groups,
            hasJobs: jobs.length > 0,
            windowStartISO,
            windowEndISO: dayCols[nDays - 1]?.iso ?? windowStartISO,
            handlers: {
              localOrder,
              onReorder: handleReorder,
              onMoveBar: handleMoveBar,
              onDropUnscheduled: handleDropUnscheduled,
              onResizeCommit: handleResizeCommit,
              onOpenJob: setPopoverId,
            },
          };
          if (view === "month") return <PlannerMonthView {...gridProps} />;
          if (view === "6weeks") return <PlannerSixWeekView {...gridProps} />;
          return <PlannerThreeMonthView {...gridProps} />;
        })()}

        {view === "week" && (
        <div className="card overflow-x-auto">
          <div style={{ width: LABEL_W + nDays * colW }}>
            {/* Header */}
            <div className="flex border-b border-line bg-gray-50">
              <div className="sticky left-0 z-20 shrink-0 border-r border-line bg-gray-50 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted" style={{ width: LABEL_W }}>
                Job
              </div>
              {dayCols.map((d) => (
                <div
                  key={d.iso}
                  className={`shrink-0 border-l border-line px-1 py-1 text-center ${d.isWeekend ? "bg-gray-100" : ""} ${d.isToday ? "bg-indigo-100" : ""}`}
                  style={{ width: colW }}
                >
                  <div className={`text-[10px] leading-tight ${d.isToday ? "font-bold" : ""}`} style={d.isToday ? { color: "var(--brand-primary)" } : { color: "var(--text-secondary)" }}>
                    {colW >= 60 ? DOW_SHORT[d.dow] : DOW_LETTERS[d.dow]}
                  </div>
                  <div className={`leading-tight ${colW >= 40 ? "text-xs" : "text-[10px]"} ${d.isToday ? "font-bold" : ""}`} style={d.isToday ? { color: "var(--brand-primary)" } : undefined}>
                    {d.dayNum}{d.monthLabel && colW >= 30 ? ` ${d.monthLabel}` : ""}
                  </div>
                  {d.monthLabel && colW < 30 && <div className="text-[9px] leading-tight text-ink-muted">{d.monthLabel}</div>}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="relative">
              {/* Today line (Section 29) */}
              {todayIdx >= 0 && (
                <div
                  className="pointer-events-none absolute top-0 z-20 h-full w-0 border-l-2"
                  style={{ left: LABEL_W + todayIdx * colW + colW / 2, borderColor: "var(--brand-primary)", opacity: 0.55 }}
                />
              )}
              {jobs.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-ink-muted">
                  No scheduled jobs in this period. Drag a job from Unscheduled Jobs onto the timeline, or use + Schedule Job.
                </div>
              )}
              {groups.map((g) => (
                <div key={g.label || "all"}>
                  {g.label && (
                    <div className="border-b border-line bg-gray-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
                      {g.label}
                    </div>
                  )}
                  {g.rows.map((j) => {
                    const span = barSpan(j);
                    return (
                      <div
                        key={j.id}
                        className={`flex border-b border-line ${dropRowId === j.id ? "border-t-2" : ""}`}
                        style={dropRowId === j.id ? { borderTopColor: "var(--brand-primary)" } : undefined}
                        onDragOver={(e) => {
                          if (e.dataTransfer.types.includes("text/x-planner-row")) {
                            e.preventDefault();
                            setDropRowId(j.id);
                          }
                        }}
                        onDragLeave={() => setDropRowId((c) => (c === j.id ? null : c))}
                        onDrop={(e) => {
                          const id = parseInt(e.dataTransfer.getData("text/x-planner-row"));
                          setDropRowId(null);
                          if (!id || id === j.id) return;
                          e.preventDefault();
                          const arr = moveInList(localOrder, id, j.id);
                          setLocalOrder(arr);
                          start(async () => reorderPlanner(arr));
                        }}
                      >
                        {/* Row label — vertical drag handle lives here.
                            overflow-hidden hard-clips the label text at the
                            column border so it never bleeds into the timeline. */}
                        <div
                          className="sticky left-0 z-10 flex shrink-0 items-center gap-1.5 overflow-hidden border-r border-line bg-white px-2"
                          style={{ width: LABEL_W }}
                        >
                          <span
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/x-planner-row", String(j.id));
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            className="cursor-grab select-none px-1 text-ink-muted hover:text-ink active:cursor-grabbing"
                            title="Drag to reorder vertically"
                          >
                            ⠿
                          </span>
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: j.color }} />
                          <div className="min-w-0 flex-1 overflow-hidden py-1">
                            <button
                              className="link block w-full truncate text-left text-sm font-semibold"
                              onClick={() => setPopoverId(j.id)}
                              title={`${j.jobNumber} — ${j.siteAddress || displayJobName(j)}`}
                            >
                              {j.jobNumber} — {j.siteAddress || displayJobName(j)}
                            </button>
                            <div className="truncate text-[11px] text-ink-muted">
                              {j.clientName}{j.engineer ? ` · ${j.engineer}` : ""}
                            </div>
                          </div>
                        </div>

                        {/* Timeline track */}
                        <div
                          className="relative shrink-0"
                          style={{ width: nDays * colW, height: 44 }}
                          onDragOver={(e) => { if (acceptsTimeline(e)) e.preventDefault(); }}
                          onDrop={onTimelineDrop(j.id)}
                        >
                          {/* Day cells */}
                          <div className="absolute inset-0 flex">
                            {dayCols.map((d) => (
                              <div
                                key={d.iso}
                                className={`h-full shrink-0 border-l border-line/60 ${d.isWeekend ? "bg-gray-100" : ""} ${d.isToday ? "bg-indigo-50" : ""}`}
                                style={{
                                  width: colW,
                                  ...(d.isWeekend
                                    ? { backgroundImage: "repeating-linear-gradient(135deg, rgba(0,0,0,0.06) 0 4px, transparent 4px 8px)" }
                                    : {}),
                                }}
                              />
                            ))}
                          </div>
                          {/* Job bar */}
                          {span.visible && (
                            <div
                              draggable={!resizing.current}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/x-planner-bar", String(j.id));
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onClick={() => setPopoverId(j.id)}
                              className={`absolute top-1.5 z-10 flex h-8 cursor-grab items-center overflow-hidden rounded px-1.5 text-xs font-medium text-white shadow-sm active:cursor-grabbing ${j.completed ? "opacity-55 saturate-50" : ""}`}
                              style={{
                                left: span.startIdx * colW + 1,
                                width: Math.max(colW - 2, (span.endIdx - span.startIdx + 1) * colW - 2),
                                backgroundColor: j.color,
                                outline: j.overdue ? "2px solid #b45309" : undefined,
                              }}
                              title={`${j.jobNumber} — ${j.siteAddress || displayJobName(j)}\n${j.planningLabel}`}
                            >
                              {span.clippedLeft && <span className="mr-0.5">◂</span>}
                              <span className="truncate">
                                {(span.endIdx - span.startIdx + 1) * colW >= 90
                                  ? `${j.jobNumber} — ${j.siteAddress || displayJobName(j)}`
                                  : j.jobNumber}
                              </span>
                              {span.clippedRight && <span className="ml-0.5">▸</span>}
                              {/* Site inspection markers (Section 56) */}
                              {j.inspections.map((i) => {
                                const idx = diffDays(windowStartISO, i.iso);
                                if (idx < span.startIdx || idx > span.endIdx) return null;
                                return (
                                  <span
                                    key={i.id}
                                    className="absolute bottom-0.5 h-1.5 w-1.5 rounded-full bg-white ring-1 ring-black/30"
                                    style={{ left: (idx - span.startIdx) * colW + colW / 2 - 3 }}
                                    title={`Site Inspection — ${i.label}`}
                                  />
                                );
                              })}
                              {/* Priority indicator (Section 20) */}
                              {(j.priority === "High" || j.priority === "Urgent") && (
                                <span className="absolute right-1 top-0.5 text-[10px]" title={`${j.priority} priority`}>▲</span>
                              )}
                            </div>
                          )}
                          {/* Resize handle (Section 38) */}
                          {span.visible && (
                            <div
                              className="absolute top-1.5 z-20 h-8 w-2 cursor-ew-resize rounded-r"
                              style={{ left: (span.endIdx + 1) * colW - 5 }}
                              onPointerDown={onResizeStart(j)}
                              onDragStart={(e) => e.preventDefault()}
                              title="Drag to change duration"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              {/* Drop zone for unscheduled jobs below the last row */}
              <div
                className="flex"
                onDragOver={(e) => { if (acceptsTimeline(e)) e.preventDefault(); }}
                onDrop={onTimelineDrop(null)}
              >
                <div className="sticky left-0 shrink-0 px-2 py-1 text-[11px] text-ink-muted" style={{ width: LABEL_W }}>
                  Drop an unscheduled job anywhere on the timeline to schedule it
                </div>
                <div style={{ width: nDays * colW, height: 20 }} />
              </div>
            </div>
          </div>
        </div>
        )}
        </div>
      </div>

      {/* Unscheduled Jobs panel (Sections 31–34) */}
      {panelOpen && (
        <div className="card w-72 shrink-0 self-start">
          <h3 className="section-title border-b border-line px-3 py-2">
            Unscheduled Jobs ({unscheduledCount})
          </h3>
          {unsRows.length === 0 ? (
            <p className="px-3 py-4 text-sm text-ink-muted">All active jobs are scheduled.</p>
          ) : (
            <ul>
              {unsRows.map((u) => (
                <li
                  key={u.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/x-unscheduled-job", String(u.id));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes("text/x-uns-row")) {
                      e.preventDefault();
                      setDropUnsId(u.id);
                    }
                  }}
                  onDragLeave={() => setDropUnsId((c) => (c === u.id ? null : c))}
                  onDrop={(e) => {
                    const id = parseInt(e.dataTransfer.getData("text/x-uns-row"));
                    setDropUnsId(null);
                    if (!id || id === u.id) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const arr = moveInList(unsOrder, id, u.id);
                    setUnsOrder(arr);
                    start(async () => reorderUnscheduled(arr));
                  }}
                  className={`cursor-grab border-b border-line px-3 py-2 last:border-0 hover:bg-gray-50 active:cursor-grabbing ${dropUnsId === u.id ? "border-t-2" : ""}`}
                  style={dropUnsId === u.id ? { borderTopColor: "var(--brand-primary)" } : undefined}
                  onClick={() => openSchedule({ presetJobId: u.id })}
                  title="Drag onto the timeline, or click to schedule"
                >
                  <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--brand-primary)" }}>
                    <span className="text-ink-muted">⠿</span>
                    {u.jobNumber} — {u.siteAddress || u.name}
                  </div>
                  <div className="ml-5 text-[11px] text-ink-muted">
                    {u.clientName}
                    {u.duration ? ` · ${unitLabel(u.unit, u.duration)}` : " · no duration"}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="px-3 py-2 text-[11px] text-ink-muted">Drag a job onto the timeline to schedule it. Drag within this list to reorder.</p>
        </div>
      )}

      {/* Job popover / quick actions (Sections 22, 39) */}
      {popoverJob && (
        <JobPopover
          job={popoverJob}
          engineers={engineers}
          canMoveUp={localOrder.indexOf(popoverJob.id) > 0}
          canMoveDown={localOrder.indexOf(popoverJob.id) < localOrder.length - 1}
          onMove={(off) => moveByOffset(popoverJob.id, off)}
          onClose={() => setPopoverId(null)}
          busy={false}
        />
      )}

      {/* Schedule Job modal (Section 40) */}
      {scheduleModal.open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-6" onClick={() => setScheduleModal({ open: false })}>
          <div className="card w-full max-w-lg p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">Schedule Job</h3>
              <button className="btn" onClick={() => setScheduleModal({ open: false })}>✕</button>
            </div>
            {err && <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
            <ScheduleForm
              key={`${scheduleModal.presetJobId ?? "pick"}-${scheduleModal.presetStart ?? ""}`}
              presetJobId={scheduleModal.presetJobId}
              presetStart={scheduleModal.presetStart}
              durationOnly={scheduleModal.durationOnly}
              presetLabel={presetJob?.label}
              jobOptions={jobOptions}
              action={doSchedule}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleForm({
  presetJobId,
  presetStart,
  durationOnly,
  presetLabel,
  jobOptions,
  action,
}: {
  presetJobId?: number;
  presetStart?: string;
  durationOnly?: boolean;
  presetLabel?: string;
  jobOptions: { value: string; label: string; hint?: string }[];
  action: (fd: FormData) => Promise<void>;
}) {
  const [mode, setMode] = useState<"duration" | "end">("duration");
  return (
    <form action={action} className="space-y-3">
      {durationOnly && presetJobId ? (
        <>
          <input type="hidden" name="jobId" value={presetJobId} />
          <input type="hidden" name="plannedStart" value={presetStart} />
          <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
            <div className="font-medium">{presetLabel}</div>
            <div className="text-xs text-ink-muted">Dropped on {presetStart ? fmtDate(fromIsoDay(presetStart)) : ""} — set a duration to create the schedule.</div>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="label">Job</label>
            <SearchableSelect
              name="jobId"
              required
              defaultValue={presetJobId ? String(presetJobId) : undefined}
              options={jobOptions}
              placeholder="Search job №, address, suburb or client…"
            />
          </div>
          <div>
            <label className="label">Planned Start</label>
            <input type="date" name="plannedStart" required className="input" defaultValue={presetStart} />
          </div>
        </>
      )}
      <div>
        <label className="label">Schedule Using</label>
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="mode" value="duration" checked={mode === "duration"} onChange={() => setMode("duration")} />
            Duration
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="mode" value="end" checked={mode === "end"} onChange={() => setMode("end")} />
            End Date
          </label>
        </div>
      </div>
      {mode === "duration" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Duration</label>
            <input type="number" name="duration" min={1} step={1} required className="input" defaultValue={5} />
          </div>
          <div>
            <label className="label">Unit</label>
            <select name="unit" className="input" defaultValue="working">
              <option value="working">Working Days</option>
              <option value="calendar">Calendar Days</option>
            </select>
          </div>
        </div>
      ) : (
        <div>
          <label className="label">Planned End</label>
          <input type="date" name="plannedEnd" required className="input" defaultValue={presetStart} />
        </div>
      )}
      <p className="text-xs text-ink-muted">The missing value (end date or duration) is calculated automatically. Working days skip weekends.</p>
      <div className="flex justify-end border-t border-line pt-3">
        <button type="submit" className="btn-primary">Schedule</button>
      </div>
    </form>
  );
}

function JobPopover({
  job,
  engineers,
  canMoveUp,
  canMoveDown,
  onMove,
  onClose,
}: {
  job: PlannerJobData;
  engineers: string[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (offset: -1 | 1) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [, start] = useTransition();
  const [mode, setMode] = useState<"duration" | "end">("duration");
  const [engineer, setEngineer] = useState(job.engineer);

  const reschedule = async (fd: FormData) => {
    const startISO = String(fd.get("start"));
    const unit = String(fd.get("unit") || job.unit);
    if (String(fd.get("mode")) === "end") {
      await scheduleJob(job.id, startISO, { endISO: String(fd.get("end")), unit });
    } else {
      await scheduleJob(job.id, startISO, { duration: parseInt(String(fd.get("duration"))) || job.duration, unit });
    }
    onClose();
  };

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-3 border-b border-line py-1.5 text-sm last:border-0">
      <span className="text-xs uppercase tracking-wide text-ink-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-6" onClick={onClose}>
      <div className="card w-full max-w-xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: job.color }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">
              {job.jobNumber} — {job.siteAddress || job.name}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <span className="rounded px-1.5 py-0.5 font-medium" style={{ color: job.statusColor, backgroundColor: job.statusColor + "1a" }}>{job.statusName}</span>
              <span className={job.overdue ? "font-semibold" : ""} style={job.overdue ? { color: "var(--warning)" } : undefined}>
                {job.planningLabel}
              </span>
              {job.overdue && <span title="Planned end date has passed">⚠</span>}
            </div>
          </div>
          <Link href={`/jobs/${job.id}`} className="btn-primary">Open Job</Link>
          <button className="btn" onClick={onClose}>✕</button>
        </div>

        <div className="grid gap-4 px-4 py-3 sm:grid-cols-2">
          <div>
            {row("Client", job.clientName)}
            {row("Engineer", job.engineer || "—")}
            {row("Priority", job.priority)}
            {row("Planned Start", fmtDate(fromIsoDay(job.startISO)))}
            {row("Planned End", fmtDate(fromIsoDay(job.endISO)))}
            {row("Duration", unitLabel(job.unit, job.duration))}
            {row("Outstanding Tasks", job.openTasks)}
            {job.inspections.length > 0 &&
              row("Site Inspections", (
                <span className="space-y-0.5">
                  {job.inspections.map((i) => <div key={i.id} className="text-xs">{i.label}</div>)}
                </span>
              ))}
            <div className="mt-2 flex gap-2">
              <button className="btn" disabled={!canMoveUp} onClick={() => onMove(-1)}>↑ Move Up</button>
              <button className="btn" disabled={!canMoveDown} onClick={() => onMove(1)}>↓ Move Down</button>
              <button
                className="btn-danger"
                onClick={() => {
                  if (confirm("Remove this job from the planner? It will move to Unscheduled Jobs.")) {
                    start(async () => { await unscheduleJob(job.id); onClose(); });
                  }
                }}
              >
                Unschedule
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {/* Reschedule */}
            <form action={(fd) => start(async () => reschedule(fd))} className="rounded-md border border-line p-2.5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Change Dates</div>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" name="start" required defaultValue={job.startISO} className="input" title="Planned start" />
                <select name="unit" defaultValue={job.unit} className="input" title="Duration unit">
                  <option value="working">Working Days</option>
                  <option value="calendar">Calendar Days</option>
                </select>
                <label className="col-span-2 flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1"><input type="radio" name="mode" value="duration" checked={mode === "duration"} onChange={() => setMode("duration")} /> Duration</span>
                  <span className="flex items-center gap-1"><input type="radio" name="mode" value="end" checked={mode === "end"} onChange={() => setMode("end")} /> End date</span>
                </label>
                {mode === "duration" ? (
                  <input type="number" name="duration" min={1} step={1} required defaultValue={job.duration} className="input col-span-2" title="Duration" />
                ) : (
                  <input type="date" name="end" required defaultValue={job.endISO} className="input col-span-2" title="Planned end" />
                )}
              </div>
              <button type="submit" className="btn-primary mt-2 w-full justify-center">Apply</button>
            </form>

            {/* Colour (Sections 16–19) */}
            <div className="rounded-md border border-line p-2.5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Planner Colour</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {PLANNER_PALETTE.map((p) => (
                  <button
                    key={p.color}
                    className="h-6 w-6 rounded-full border-2"
                    style={{
                      backgroundColor: p.color,
                      borderColor: job.color.toLowerCase() === p.color.toLowerCase() ? "#1e2430" : "transparent",
                    }}
                    title={p.name}
                    onClick={() => start(async () => setPlannerColor(job.id, p.color))}
                  />
                ))}
                <input
                  type="color"
                  defaultValue={job.color}
                  title="Custom colour"
                  className="h-6 w-8 cursor-pointer rounded border border-line"
                  onChange={(e) => start(async () => setPlannerColor(job.id, e.target.value))}
                />
              </div>
            </div>

            {/* Engineer / priority */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Engineer</label>
                <input
                  className="input"
                  list="planner-engineers"
                  value={engineer}
                  onChange={(e) => setEngineer(e.target.value)}
                  onBlur={() => { if (engineer !== job.engineer) start(async () => setJobEngineer(job.id, engineer)); }}
                />
                <datalist id="planner-engineers">
                  {engineers.map((e) => <option key={e} value={e} />)}
                </datalist>
              </div>
              <div>
                <label className="label">Priority</label>
                <select
                  className="input"
                  defaultValue={job.priority}
                  onChange={(e) => start(async () => setJobPriority(job.id, e.target.value))}
                >
                  {["Low", "Normal", "High", "Urgent"].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
