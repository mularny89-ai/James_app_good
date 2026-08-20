"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { moveJob } from "@/lib/actions/jobs";
import MoveTo from "@/components/MoveTo";
import { priorityColor } from "@/lib/constants";

type BoardJob = {
  id: number;
  jobNumber: string;
  name: string;
  clientName: string;
  dueDate: string | null;
  priority: string;
  statusId: number;
  openTasks: number;
  overdue: boolean;
};

type Column = { id: number; name: string; color: string; jobs: BoardJob[] };

export default function KanbanBoard({
  columns,
  allStatuses,
}: {
  columns: Column[];
  allStatuses: { id: number; name: string }[];
}) {
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);
  const [, start] = useTransition();

  const onDrop = (colId: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCol(null);
    const jobId = parseInt(e.dataTransfer.getData("text/job-id"));
    const col = columns.find((c) => c.id === colId);
    if (!jobId || !col) return;
    start(async () => moveJob(jobId, col.name));
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div
          key={col.id}
          className={`kanban-col ${dragOverCol === col.id ? "drag-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverCol(col.id);
          }}
          onDragLeave={() => setDragOverCol((c) => (c === col.id ? null : c))}
          onDrop={onDrop(col.id)}
        >
          <div
            className="flex items-center justify-between rounded-t-lg border-b border-line px-3 py-2"
            style={{ backgroundColor: col.color + "14" }}
          >
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: col.color }}>
              {col.name}
            </span>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink-muted">
              {col.jobs.length}
            </span>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-2">
            {col.jobs.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-ink-muted">No jobs</p>
            )}
            {col.jobs.map((job) => (
              <div
                key={job.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/job-id", String(job.id))}
                className="cursor-grab rounded-md border border-line bg-white p-2.5 shadow-sm hover:shadow active:cursor-grabbing"
              >
                <div className="flex items-center justify-between">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="link text-sm font-bold"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {job.jobNumber}
                  </Link>
                  <span className="text-xs font-medium" style={{ color: priorityColor(job.priority) }}>
                    {job.priority}
                  </span>
                </div>
                <Link href={`/jobs/${job.id}`} className="mt-0.5 block truncate text-sm font-medium hover:underline">
                  {job.name}
                </Link>
                <div className="truncate text-xs text-ink-muted">{job.clientName}</div>
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className={job.overdue ? "font-semibold text-err" : "text-ink-muted"}>
                    {job.dueDate ? `Due: ${job.dueDate}` : "No due date"}
                  </span>
                  <span className="text-ink-muted">{job.openTasks} task{job.openTasks === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between border-t border-line pt-1.5">
                  <span className="text-xs text-ink-muted">Move To ▼</span>
                  <MoveTo
                    compact
                    options={allStatuses.map((s) => ({ id: s.id, label: s.name }))}
                    current={job.statusId}
                    onMove={async (statusId: number) => {
                      const s = allStatuses.find((x) => x.id === statusId);
                      if (s) await moveJob(job.id, s.name);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
