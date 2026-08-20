import { db } from "@/lib/db";
import { createJob } from "@/lib/actions/jobs";
import { peekNextJobNumber } from "@/lib/numbering";
import { PageHeader, Field } from "@/components/ui";
import SearchableSelect from "@/components/SearchableSelect";
import { PRIORITIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function NewJobPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const [clients, types, nextNo] = await Promise.all([
    db.client.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    db.jobType.findMany({ orderBy: { order: "asc" } }),
    peekNextJobNumber(),
  ]);

  return (
    <div className="mx-auto max-w-3xl p-5">
      <PageHeader title="New Job" subtitle={`Job number will be assigned automatically (next: ${nextNo})`} />

      {searchParams.error === "client" && (
        <div className="mb-4 rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--error)", color: "var(--error)", backgroundColor: "#fef2f2" }}>
          Please select a client from the list before creating the job.
        </div>
      )}

      {clients.length === 0 ? (
        <div className="card p-4 text-sm">
          You need a client before creating a job.{" "}
          <a href="/clients/new" className="link font-medium">Create a client first →</a>
        </div>
      ) : (
        <form action={createJob} className="card space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client *">
              <SearchableSelect
                name="clientId"
                required
                options={clients.map((c) => ({ value: String(c.id), label: c.name, hint: c.company }))}
              />
            </Field>
            <Field label="Client Contact">
              <input name="clientContact" className="input" placeholder="Defaults to client contact person" />
            </Field>
            <Field label="Job / Project Name">
              <input name="name" className="input" placeholder="e.g. 14 Example Street, Broadbeach" />
            </Field>
            <Field label="Project Type">
              <select name="projectType" className="input" defaultValue="">
                <option value="">—</option>
                {types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Street Address" className="sm:col-span-2">
              <input name="siteStreet" className="input" placeholder="e.g. 14 Example Street" />
            </Field>
            <Field label="Town / Suburb">
              <input name="siteSuburb" className="input" placeholder="e.g. Broadbeach" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="State">
                <select name="siteState" className="input" defaultValue="">
                  <option value="">—</option>
                  {["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Postcode">
                <input name="sitePostcode" className="input" placeholder="4218" />
              </Field>
            </div>
            <Field label="Billing Address" className="sm:col-span-2">
              <input name="billingAddress" className="input" placeholder="Defaults to client billing address" />
            </Field>
            <Field label="Priority">
              <select name="priority" className="input" defaultValue="Normal">
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Assigned Engineer">
              <input name="assignedEngineer" className="input" />
            </Field>
            <Field label="Start Date">
              <input type="date" name="startDate" className="input" />
            </Field>
            <Field label="Due Date">
              <input type="date" name="dueDate" className="input" />
            </Field>
            <Field label="Quoted Fee (ex GST)">
              <input type="number" step="0.01" min="0" name="quotedFee" className="input" placeholder="0.00" />
            </Field>
            {/* Optional planner scheduling (Section 43) */}
            <Field label="Planned Start (optional)">
              <input type="date" name="plannedStart" className="input" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Planned Duration (optional)">
                <input type="number" min={1} step={1} name="plannedDuration" className="input" placeholder="e.g. 5" />
              </Field>
              <Field label="Duration Unit">
                <select name="durationUnit" className="input" defaultValue="working">
                  <option value="working">Working Days</option>
                  <option value="calendar">Calendar Days</option>
                </select>
              </Field>
            </div>
            <Field label="Project Description" className="sm:col-span-2">
              <textarea name="description" rows={2} className="input" />
            </Field>
            <Field label="Engineering Scope" className="sm:col-span-2">
              <textarea name="scope" rows={3} className="input" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <a href="/jobs" className="btn">Cancel</a>
            <button type="submit" className="btn-primary">Create Job</button>
          </div>
        </form>
      )}
    </div>
  );
}
