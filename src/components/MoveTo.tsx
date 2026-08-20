"use client";

import { useTransition } from "react";

/** "Move To ▼" dropdown used on job cards and task rows (Sections 24, 34). */
export default function MoveTo({
  options,
  current,
  onMove,
  compact,
}: {
  options: { id: number | string; label: string }[];
  current: number | string;
  onMove: (id: any) => Promise<void>;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      value={String(current)}
      disabled={pending}
      onChange={(e) => {
        const raw = e.target.value;
        const opt = options.find((o) => String(o.id) === raw);
        if (!opt) return;
        start(async () => onMove(opt.id));
      }}
      onClick={(e) => e.stopPropagation()}
      className={`rounded border border-line bg-white text-xs ${compact ? "px-1 py-0.5" : "px-2 py-1"}`}
      aria-label="Move to"
    >
      {options.map((o) => (
        <option key={String(o.id)} value={String(o.id)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
