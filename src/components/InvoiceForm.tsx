"use client";

import { useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";
import SiteAddressFields from "@/components/SiteAddressFields";
import TaskItemsEditor, { TaskItemRow, PresetOpt } from "@/components/TaskItemsEditor";
import { Field } from "@/components/ui";
import { displayJobName } from "@/lib/format";

type JobOpt = {
  id: number;
  jobNumber: string;
  name: string;
  siteAddress: string;
  siteStreet: string;
  siteSuburb: string;
  billingAddress: string;
  remainingFee: number; // quoted + variations − already invoiced
};

/** Section 57: creating an invoice from a job auto-populates everything. */
export default function InvoiceForm({
  action,
  jobs,
  defaultJobId,
  gstRate,
  invoice,
  presets = [],
  submitLabel = "Create Invoice",
}: {
  action: (fd: FormData) => Promise<void>;
  jobs: JobOpt[];
  defaultJobId?: number;
  gstRate: number;
  presets?: PresetOpt[];
  invoice?: {
    jobId: number | null;
    siteAddress: string;
    siteStreet: string;
    siteSuburb: string;
    billingAddress: string;
    description: string;
    dueDate: string;
    notes: string;
    items: TaskItemRow[];
  };
  submitLabel?: string;
}) {
  const initialJob = jobs.find((j) => j.id === (invoice?.jobId ?? defaultJobId)) ?? null;
  const [job, setJob] = useState<JobOpt | null>(initialJob);

  const defaultItems: TaskItemRow[] = invoice?.items ?? (job
    ? [{ name: "Structural Engineering Services", description: `Job ${job.jobNumber} (${displayJobName(job)})`, qty: 1, unitPrice: Math.max(job.remainingFee, 0), gst: true }]
    : []);

  return (
    <form action={action} className="card space-y-4 p-5" key={job?.id ?? "none"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Job (auto-fills details)">
          <SearchableSelect
            name="jobId"
            defaultValue={job ? String(job.id) : ""}
            placeholder="Search job number or address…"
            options={jobs.map((j) => ({ value: String(j.id), label: `${j.jobNumber} — ${displayJobName(j)}`, hint: j.siteAddress }))}
            onChange={(v) => setJob(jobs.find((j) => String(j.id) === v) ?? null)}
          />
        </Field>
        <Field label="Due Date">
          <input
            type="date" name="dueDate" className="input"
            defaultValue={invoice?.dueDate ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)}
          />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <input name="description" className="input" defaultValue={invoice?.description ?? (job ? `Job ${job.jobNumber} — ${displayJobName(job)}` : "")} />
        </Field>
        <Field label="Billing Address" className="sm:col-span-2">
          <input name="billingAddress" className="input" defaultValue={invoice?.billingAddress ?? job?.billingAddress ?? ""} />
        </Field>
        <SiteAddressFields
          defaultStreet={invoice?.siteStreet || invoice?.siteAddress || job?.siteStreet || job?.siteAddress || ""}
          defaultSuburb={invoice?.siteSuburb ?? job?.siteSuburb ?? ""}
        />
      </div>

      {job && !invoice && (
        <p className="rounded-md border border-line bg-gray-50 px-3 py-2 text-xs text-ink-muted">
          Remaining uninvoiced fee for Job {job.jobNumber}: <strong>${Math.max(job.remainingFee, 0).toFixed(2)}</strong> (ex GST) — pre-filled as the first line item. Adjust as needed; multiple invoices per job are supported.
        </p>
      )}

      <div>
        <h3 className="section-title mb-2">Tasks</h3>
        <TaskItemsEditor items={defaultItems} gstRate={gstRate} presets={presets} documentTitle="Invoice" />
      </div>

      <Field label="Notes"><textarea name="notes" rows={2} className="input" defaultValue={invoice?.notes ?? ""} /></Field>

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <a href="/invoices" className="btn">Cancel</a>
        <button type="submit" className="btn-primary">{submitLabel}</button>
      </div>
    </form>
  );
}
