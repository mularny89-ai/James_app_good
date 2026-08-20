import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDate, fmtMoney } from "@/lib/format";
import { PageHeader, SoftBadge, EmptyState } from "@/components/ui";
import { quoteStatusColor, invoiceStatusColor, inspectionStatusColor } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Global search across every module (Sections 66–67). */
export default async function SearchPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const q = (searchParams.q ?? "").trim();
  const contains = { contains: q };

  let jobs: any[] = [], clients: any[] = [], quotes: any[] = [], invoices: any[] = [], tasks: any[] = [], inspections: any[] = [];
  const asNumber = parseInt(q);

  if (q) {
    [jobs, clients, quotes, invoices, tasks, inspections] = await Promise.all([
      db.job.findMany({
        where: {
          archived: false,
          OR: [
            { name: contains }, { siteAddress: contains }, { description: contains }, { scope: contains },
            ...(isNaN(asNumber) ? [] : [{ jobNumber: asNumber }]),
          ],
        },
        include: { client: true, status: true }, take: 25,
      }),
      db.client.findMany({
        where: { archived: false, OR: [{ name: contains }, { company: contains }, { contactPerson: contains }, { email: contains }, { billingAddress: contains }] },
        take: 25,
      }),
      db.quote.findMany({
        where: { archived: false, OR: [{ quoteNumber: contains }, { project: contains }, { siteAddress: contains }, { client: { name: contains } }] },
        include: { client: true }, take: 25,
      }),
      db.invoice.findMany({
        where: { archived: false, OR: [{ invoiceNumber: contains }, { description: contains }, { siteAddress: contains }, { client: { name: contains } }] },
        include: { client: true, job: true }, take: 25,
      }),
      db.task.findMany({
        where: { OR: [{ title: contains }, { description: contains }, { notes: contains }] },
        include: { job: true }, take: 25,
      }),
      db.siteInspection.findMany({
        where: { OR: [{ siteAddress: contains }, { clientName: contains }, { jobName: contains }] },
        include: { job: true, type: true }, take: 25,
      }),
    ]);
  }

  const total = jobs.length + clients.length + quotes.length + invoices.length + tasks.length + inspections.length;

  const Section = ({ title, children, count }: { title: string; children: React.ReactNode; count: number }) =>
    count === 0 ? null : (
      <section className="card mb-4">
        <h3 className="section-title border-b border-line px-3 py-2">{title} ({count})</h3>
        <ul className="divide-y divide-line">{children}</ul>
      </section>
    );

  return (
    <div className="p-5">
      <PageHeader title={`Search: “${q}”`} subtitle={q ? `${total} result${total === 1 ? "" : "s"}` : "Enter a search term above"} />
      {!q ? (
        <EmptyState message="Search job numbers, clients, companies, addresses, quotes, invoices and tasks." />
      ) : total === 0 ? (
        <EmptyState message={`Nothing found for “${q}”.`} />
      ) : (
        <>
          <Section title="Jobs" count={jobs.length}>
            {jobs.map((j) => (
              <li key={j.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <Link href={`/jobs/${j.id}`} className="link font-bold">{j.jobNumber}</Link>
                <span className="truncate">{j.name}</span>
                <span className="truncate text-xs text-ink-muted">{j.siteAddress}</span>
                <span className="ml-auto"><SoftBadge label={j.status.name} color={j.status.color} /></span>
              </li>
            ))}
          </Section>
          <Section title="Clients" count={clients.length}>
            {clients.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <Link href={`/clients/${c.id}`} className="link font-semibold">{c.name}</Link>
                <span className="text-ink-muted">{c.company}</span>
                <span className="ml-auto text-xs text-ink-muted">{c.email}</span>
              </li>
            ))}
          </Section>
          <Section title="Quotes" count={quotes.length}>
            {quotes.map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <Link href={`/quotes/${x.id}`} className="link font-semibold">{x.quoteNumber}</Link>
                <span className="truncate">{x.project || x.siteAddress}</span>
                <span className="text-ink-muted">{x.client.name}</span>
                <span className="ml-auto font-medium">{fmtMoney(x.total)}</span>
                <SoftBadge label={x.status} color={quoteStatusColor(x.status)} />
              </li>
            ))}
          </Section>
          <Section title="Invoices" count={invoices.length}>
            {invoices.map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <Link href={`/invoices/${x.id}`} className="link font-semibold">{x.invoiceNumber}</Link>
                <span className="truncate">{x.description}</span>
                <span className="text-ink-muted">{x.client.name}</span>
                <span className="ml-auto font-medium">{fmtMoney(x.total - x.amountPaid)}</span>
                <SoftBadge label={x.status} color={invoiceStatusColor(x.status)} />
              </li>
            ))}
          </Section>
          <Section title="Tasks" count={tasks.length}>
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <span className={t.completed ? "text-ink-muted line-through" : ""}>{t.title}</span>
                {t.job && <Link href={`/jobs/${t.job.id}`} className="link font-semibold">{t.job.jobNumber}</Link>}
                <span className="ml-auto text-xs text-ink-muted">{t.dueDate ? `Due ${fmtDate(t.dueDate)}` : ""}</span>
              </li>
            ))}
          </Section>
          <Section title="Site Inspections" count={inspections.length}>
            {inspections.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <span className="font-medium">{fmtDate(i.date)} {i.startTime}</span>
                {i.job && <Link href={`/jobs/${i.job.id}`} className="link font-semibold">{i.job.jobNumber}</Link>}
                <span className="truncate">{i.siteAddress}</span>
                <span className="ml-auto"><SoftBadge label={i.status} color={inspectionStatusColor(i.status)} /></span>
              </li>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}
