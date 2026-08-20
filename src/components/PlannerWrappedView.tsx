"use client";

/**
 * Wrapped weekly-row planner renderers for Month / 6 Weeks / 3 Months.
 *
 * Unlike the Week timeline (one row of 7 wide columns per job), these views
 * stack Monday–Sunday week rows inside each job row, so the date axis wraps
 * and never needs horizontal scrolling. Working-day job bars break over
 * weekends and across week-row boundaries; the job keeps one colour and
 * identity across all segments.
 */

import { useState, useRef } from "react";
import { barSegments, isWeekend, fromIsoDay, isoDay, addDaysLocal } from "@/lib/planner";
import type { PlannerJobData, DayCol } from "@/components/PlannerBoard";

export type WrappedDensity = "month" | "sixweeks" | "threemonths";

export type WrappedHandlers = {
  localOrder: number[];
  onReorder: (ids: number[]) => void;
  onMoveBar: (jobId: number, startISO: string) => void;
  onDropUnscheduled: (jobId: number, iso: string, rowJobId: number | null) => void;
  onResizeCommit: (jobId: number, endISO: string) => void;
  onOpenJob: (id: number) => void;
};

const LABEL_W = 240;
const DOW_HEAD = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const ROW_H: Record<WrappedDensity, number> = { month: 34, sixweeks: 30, threemonths: 26 };
const BAR_FONT: Record<WrappedDensity, string> = {
  month: "text-xs",
  sixweeks: "text-[11px]",
  threemonths: "text-[10px]",
};

function diffDays(aISO: string, bISO: string): number {
  return Math.round((fromIsoDay(bISO).getTime() - fromIsoDay(aISO).getTime()) / 86400000);
}

function shortStreet(j: PlannerJobData): string {
  if (j.siteStreet) return j.siteStreet;
  const full = j.siteAddress || j.name;
  return full.split(",")[0].trim();
}

type Seg = {
  colStart: number;
  colEnd: number;
  /** job continues from before this segment (previous week row or weekend gap) */
  contLeft: boolean;
  /** job continues after this segment (next week row or weekend gap) */
  contRight: boolean;
  /** segment is clipped by the view window edge */
  clipLeft: boolean;
  clipRight: boolean;
  isJobEnd: boolean;
  startISO: string;
  endISO: string;
};

/** Segments of a job bar that fall inside one week row (Mon–Sun). */
function weekSegments(j: PlannerJobData, week: DayCol[], effectiveEndISO: string): Seg[] {
  const wStart = week[0].iso;
  const wEnd = week[6].iso;
  const runs = barSegments(j.startISO, effectiveEndISO, j.unit);
  const out: Seg[] = [];
  runs.forEach((r, i) => {
    if (r.endISO < wStart || r.startISO > wEnd) return;
    const startISO = r.startISO < wStart ? wStart : r.startISO;
    const endISO = r.endISO > wEnd ? wEnd : r.endISO;
    out.push({
      colStart: diffDays(wStart, startISO),
      colEnd: diffDays(wStart, endISO),
      contLeft: i > 0 || r.startISO < wStart,
      contRight: i < runs.length - 1 || r.endISO > wEnd,
      clipLeft: i === 0 && j.startISO < wStart,
      clipRight: i === runs.length - 1 && effectiveEndISO > wEnd,
      isJobEnd: i === runs.length - 1 && r.endISO <= wEnd,
      startISO,
      endISO,
    });
  });
  return out;
}

function barLabel(density: WrappedDensity, j: PlannerJobData, segDays: number, labelled: boolean): string {
  if (density === "month") {
    if (!labelled) return `${j.jobNumber} — ${j.siteAddress || j.name}`;
    return segDays >= 2 ? `${j.jobNumber} — ${shortStreet(j)}` : j.jobNumber;
  }
  if (density === "sixweeks") {
    return segDays >= 2 || !labelled ? `${j.jobNumber} — ${shortStreet(j)}` : j.jobNumber;
  }
  return segDays >= 3 ? `${j.jobNumber} — ${shortStreet(j)}` : j.jobNumber;
}

