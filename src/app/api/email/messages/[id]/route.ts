import { NextResponse } from "next/server";
import { graphRequest } from "@/lib/msal";

export const dynamic = "force-dynamic";

// GET /api/email/messages/[id] — full message + attachment metadata
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let res: Response;
  try {
    res = await graphRequest(
      `/me/messages/${encodeURIComponent(params.id)}?$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,isRead,hasAttachments&$expand=attachments($select=id,name,contentType,size)`,
    );
  } catch (e: any) {
    if (e.message === "NOT_CONNECTED") return NextResponse.json({ error: "not_connected" }, { status: 401 });
    throw e;
  }
  if (!res.ok) return NextResponse.json({ error: `graph_${res.status}` }, { status: res.status });
  const m = await res.json();

  return NextResponse.json({
    id: m.id,
    subject: m.subject || "(no subject)",
    from: m.from?.emailAddress?.name || m.from?.emailAddress?.address || "",
    fromEmail: m.from?.emailAddress?.address || "",
    to: (m.toRecipients ?? []).map((r: any) => ({ name: r.emailAddress?.name || "", email: r.emailAddress?.address || "" })),
    cc: (m.ccRecipients ?? []).map((r: any) => ({ name: r.emailAddress?.name || "", email: r.emailAddress?.address || "" })),
    receivedAt: m.receivedDateTime,
    isRead: m.isRead,
    bodyHtml: m.body?.contentType === "html" ? m.body.content : "",
    bodyText:
      m.body?.contentType === "text"
        ? m.body.content
        : (m.body?.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    attachments: (m.attachments ?? [])
      .filter((a: any) => !a.isInline)
      .map((a: any) => ({ id: a.id, name: a.name, contentType: a.contentType, size: a.size })),
  });
}

// PATCH /api/email/messages/[id] { isRead?, flagged? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const patch: any = {};
  if (typeof body.isRead === "boolean") patch.isRead = body.isRead;
  if (typeof body.flagged === "boolean") patch.flag = { flagStatus: body.flagged ? "flagged" : "notFlagged" };
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  let res: Response;
  try {
    res = await graphRequest(`/me/messages/${encodeURIComponent(params.id)}`, { method: "PATCH", body: patch });
  } catch (e: any) {
    if (e.message === "NOT_CONNECTED") return NextResponse.json({ error: "not_connected" }, { status: 401 });
    throw e;
  }
  if (!res.ok) return NextResponse.json({ error: `graph_${res.status}` }, { status: res.status });
  return NextResponse.json({ ok: true });
}

// DELETE /api/email/messages/[id] — moves to Deleted Items
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let res: Response;
  try {
    res = await graphRequest(`/me/messages/${encodeURIComponent(params.id)}`, { method: "DELETE" });
  } catch (e: any) {
    if (e.message === "NOT_CONNECTED") return NextResponse.json({ error: "not_connected" }, { status: 401 });
    throw e;
  }
  if (!res.ok) return NextResponse.json({ error: `graph_${res.status}` }, { status: res.status });
  return NextResponse.json({ ok: true });
}
