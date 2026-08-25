"use client";

/**
 * Shared overlapping-lane calendar grids for Month / 6 Weeks / 3 Months.
 *
 * One Monday–Sunday calendar for the whole period — every job's bar lives in
 * the SAME grid. Jobs that overlap in time are assigned to different "lanes"
 * (stacked sub-rows in each week strip), so you can see at a glance which
 * jobs run concurrently. Bars drag to reschedule; edges drag to resize;
 * unscheduled jobs drop onto a week to schedule them.
 */

import { useMemo, useRef, useState, useEffect } from "react";
import { barSegments, fromIsoDay, isoDay, addDaysLocal, isWeekend } from "@/lib/planner";
import type { PlannerJobData, DayCol } from "@/components/PlannerBoard";

export type WrappedDensity = "month" | "sixweeks" | "threemonths";

export type WrappedGridProps = {
  density: WrappedDensity;
  weeks: DayCol[][];
  groups: { label: string; rows: PlannerJobData[] }[];
  hasJobs: boolean;
  windowStartISO: string;
  windowEndISO: string;
  handlers: {
    localOrder: number[];
    onReorder: (ids: number[]) => void;
    onMoveBar: (jobId: number, startISO: string) => void;
    onDropUnscheduled: (jobId: number, iso: string, rowJobId: number | null) => void;
    onResizeCommit: (jobId: number, endISO: string) => void;
    onOpenJob: (id: number) => void;
  };
};

const DOW_HEAD = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
/** Lane (bar track) height per density — each week strip holds maxLanes of them. */
const LANE_H: Record<WrappedDensity, number> = { month: 22, sixweeks: 19, threemonths: 15 };
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
  contLeft: boolean;
  contRight: boolean;
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

/** Overlap-free lane assignment: longest-running jobs get the top lanes. */
function assignLanes(jobs: PlannerJobData[]): Map<number, number> {
  const sorted = [...jobs].sort(
    (a, b) =>
      a.startISO.localeCompare(b.startISO) ||
      b.endISO.localeCompare(a.endISO) ||
      a.jobNumber.localeCompare(b.jobNumber)
  );
  const laneEnds: string[] = [];
  const m = new Map<number, number>();
  for (const j of sorted) {
    let lane = laneEnds.findIndex((end) => end < j.startISO);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = j.endISO;
    m.set(j.id, lane);
  }
  return m;
}

function barLabel(density: WrappedDensity, j: PlannerJobData, segDays: number, firstSeg: boolean): string {
  // Continuation segments carry no label — only the first (or a clipped
  // window-start) segment shows the job number + street.
  if (!firstSeg) return "";
  if (density === "month") {
    return segDays >= 2 ? `${j.jobNumber} — ${shortStreet(j)}` : j.jobNumber;
  }
  if (density === "sixweeks") {
    return segDays >= 2 ? `${j.jobNumber} — ${shortStreet(j)}` : j.jobNumber;
  }
  return segDays >= 3 ? `${j.jobNumber} — ${shortStreet(j)}` : j.jobNumber;
}

