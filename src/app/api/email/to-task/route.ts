import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// GET /api/email/to-task — available task lists for the picker
export async function GET() {
  const lists = await db.taskList.findMany({
    where: { name: { not: "Completed" } },
    orderBy: { order: "asc" },
    select: { id: true, name: true, category: true },
  });
  return NextResponse.json({ lists });
}

// POST /api/email/to-task { subject, from, fromEmail, preview, jobId?, clientId?, listId? }
// Creates a follow-up task from an email, linked to the matched job/client.
export async function POST(req: Request) {
  const { subject, from, fromEmail, preview, jobId, clientId, listId } = await req.json();
  if (!subject) return NextResponse.json({ error: "Subject required." }, { status: 400 });

  let list = listId
    ? await db.taskList.findUnique({ where: { id: Number(listId) } })
    : null;
  if (!list) {
    list = await db.taskList.findFirst({ where: { name: { not: "Completed" } }, orderBy: { order: "asc" } });
  }
  if (!list) {
    list = await db.taskList.create({ data: { name: "Email Follow-ups", category: "General" } });
  }

  const task = await db.task.create({
    data: {
      title: `Email: ${subject}`.slice(0, 200),
      description: `From: ${from} <${fromEmail}>\n\n${(preview || "").slice(0, 500)}`,
      listId: list.id,
      jobId: jobId ? Number(jobId) : null,
      clientId: clientId ? Number(clientId) : null,
      priority: "Normal",
    },
  });

  if (jobId) {
    try {
      await logActivity(`Task created from email — "${subject}"`, { jobId: Number(jobId), taskId: task.id });
    } catch { /* best-effort */ }
  }

  return NextResponse.json({ ok: true, taskId: task.id, list: list.name });
}
