"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rescheduleInspection } from "@/lib/actions/inspections";
import { moveCalendarEvent } from "@/lib/actions/calendar";
import { readableTextOn } from "@/lib/format";

export type CalEvent = {
  id: number;
  kind: "inspection" | "task" | "job" | "event";
  date: string; // yyyy-mm-dd
  startTime: string;
  endTime: string;
  label: string;
  sublabel: string;
  title?: string;      // event type, e.g. "Site Inspection"
  jobNumber?: string | null;
  address?: string;
  clientName?: string;
  href: string;
  color: string;
  allDay?: boolean;
};

/** "09:30" -> "9:30 AM" (kept local so the client bundle stays self-contained). */
function fmtTime12(t: string): string {
  if (!t) return "";
  const [hs, ms] = t.split(":");
  const h = parseInt(hs);
  if (isNaN(h)) return t;
  return `${h % 12 === 0 ? 12 : h % 12}:${(ms ?? "00").padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const toISO = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DRAGGABLE = new Set(["inspection", "event"]);

function EventChip({ ev, compact }: { ev: CalEvent; compact?: boolean }) {
  const router = useRouter();
  const draggable = DRAGGABLE.has(ev.kind);
  const onDragStart = (e: React.DragEvent) => e.dataTransfer.setData("text/event", JSON.stringify({ id: ev.id, kind: ev.kind }));
  const time12 = fmtTime12(ev.startTime);

  if (compact) {
    // Month view: time + address first for inspections, time + title otherwise.
    const text = ev.kind === "inspection"
      ? [time12, ev.address || ev.label].filter(Boolean).join(" — ")
      : [time12, ev.label].filter(Boolean).join(" — ");
    return (
      <button
        draggable={draggable}
        onDragStart={onDragStart}
        onClick={() => router.push(ev.href)}
        className="cal-event"
        style={{ backgroundColor: ev.color, color: readableTextOn(ev.color), cursor: draggable ? "grab" : "pointer" }}
        title={`${time12} ${ev.title ?? ev.label} — ${ev.address ?? ev.sublabel}${ev.jobNumber ? ` · ${ev.jobNumber}` : ""}${ev.clientName ? ` · ${ev.clientName}` : ""}`}
      >
        {text}
      </button>
    );
  }
  // Day/week blocks — inspections lead with time then address (address outranks type);
  // general events lead with time then the event title.
  const timeLabel = ev.allDay ? "All day" : fmtTime12(ev.startTime) + (ev.endTime ? ` – ${fmtTime12(ev.endTime)}` : "");
  const fg = readableTextOn(ev.color);
  const primary = ev.kind === "inspection" ? (ev.address || ev.label) : ev.label;
  return (
    <button
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={() => router.push(ev.href)}
      className="cal-event"
      style={{ backgroundColor: ev.color, color: fg, cursor: draggable ? "grab" : "pointer", whiteSpace: "normal", overflow: "hidden" }}
      title={`${timeLabel} ${ev.title ?? ev.label} — ${ev.address ?? ev.sublabel}${ev.clientName ? ` (${ev.clientName})` : ""}`}
    >
      <span className="block truncate text-[11px] font-bold leading-tight">{timeLabel}</span>
      <span className="block truncate text-[11px] font-semibold leading-tight">{primary}</span>
      {ev.jobNumber != null && <span className="block truncate text-[10px] leading-tight">{ev.jobNumber}</span>}
      {ev.clientName && <span className="block truncate text-[10px] leading-tight opacity-90">{ev.clientName}</span>}
      {ev.title && <span className="block truncate text-[10px] leading-tight opacity-80">{ev.title}</span>}
    </button>
  );
}

export default function CalendarView({
  view,
  anchor, // yyyy-mm-dd
  events,
}: {
  view: "month" | "week" | "day" | "agenda";
  anchor: string;
  events: CalEvent[];
}) {
  const router = useRouter();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [, start] = useTransition();
  const anchorDate = new Date(anchor + "T00:00:00");
  const todayISO = toISO(new Date());

  const nav = (d: Date, v = view) => router.push(`/calendar?view=${v}&date=${toISO(d)}`);
  const shift = (n: number) => {
    const d = new Date(anchorDate);
    if (view === "month") d.setMonth(d.getMonth() + n);
    else if (view === "week") d.setDate(d.getDate() + n * 7);
    else d.setDate(d.getDate() + n);
    nav(d);
  };

  const eventsOn = (iso: string) => events.filter((e) => e.date === iso);

  const dropHandlers = (iso: string) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(iso); },
    onDragLeave: () => setDragOver((c) => (c === iso ? null : c)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(null);
      try {
        const { id, kind } = JSON.parse(e.dataTransfer.getData("text/event"));
        if (kind === "inspection" && iso) start(async () => rescheduleInspection(id, iso));
        else if (kind === "event" && iso) start(async () => moveCalendarEvent(id, iso));
      } catch { /* ignore */ }
    },
  });

  const cellCls = (iso: string) =>
    `cal-cell ${iso === todayISO ? "today" : ""} ${dragOver === iso ? "outline-dashed outline-2 -outline-offset-2" : ""}`;

  // ---------- Month ----------
  const renderMonth = () => {
    const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first); gridStart.setDate(1 - startOffset);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); cells.push(d); }

    return (
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line bg-gray-50">
          {DAYS.map((d) => <div key={d} className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d) => {
            const iso = toISO(d);
            const inMonth = d.getMonth() === anchorDate.getMonth();
            const evs = eventsOn(iso);
            return (
              <div key={iso} className={`${cellCls(iso)} ${inMonth ? "" : "other-month"}`} {...dropHandlers(iso)}>
                <div className="mb-1 flex items-center justify-between">
                  <span className={`text-xs font-medium ${iso === todayISO ? "rounded-full px-1.5 text-white" : "text-ink-muted"}`}
                    style={iso === todayISO ? { backgroundColor: "var(--brand-primary)" } : undefined}>
                    {d.getDate()}
                  </span>
                </div>
                {evs.slice(0, 3).map((ev) => <EventChip key={`${ev.kind}${ev.id}`} ev={ev} compact />)}
                {evs.length > 3 && (
                  <button className="text-xs text-ink-muted hover:underline" onClick={() => nav(d, "day")}>
                    +{evs.length - 3} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ---------- Week / Day ----------
  const renderWeek = () => {
    const dayCount = view === "day" ? 1 : 7;
    const start = new Date(anchorDate);
    if (view === "week") start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const days: Date[] = [];
    for (let i = 0; i < dayCount; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
    const hours = Array.from({ length: 12 }, (_, i) => i + 6); // 06:00–17:00
    const gridCols = dayCount === 1 ? "grid-cols-[64px_1fr]" : "grid-cols-[64px_repeat(7,1fr)]";
    const timed = (iso: string) => eventsOn(iso).filter((e) => !e.allDay);
    const allDay = (iso: string) => eventsOn(iso).filter((e) => e.allDay);

    return (
      <div className="card overflow-x-auto">
        <div className={`grid ${gridCols} border-b border-line bg-gray-50`}>
          <div />
          {days.map((d) => {
            const iso = toISO(d);
            return (
              <div key={iso} className={`border-l border-line px-2 py-1.5 text-center ${iso === todayISO ? "today" : ""}`} {...dropHandlers(iso)}>
                <div className="text-xs font-semibold uppercase text-ink-muted">{DAYS[(d.getDay() + 6) % 7]}</div>
                <button className="text-sm font-bold hover:underline" onClick={() => nav(d, "day")}
                  style={iso === todayISO ? { color: "var(--brand-primary)" } : undefined}>
                  {d.getDate()} {MONTHS[d.getMonth()].slice(0, 3)}
                </button>
              </div>
            );
          })}
        </div>
        {/* All-day events */}
        <div className={`grid ${gridCols} border-b border-line`}>
          <div className="px-1 py-1 text-right text-xs text-ink-muted">All day</div>
          {days.map((d) => {
            const iso = toISO(d);
            const evs = allDay(iso);
            return (
              <div key={iso} className={`min-h-[26px] border-l border-line p-0.5 ${iso === todayISO ? "today" : ""}`} {...dropHandlers(iso)}>
                {evs.map((ev) => <EventChip key={`${ev.kind}${ev.id}`} ev={ev} />)}
              </div>
            );
          })}
        </div>
        {hours.map((h) => (
          <div key={h} className={`grid ${gridCols}`}>
            <div className="px-1 py-1 text-right text-xs text-ink-muted">{String(h).padStart(2, "0")}:00</div>
            {days.map((d) => {
              const iso = toISO(d);
              const evs = timed(iso).filter((e) => parseInt(e.startTime.split(":")[0]) === h);
              return (
                <div key={iso} className={`min-h-[40px] border-b border-l border-line p-0.5 ${iso === todayISO ? "today" : ""}`} {...dropHandlers(iso)}>
                  {evs.map((ev) => <EventChip key={`${ev.kind}${ev.id}`} ev={ev} />)}
                </div>
              );
            })}
          </div>
        ))}
        {/* Events outside 06:00–17:00 */}
        <div className={`grid ${gridCols}`}>
          <div className="px-1 py-1 text-right text-xs text-ink-muted">Other</div>
          {days.map((d) => {
            const iso = toISO(d);
            const evs = timed(iso).filter((e) => { const h = parseInt(e.startTime.split(":")[0]); return h < 6 || h > 17 || isNaN(h); });
            return (
              <div key={iso} className={`min-h-[32px] border-l border-line p-0.5 ${iso === todayISO ? "today" : ""}`} {...dropHandlers(iso)}>
                {evs.map((ev) => <EventChip key={`${ev.kind}${ev.id}`} ev={ev} />)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ---------- Agenda ----------
  const renderAgenda = () => {
    const sorted = [...events].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    if (sorted.length === 0) return <div className="card px-4 py-8 text-center text-sm text-ink-muted">Nothing scheduled in this period.</div>;
    let lastDate = "";
    return (
      <div className="card divide-y divide-line">
        {sorted.map((ev) => {
          const showDate = ev.date !== lastDate;
          lastDate = ev.date;
          const d = new Date(ev.date + "T00:00:00");
          return (
            <div key={`${ev.kind}${ev.id}`}>
              {showDate && (
                <div className="bg-gray-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                  {DAYS[(d.getDay() + 6) % 7]} {d.getDate()} {MONTHS[d.getMonth()]} {d.getFullYear()}
                </div>
              )}
              <button className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50" onClick={() => router.push(ev.href)}>
                <span className="w-24 shrink-0 text-sm font-semibold">{ev.startTime}{ev.endTime ? `–${ev.endTime}` : ""}</span>
                <span className="h-8 w-1 rounded" style={{ backgroundColor: ev.color }} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{ev.label}</span>
                  <span className="block truncate text-xs text-ink-muted">{ev.sublabel}</span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const title =
    view === "month"
      ? `${MONTHS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`
      : view === "day"
        ? `${anchorDate.getDate()} ${MONTHS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`
        : `Week of ${anchorDate.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button className="btn" onClick={() => shift(-1)}>‹</button>
          <button className="btn" onClick={() => nav(new Date())}>Today</button>
          <button className="btn" onClick={() => shift(1)}>›</button>
        </div>
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="ml-auto flex gap-1">
          {(["month", "week", "day", "agenda"] as const).map((v) => (
            <button
              key={v}
              className={view === v ? "btn-primary" : "btn"}
              onClick={() => nav(anchorDate, v)}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-2 text-xs text-ink-muted">Drag an inspection or event to another day to reschedule it — the change is saved immediately.</p>
      {view === "month" && renderMonth()}
      {(view === "week" || view === "day") && renderWeek()}
      {view === "agenda" && renderAgenda()}
    </div>
  );
}