function WrappedGrid({ density, weeks, groups, hasJobs, windowStartISO, windowEndISO, handlers }: WrappedGridProps) {
  // Lanes expand/contracts with the viewport; start from the static floor.
  const [laneH, setLaneH] = useState<number>(LANE_H[density]);
  const fontCls = BAR_FONT[density];
  const nWeeks = weeks.length;

  // Jobs flattened across engineer groups; lanes assign once for the whole set.
  const allJobs = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const lanes = useMemo(() => assignLanes(allJobs), [allJobs]);
  const laneCount = useMemo(() => {
    let max = 0;
    lanes.forEach((v) => { if (v > max) max = v; });
    return max + 1;
  }, [lanes]);

  // Month separators + shading: a strip is "month start" when week[6] is in a
  // different month than week[0], i.e. the month changes on Sunday.
  const stripMeta = useMemo(() => {
    // Detect strips that START a new calendar month (week[6] month ≠ week[0] month).
    const metas = weeks.map((week) => {
      const m0 = fromIsoDay(week[0].iso).getMonth();
      const m1 = fromIsoDay(week[6].iso).getMonth();
      const startOfNew = m0 !== m1;
      const monthLabel = startOfNew
        ? fromIsoDay(week[6].iso).toLocaleString("en-AU", { month: "long", year: "numeric" })
        : "";
      return { startOfNew, monthLabel };
    });
    let shaded = false;
    return metas.map((m) => {
      if (m.startOfNew) shaded = !shaded;
      return { ...m, bg: shaded ? "rgba(248,250,252,0.7)" : undefined };
    });
  }, [weeks]);
  const stripStyle = stripMeta;

  const [resizePrev, setResizePrev] = useState<{ jobId: number; endISO: string } | null>(null);
  const resizing = useRef(false);

  // ----- Responsive lane height: fill the available viewport -----
  // Sizing uses the element's viewport top so the whole calendar fits without
  // page scroll when possible, clamped between a floor (static sizes) and a
  // ceiling (so huge monitors don't make bars enormous).
  useEffect(() => {
    const MIN_LANE = LANE_H[density];
    const MAX_LANE = { month: 34, sixweeks: 28, threemonths: 24 }[density];
    const compute = () => {
      const el = document.getElementById("planner-wrapped-root");
      const rect = el?.getBoundingClientRect();
      const top = rect?.top ?? 0;
      const avail = Math.max(200, window.innerHeight - top - 24);
      const lane = Math.floor((avail / Math.max(1, nWeeks)) - 16); // minus strip padding
      setLaneH(Math.max(MIN_LANE, Math.min(MAX_LANE, lane || MIN_LANE)));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [density, nWeeks]);

  const acceptsBar = (e: React.DragEvent) =>
    e.dataTransfer.types.includes("text/x-planner-bar") || e.dataTransfer.types.includes("text/x-unscheduled-job");

  const dropIso = (e: React.DragEvent, week: DayCol[]): string => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const idx = Math.min(6, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * 7)));
    return week[idx].iso;
  };

  const onWeekDrop = (week: DayCol[]) => (e: React.DragEvent) => {
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
    if (unsId) handlers.onDropUnscheduled(unsId, iso, null);
  };

  const onResizeStart = (j: PlannerJobData, week: DayCol[]) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const track = (el.closest("[data-week-track]") as HTMLElement) ?? el.parentElement!;
    const snap = (clientX: number): string => {
      const rect = track.getBoundingClientRect();
      const idx = Math.min(6, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * 7)));
      let iso = week[idx].iso;
      if (iso < j.startISO) iso = j.startISO;
      // Working-day jobs never end on a weekend — snap back to Friday.
      if (j.unit !== "calendar" && isWeekend(fromIsoDay(iso))) {
        let d = fromIsoDay(iso);
        while (isWeekend(d)) d = addDaysLocal(d, -1);
        if (isoDay(d) >= j.startISO) iso = isoDay(d);
      }
      return iso;
    };
    const onMove = (ev: PointerEvent) => setResizePrev({ jobId: j.id, endISO: snap(ev.clientX) });
    const onUp = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      resizing.current = false;
      const iso = snap(ev.clientX);
      setResizePrev(null);
      if (iso !== j.endISO) handlers.onResizeCommit(j.id, iso);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  };

  const stripH = laneCount * laneH;

  /** Under-bar render tracking: assigns every day cell + month separators +
   * shading without mutating loops. Called per strip index. */
  const renderStrip = (week: DayCol[], wi: number, rows?: PlannerJobData[]) => {
    const meta = stripStyle[wi];
    const stripBg = meta.bg;
    return (
      <div
        key={week[0].iso}
        data-week-track
        className={`relative ${wi < weeks.length - 1 ? "border-b border-line/60" : ""}`}
        style={{ height: stripH, backgroundColor: stripBg }}
        onDragOver={(e) => { if (acceptsBar(e)) e.preventDefault(); }}
        onDrop={onWeekDrop(week)}
      >
        {meta.startOfNew && (
          <div className="absolute inset-x-0 top-0 z-10 h-1 bg-brand-primary/60">
            <span className="absolute left-8 top-1 text-[9px] font-bold uppercase tracking-wide text-brand-primary">
              {meta.monthLabel}
            </span>
          </div>
        )}
        {dayCells(week, false)}
        {rows ? rows.map((j) => renderBar(j, week)) : null}
        {numberOverlay(week)}
      </div>
    );
  };

  /** Day cells sit BELOW bars (so the bar stays draggable) — but numbers are
   * lifted INTO a pointer-events overlay above everything via absolute z-20. */
  const dayCells = (week: DayCol[], showNums: boolean) => (
    /* Day cells are BELOW bars (so bars stay draggable); numbers form an
     * overlay grid rendered ABOVE the bars with pointer-events-none, and the
     * renderStrip composes baseCells + bars + numberOverlay in that order. */
    <div className="pointer-events-none absolute inset-0 grid grid-cols-7">
      {week.map((d) => (
        <div
          key={d.iso}
          className={`relative border-l border-line/60 first:border-l-0 ${d.isToday ? "bg-indigo-50" : ""}`}
          style={
            d.isWeekend
              ? { backgroundImage: "repeating-linear-gradient(135deg, rgba(0,0,0,0.05) 0 4px, transparent 4px 8px)" }
              : undefined
          }
        >
        </div>
      ))}
    </div>
  );

  const numberOverlay = (week: DayCol[]) => (
    <div className="pointer-events-none absolute inset-0 z-30 grid grid-cols-7">
      {week.map((d) => (
        <div
          key={d.iso}
          style={{ gridColumnStart: d.dow + 1, gridColumnEnd: d.dow + 2 }}
          className="relative"
        >
          <span
            className={`absolute left-1 top-0.5 rounded-sm px-1 leading-tight ${density === "threemonths" ? "text-[9px]" : "text-[10px]"} ${d.isWeekend ? "bg-white/80 text-ink-muted" : "bg-white/90"} ${d.isToday ? "font-bold text-brand-primary" : "text-ink-muted"}`}
          >
            {d.dayNum}
          </span>
        </div>
      ))}
    </div>
  );

  const renderBar = (j: PlannerJobData, week: DayCol[]) => {
    const effEnd = resizePrev?.jobId === j.id && resizePrev ? resizePrev.endISO : j.endISO;
    const segs = weekSegments(j, week, effEnd);
    if (!segs.length) return null;
    const lane = lanes.get(j.id) ?? 0;
    const clipStart = j.startISO < windowStartISO;
    const clipEnd = effEnd > windowEndISO;
    return segs.map((s, i) => {
      const isLabelSeg = !clipStart && !s.contLeft;
      const text = barLabel(density, j, s.colEnd - s.colStart + 1, isLabelSeg);
      const showText = isLabelSeg;
      return (
        <div
          key={`${j.id}-${s.startISO}-${i}`}
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
            top: lane * laneH + 1,
            height: laneH - 2,
            backgroundColor: j.color,
            borderRadius: `${s.contLeft ? 0 : 5}px ${s.contRight ? 0 : 5}px ${s.contRight ? 0 : 5}px ${s.contLeft ? 0 : 5}px`,
            outline: j.overdue ? "2px solid #b45309" : undefined,
            // Label sits beside the day-number chip rather than under it:
            // keep vertical centreing and indent the text past the chip zone.
            paddingLeft: i === 0 && showText ? (density === "threemonths" ? 20 : 22) : undefined,
          }}
          title={`${j.jobNumber} — ${j.siteAddress || j.name}\n${j.planningLabel}\n${j.startISO} → ${j.endISO}${lane > 0 ? `\nOverlaps ${lane} other job${lane > 1 ? "s" : ""}` : ""}`}
        >
          {i === 0 && (clipStart || s.contLeft) && <span className="pl-0.5">◂</span>}
          {showText && <span className="truncate px-1">{text}</span>}
          {i === segs.length - 1 && (clipEnd || s.contRight) && <span className="ml-auto pr-0.5">▸</span>}
          {(j.priority === "High" || j.priority === "Urgent") && i === 0 && (
            <span className="absolute right-1 top-0 text-[8px]" title={`${j.priority} priority`}>▲</span>
          )}
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

  return (
    <div id="planner-wrapped-root" className="card overflow-hidden">
      {/* 7-column weekday header */}
      <div className="flex border-b border-line bg-gray-50">
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

      {/* Legend + one shared calendar. Engineer groups add divider labels. */}
      <div className="relative">
        {groups.map((g) => (
          <div key={g.label || "all"}>
            {g.label && (
              <div className="border-b border-line bg-gray-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
                {g.label}
              </div>
            )}
            {weeks.map((week, wi) => renderStrip(week, wi, g.rows))}
          </div>
        ))}
        {/* Shared drop zone if empty board */}
        {!hasJobs && weeks.map((week, wi) => renderStrip(week, wi))}
      </div>

      {hasJobs && laneCount > 1 && (
        <div className="border-t border-line bg-gray-50 px-3 py-1.5 text-[11px] text-ink-muted">
          {laneCount} overlapping jobs are stacked in separate lanes so you can see every concurrent job at once.
        </div>
      )}
    </div>
  );
}

export function PlannerMonthView(props: Omit<WrappedGridProps, "density">) {
  return <WrappedGrid {...props} density="month" />;
}

export function PlannerSixWeekView(props: Omit<WrappedGridProps, "density">) {
  return <WrappedGrid {...props} density="sixweeks" />;
}

export function PlannerThreeMonthView(props: Omit<WrappedGridProps, "density">) {
  return <WrappedGrid {...props} density="threemonths" />;
}
