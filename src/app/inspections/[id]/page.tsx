import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { toInputDate } from "@/lib/format";
import { updateInspection, setInspectionStatus, deleteInspection } from "@/lib/actions/inspections";
import { PageHeader, SoftBadge } from "@/components/ui";
import InspectionForm from "@/components/InspectionForm";
import ConfirmButton from "@/components/ConfirmButton";
import { inspectionStatusColor, INSPECTION_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function InspectionDetailPage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const insp = await db.siteInspection.findUnique({ where: { id }, include: { job: true, type: true } });
  if (!insp) notFound();

  const [jobs, types] = await Promise.all([
    db.job.findMany({ where: { archived: false }, include: { client: true }, orderBy: { jobNumber: "desc" }, take: 500 }),
    db.inspectionType.findMany({ orderBy: { order: "asc" } }),
  ]);

  const jobOpts = jobs.map((j) => ({
    id: j.id,
    jobNumber: j.jobNumber,
    name: j.name,
    clientName: j.client.name,
    siteAddress: j.siteAddress,
    clientContact: j.clientContact || j.client.contactPerson,
    clientPhone: j.client.mobile || j.client.phone,
    clientEmail: j.client.email,
  }));

  async function updateBound(fd: FormData) {
    "use server";
    await updateInspection(id, fd);
  }

  return (
    <div className="mx-auto max-w-3xl p-5">
      <PageHeader
        title={`Inspection — ${insp.type?.name ?? "Site Visit"}`}
        subtitle={
          <span className="flex items-center gap-3">
            <SoftBadge label={insp.status} color={inspectionStatusColor(insp.status)} />
            {insp.job && <span>Job: <Link href={`/jobs/${insp.job.id}`} className="link font-semibold">{insp.job.jobNumber}</Link></span>}
            <span className="font-medium">{insp.siteAddress}</span>
          </span>
        }
        actions={
          <>
            {INSPECTION_STATUSES.filter((s) => s !== insp.status).map((s) => (
              <form key={s} action={async () => { "use server"; await setInspectionStatus(id, s); }}>
                <button type="submit" className="btn">{s}</button>
              </form>
            ))}
            <ConfirmButton label="Delete" message="Delete this inspection? It will be removed from the job history." onConfirm={async () => { "use server"; await deleteInspection(id); }} />
          </>
        }
      />
      <InspectionForm
        action={updateBound}
        jobs={jobOpts}
        types={types}
        inspection={{
          id: insp.id,
          jobId: insp.jobId,
          jobName: insp.jobName,
          clientName: insp.clientName,
          siteAddress: insp.siteAddress,
          typeId: insp.typeId,
          date: toInputDate(insp.date),
          startTime: insp.startTime,
          endTime: insp.endTime,
          contactPerson: insp.contactPerson,
          contactPhone: insp.contactPhone,
          contactEmail: insp.contactEmail,
          notes: insp.notes,
          status: insp.status,
        }}
      />
    </div>
  );
}
