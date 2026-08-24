"use server";

import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PDFDocument, StandardFonts, PDFFont } from "pdf-lib";
import {
  FormType,
  FORM_LABEL,
  PDF_FIELD_MAP,
  TEMPLATE_FILE,
  DATE_KEYS,
  pdfDate,
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

  // Fill the official template's AcroForm fields, then flatten for a clean print.
  // A single embedded Helvetica is used for every value we touch and the appearance
  // stream is rebuilt, so preset/manual text can't smear white over the template.
  const tplPath = path.join(process.cwd(), "public", "uploads", "form-templates", TEMPLATE_FILE[formType]);
  const pdf = await PDFDocument.load(fs.readFileSync(tplPath));
  const helvet = await pdf.embedFont(StandardFonts.Helvetica);
  const form = pdf.getForm();
  const touched: Array<{ updateAppearances: (font: PDFFont) => void }> = [];
  for (const [key, fieldName] of Object.entries(PDF_FIELD_MAP[formType])) {
    const raw = data[key] ?? "";
    const value = DATE_KEYS.includes(key) ? pdfDate(raw) : raw;
    try {
      try {
        const tf = form.getTextField(fieldName);
        tf.setText(value);
        touched.push(tf);
      } catch {
        if (value) {
          const dd = form.getDropdown(fieldName);
          if (dd.getOptions().includes(value)) {
            dd.select(value);
            touched.push(dd);
          }
        }
      }
    } catch {
      // Field missing in template — skip rather than fail the whole PDF.
    }
  }
  // Rebuild appearance streams with the one embedded font — prevents smearing.
  for (const f of touched) {
    try {
      f.updateAppearances(helvet);
    } catch {
      // some dropdowns disallow it; keep default appearance — fine.
    }
  }
  form.flatten();
  const bytes = await pdf.save();

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
