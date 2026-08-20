"use server";

import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { nextNumber, formatJobNumber } from "@/lib/numbering";
import { parseInputDate } from "@/lib/format";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => parseFloat(str(fd, k)) || 0;

async function statusIdByName(name: string): Promise<number> {
  const s = await db.jobStatus.findUnique({ where: { name } });
  if (!s) throw new Error(`Job status "${name}" is not configured.`);
  return s.id;
}

export async function createJob(fd: FormData) {
  const clientId = parseInt(str(fd, "clientId"));
  if (!clientId) throw new Error("Select a client.");
  const client = await db.client.findUniqueOrThrow({ where: { id: clientId } });
  const name = str(fd, "name") || str(fd, "siteAddress") || "Untitled Job";

  const job = await db.$transaction(async (tx) => {
    const { seq, year } = await nextNumber(tx, "job");
    const jobNumber = await formatJobNumber(seq, year);
    const typeName = str(fd, "projectType");
    const type = typeName ? await tx.jobType.findUnique({ where: { name: typeName } }) : null;
    return tx.job.create({
      data: {
        jobNumber,
        name,
        clientId,
        clientContact: str(fd, "clientContact") || client.contactPerson,
        siteAddress: str(fd, "siteAddress"),
        billingAddress: str(fd, "billingAddress") || client.billingAddress,
        description: str(fd, "description"),
        scope: str(fd, "scope"),
        projectTypeId: type?.id ?? null,
        statusId: await statusIdByName("To Start"),
        priority: str(fd, "priority") || "Normal",
        assignedEngineer: str(fd, "assignedEngineer"),
        startDate: parseInputDate(str(fd, "startDate")),
        dueDate: parseInputDate(str(fd, "dueDate")),
        quotedFee: num(fd, "quotedFee"),
      },
    });
  });
  await logActivity(`Job ${job.jobNumber} created`, { jobId: job.id, clientId });
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  redirect(`/jobs/${job.id}`);
}

export async function updateJob(id: number, fd: FormData) {
  const typeName = str(fd, "projectType");
  const type = typeName ? await db.jobType.findUnique({ where: { name: typeName } }) : null;
  const statusName = str(fd, "status");
  const statusId = statusName ? await statusIdByName(statusName) : undefined;
  const job = await db.job.update({
    where: { id },
    data: {
      name: str(fd, "name"),
      clientContact: str(fd, "clientContact"),
      siteAddress: str(fd, "siteAddress"),
      billingAddress: str(fd, "billingAddress"),
      description: str(fd, "description"),
      scope: str(fd, "scope"),
      projectTypeId: type?.id ?? null,
      ...(statusId ? { statusId } : {}),
      priority: str(fd, "priority") || "Normal",
      assignedEngineer: str(fd, "assignedEngineer"),
      startDate: parseInputDate(str(fd, "startDate")),
      dueDate: parseInputDate(str(fd, "dueDate")),
      quotedFee: num(fd, "quotedFee"),
      variations: num(fd, "variations"),
      notes: str(fd, "notes"),
    },
    include: { status: true },
  });
  if (statusName === "Completed" && !job.completedAt) {
    await db.job.update({ where: { id }, data: { completedAt: new Date() } });
  }
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
}

/** Bindable variant for client components — looks up the status by id. */
export async function moveJobById(id: number, statusId: number) {
  const s = await db.jobStatus.findUnique({ where: { id: statusId } });
  if (!s) throw new Error("Unknown status");
  await moveJob(id, s.name);
}

export async function moveJob(id: number, statusName: string) {
  const statusId = await statusIdByName(statusName);
  const job = await db.job.findUniqueOrThrow({ where: { id }, include: { status: true } });
  if (job.status.name === statusName) return;
  await db.job.update({
    where: { id },
    data: {
      statusId,
      completedAt: statusName === "Completed" ? new Date() : job.completedAt,
    },
  });
  await logActivity(`Job ${job.jobNumber} moved to ${statusName}`, { jobId: id, clientId: job.clientId });
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/dashboard");
}

export async function archiveJob(id: number) {
  await db.job.update({ where: { id }, data: { archived: true } });
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
}

// ----- Notes -----

export async function addJobNote(jobId: number, content: string) {
  if (!content.trim()) return;
  await db.jobNote.create({ data: { jobId, content: content.trim() } });
  revalidatePath(`/jobs/${jobId}`);
}

export async function toggleNotePin(noteId: number, jobId: number) {
  const n = await db.jobNote.findUniqueOrThrow({ where: { id: noteId } });
  await db.jobNote.update({ where: { id: noteId }, data: { pinned: !n.pinned } });
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateJobNote(noteId: number, jobId: number, content: string) {
  await db.jobNote.update({ where: { id: noteId }, data: { content } });
  revalidatePath(`/jobs/${jobId}`);
}

export async function deleteJobNote(noteId: number, jobId: number) {
  await db.jobNote.delete({ where: { id: noteId } });
  revalidatePath(`/jobs/${jobId}`);
}

// ----- Document register (revision-ready, Section 63) -----

export async function addDocument(jobId: number, fd: FormData) {
  const name = str(fd, "name");
  if (!name) return;
  await db.document.create({
    data: {
      jobId,
      name,
      category: str(fd, "category") || "Other",
      revision: str(fd, "revision") || "A",
    },
  });
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
  await logActivity(`Document "${name}" registered on Job ${job.jobNumber}`, { jobId });
  revalidatePath(`/jobs/${jobId}`);
}

export async function deleteDocument(docId: number, jobId: number) {
  await db.document.delete({ where: { id: docId } });
  revalidatePath(`/jobs/${jobId}`);
}