function WrappedGrid({
  density,
  weeks,
  groups,
  hasJobs,
  windowStartISO,
  windowEndISO,
  handlers,
}: {
  density: WrappedDensity;
  weeks: DayCol[][];
  groups: { label: string; rows: PlannerJobData[] }[];
  hasJobs: boolean;
  windowStartISO: string;
  windowEndISO: string;
  handlers: WrappedHandlers;
}) {
  const [dropRowId, setDropRowId] = useState<number | null>(null);
  const [resizePrev, setResizePrev] = useState<{ jobId: number; endISO: string } | null>(null);
  const resizing = useRef(false);
  const rowH = ROW_H[density];
  const fontCls = BAR_FONT[density];

  const acceptsBar = (e: React.DragEvent) =>
    e.dataTransfer.types.includes("text/x-planner-bar") || e.dataTransfer.types.includes("text/x-unscheduled-job");

  const dropIso = (e: React.DragEvent, week: DayCol[]): string => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const idx = Math.min(6, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * 7)));
    return week[idx].iso;
  };

  const onWeekDrop = (rowJobId: number | null, week: DayCol[]) => (e: React.DragEvent) => {
    if (!acceptsBar(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const iso = dropIso(e, week);
    const barId = parseInt(e.dataTransfer.getData("text/x-planner-bar"));
    if (barId) {
      handlers.onMoveBar(barId, iso);
      return;
    }
    const unsId = parseInt(e.dataTransfer.getData("text/x-unscheduled-job"));
    if (unsId) handlers.onDropUnscheduled(unsId, iso, rowJobId);
  };

  const onResizeStart = (j: PlannerJobData, week: DayCol[]) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const track = (el.closest("[data-week-track]") as HTMLElement) ?? el.parentElement!;
    const onMove = (ev: PointerEvent) => {
      const rect = track.getBoundingClientRect();
      const idx = Math.min(6, Math.max(0, Math.floor(((ev.clientX - rect.left) / rect.width) * 7)));
      let iso = week[idx].iso;
      if (iso < j.startISO) iso = j.startISO;
      // Working-day jobs never end on a weekend — snap back to Friday.
      if (j.unit !== "calendar" && isWeekend(fromIsoDay(iso))) {
        let d = fromIsoDay(iso);
        while (isWeekend(d)) d = addDaysLocal(d, -1);
        if (isoDay(d) >= j.startISO) iso = isoDay(d);
      }
      setResizePrev({ jobId: j.id, endISO: iso });
    };
    const onUp = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      resizing.current = false;
      setResizePrev(null);
      // Recompute from the final pointer position so the commit matches the preview.
      const rect = track.getBoundingClientRect();
      const idx = Math.min(6, Math.max(0, Math.floor(((ev.clientX - rect.left) / rect.width) * 7)));
      let iso = week[idx].iso;
      if (iso < j.startISO) iso = j.startISO;
      if (j.unit !== "calendar" && isWeekend(fromIsoDay(iso))) {
        let d = fromIsoDay(iso);
        while (isWeekend(d)) d = addDaysLocal(d, -1);
        if (isoDay(d) >= j.startISO) iso = isoDay(d);
      }
      if (iso !== j.endISO) handlers.onResizeCommit(j.id, iso);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  };

  const moveInList = (list: number[], id: number, beforeId: number) => {
    const arr = list.filter((x) => x !== id);
    const idx = arr.indexOf(beforeId);
    arr.splice(idx === -1 ? arr.length : idx, 0, id);
    return arr;
  };

  const dayCells = (week: DayCol[], showNums: boolean) => (
    <div className="pointer-events-none absolute inset-0 grid grid-cols-7">
      {week.map((d) => (
        <div
          key={d.iso}
          className={`relative border-l border-line/60 first:border-l-0 ${d.isWeekend ? "bg-gray-100" : ""} ${d.isToday ? "bg-indigo-50" : ""}`}
          style={
            d.isWeekend
              ? { backgroundImage: "repeating-linear-gradient(135deg, rgba(0,0,0,0.05) 0 4px, transparent 4px 8px)" }
              : undefined
          }
        >
          {showNums && (
            <span
              className={`absolute left-1 top-0.5 leading-none ${density === "threemonths" ? "text-[9px]" : "text-[10px]"} ${d.isToday ? "font-bold" : ""}`}
              style={d.isToday ? { color: "var(--brand-primary)" } : { color: "var(--text-secondary)" }}
            >
              {d.dayNum}{d.monthLabel ? ` ${d.monthLabel}` : ""}
            </span>
          )}
        </div>
      ))}
    </div>
  );

  const renderBar = (j: PlannerJobData, week: DayCol[]) => {
    const effectiveEnd = resizePrev?.jobId === j.id ? resizePrev.endISO : j.endISO;
    const segs = weekSegments(j, week, effectiveEnd);
    if (!segs.length) return null;
    const clipStart = j.startISO < windowStartISO;
    const clipEnd = effectiveEnd > windowEndISO;
    // Only the segment holding the true job start carries the full label;
    // segments continuing from earlier week rows get the compact label.
    const jobStartsThisWeek = j.startISO >= week[0].iso && j.startISO <= week[6].iso;
    return segs.map((s, i) => {
      const isLabelSeg = i === 0 && jobStartsThisWeek && !clipStart;
      const text = barLabel(density, j, s.colEnd - s.colStart + 1, !isLabelSeg);
      const showText = isLabelSeg || s.colEnd - s.colStart + 1 >= 2;
      return (
        <div
          key={`${s.startISO}-${i}`}
          draggable={!resizing.current}
          onDragStart={(e) => {
            e.dataTransfer.setData("text/x-planner-bar", String(j.id));
            e.dataTransfer.effectAllowed = "move";
          }}
          onClick={() => handlers.onOpenJob(j.id)}
          className={`absolute z-10 flex cursor-grab items-center overflow-hidden font-medium text-white shadow-sm active:cursor-grabbing ${fontCls} ${j.completed ? "opacity-55 saturate-50" : ""}`}
          style={{
            left: `calc(${(s.colStart / 7) * 100}% + 1px)`,
            width: `calc(${((s.colEnd - s.colStart + 1) / 7) * 100}% - 2px)`,
            top: 3,
            height: rowH - 6,
            backgroundColor: j.color,
            borderRadius: `${s.contLeft ? 0 : 6}px ${s.contRight ? 0 : 6}px ${s.contRight ? 0 : 6}px ${s.contLeft ? 0 : 6}px`,
            outline: j.overdue ? "2px solid #b45309" : undefined,
          }}
          title={`${j.jobNumber} — ${j.siteAddress || j.name}\n${j.planningLabel}\n${j.startISO} → ${j.endISO}`}
        >
          {i === 0 && (clipStart || s.contLeft) && <span className="pl-0.5">◂</span>}
          {showText && <span className="truncate px-1">{text}</span>}
          {i === segs.length - 1 && (clipEnd || s.contRight) && <span className="ml-auto pr-0.5">▸</span>}
          {(j.priority === "High" || j.priority === "Urgent") && i === 0 && (
            <span className="absolute right-1 top-0 text-[9px]" title={`${j.priority} priority`}>▲</span>
          )}
          {/* Site inspection markers */}
          {j.inspections.map((insp) => {
            if (insp.iso < s.startISO || insp.iso > s.endISO) return null;
            const idx = diffDays(s.startISO, insp.iso);
            return (
              <span
                key={insp.id}
                className="absolute bottom-0.5 h-1.5 w-1.5 rounded-full bg-white ring-1 ring-black/30"
                style={{ left: `calc(${((idx + 0.5) / (s.colEnd - s.colStart + 1)) * 100}% - 3px)` }}
                title={`Site Inspection — ${insp.label}`}
              />
            );
          })}
          {/* Resize handle on the job's final segment */}
          {s.isJobEnd && !clipEnd && (
            <div
              data-resize-handle
              className="absolute right-0 top-0 z-20 h-full w-2 cursor-ew-resize"
              onPointerDown={onResizeStart(j, week)}
              onDragStart={(e) => e.preventDefault()}
              title="Drag to change duration"
            />
          )}
        </div>
      );
    });
  };

  const weekStack = (rowJobId: number | null, j?: PlannerJobData) => (
    <div className="min-w-0 flex-1">
      {weeks.map((week, wi) => (
        <div
          key={week[0].iso}
          data-week-track
          className={`relative ${wi < weeks.length - 1 ? "border-b border-line/50" : ""}`}
          style={{ height: rowH }}
          onDragOver={(e) => { if (acceptsBar(e)) e.preventDefault(); }}
          onDrop={onWeekDrop(rowJobId, week)}
        >
          {dayCells(week, true)}
          {j ? renderBar(j, week) : null}
        </div>
      ))}
    </div>
  );

  return (
    <div className="card overflow-hidden">
      {/* 7-column weekday header */}
      <div className="flex border-b border-line bg-gray-50">
        <div
          className="shrink-0 border-r border-line px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted"
          style={{ width: LABEL_W }}
        >
          Job
        </div>
        <div className="grid flex-1 grid-cols-7">
          {DOW_HEAD.map((d, i) => (
            <div
              key={d}
              className={`border-l border-line px-1 py-1 text-center text-[11px] font-semibold first:border-l-0 ${i >= 5 ? "text-ink-muted" : ""}`}
            >
              {d}
            </div>
          ))}
        </div>
      </div>

      {!hasJobs && (
        <div className="border-b border-line px-4 py-3 text-sm text-ink-muted">
          No scheduled jobs in this period. Drag a job from Unscheduled Jobs onto a week below, or use + Schedule Job.
        </div>
      )}

      {groups.map((g) => (
        <div key={g.label || "all"}>
          {g.label && (
            <div className="border-b border-line bg-gray-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
              {g.label}
            </div>
          )}
          {g.rows.map((j) => (
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
                handlers.onReorder(moveInList(handlers.localOrder, id, j.id));
              }}
            >
              {/* Row label — vertical drag handle */}
              <div
                className="flex shrink-0 items-start gap-1.5 border-r border-line bg-white px-2 py-1.5"
                style={{ width: LABEL_W }}
              >
                <span
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/x-planner-row", String(j.id));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="cursor-grab select-none px-1 pt-0.5 text-ink-muted hover:text-ink active:cursor-grabbing"
                  title="Drag to reorder vertically"
                >
                  ⠿
                </span>
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: j.color }} />
                <div className="min-w-0 flex-1">
                  <button
                    className="link block truncate text-left text-sm font-semibold"
                    onClick={() => handlers.onOpenJob(j.id)}
                    title={`${j.jobNumber} — ${j.siteAddress || j.name}`}
                  >
                    {j.jobNumber} — {j.siteAddress || j.name}
                  </button>
                  <div className="truncate text-[11px] text-ink-muted">
                    {j.clientName}{j.engineer ? ` · ${j.engineer}` : ""}
                  </div>
                </div>
              </div>
              {weekStack(j.id, j)}
            </div>
          ))}
        </div>
      ))}

      {/* Spare droppable week stack — schedule unscheduled jobs even when the board is empty */}
      <div className="flex">
        <div className="shrink-0 px-2 py-1 text-[11px] text-ink-muted" style={{ width: LABEL_W }}>
          Drop an unscheduled job on any week to schedule it
        </div>
        {weekStack(null)}
      </div>
    </div>
  );
}

export function PlannerMonthView(props: Omit<Parameters<typeof WrappedGrid>[0], "density">) {
  return <WrappedGrid {...props} density="month" />;
}

export function PlannerSixWeekView(props: Omit<Parameters<typeof WrappedGrid>[0], "density">) {
  return <WrappedGrid {...props} density="sixweeks" />;
}

export function PlannerThreeMonthView(props: Omit<Parameters<typeof WrappedGrid>[0], "density">) {
  return <WrappedGrid {...props} density="threemonths" />;
}
