"use server";

import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fillFormTemplate } from "@/lib/form-pdf";
import {
  FormType,
  FORM_LABEL,
  formFileName,
  parseFormData,
} from "@/lib/forms";

function str(fd: FormData, k: string): string {
  return (fd.get(k)?.toString() ?? "").trim();
}

async function upsertRecord(jobId: number, formType: FormType, fd: FormData) {
  const dataJson = str(fd, "dataJson") || "{}";
  const status = str(fd, "status") || "draft";
  const inspectionId = parseInt(str(fd, "inspectionId")) || null;
  return db.formRecord.upsert({
    where: { jobId_formType: { jobId, formType } },
    update: { data: dataJson, status, inspectionId },
    create: { jobId, formType, data: dataJson, status, inspectionId },
  });
}

/** Save progress — keeps the current status, never issues. */
export async function saveFormDraft(jobId: number, formType: FormType, fd: FormData) {
  await upsertRecord(jobId, formType, fd);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/forms/${formType}`);
}

/**
 * Saves the current field values, fills the official AcroForm template,
 * writes the PDF to the project's documents and records a revision.
 * Re-generating an issued form creates a new revision — never overwrites.
 */
export async function generateFormPdf(jobId: number, formType: FormType, fd: FormData) {
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
  const prev = await db.formRecord.findUnique({ where: { jobId_formType: { jobId, formType } } });
  const wasIssued = prev?.status === "issued";
  const revision = (prev?.revision ?? 0) + (wasIssued ? 1 : prev?.revision ? 0 : 1);

  const record = await db.formRecord.upsert({
    where: { jobId_formType: { jobId, formType } },
    update: {
      data: str(fd, "dataJson") || "{}",
      status: "issued",
      revision,
      inspectionId: parseInt(str(fd, "inspectionId")) || null,
    },
    create: {
      jobId,
      formType,
      data: str(fd, "dataJson") || "{}",
      status: "issued",
      revision,
      inspectionId: parseInt(str(fd, "inspectionId")) || null,
    },
  });

  const data = parseFormData(record.data);
  const inspection = record.inspectionId
    ? await db.siteInspection.findUnique({ where: { id: record.inspectionId }, include: { type: true } })
    : null;

  // Fill is shared with the preview API (/api/form-preview) — one embedded font.
  const bytes = await fillFormTemplate(formType, data);

  const fileName = formFileName(formType, job, inspection?.type?.name ?? "", revision);
  const dir = path.join(process.cwd(), "public", "uploads", "forms", `job-${jobId}`);
  fs.mkdirSync(dir, { recursive: true });
  const safeName = fileName.replace(/[/\\]/g, "-");
  fs.writeFileSync(path.join(dir, safeName), bytes);
  const filePath = `/api/generated-forms/job-${jobId}/${encodeURIComponent(safeName)}`;

  await db.formRevision.create({ data: { formId: record.id, revision, fileName, filePath } });
  await db.document.create({
    data: { jobId, category: "Forms", name: fileName, revision: String(revision), filePath },
  });
  await logActivity(`${FORM_LABEL[formType]} generated (Rev ${revision}) for Job ${job.jobNumber}`, { jobId });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/forms/${formType}`);
}

/** Delete a draft that was never issued. */
export async function deleteFormRecord(formId: number, jobId: number) {
  const rec = await db.formRecord.findUniqueOrThrow({ where: { id: formId } });
  if (rec.status === "issued") return; // issued forms are legal records — keep them
  await db.formRecord.delete({ where: { id: formId } });
  revalidatePath(`/jobs/${jobId}`);
}

/** Settings → Form Defaults: signatory details applied to every new form. */
export async function saveFormDefaults(fd: FormData) {
  const keys = [
    "sigName", "sigCompany", "sigContact", "sigPhone", "sigMobile", "sigEmail",
    "postalStreet1", "postalStreet2", "postalState", "postalPostcode",
    "licenceType", "licenceNumber",
  ];
  const data = Object.fromEntries(keys.map((k) => [k, str(fd, k)]));
  await db.companySettings.upsert({
    where: { id: 1 },
    update: { formDefaults: JSON.stringify(data) },
    create: { id: 1, formDefaults: JSON.stringify(data) },
  });
  revalidatePath("/settings");
  redirect("/settings?tab=formdefaults");
}
