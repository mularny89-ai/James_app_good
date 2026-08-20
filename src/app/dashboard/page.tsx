import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDate, fmtMoney, isToday, isOverdue, startOfDay, endOfDay, addDays } from "@/lib/format";
import { refreshOverdueInvoices } from "@/lib/actions/invoices";
import { PageHeader, EmptyState, SoftBadge } from "@/components/ui";
import { inspectionStatusColor, priorityColor } from "@/lib/constants";

export const dynamic = "force-dynamic";

function Card({ href, label, count, tone }: { href: string; label: string; count: number; tone?: string }) {
  const color = tone ?? "var(--brand-primary)";
  return (
    <Link
      href={href}
      className="card block px-3 py-2.5 transition-shadow hover:shadow-sm"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="text-2xl font-bold leading-none" style={{ color }}>{count}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</div>
    </Link>
  );
}

export default async function DashboardPage() {
  await refreshOverdueInvoices();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(addDays(now, 7));

  const [
    jobsToStart, jobsInProgress, jobsToFinalise, jobsAwaitingInfo,
    inspectionsThisWeek, overdueTasks, quotesAwaiting, draftInvoices,
    outstandingInvoices, outstandingAgg,
    todaysTasks, todaysInspections, jobsDueToday,
    overdueJobs, upcomingInspections, upcomingDeadlines,
    recentJobs, updatedJobs, quotesPending, unpaidInvoices,
  ] = await Promise.all([
    db.job.count({ where: { archived: false, status: { name: "To Start" } } }),
    db.job.count({ where: { archived: false, status: { name: "In Progress" } } }),
    db.job.count({ where: { archived: false, status: { name: "To Finalise" } } }),
    db.job.count({ where: { archived: false, status: { name: { startsWith: "Awaiting" } } } }),
    db.siteInspection.count({ where: { date: { gte: todayStart, lte: weekEnd }, status: { notIn: ["Cancelled"] } } }),
    db.task.count({ where: { completed: false, dueDate: { lt: todayStart } } }),
    db.quote.count({ where: { archived: false, status: "Sent" } }),
    db.invoice.count({ where: { archived: false, status: "Draft" } }),
    db.invoice.count({ where: { archived: false, status: { in: ["Sent", "Part Paid", "Overdue"] } } }),
    db.invoice.aggregate({ _sum: { total: true, amountPaid: true }, where: { archived: false, status: { in: ["Sent", "Part Paid", "Overdue"] } } }),
    db.task.findMany({ where: { completed: false, OR: [{ dueDate: { gte: todayStart, lte: todayEnd } }, { inMyDay: true }] }, include: { job: true }, orderBy: [{ dueTime: "asc" }, { priority: "desc" }], take: 20 }),
    db.siteInspection.findMany({ where: { date: { gte: todayStart, lte: todayEnd }, status: { notIn: ["Cancelled"] } }, include: { type: true, job: true }, orderBy: { startTime: "asc" } }),
    db.job.findMany({ where: { archived: false, dueDate: { gte: todayStart, lte: todayEnd }, status: { name: { notIn: ["Completed", "Cancelled"] } } }, include: { client: true, status: true } }),
    db.job.findMany({ where: { archived: false, dueDate: { lt: todayStart }, status: { name: { notIn: ["Completed", "Cancelled"] } } }, include: { client: true, status: true }, orderBy: { dueDate: "asc" }, take: 10 }),
    db.siteInspection.findMany({ where: { date: { gt: todayEnd, lte: weekEnd }, status: { notIn: ["Cancelled"] } }, include: { type: true, job: true }, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 10 }),
    db.job.findMany({ where: { archived: false, dueDate: { gt: todayEnd, lte: weekEnd }, status: { name: { notIn: ["Completed", "Cancelled"] } } }, include: { client: true }, orderBy: { dueDate: "asc" }, take: 10 }),
    db.job.findMany({ where: { archived: false }, include: { client: true, status: true }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.job.findMany({ where: { archived: false }, include: { client: true, status: true }, orderBy: { updatedAt: "desc" }, take: 6 }),
    db.quote.findMany({ where: { archived: false, status: "Sent" }, include: { client: true }, orderBy: { date: "asc" }, take: 8 }),
    db.invoice.findMany({ where: { archived: false, status: { in: ["Sent", "Part Paid", "Overdue"] } }, include: { client: true, job: true }, orderBy: { dueDate: "asc" }, take: 8 }),
  ]);

  const outstandingTotal = (outstandingAgg._sum.total ?? 0) - (outstandingAgg._sum.amountPaid ?? 0);
  const overdueTaskList = await db.task.findMany({
    where: { completed: false, dueDate: { lt: todayStart } },
    include: { job: true }, orderBy: { dueDate: "asc" }, take: 10,
  });

  return (
    <div className="p-5">
      <PageHeader title="Dashboard" subtitle={fmtDate(now)} />

      {/* Summary cards — Section 11, all from live data, all clickable (Section 110) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card href="/jobs?status=To Start" label="Jobs To Start" count={jobsToStart} />
        <Card href="/jobs?status=In Progress" label="Jobs In Progress" count={jobsInProgress} tone="#0e7cc4" />
        <Card href="/jobs?status=To Finalise" label="Jobs To Finalise" count={jobsToFinalise} tone="#7c3aed" />
        <Card href="/jobs?awaiting=1" label="Awaiting Information" count={jobsAwaitingInfo} tone="#b45309" />
        <Card href="/calendar" label="Inspections This Week" count={inspectionsThisWeek} tone="#0e7cc4" />
        <Card href="/tasks?filter=overdue" label="Overdue Tasks" count={overdueTasks} tone="#b91c1c" />
        <Card href="/quotes?status=Sent" label="Quotes Awaiting Response" count={quotesAwaiting} tone="#b45309" />
        <Card href="/invoices?status=Draft" label="Draft Invoices" count={draftInvoices} tone="#64748b" />
        <Card href="/invoices?status=outstanding" label="Outstanding Invoices" count={outstandingInvoices} tone="#b91c1c" />
        <div className="card px-3 py-2.5" style={{ borderLeft: "3px solid var(--error)" }}>
          <div className="text-2xl font-bold leading-none" style={{ color: "var(--error)" }}>{fmtMoney(outstandingTotal)}</div>
          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-muted">Total Outstanding</div>
        </div>
      </div>

      {/* TODAY — Section 12 */}
      <h2 className="mb-2 mt-6 text-base font-bold uppercase tracking-wide" style={{ color: "var(--brand-primary)" }}>
        Today
      </h2>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Today&apos;s Tasks</h3>
          {todaysTasks.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-muted">No tasks scheduled for today.</p>
          ) : (
            <ul className="divide-y divide-line">
              {todaysTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="truncate">{t.title}</span>
                  {t.job && <Link href={`/jobs/${t.job.id}`} className="link shrink-0 text-xs font-semibold">{t.job.jobNumber}</Link>}
                  {t.dueTime && <span className="shrink-0 text-xs text-ink-muted">{t.dueTime}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Today&apos;s Site Inspections</h3>
          {todaysInspections.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-muted">No site inspections scheduled today.</p>
          ) : (
            <ul className="divide-y divide-line">
              {todaysInspections.map((i) => (
                <li key={i.id} className="px-3 py-1.5 text-sm">
                  <Link href={`/inspections/${i.id}`} className="link font-semibold">{i.startTime}</Link>
                  {i.job && <Link href={`/jobs/${i.job.id}`} className="link ml-2 font-semibold">{i.job.jobNumber}</Link>}
                  <span className="ml-2">{i.siteAddress}</span>
                  <SoftBadge label={i.status} color={inspectionStatusColor(i.status)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Jobs Due Today</h3>
          {jobsDueToday.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-muted">No jobs due today.</p>
          ) : (
            <ul className="divide-y divide-line">
              {jobsDueToday.map((j) => (
                <li key={j.id} className="px-3 py-1.5 text-sm">
                  <Link href={`/jobs/${j.id}`} className="link font-semibold">{j.jobNumber}</Link>
                  <span className="ml-2">{j.name}</span>
                  <SoftBadge label={j.status.name} color={j.status.color} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Overdue &amp; Attention</h3>
          {overdueJobs.length === 0 && overdueTaskList.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-muted">Nothing overdue. Well done.</p>
          ) : (
            <ul className="divide-y divide-line">
              {overdueJobs.map((j) => (
                <li key={`j${j.id}`} className="px-3 py-1.5 text-sm">
                  <span className="mr-1 text-xs font-semibold text-err">JOB</span>
                  <Link href={`/jobs/${j.id}`} className="link font-semibold">{j.jobNumber}</Link>
                  <span className="ml-2">{j.name}</span>
                  <span className="ml-2 text-xs text-err">due {fmtDate(j.dueDate)}</span>
                </li>
              ))}
              {overdueTaskList.map((t) => (
                <li key={`t${t.id}`} className="px-3 py-1.5 text-sm">
                  <span className="mr-1 text-xs font-semibold text-warn">TASK</span>
                  <span>{t.title}</span>
                  <span className="ml-2 text-xs text-err">due {fmtDate(t.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* UPCOMING — Section 13 */}
      <h2 className="mb-2 mt-6 text-base font-bold uppercase tracking-wide" style={{ color: "var(--brand-primary)" }}>
        Upcoming
      </h2>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Upcoming Site Inspections</h3>
          {upcomingInspections.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-muted">No site inspections scheduled this week. <Link className="link" href="/inspections/new">+ Schedule Inspection</Link></p>
          ) : (
            <ul className="divide-y divide-line">
              {upcomingInspections.map((i) => (
                <li key={i.id} className="px-3 py-1.5 text-sm">
                  <span className="font-medium">{fmtDate(i.date)}</span>
                  <span className="ml-1 text-ink-muted">{i.startTime}</span>
                  {i.job && <Link href={`/jobs/${i.job.id}`} className="link ml-2 font-semibold">{i.job.jobNumber}</Link>}
                  <span className="ml-2">{i.siteAddress}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Upcoming Job Deadlines</h3>
          {upcomingDeadlines.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-muted">No job deadlines in the next 7 days.</p>
          ) : (
            <ul className="divide-y divide-line">
              {upcomingDeadlines.map((j) => (
                <li key={j.id} className="px-3 py-1.5 text-sm">
                  <span className="font-medium">{fmtDate(j.dueDate)}</span>
                  <Link href={`/jobs/${j.id}`} className="link ml-2 font-semibold">{j.jobNumber}</Link>
                  <span className="ml-2">{j.name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Recently Updated Jobs</h3>
          {updatedJobs.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-muted">No jobs yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {updatedJobs.map((j) => (
                <li key={j.id} className="px-3 py-1.5 text-sm">
                  <Link href={`/jobs/${j.id}`} className="link font-semibold">{j.jobNumber}</Link>
                  <span className="ml-2">{j.name}</span>
                  <SoftBadge label={j.status.name} color={j.status.color} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Quotes Awaiting Approval</h3>
          {quotesPending.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-muted">No quotes awaiting a response.</p>
          ) : (
            <ul className="divide-y divide-line">
              {quotesPending.map((q) => (
                <li key={q.id} className="px-3 py-1.5 text-sm">
                  <Link href={`/quotes/${q.id}`} className="link font-semibold">{q.quoteNumber}</Link>
                  <span className="ml-2">{q.client.name}</span>
                  <span className="ml-2 font-medium">{fmtMoney(q.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Invoices Awaiting Payment</h3>
          {unpaidInvoices.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-muted">No invoices awaiting payment.</p>
          ) : (
            <ul className="divide-y divide-line">
              {unpaidInvoices.map((inv) => (
                <li key={inv.id} className="px-3 py-1.5 text-sm">
                  <Link href={`/invoices/${inv.id}`} className="link font-semibold">{inv.invoiceNumber}</Link>
                  <span className="ml-2">{inv.client.name}</span>
                  <span className="ml-2 font-medium">{fmtMoney(inv.total - inv.amountPaid)}</span>
                  <span className={`ml-2 text-xs ${inv.status === "Overdue" ? "font-semibold text-err" : "text-ink-muted"}`}>
                    due {fmtDate(inv.dueDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="section-title border-b border-line px-3 py-2">Recent Jobs</h3>
          {recentJobs.length === 0 ? (
            <div className="p-3"><EmptyState message="No jobs yet. Accept a quote or create a job to get started." actionHref="/jobs/new" actionLabel="+ New Job" /></div>
          ) : (
            <ul className="divide-y divide-line">
              {recentJobs.map((j) => (
                <li key={j.id} className="px-3 py-1.5 text-sm">
                  <Link href={`/jobs/${j.id}`} className="link font-semibold">{j.jobNumber}</Link>
                  <span className="ml-2">{j.name}</span>
                  <span className="ml-2 text-xs" style={{ color: priorityColor(j.priority) }}>{j.priority}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
