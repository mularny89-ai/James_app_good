import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import FormEditor from "@/components/FormEditor";
import {
  autoPopulateForm,
  getFormDefaults,
  parseFormData,
} from "@/lib/forms";
import { saveFormDraft, generateFormPdf } from "@/lib/actions/forms";
import { fmtDate, toInputDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FormPage({
  params,
}: {
  params: { id: string; formType: string };
}) {
  const jobId = parseInt(params.id);
  const formType = params.formType;
  if (formType !== "form15" && formType !== "form12") notFound();

  const [job, inspectionsRaw] = await Promise.all([
    db.job.findUnique({
      where: { id: jobId },
      include: { client: true, projectType: true, assignedEmployee: true },
    }),
    db.siteInspection.findMany({
      where: { jobId },
      include: { type: true },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    }),
  ]);
  if (!job) notFound();

  const record = await db.formRecord.findUnique({
    where: { jobId_formType: { jobId, formType } },
    include: { revisions: { orderBy: { revision: "desc" } } },
  });
  const defaults = await getFormDefaults();

  const data = record
    ? parseFormData(record.data)
    : autoPopulateForm(formType, job, job.client, defaults);

  const inspections = inspectionsRaw.map((i) => ({
    id: i.id,
    label: `${i.type?.name ?? "Inspection"} — ${fmtDate(i.date)} ${i.startTime}`,
    typeName: i.type?.name ?? "",
    dateISO: toInputDate(i.date),
  }));

  return (
    <div className="p-5">
      <PageHeader
        title={`Job ${job.jobNumber} — ${formType === "form15" ? "Form 15" : "Form 12"}`}
        subtitle="Values save as draft; Generate PDF fills the official template."
      />
      <FormEditor
        key={record?.updatedAt?.toISOString() ?? "new"}
        formType={formType}
        jobId={job.id}
        jobNumber={String(job.jobNumber)}
        jobAddress={job.siteAddress}
        clientName={job.client.name}
        initialData={data}
        initialStatus={record?.status ?? "draft"}
        initialRevision={record?.revision ?? 0}
        initialInspectionId={record?.inspectionId ?? null}
        inspections={inspections}
        revisions={(record?.revisions ?? []).map((r) => ({
          id: r.id,
          revision: r.revision,
          fileName: r.fileName,
          filePath: r.filePath,
          createdAt: fmtDate(r.createdAt),
        }))}
        saveAction={saveFormDraft.bind(null, job.id, formType)}
        generateAction={generateFormPdf.bind(null, job.id, formType)}
      />
    </div>
  );
}
