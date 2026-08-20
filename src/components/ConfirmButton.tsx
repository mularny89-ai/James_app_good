"use client";

import { useState, useTransition } from "react";

/** Confirmation for important/destructive actions only (Section 96). */
export default function ConfirmButton({
  message,
  onConfirm,
  label,
  className = "btn-danger",
}: {
  message: string;
  onConfirm: () => Promise<void>;
  label: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button type="button" className={className} onClick={() => setArmed(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-2 py-1">
      <span className="text-xs text-red-800">{message}</span>
      <button
        type="button"
        disabled={pending}
        className="rounded bg-red-700 px-2 py-0.5 text-xs font-medium text-white"
        onClick={() => start(async () => onConfirm())}
      >
        {pending ? "Working…" : "Confirm"}
      </button>
      <button type="button" className="text-xs text-ink-muted underline" onClick={() => setArmed(false)}>
        Cancel
      </button>
    </span>
  );
}
