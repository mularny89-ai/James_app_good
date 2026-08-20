import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/actions/calendar";
import CalendarEventForm from "@/components/CalendarEventForm";
import { PageHeader, SoftBadge } from "@/components/ui";
import ConfirmButton from "@/components/ConfirmButton";
import { fmtDate, fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  const id = parseInt(params.id);
  const mode = searchParams.mode ?? "view";

  const [ev, jobs, clients] = await Promise.all([
    db.calendarEvent.findUnique({ where: { id }, include: { job: { include: { client: true } }, client: true } }),
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
  if (!ev) notFound();

  async function updateBound(fd: FormData) {
    "use server";
    await updateCalendarEvent(id, fd);
  }

  const jobOpts = jobs.map((j) => ({ id: j.id, label: j.siteAddress ? `${j.jobNumber} — ${j.siteAddress}` : `${j.jobNumber} — ${j.name}`, hint: j.name }));
  const clientOpts = clients.map((c) => ({ id: c.id, label: c.name, hint: c.company }));

  return (
    <div className="mx-auto max-w-3xl p-5">
      <PageHeader
        title={ev.title}
        subtitle={<SoftBadge label={ev.type} color={ev.color} />}
        actions={
          <>
            {mode === "edit" ? (
              <Link href={`/calendar/events/${id}`} className="btn">View</Link>
            ) : (
              <Link href={`/calendar/events/${id}?mode=edit`} className="btn">Edit</Link>
            )}
            <ConfirmButton
              label="Delete"
              message="Delete this calendar event?"
              className="btn-danger"
              onConfirm={async () => { "use server"; await deleteCalendarEvent(id); }}
            />
          </>
        }
      />
      {searchParams.created === "1" && (
        <div className="mb-3 rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--success)", color: "var(--success)", backgroundColor: "#f0fdf4" }}>
          Event created successfully.
        </div>
      )}
      {searchParams.saved === "1" && (
        <div className="mb-3 rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--success)", color: "var(--success)", backgroundColor: "#f0fdf4" }}>
          Event saved.
        </div>
      )}

      {mode === "edit" ? (
        <CalendarEventForm
          action={updateBound}
          jobs={jobOpts}
          clients={clientOpts}
          event={{
            id: ev.id,
            title: ev.title,
            type: ev.type,
            date: ev.date.toISOString().slice(0, 10),
            startTime: ev.startTime,
            endTime: ev.endTime,
            allDay: ev.allDay,
            location: ev.location,
            notes: ev.notes,
            color: ev.color,
            jobId: ev.jobId,
            clientId: ev.clientId,
          }}
          submitLabel="Save Changes"
        />
      ) : (
        <div className="card p-5 text-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-4 w-4 rounded-full" style={{ backgroundColor: ev.color }} />
            <span className="font-semibold">{ev.type}</span>
            {ev.allDay && <span className="text-xs text-ink-muted">All day</span>}
          </div>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <dt className="label">Date</dt>
              <dd>{fmtDate(ev.date)}</dd>
            </div>
            {!ev.allDay && (
              <div>
                <dt className="label">Time</dt>
                <dd>{fmtTime(ev.startTime)}{ev.endTime ? ` – ${fmtTime(ev.endTime)}` : ""}</dd>
              </div>
            )}
            {ev.location && (
              <div>
                <dt className="label">Location</dt>
                <dd>{ev.location}</dd>
              </div>
            )}
            {ev.job && (
              <div>
                <dt className="label">Job</dt>
                <dd><Link href={`/jobs/${ev.job.id}`} className="link">{ev.job.jobNumber} — {ev.job.name}</Link></dd>
              </div>
            )}
            {(ev.client ?? ev.job?.client) && (
              <div>
                <dt className="label">Client</dt>
                <dd>{(ev.client ?? ev.job?.client)?.name}</dd>
              </div>
            )}
          </dl>
          {ev.notes && (
            <div className="mt-3">
              <div className="label">Notes</div>
              <p className="whitespace-pre-wrap">{ev.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
