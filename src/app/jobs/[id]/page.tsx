import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime, fmtMoney, toInputDate, displayJobName } from "@/lib/format";
import { updateJob, moveJobById, addDocument, deleteDocument } from "@/lib/actions/jobs";
import { createTask } from "@/lib/actions/tasks";
import { PageHeader, SoftBadge, EmptyState, Field, StatRow, Badge } from "@/components/ui";
import SearchableSelect from "@/components/SearchableSelect";
import MoveTo from "@/components/MoveTo";
import ConfirmButton from "@/components/ConfirmButton";
import JobProgress from "@/components/JobProgress";
import NotesSection from "@/components/NotesSection";
import { archiveJob } from "@/lib/actions/jobs";
import { PRIORITIES, DOCUMENT_CATEGORIES, quoteStatusColor, invoiceStatusColor, inspectionStatusColor, priorityColor } from "@/lib/constants";
import { planningStatus, PLANNING_STATUS_LABELS } from "@/lib/planner";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const TABS = ["Overview", "Tasks", "Inspections", "Financial", "Documents", "Notes", "Activity"] as const;

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  const id = parseInt(params.id);
  const tab = searchParams.tab ?? "Overview";

  const job = await db.job.findUnique({
    where: { id },
    include: {
      client: true,
      status: true,
      projectType: true,
      assignedEmployee: true,
      quote: { include: { items: true } },
      tasks: { orderBy: [{ completed: "asc" }, { dueDate: "asc" }] },
      inspections: { include: { type: true }, orderBy: { date: "desc" } },
      invoices: { include: { items: true, payments: true }, orderBy: { createdAt: "desc" } },
      jobNotes: true,
      documents: { orderBy: [{ category: "asc" }, { name: "asc" }, { revision: "asc" }] },
      activities: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!job) notFound();

  const [statuses, types, taskLists, employees] = await Promise.all([
    db.jobStatus.findMany({ orderBy: { order: "asc" } }),
    db.jobType.findMany({ orderBy: { order: "asc" } }),
    db.taskList.findMany({ orderBy: { order: "asc" } }),
    db.employee.findMany({ where: { active: true, assignable: true }, orderBy: { displayName: "asc" } }),
  ]);

  // Financial summary derived from linked records (Section 59)
  const liveInvoices = job.invoices.filter((i) => !i.archived && i.status !== "Cancelled");
  const invoiced = liveInvoices.reduce((s, i) => s + i.total, 0);
  const paid = liveInvoices.reduce((s, i) => s + i.amountPaid, 0);
  const totalFee = job.quotedFee + job.variations;
  const outstanding = invoiced - paid;

  async function updateJobBound(fd: FormData) {
    "use server";
    await updateJob(id, fd);
  }

  return (
    <div className="p-5">
      <PageHeader
        title={
          <span>
            <span style={{ color: "var(--brand-primary)" }}>{job.jobNumber}</span>
            {displayJobName(job) && <span className="ml-3">{displayJobName(job)}</span>}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-3">
            <span>Client: <Link href={`/clients/${job.clientId}`} className="link">{job.client.name}</Link></span>
            <Badge label={job.status.name} color={job.status.color} />
            <span style={{ color: priorityColor(job.priority) }}>{job.priority}</span>
            <span>Due: {fmtDate(job.dueDate)}</span>
            {job.quote && <span>Quote: <Link href={`/quotes/${job.quote.id}`} className="link">{job.quote.quoteNumber}</Link></span>}
          </span>
        }
        actions={
          <>
            <MoveTo
              options={statuses.map((s) => ({ id: s.id, label: s.name }))}
              current={job.statusId}
              onMove={moveJobById.bind(null, job.id)}
            />
            <Link href={`/invoices/new?jobId=${job.id}`} className="btn-primary">Create Invoice</Link>
            <ConfirmButton
              label="Archive"
              message="Archive this job? It will be hidden from active lists."
              onConfirm={async () => {
                "use server";
                await archiveJob(id);
                redirect("/jobs");
              }}
            />
          </>
        }
      />

      <JobProgress statusName={job.status.name} />

      {/* Tabs — Section 26 */}
      <nav className="mb-4 mt-4 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/jobs/${id}?tab=${t}`}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t ? "border-b-2 text-white-imp" : "text-ink-muted hover:text-ink"
            }`}
            style={tab === t ? { borderColor: "var(--brand-primary)", color: "var(--brand-primary)" } : undefined}
          >
            {t}
          </Link>
        ))}
      </nav>

      {tab === "Overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <form action={updateJobBound} className="card space-y-3 p-4 lg:col-span-2">
            <h3 className="section-title">Job Details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Job Number"><input className="input bg-gray-50" value={String(job.jobNumber)} readOnly /></Field>
              <Field label="Status">
                <select name="status" defaultValue={job.status.name} className="input">
                  {statuses.map((s) => <option key={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Project / Job Name"><input name="name" defaultValue={job.name} className="input" /></Field>
              <Field label="Project Type">
                <select name="projectType" defaultValue={job.projectType?.name ?? ""} className="input">
                  <option value="">—</option>
                  {types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </Field>
              <Field label="Client Contact"><input name="clientContact" defaultValue={job.clientContact} className="input" /></Field>
              <Field label="Priority">
                <select name="priority" defaultValue={job.priority} className="input">
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Street Address" className="sm:col-span-2"><input name="siteStreet" defaultValue={job.siteStreet || job.siteAddress} className="input" /></Field>
              <Field label="Town / Suburb"><input name="siteSuburb" defaultValue={job.siteSuburb} className="input" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="State">
                  <select name="siteState" defaultValue={job.siteState} className="input">
                    <option value="">—</option>
                    {["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Postcode"><input name="sitePostcode" defaultValue={job.sitePostcode} className="input" /></Field>
              </div>
              <Field label="Billing Address" className="sm:col-span-2"><input name="billingAddress" defaultValue={job.billingAddress} className="input" /></Field>
              <Field label="Assigned Engineer">
                <SearchableSelect
                  name="assignedEmployeeId"
                  defaultValue={job.assignedEmployeeId ? String(job.assignedEmployeeId) : ""}
                  placeholder="Search employees…"
                  options={[
                    ...(job.assignedEmployee && !job.assignedEmployee.active
                      ? [{ value: String(job.assignedEmployee.id), label: job.assignedEmployee.displayName, hint: "Inactive" }]
                      : []),
                    ...employees.map((e) => ({ value: String(e.id), label: e.displayName, hint: e.position })),
                  ]}
                />
              </Field>
              <Field label="Start Date"><input type="date" name="startDate" defaultValue={toInputDate(job.startDate)} className="input" /></Field>
              <Field label="Due Date"><input type="date" name="dueDate" defaultValue={toInputDate(job.dueDate)} className="input" /></Field>
              <Field label="Quoted Fee (ex GST)"><input type="number" step="0.01" name="quotedFee" defaultValue={job.quotedFee} className="input" /></Field>
              <Field label="Variations (ex GST)"><input type="number" step="0.01" name="variations" defaultValue={job.variations} className="input" /></Field>
              <Field label="Created"><input className="input bg-gray-50" value={fmtDate(job.createdAt)} readOnly /></Field>
              <Field label="Description" className="sm:col-span-2"><textarea name="description" rows={2} defaultValue={job.description} className="input" /></Field>
              <Field label="Engineering Scope" className="sm:col-span-2"><textarea name="scope" rows={3} defaultValue={job.scope} className="input" /></Field>
              <Field label="Internal Notes" className="sm:col-span-2"><textarea name="notes" rows={2} defaultValue={job.notes} className="input" /></Field>
            </div>
            <div className="flex justify-end border-t border-line pt-3">
              <button type="submit" className="btn-primary">Save Changes</button>
            </div>
          </form>

          <div className="space-y-4">
            {/* Planning — Job Planner integration (Section 42) */}
            <div className="card">
              <h3 className="section-title border-b border-line px-3 py-2">Planning</h3>
              {job.plannedStartDate ? (
                <>
                  <StatRow
                    label="Planner Colour"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: job.plannerColor || "#3b5bdb" }} />
                        {job.plannerColor || "—"}
                      </span>
                    }
                  />
                  <StatRow label="Planned Start" value={fmtDate(job.plannedStartDate)} />
                  <StatRow label="Planned End" value={fmtDate(job.plannedEndDate)} />
                  <StatRow
                    label="Duration"
                    value={job.plannedDuration ? `${job.plannedDuration} ${job.durationUnit === "calendar" ? "calendar" : "working"} day${job.plannedDuration === 1 ? "" : "s"}` : "—"}
                  />
                  <StatRow
                    label="Planning Status"
                    value={PLANNING_STATUS_LABELS[planningStatus({ plannedStartDate: job.plannedStartDate, plannedEndDate: job.plannedEndDate, statusName: job.status.name })]}
                  />
                  <div className="px-3 py-2">
                    <Link href={`/planner?view=week&start=${toInputDate(job.plannedStartDate)}`} className="btn w-full justify-center">View in Planner</Link>
                  </div>
                </>
              ) : (
                <div className="px-3 py-3 text-sm">
                  <p className="text-ink-muted">Not yet scheduled.</p>
                  <Link href={`/planner?schedule=${job.id}`} className="btn-primary mt-2 w-full justify-center">Schedule Job</Link>
                </div>
              )}
            </div>
            <div className="card">
              <h3 className="section-title border-b border-line px-3 py-2">Financial Summary</h3>
              <StatRow label="Quoted" value={fmtMoney(job.quotedFee)} />
              <StatRow label="Variations" value={fmtMoney(job.variations)} />
              <StatRow label="Total Fee" value={fmtMoney(totalFee)} bold />
              <StatRow label="Invoiced" value={fmtMoney(invoiced)} />
              <StatRow label="Paid" value={<span className="text-ok">{fmtMoney(paid)}</span>} />
              <StatRow label="Outstanding" value={<span className={outstanding > 0 ? "text-err" : "text-ok"}>{fmtMoney(outstanding)}</span>} bold />
            </div>
            {job.quote && (
              <div className="card p-3 text-sm">
                <h3 className="section-title mb-2">Source Quote</h3>
                <p>
                  <Link href={`/quotes/${job.quote.id}`} className="link font-semibold">{job.quote.quoteNumber}</Link>
                  <SoftBadge label={job.quote.status} color={quoteStatusColor(job.quote.status)} />
                </p>
                <p className="mt-1 text-xs text-ink-muted">{job.quote.quoteNumber} → Job {job.jobNumber}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "Tasks" && (
        <div className="card p-4">
          <form action={createTask} className="mb-4 flex flex-wrap items-end gap-2 border-b border-line pb-4">
            <input type="hidden" name="jobId" value={job.id} />
            <Field label="Task Name" className="min-w-64 flex-1">
              <input name="title" className="input" placeholder={`Task for Job ${job.jobNumber}…`} required />
            </Field>
            <Field label="List">
              <select name="listId" className="input w-44" defaultValue={taskLists[0]?.id}>
                {taskLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Due Date"><input type="date" name="dueDate" className="input" /></Field>
            <Field label="Priority">
              <select name="priority" className="input w-28" defaultValue="Normal">{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
            </Field>
            <button className="btn-primary" type="submit">Add Task</button>
          </form>
          {job.tasks.length === 0 ? (
            <EmptyState message="No tasks for this job yet." />
          ) : (
            <ul className="divide-y divide-line">
              {job.tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className={t.completed ? "text-ink-muted line-through" : ""}>{t.title}</span>
                  {t.important && <span className="text-warn">★</span>}
                  <span className="ml-auto text-xs text-ink-muted">
                    {t.dueDate ? `Due ${fmtDate(t.dueDate)}` : ""}
                  </span>
                  <SoftBadge label={t.completed ? "Done" : t.priority} color={t.completed ? "#15803d" : priorityColor(t.priority)} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-muted">Full task management (complete, subtasks, My Day) is under <Link href="/tasks" className="link">Tasks</Link>.</p>
        </div>
      )}

      {tab === "Inspections" && (
        <div className="card p-4">
          <div className="mb-3 flex justify-end">
            <Link href={`/inspections/new?jobId=${job.id}`} className="btn-primary">+ Schedule Inspection</Link>
          </div>
          {job.inspections.length === 0 ? (
            <EmptyState message="No site inspections for this job." actionHref={`/inspections/new?jobId=${job.id}`} actionLabel="+ Schedule Inspection" />
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-line">
                <th className="th">Date</th><th className="th">Time</th><th className="th">Type</th><th className="th">Site Address</th><th className="th">Status</th>
              </tr></thead>
              <tbody>
                {job.inspections.map((i) => (
                  <tr key={i.id} className="border-b border-line hover:bg-gray-50">
                    <td className="td font-medium">{fmtDate(i.date)}</td>
                    <td className="td">{i.startTime}–{i.endTime}</td>
                    <td className="td">{i.type?.name ?? "—"}</td>
                    <td className="td">{i.siteAddress}</td>
                    <td className="td">
                      <Link href={`/inspections/${i.id}`} className="link">
                        <SoftBadge label={i.status} color={inspectionStatusColor(i.status)} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "Financial" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card h-fit">
            <h3 className="section-title border-b border-line px-3 py-2">Financial Summary</h3>
            <StatRow label="Quoted" value={fmtMoney(job.quotedFee)} />
            <StatRow label="Variations" value={fmtMoney(job.variations)} />
            <StatRow label="Total Fee" value={fmtMoney(totalFee)} bold />
            <StatRow label="Invoiced" value={fmtMoney(invoiced)} />
            <StatRow label="Paid" value={<span className="text-ok">{fmtMoney(paid)}</span>} />
            <StatRow label="Outstanding" value={<span className={outstanding > 0 ? "text-err" : "text-ok"}>{fmtMoney(outstanding)}</span>} bold />
            <div className="px-3 py-2">
              <Link href={`/invoices/new?jobId=${job.id}`} className="btn-primary w-full justify-center">Create Invoice</Link>
            </div>
          </div>
          <div className="card lg:col-span-2">
            <h3 className="section-title border-b border-line px-3 py-2">Invoices</h3>
            {job.invoices.length === 0 ? (
              <p className="px-3 py-4 text-sm text-ink-muted">No invoices yet for this job.</p>
            ) : (
              <table className="w-full">
                <thead><tr className="border-b border-line">
                  <th className="th">Invoice №</th><th className="th">Date</th><th className="th">Total</th><th className="th">Paid</th><th className="th">Outstanding</th><th className="th">Status</th>
                </tr></thead>
                <tbody>
                  {job.invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-line hover:bg-gray-50">
                      <td className="td font-semibold"><Link href={`/invoices/${inv.id}`} className="link">{inv.invoiceNumber}</Link></td>
                      <td className="td">{fmtDate(inv.date)}</td>
                      <td className="td">{fmtMoney(inv.total)}</td>
                      <td className="td text-ok">{fmtMoney(inv.amountPaid)}</td>
                      <td className="td">{fmtMoney(inv.total - inv.amountPaid)}</td>
                      <td className="td"><SoftBadge label={inv.status} color={invoiceStatusColor(inv.status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "Documents" && (
        <div className="card p-4">
          <form action={addDocument.bind(null, job.id)} className="mb-4 flex flex-wrap items-end gap-2 border-b border-line pb-4">
            <Field label="Document Name" className="min-w-64 flex-1"><input name="name" className="input" required placeholder="e.g. Structural Drawings Sheet S01" /></Field>
            <Field label="Category">
              <select name="category" className="input w-52">
                {DOCUMENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Revision"><input name="revision" className="input w-20" defaultValue="A" /></Field>
            <button className="btn-primary" type="submit">Register Document</button>
          </form>
          {job.documents.length === 0 ? (
            <p className="py-4 text-sm text-ink-muted">No documents registered. The register is revision-ready — multiple revisions (A, B, C…) of the same document can be tracked.</p>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-line">
                <th className="th">Category</th><th className="th">Document</th><th className="th">Rev</th><th className="th">Registered</th><th className="th"></th>
              </tr></thead>
              <tbody>
                {job.documents.map((d) => (
                  <tr key={d.id} className="border-b border-line">
                    <td className="td text-ink-muted">{d.category}</td>
                    <td className="td font-medium">{d.name}</td>
                    <td className="td font-bold" style={{ color: "var(--brand-primary)" }}>{d.revision}</td>
                    <td className="td text-ink-muted">{fmtDate(d.uploadedAt)}</td>
                    <td className="td text-right">
                      <ConfirmButton label="Remove" message="Remove this document from the register?" className="text-xs text-err underline" onConfirm={async () => { "use server"; await deleteDocument(d.id, job.id); }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "Notes" && (
        <div className="card p-4">
          <NotesSection jobId={job.id} notes={job.jobNotes} />
        </div>
      )}

      {tab === "Activity" && (
        <div className="card p-4">
          {job.activities.length === 0 ? (
            <p className="py-4 text-sm text-ink-muted">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-0">
              {job.activities.map((a) => (
                <li key={a.id} className="flex gap-3 border-b border-line py-2 text-sm last:border-0">
                  <span className="w-40 shrink-0 text-xs text-ink-muted">{fmtDateTime(a.createdAt)}</span>
                  <span>{a.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
