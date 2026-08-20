import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { updateClient, archiveClient, unarchiveClient } from "@/lib/actions/clients";
import { PageHeader, SoftBadge, StatRow } from "@/components/ui";
import ClientForm from "@/components/ClientForm";
import ConfirmButton from "@/components/ConfirmButton";
import { quoteStatusColor, invoiceStatusColor, inspectionStatusColor } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const client = await db.client.findUnique({
    where: { id },
    include: {
      jobs: { where: { archived: false }, include: { status: true }, orderBy: { createdAt: "desc" } },
      quotes: { where: { archived: false }, orderBy: { createdAt: "desc" } },
      invoices: { where: { archived: false }, include: { job: true }, orderBy: { createdAt: "desc" } },
      tasks: { where: { completed: false }, orderBy: { dueDate: "asc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!client) notFound();

  const inspections = await db.siteInspection.findMany({
    where: { OR: [{ clientName: client.name }, { job: { clientId: id } }] },
    include: { job: true, type: true },
    orderBy: { date: "desc" },
    take: 30,
  });

  const activeJobs = client.jobs.filter((j) => !["Completed", "Cancelled"].includes(j.status.name));
  const completedJobs = client.jobs.filter((j) => j.status.name === "Completed");
  const outstanding = client.invoices
    .filter((i) => ["Sent", "Part Paid", "Overdue"].includes(i.status))
    .reduce((s, i) => s + (i.total - i.amountPaid), 0);

  async function updateBound(fd: FormData) {
    "use server";
    await updateClient(id, fd);
  }

  return (
    <div className="p-5">
      <PageHeader
        title={client.name}
        subtitle={
          <span>
            {client.company && <span className="mr-3">{client.company}</span>}
            <span className="mr-3">{client.email}</span>
            <span>{client.phone || client.mobile}</span>
            {client.archived && <SoftBadge label="Archived" color="#6b7280" />}
          </span>
        }
        actions={
          <>
            <Link href={`/quotes/new?clientId=${client.id}`} className="btn">+ Quote</Link>
            <Link href={`/jobs/new?clientId=${client.id}`} className="btn">+ Job</Link>
            <Link href={`/tasks?clientId=${client.id}&new=1`} className="btn">+ Task</Link>
            {client.archived ? (
              <form action={async () => { "use server"; await unarchiveClient(id); }}>
                <button className="btn" type="submit">Unarchive</button>
              </form>
            ) : (
              <ConfirmButton
                label="Archive Client"
                message="Archive this client? Clients with active jobs cannot be archived."
                onConfirm={async () => { "use server"; await archiveClient(id); }}
              />
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <form action={updateBound} className="card space-y-3 p-4 lg:col-span-2">
          <h3 className="section-title">Client Details</h3>
          <ClientForm client={client as unknown as Record<string, string>} />
          <div className="flex justify-end border-t border-line pt-3">
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="card">
            <h3 className="section-title border-b border-line px-3 py-2">Summary</h3>
            <StatRow label="Client Since" value={fmtDate(client.createdAt)} />
            <StatRow label="Active Jobs" value={activeJobs.length} />
            <StatRow label="Completed Jobs" value={completedJobs.length} />
            <StatRow label="Quotes" value={client.quotes.length} />
            <StatRow label="Invoices" value={client.invoices.length} />
            <StatRow label="Outstanding" value={<span className={outstanding > 0 ? "text-err" : "text-ok"}>{fmtMoney(outstanding)}</span>} bold />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Active Jobs</h3>
          {activeJobs.length === 0 ? <p className="px-3 py-3 text-sm text-ink-muted">No active jobs.</p> : (
            <ul className="divide-y divide-line">
              {activeJobs.map((j) => (
                <li key={j.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <Link href={`/jobs/${j.id}`} className="link font-semibold">{j.jobNumber}</Link>
                  <span className="truncate">{j.name}</span>
                  <span className="ml-auto"><SoftBadge label={j.status.name} color={j.status.color} /></span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Completed Jobs</h3>
          {completedJobs.length === 0 ? <p className="px-3 py-3 text-sm text-ink-muted">No completed jobs yet.</p> : (
            <ul className="divide-y divide-line">
              {completedJobs.map((j) => (
                <li key={j.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <Link href={`/jobs/${j.id}`} className="link font-semibold">{j.jobNumber}</Link>
                  <span className="truncate">{j.name}</span>
                  <span className="ml-auto text-xs text-ink-muted">{fmtDate(j.completedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Quotes</h3>
          {client.quotes.length === 0 ? <p className="px-3 py-3 text-sm text-ink-muted">No quotes.</p> : (
            <ul className="divide-y divide-line">
              {client.quotes.map((q) => (
                <li key={q.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <Link href={`/quotes/${q.id}`} className="link font-semibold">{q.quoteNumber}</Link>
                  <span className="truncate">{q.project}</span>
                  <span className="ml-auto font-medium">{fmtMoney(q.total)}</span>
                  <SoftBadge label={q.status} color={quoteStatusColor(q.status)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Invoices</h3>
          {client.invoices.length === 0 ? <p className="px-3 py-3 text-sm text-ink-muted">No invoices.</p> : (
            <ul className="divide-y divide-line">
              {client.invoices.map((inv) => (
                <li key={inv.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <Link href={`/invoices/${inv.id}`} className="link font-semibold">{inv.invoiceNumber}</Link>
                  {inv.job && <span className="text-xs text-ink-muted">Job {inv.job.jobNumber}</span>}
                  <span className="ml-auto font-medium">{fmtMoney(inv.total - inv.amountPaid)}</span>
                  <SoftBadge label={inv.status} color={invoiceStatusColor(inv.status)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Site Inspections</h3>
          {inspections.length === 0 ? <p className="px-3 py-3 text-sm text-ink-muted">No site inspections.</p> : (
            <ul className="divide-y divide-line">
              {inspections.map((i) => (
                <li key={i.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="font-medium">{fmtDate(i.date)}</span>
                  <span className="text-xs text-ink-muted">{i.startTime}</span>
                  {i.job && <Link href={`/jobs/${i.job.id}`} className="link font-semibold">{i.job.jobNumber}</Link>}
                  <span className="truncate">{i.siteAddress}</span>
                  <span className="ml-auto"><SoftBadge label={i.status} color={inspectionStatusColor(i.status)} /></span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Activity</h3>
          {client.activities.length === 0 ? <p className="px-3 py-3 text-sm text-ink-muted">No activity yet.</p> : (
            <ul className="divide-y divide-line">
              {client.activities.slice(0, 20).map((a) => (
                <li key={a.id} className="flex gap-3 px-3 py-1.5 text-sm">
                  <span className="w-36 shrink-0 text-xs text-ink-muted">{fmtDateTime(a.createdAt)}</span>
                  <span>{a.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {client.notes && (
        <section className="card mt-4 p-4">
          <h3 className="section-title mb-2">Notes</h3>
          <p className="whitespace-pre-wrap text-sm">{client.notes}</p>
        </section>
      )}
    </div>
  );
}
