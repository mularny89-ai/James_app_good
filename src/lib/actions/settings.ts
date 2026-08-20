"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function saveCompanySettings(fd: FormData) {
  await db.companySettings.upsert({
    where: { id: 1 },
    update: {
      companyName: str(fd, "companyName") || "Mellan Consulting Engineers",
      tradingName: str(fd, "tradingName"),
      abn: str(fd, "abn"),
      address: str(fd, "address"),
      phone: str(fd, "phone"),
      email: str(fd, "email"),
      website: str(fd, "website"),
    },
    create: { id: 1 },
  });
  revalidatePath("/", "layout");
}

export async function saveBrandingSettings(fd: FormData) {
  const primary = str(fd, "primaryColor") || "#34368B";
  await db.companySettings.upsert({
    where: { id: 1 },
    update: { primaryColor: primary, secondaryColor: str(fd, "secondaryColor") || primary },
    create: { id: 1, primaryColor: primary },
  });
  revalidatePath("/", "layout");
}

export async function saveNumberingSettings(fd: FormData) {
  const jobDigits = parseInt(str(fd, "jobDigits")) || 3;
  const quoteDigits = parseInt(str(fd, "quoteDigits")) || 3;
  await db.companySettings.upsert({
    where: { id: 1 },
    update: {
      jobPrefix: str(fd, "jobPrefix") || "J66",
      jobDigits,
      quotePrefix: str(fd, "quotePrefix") || "Q66",
      quoteDigits,
      invoicePrefix: str(fd, "invoicePrefix") || "INV-",
      invoiceFormat: str(fd, "invoiceFormat") || "YY####",
    },
    create: { id: 1 },
  });
  // "Next Sequence" writes straight onto the counters; existing records
  // are never renumbered — only future allocations are affected.
  const jobNext = parseInt(str(fd, "jobNext"));
  const quoteNext = parseInt(str(fd, "quoteNext"));
  if (jobNext > 0) {
    await db.numberSequence.upsert({
      where: { key_year: { key: "job", year: 0 } },
      update: { nextValue: jobNext },
      create: { key: "job", year: 0, nextValue: jobNext },
    });
  }
  if (quoteNext > 0) {
    await db.numberSequence.upsert({
      where: { key_year: { key: "quote", year: 0 } },
      update: { nextValue: quoteNext },
      create: { key: "quote", year: 0, nextValue: quoteNext },
    });
  }
  revalidatePath("/", "layout");
}

export async function saveFinancialSettings(fd: FormData) {
  await db.companySettings.upsert({
    where: { id: 1 },
    update: {
      gstRate: parseFloat(str(fd, "gstRate")) || 10,
      currency: str(fd, "currency") || "AUD",
    },
    create: { id: 1 },
  });
  revalidatePath("/", "layout");
}

export async function savePreferences(fd: FormData) {
  await db.companySettings.upsert({
    where: { id: 1 },
    update: {
      dateFormat: str(fd, "dateFormat") || "d MMM yyyy",
      timeFormat: str(fd, "timeFormat") || "24h",
    },
    create: { id: 1 },
  });
  revalidatePath("/", "layout");
}

export async function uploadLogo(fd: FormData) {
  const file = fd.get("logo") as File | null;
  if (!file || file.size === 0) return;
  const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
  if (!allowed.includes(file.type)) throw new Error("Logo must be PNG, JPG, WebP, SVG or GIF.");
  const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg", "image/gif": "gif" }[file.type];
  const dir = path.join(process.cwd(), "public", "uploads", "branding");
  await mkdir(dir, { recursive: true });
  const filename = `logo-${Date.now()}.${ext}`;
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  await db.companySettings.upsert({
    where: { id: 1 },
    update: { logoPath: `/uploads/branding/${filename}` },
    create: { id: 1, logoPath: `/uploads/branding/${filename}` },
  });
  revalidatePath("/", "layout");
}

export async function removeLogo() {
  await db.companySettings.update({ where: { id: 1 }, data: { logoPath: "" } });
  revalidatePath("/", "layout");
}

// ----- Configurable lists: statuses, job types, task lists, inspection types -----

type ConfigKind = "status" | "jobType" | "taskList" | "inspectionType";

function tableFor(kind: ConfigKind) {
  switch (kind) {
    case "status": return db.jobStatus;
    case "jobType": return db.jobType;
    case "taskList": return db.taskList;
    case "inspectionType": return db.inspectionType;
  }
}

export async function addConfigItem(kind: ConfigKind, name: string) {
  const t = tableFor(kind) as any;
  const max = await t.aggregate({ _max: { order: true } });
  await t.create({ data: { name: name.trim(), order: (max._max.order ?? 0) + 1 } });
  revalidatePath("/settings");
}

export async function renameConfigItem(kind: ConfigKind, id: number, name: string) {
  const t = tableFor(kind) as any;
  await t.update({ where: { id }, data: { name: name.trim() } });
  revalidatePath("/", "layout");
}

export async function deleteConfigItem(kind: ConfigKind, id: number) {
  // Refuse to delete items in use to protect relationships (Section 75).
  if (kind === "status") {
    const n = await db.job.count({ where: { statusId: id } });
    if (n > 0) throw new Error(`This status is used by ${n} job(s) and cannot be removed.`);
  }
  if (kind === "jobType") {
    const n = await db.job.count({ where: { projectTypeId: id } });
    if (n > 0) throw new Error(`This job type is used by ${n} job(s) and cannot be removed.`);
  }
  if (kind === "taskList") {
    const n = await db.task.count({ where: { listId: id } });
    if (n > 0) throw new Error(`This task list contains ${n} task(s) and cannot be removed.`);
    const l = await db.taskList.findUnique({ where: { id } });
    if (l?.isSystem) throw new Error("System task lists cannot be removed.");
  }
  if (kind === "inspectionType") {
    const n = await db.siteInspection.count({ where: { typeId: id } });
    if (n > 0) throw new Error(`This inspection type is used by ${n} inspection(s) and cannot be removed.`);
  }
  const t = tableFor(kind) as any;
  await t.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function reorderConfigItem(kind: ConfigKind, id: number, dir: "up" | "down") {
  const t = tableFor(kind) as any;
  const item = await t.findUnique({ where: { id } });
  if (!item) return;
  const sibling = await t.findFirst({
    where: dir === "up" ? { order: { lt: item.order } } : { order: { gt: item.order } },
    orderBy: { order: dir === "up" ? "desc" : "asc" },
  });
  if (!sibling) return;
  await t.update({ where: { id: item.id }, data: { order: sibling.order } });
  await t.update({ where: { id: sibling.id }, data: { order: item.order } });
  revalidatePath("/settings");
}

export async function toggleBoardColumn(statusId: number, isBoardColumn: boolean) {
  const max = await db.jobStatus.aggregate({ _max: { boardOrder: true } });
  await db.jobStatus.update({
    where: { id: statusId },
    data: { isBoardColumn, boardOrder: isBoardColumn ? (max._max.boardOrder ?? 0) + 1 : 0 },
  });
  revalidatePath("/", "layout");
}

export async function moveBoardColumn(statusId: number, dir: "up" | "down") {
  const cols = await db.jobStatus.findMany({ where: { isBoardColumn: true }, orderBy: { boardOrder: "asc" } });
  const idx = cols.findIndex((c) => c.id === statusId);
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= cols.length) return;
  await db.jobStatus.update({ where: { id: cols[idx].id }, data: { boardOrder: cols[swap].boardOrder } });
  await db.jobStatus.update({ where: { id: cols[swap].id }, data: { boardOrder: cols[idx].boardOrder } });
  revalidatePath("/jobs");
}
