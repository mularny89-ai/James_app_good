"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function savePreset(fd: FormData) {
  const id = parseInt(str(fd, "presetId")) || 0;
  const name = str(fd, "name");
  if (!name) throw new Error("Preset name is required.");
  const data = {
    name,
    description: str(fd, "description"),
    unitPrice: parseFloat(str(fd, "unitPrice")) || 0,
    gstApplicable: fd.get("gstApplicable") === "on",
    defaultQty: parseFloat(str(fd, "defaultQty")) || 1,
    active: fd.get("active") === "on",
  };
  if (id > 0) {
    await db.invoicePreset.update({ where: { id }, data });
  } else {
    const max = await db.invoicePreset.aggregate({ _max: { order: true } });
    await db.invoicePreset.create({ data: { ...data, order: (max._max.order ?? 0) + 1 } });
  }
  revalidatePath("/settings");
}

export async function duplicatePreset(id: number) {
  const src = await db.invoicePreset.findUniqueOrThrow({ where: { id } });
  const max = await db.invoicePreset.aggregate({ _max: { order: true } });
  await db.invoicePreset.create({
    data: {
      name: `${src.name} (copy)`,
      description: src.description,
      unitPrice: src.unitPrice,
      gstApplicable: src.gstApplicable,
      defaultQty: src.defaultQty,
      active: true,
      order: (max._max.order ?? 0) + 1,
    },
  });
  revalidatePath("/settings");
}

export async function togglePreset(id: number) {
  const p = await db.invoicePreset.findUniqueOrThrow({ where: { id } });
  await db.invoicePreset.update({ where: { id }, data: { active: !p.active } });
  revalidatePath("/settings");
}

export async function deletePreset(id: number) {
  // Presets are templates: deleting one never affects historical invoices,
  // which store their own snapshot of description and price.
  await db.invoicePreset.delete({ where: { id } });
  revalidatePath("/settings");
}
