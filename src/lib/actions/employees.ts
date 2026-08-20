"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function saveEmployee(fd: FormData) {
  const id = parseInt(str(fd, "employeeId")) || 0;
  const firstName = str(fd, "firstName");
  const lastName = str(fd, "lastName");
  const displayName = str(fd, "displayName") || [firstName, lastName].filter(Boolean).join(" ");
  if (!firstName && !lastName && !displayName) throw new Error("Employee name is required.");
  const data = {
    firstName,
    lastName,
    displayName,
    position: str(fd, "position"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    notes: str(fd, "notes"),
    active: fd.get("active") === "on" || str(fd, "active") === "true",
    assignable: fd.get("assignable") === "on" || str(fd, "assignable") === "true",
  };
  if (id > 0) {
    await db.employee.update({ where: { id }, data });
  } else {
    const max = await db.employee.aggregate({ _max: { order: true } });
    await db.employee.create({ data: { ...data, order: (max._max.order ?? 0) + 1 } });
  }
  revalidatePath("/settings");
  revalidatePath("/jobs");
}

export async function deleteEmployee(id: number) {
  const inUse = await db.job.count({ where: { assignedEmployeeId: id } });
  if (inUse > 0) throw new Error(`This employee is assigned to ${inUse} job(s). Mark them Inactive instead.`);
  await db.employee.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function toggleEmployee(id: number, field: "active" | "assignable") {
  const e = await db.employee.findUniqueOrThrow({ where: { id } });
  await db.employee.update({ where: { id }, data: field === "active" ? { active: !e.active } : { assignable: !e.assignable } });
  revalidatePath("/settings");
}
