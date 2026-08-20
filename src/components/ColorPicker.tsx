"use client";

import { useState } from "react";
import { CALENDAR_COLOR_PALETTE } from "@/lib/constants";

/** Swatch picker for calendar colours. Submits the hex value in a hidden input. */
export default function ColorPicker({
  name,
  defaultValue = "#2563eb",
  allowInherit = false,
  inheritLabel = "Auto (job colour)",
}: {
  name: string;
  defaultValue?: string;
  /** Inspections: empty value inherits the linked job's planner colour. */
  allowInherit?: boolean;
  inheritLabel?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name={name} value={value} />
      {allowInherit && (
        <button
          type="button"
          onClick={() => setValue("")}
          className={`rounded-md border px-2 py-1 text-xs ${value === "" ? "border-ink font-semibold" : "border-line text-ink-muted"}`}
        >
          {inheritLabel}
        </button>
      )}
      {CALENDAR_COLOR_PALETTE.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.name}
          onClick={() => setValue(c.value)}
          className={`h-6 w-6 rounded-full border-2 ${value === c.value ? "border-ink" : "border-transparent"}`}
          style={{ backgroundColor: c.value }}
        />
      ))}
      {value && (
        <span className="ml-1 text-xs text-ink-muted">
          {CALENDAR_COLOR_PALETTE.find((c) => c.value === value)?.name ?? value}
        </span>
      )}
    </div>
  );
}
