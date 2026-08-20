"use server";

import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { parseInputDate } from "@/lib/format";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function revalidateAll(jobId?: number | null) {
  revalidatePath("/inspections");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  if (jobId) revalidatePath(`/jobs/${jobId}`);
}

/** Section 45: when created from a job, job/client/site data is inherited. */
export async function createInspection(fd: FormData) {
  const jobId = parseInt(str(fd, "jobId")) || null;
  const job = jobId
    ? await db.job.findUnique({ where: { id: jobId }, include: { client: true } })
    : null;
  const date = parseInputDate(str(fd, "date")) ?? new Date();
  const typeName = str(fd, "inspectionType");
  const type = typeName ? await db.inspectionType.findUnique({ where: { name: typeName } }) : null;

  const insp = await db.siteInspection.create({
    data: {
      jobId: job?.id ?? null,
      jobName: job ? job.name : str(fd, "jobName"),
      clientName: job ? job.client.name : str(fd, "clientName"),
      siteAddress: job ? job.siteAddress : str(fd, "siteAddress"),
      typeId: type?.id ?? null,
      date,
      startTime: str(fd, "startTime") || "09:00",
      endTime: str(fd, "endTime") || "10:00",
      contactPerson: str(fd, "contactPerson"),
      contactPhone: str(fd, "contactPhone"),
      contactEmail: str(fd, "contactEmail"),
      notes: str(fd, "notes"),
      status: str(fd, "status") || "Scheduled",
    },
  });
  if (job) {
    const typeLabel = type?.name ?? "Site inspection";
    await logActivity(`${typeLabel} booked for ${str(fd, "date")} on Job ${job.jobNumber}`, { jobId: job.id });
  }
  revalidateAll(job?.id);
  redirect(`/inspections/${insp.id}`);
}

export async function updateInspection(id: number, fd: FormData) {
  const insp = await db.siteInspection.findUniqueOrThrow({ where: { id } });
  const jobId = parseInt(str(fd, "jobId")) || insp.jobId;
  const job = jobId ? await db.job.findUnique({ where: { id: jobId }, include: { client: true } }) : null;
  const typeName = str(fd, "inspectionType");
  const type = typeName ? await db.inspectionType.findUnique({ where: { name: typeName } }) : null;

  await db.siteInspection.update({
    where: { id },
    data: {
      jobId: job?.id ?? null,
      jobName: job ? job.name : str(fd, "jobName"),
      clientName: job ? job.client.name : str(fd, "clientName"),
      siteAddress: job ? job.siteAddress : str(fd, "siteAddress"),
      typeId: type?.id ?? null,
      date: parseInputDate(str(fd, "date")) ?? insp.date,
      startTime: str(fd, "startTime") || insp.startTime,
      endTime: str(fd, "endTime") || insp.endTime,
      contactPerson: str(fd, "contactPerson"),
      contactPhone: str(fd, "contactPhone"),
      contactEmail: str(fd, "contactEmail"),
      notes: str(fd, "notes"),
      status: str(fd, "status") || insp.status,
    },
  });
  revalidateAll(insp.jobId);
}

export async function setInspectionStatus(id: number, status: string) {
  const insp = await db.siteInspection.findUniqueOrThrow({ where: { id }, include: { job: true } });
  await db.siteInspection.update({ where: { id }, data: { status } });
  if (insp.job) {
    await logActivity(`Inspection (${insp.typeId ? "" : ""}${insp.siteAddress}) marked ${status} on Job ${insp.job.jobNumber}`, { jobId: insp.jobId! });
  }
  revalidateAll(insp.jobId);
}

/** Section 44: drag-to-reschedule on the calendar persists immediately. */
export async function rescheduleInspection(id: number, isoDate: string) {
  const d = parseInputDate(isoDate);
  if (!d) return;
  const insp = await db.siteInspection.update({ where: { id }, data: { date: d } });
  revalidatePath("/calendar");
  revalidatePath("/inspections");
  if (insp.jobId) revalidatePath(`/jobs/${insp.jobId}`);
}

export async function deleteInspection(id: number) {
  const insp = await db.siteInspection.findUniqueOrThrow({ where: { id } });
  await db.siteInspection.delete({ where: { id } });
  revalidateAll(insp.jobId);
  redirect("/inspections");
}
