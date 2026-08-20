"use client";

import { useTransition } from "react";

/** "Move To ▼" dropdown used on job cards and task rows.
 *  Options may carry a `group`; grouped options render under <optgroup> headers. */
export default function MoveTo({
  options,
  current,
  onMove,
  compact,
}: {
  options: { id: number | string; label: string; group?: string }[];
  current: number | string;
  onMove: (id: any) => Promise<void>;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();

  const groups = options.reduce<{ name: string; opts: typeof options }[]>(
    (acc, o) => {
      if (o.group) {
        const g = acc.find((x) => x.name === o.group);
        if (g) g.opts.push(o);
        else acc.push({ name: o.group, opts: [o] });
      }
      return acc;
    }, []);
  const ungrouped = options.filter((o) => !o.group);

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
      {ungrouped.map((o) => (
        <option key={String(o.id)} value={String(o.id)}>
          {o.label}
        </option>
      ))}
      {groups.map((g) => (
        <optgroup key={g.name} label={g.name}>
          {g.opts.map((o) => (
            <option key={String(o.id)} value={String(o.id)}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
