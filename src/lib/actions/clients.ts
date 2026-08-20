"use server";

import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function createClient(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("Client name is required.");
  const client = await db.client.create({
    data: {
      name,
      company: str(fd, "company"),
      contactPerson: str(fd, "contactPerson"),
      phone: str(fd, "phone"),
      mobile: str(fd, "mobile"),
      email: str(fd, "email"),
      billingAddress: str(fd, "billingAddress"),
      abn: str(fd, "abn"),
      notes: str(fd, "notes"),
    },
  });
  await logActivity(`Client ${name} created`, { clientId: client.id });
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClient(id: number, fd: FormData) {
  const client = await db.client.update({
    where: { id },
    data: {
      name: str(fd, "name"),
      company: str(fd, "company"),
      contactPerson: str(fd, "contactPerson"),
      phone: str(fd, "phone"),
      mobile: str(fd, "mobile"),
      email: str(fd, "email"),
      billingAddress: str(fd, "billingAddress"),
      abn: str(fd, "abn"),
      notes: str(fd, "notes"),
    },
  });
  revalidatePath(`/clients/${client.id}`);
  revalidatePath("/clients");
}

export async function archiveClient(id: number) {
  const active = await db.job.count({
    where: { clientId: id, archived: false, status: { name: { notIn: ["Completed", "Cancelled"] } } },
  });
  if (active > 0) throw new Error("This client cannot be archived because it has active jobs.");
  await db.client.update({ where: { id }, data: { archived: true } });
  revalidatePath("/clients");
}

export async function unarchiveClient(id: number) {
  await db.client.update({ where: { id }, data: { archived: false } });
  revalidatePath("/clients");
}
