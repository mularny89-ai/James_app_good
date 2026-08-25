import { db } from "@/lib/db";
import { createInspection } from "@/lib/actions/inspections";
import { PageHeader } from "@/components/ui";
import InspectionForm from "@/components/InspectionForm";

export const dynamic = "force-dynamic";

export default async function NewInspectionPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const defaultJobId = searchParams.jobId ? parseInt(searchParams.jobId) : undefined;

  const [jobs, types] = await Promise.all([
    db.job.findMany({
      where: { archived: false },
      include: { client: true },
      orderBy: { jobNumber: "desc" },
      take: 500,
    }),
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

  return (
    <div className="mx-auto max-w-3xl p-5">
      <PageHeader
        title="Schedule Site Inspection"
        subtitle="Search for the site address — or type one manually. Job details are pre-filled when coming from a job page."
      />
      <InspectionForm
        action={createInspection}
        jobs={jobOpts}
        types={types}
        defaultJobId={defaultJobId}
        returnTo={searchParams.from === "calendar" ? "calendar" : undefined}
        submitLabel="Schedule Inspection"
      />
    </div>
  );
}
