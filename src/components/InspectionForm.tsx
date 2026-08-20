"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import SearchableSelect from "@/components/SearchableSelect";
import { Field } from "@/components/ui";
import { INSPECTION_STATUSES } from "@/lib/constants";

function SubmitButton({ label }: { label: string }) {
  // Disabled while the server action runs — prevents duplicate inspections.
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

type JobOpt = { id: number; jobNumber: number; name: string; clientName: string; siteAddress: string; clientContact: string; clientPhone: string; clientEmail: string };
type InspType = { id: number; name: string };

export type InspectionDTO = {
  id: number;
  jobId: number | null;
  jobName: string;
  clientName: string;
  siteAddress: string;
  typeId: number | null;
  date: string;
  startTime: string;
  endTime: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
  status: string;
};

/** Section 45/79: selecting a job auto-populates client, address and contacts. */
export default function InspectionForm({
  action,
  jobs,
  types,
  inspection,
  defaultJobId,
  returnTo,
  submitLabel = "Save Inspection",
}: {
  action: (fd: FormData) => Promise<void>;
  jobs: JobOpt[];
  types: InspType[];
  inspection?: InspectionDTO;
  defaultJobId?: number;
  returnTo?: string;
  submitLabel?: string;
}) {
  const [selectedJob, setSelectedJob] = useState<JobOpt | null>(
    jobs.find((j) => j.id === (inspection?.jobId ?? defaultJobId)) ?? null
  );

  const linked = !!selectedJob;

  return (
    <form action={action} className="card space-y-4 p-5">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      {/* key forces re-mount so inherited job data populates uncontrolled fields */}
      <div className="grid gap-4 sm:grid-cols-2" key={selectedJob?.id ?? "none"}>
        <Field label="Job / Site">
          <SearchableSelect
            name="jobId"
            defaultValue={selectedJob ? String(selectedJob.id) : ""}
            placeholder="Search job number, address or client…"
            options={[
              { value: "", label: "No Job / Enter Address Manually" },
              ...jobs.map((j) => ({
                value: String(j.id),
                label: j.siteAddress ? `${j.jobNumber} — ${j.siteAddress}` : `${j.jobNumber} — ${j.name}`,
                hint: j.clientName,
              })),
            ]}
            onChange={(v) => setSelectedJob(jobs.find((j) => String(j.id) === v) ?? null)}
          />
        </Field>
        <Field label="Inspection Type">
          <select name="inspectionType" className="input" defaultValue={types.find((t) => t.id === inspection?.typeId)?.name ?? ""}>
            <option value="">—</option>
            {types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </Field>

        <Field label="Job Name">
          <input name="jobName" className="input" defaultValue={inspection?.jobName ?? selectedJob?.name ?? ""} readOnly={linked} />
        </Field>
        <Field label="Client Name">
          <input name="clientName" className="input" defaultValue={inspection?.clientName ?? selectedJob?.clientName ?? ""} readOnly={linked} />
        </Field>
        <Field label="Site Address" className="sm:col-span-2">
          <input name="siteAddress" className="input" defaultValue={inspection?.siteAddress ?? selectedJob?.siteAddress ?? ""} readOnly={linked} required={!linked} />
        </Field>

        <Field label="Date *"><input type="date" name="date" className="input" defaultValue={inspection?.date ?? ""} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><input type="time" name="startTime" className="input" defaultValue={inspection?.startTime ?? "09:00"} /></Field>
          <Field label="End"><input type="time" name="endTime" className="input" defaultValue={inspection?.endTime ?? "10:00"} /></Field>
        </div>

        <Field label="Contact Person">
          <input name="contactPerson" className="input" defaultValue={inspection?.contactPerson ?? selectedJob?.clientContact ?? ""} />
        </Field>
        <Field label="Contact Phone">
          <input name="contactPhone" className="input" defaultValue={inspection?.contactPhone ?? selectedJob?.clientPhone ?? ""} />
        </Field>
        <Field label="Contact Email">
          <input name="contactEmail" className="input" defaultValue={inspection?.contactEmail ?? selectedJob?.clientEmail ?? ""} />
        </Field>
        <Field label="Status">
          <select name="status" className="input" defaultValue={inspection?.status ?? "Scheduled"}>
            {INSPECTION_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea name="notes" rows={3} className="input" defaultValue={inspection?.notes ?? ""} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <a href="/inspections" className="btn">Cancel</a>
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
