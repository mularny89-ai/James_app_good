"use server";

import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { parseInputDate, fmtDate, fmtTime } from "@/lib/format";
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
      jobName: str(fd, "jobName") || job?.name || "",
      clientName: str(fd, "clientName") || job?.client.name || "",
      siteAddress: str(fd, "siteAddress") || job?.siteAddress || "",
      typeId: type?.id ?? null,
      date,
      startTime: str(fd, "startTime") || "09:00",
      endTime: str(fd, "endTime") || "10:00",
      contactPerson: str(fd, "contactPerson"),
      contactPhone: str(fd, "contactPhone"),
      contactEmail: str(fd, "contactEmail"),
      notes: str(fd, "notes"),
      status: str(fd, "status") || "Scheduled",
      color: str(fd, "color"), // "" inherits the job's planner colour
    },
  });
  if (job) {
    const typeLabel = type?.name ?? "Site inspection";
    await logActivity(
      `${typeLabel} scheduled for ${fmtDate(insp.date)} at ${fmtTime(insp.startTime)}`,
      { jobId: job.id }
    );
  }
  revalidateAll(job?.id);
  // Close the form: return to the screen the user came from, with a success flag.
  const returnTo = str(fd, "returnTo");
  if (returnTo === "calendar") redirect(`/calendar?scheduled=1&date=${str(fd, "date")}`);
  redirect(`/inspections/${insp.id}?created=1`);
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
      jobName: str(fd, "jobName") || job?.name || "",
      clientName: str(fd, "clientName") || job?.client.name || "",
      siteAddress: str(fd, "siteAddress") || job?.siteAddress || "",
      typeId: type?.id ?? null,
      date: parseInputDate(str(fd, "date")) ?? insp.date,
      startTime: str(fd, "startTime") || insp.startTime,
      endTime: str(fd, "endTime") || insp.endTime,
      contactPerson: str(fd, "contactPerson"),
      contactPhone: str(fd, "contactPhone"),
      contactEmail: str(fd, "contactEmail"),
      notes: str(fd, "notes"),
      status: str(fd, "status") || insp.status,
      color: str(fd, "color"), // "" inherits the job's planner colour
    },
  });
  revalidateAll(insp.jobId);
}

export async function setInspectionStatus(id: number, status: string) {
  const insp = await db.siteInspection.findUniqueOrThrow({ where: { id }, include: { job: true, type: true } });
  await db.siteInspection.update({ where: { id }, data: { status } });
  if (insp.job) {
    const typeLabel = insp.type?.name ?? "Site inspection";
    const message =
      status === "Completed"
        ? `${typeLabel} completed at ${insp.siteAddress || "site"}`
        : `${typeLabel} at ${insp.siteAddress || "site"} marked ${status}`;
    await logActivity(message, { jobId: insp.jobId! });
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
