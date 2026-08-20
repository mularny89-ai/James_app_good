"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import SearchableSelect from "@/components/SearchableSelect";
import ColorPicker from "@/components/ColorPicker";
import { Field } from "@/components/ui";
import { CALENDAR_EVENT_TYPES } from "@/lib/constants";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

type Opt = { id: number; label: string; hint?: string };

export type CalendarEventDTO = {
  id: number;
  title: string;
  type: string;
  date: string; // yyyy-mm-dd
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string;
  notes: string;
  color: string;
  jobId: number | null;
  clientId: number | null;
};

/** General/personal calendar event form. Job and client links are optional. */
export default function CalendarEventForm({
  action,
  jobs,
  clients,
  event,
  defaultType,
  submitLabel = "Save Event",
}: {
  action: (fd: FormData) => Promise<void>;
  jobs: Opt[];
  clients: Opt[];
  event?: CalendarEventDTO;
  defaultType?: string;
  submitLabel?: string;
}) {
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const type = event?.type ?? defaultType ?? "Other";

  return (
    <form action={action} className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event Title *">
          <input name="title" className="input" defaultValue={event?.title ?? ""} required placeholder="e.g. Dentist" />
        </Field>
        <Field label="Event Type">
          <select name="type" className="input" defaultValue={type}>
            {CALENDAR_EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Date *">
          <input type="date" name="date" className="input" defaultValue={event?.date ?? ""} required />
        </Field>
        <Field label="Colour">
          <ColorPicker name="color" defaultValue={event?.color || "#2563eb"} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="allDay"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          All Day
        </label>
        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <input type="time" name="startTime" className="input" defaultValue={event?.startTime ?? "09:00"} />
            </Field>
            <Field label="End">
              <input type="time" name="endTime" className="input" defaultValue={event?.endTime ?? ""} />
            </Field>
          </div>
        )}
        <Field label="Job (optional)">
          <SearchableSelect
            name="jobId"
            defaultValue={event?.jobId ? String(event.jobId) : ""}
            placeholder="Search job number or address…"
            options={jobs.map((j) => ({ value: String(j.id), label: j.label, hint: j.hint }))}
          />
        </Field>
        <Field label="Client (optional)">
          <SearchableSelect
            name="clientId"
            defaultValue={event?.clientId ? String(event.clientId) : ""}
            placeholder="Search client…"
            options={clients.map((c) => ({ value: String(c.id), label: c.label, hint: c.hint }))}
          />
        </Field>
        <Field label="Location">
          <input name="location" className="input" defaultValue={event?.location ?? ""} placeholder="Optional" />
        </Field>
        <Field label="Description / Notes" className="sm:col-span-2">
          <textarea name="notes" rows={3} className="input" defaultValue={event?.notes ?? ""} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <a href="/calendar" className="btn">Cancel</a>
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
