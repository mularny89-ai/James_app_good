import { db } from "@/lib/db";
import { createCalendarEvent } from "@/lib/actions/calendar";
import CalendarEventForm from "@/components/CalendarEventForm";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewEventPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const type = searchParams.type ?? "Other";
  const [jobs, clients] = await Promise.all([
    db.job.findMany({
      where: { archived: false },
      select: { id: true, jobNumber: true, name: true, siteAddress: true },
      orderBy: { jobNumber: "desc" },
      take: 500,
    }),
    db.client.findMany({
      where: { archived: false },
      select: { id: true, name: true, company: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl p-5">
      <PageHeader title={`New ${type}`} subtitle="General calendar event — no job is required." />
      <CalendarEventForm
        action={createCalendarEvent}
        defaultType={type}
        jobs={jobs.map((j) => ({ id: j.id, label: j.siteAddress ? `${j.jobNumber} — ${j.siteAddress}` : `${j.jobNumber} — ${j.name}`, hint: j.name }))}
        clients={clients.map((c) => ({ id: c.id, label: c.name, hint: c.company }))}
        submitLabel="Create Event"
      />
    </div>
  );
}
