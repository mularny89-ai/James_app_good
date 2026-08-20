"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const GENERAL_TYPES = ["Meeting", "Personal Appointment", "Phone Call", "Reminder", "Blocked Time", "Other"];

/** "+ Add Event" dropdown: site inspections keep their specialised workflow,
 *  everything else goes to the general event form with the type preselected. */
export default function AddEventMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="btn-primary" onClick={() => setOpen((o) => !o)}>
        + Add Event
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-line bg-white py-1 shadow-lg">
          <Link
            href="/inspections/new?from=calendar"
            className="block px-3 py-1.5 text-sm hover:bg-gray-100"
            onClick={() => setOpen(false)}
          >
            Site Inspection
          </Link>
          <div className="my-1 border-t border-line" />
          {GENERAL_TYPES.map((t) => (
            <Link
              key={t}
              href={`/calendar/events/new?type=${encodeURIComponent(t)}`}
              className="block px-3 py-1.5 text-sm hover:bg-gray-100"
              onClick={() => setOpen(false)}
            >
              {t}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
