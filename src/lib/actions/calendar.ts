"use server";

import { db } from "@/lib/db";
import { parseInputDate } from "@/lib/format";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function eventData(fd: FormData) {
  const allDay = str(fd, "allDay") === "on";
  return {
    title: str(fd, "title"),
    type: str(fd, "type") || "Other",
    date: parseInputDate(str(fd, "date")) ?? new Date(),
    startTime: allDay ? "" : str(fd, "startTime"),
    endTime: allDay ? "" : str(fd, "endTime"),
    allDay,
    location: str(fd, "location"),
    notes: str(fd, "notes"),
    color: str(fd, "color") || "#2563eb",
    jobId: parseInt(str(fd, "jobId")) || null,
    clientId: parseInt(str(fd, "clientId")) || null,
  };
}

function revalidateCal() {
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function createCalendarEvent(fd: FormData) {
  const data = eventData(fd);
  if (!data.title) throw new Error("Event title is required.");
  const ev = await db.calendarEvent.create({ data });
  revalidateCal();
  redirect(`/calendar/events/${ev.id}?created=1`);
}

export async function updateCalendarEvent(id: number, fd: FormData) {
  const data = eventData(fd);
  if (!data.title) throw new Error("Event title is required.");
  await db.calendarEvent.update({ where: { id }, data });
  revalidateCal();
  redirect(`/calendar/events/${id}?saved=1`);
}

export async function deleteCalendarEvent(id: number) {
  await db.calendarEvent.delete({ where: { id } });
  revalidateCal();
  redirect("/calendar");
}

/** Drag-to-move on the calendar persists immediately (same as inspections). */
export async function moveCalendarEvent(id: number, isoDate: string) {
  const d = parseInputDate(isoDate);
  if (!d) return;
  await db.calendarEvent.update({ where: { id }, data: { date: d } });
  revalidateCal();
}
