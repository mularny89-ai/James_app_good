import { NextResponse } from "next/server";
import { graphRequest } from "@/lib/msal";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const LIST_SELECT = "id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments,flag,conversationId";
const DETAIL_SELECT =
  "id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,isRead,hasAttachments,internetMessageId";

function notConnected(e: any) {
  return e?.message === "NOT_CONNECTED";
}

function mapListMessage(m: any) {
  return {
    id: m.id,
    subject: m.subject || "(no subject)",
    from: m.from?.emailAddress?.name || m.from?.emailAddress?.address || "",
    fromEmail: m.from?.emailAddress?.address || "",
    receivedAt: m.receivedDateTime,
    preview: m.bodyPreview || "",
    isRead: m.isRead,
    hasAttachments: m.hasAttachments,
    flagged: m.flag?.flagStatus === "flagged",
  };
}

// GET /api/email/messages?folder=<id>&q=&cursor=<skip>
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const folder = sp.get("folder") ?? "inbox";
  const skip = parseInt(sp.get("skip") ?? "0") || 0;
  const full = sp.get("full") === "1";

  const path = q
    ? `/me/messages?$search=${encodeURIComponent(`"${q}"`)}&$top=30&$select=${full ? DETAIL_SELECT : LIST_SELECT}`
    : `/me/mailFolders/${encodeURIComponent(folder)}/messages?$top=30&$skip=${skip}&$select=${full ? DETAIL_SELECT : LIST_SELECT}&$orderby=receivedDateTime desc`;

  let res: Response;
  try {
    res = await graphRequest(path);
  } catch (e: any) {
    if (notConnected(e)) return NextResponse.json({ error: "not_connected" }, { status: 401 });
    throw e;
  }
  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: `graph_${res.status}`, detail: detail.slice(0, 300) }, { status: res.status });
  }
  const data = await res.json();
  const raw: any[] = data.value ?? [];

  // Match senders to clients + active jobs for context links.
  const emails = raw.map((m) => m.from?.emailAddress?.address?.toLowerCase()).filter((e): e is string => Boolean(e));
  const clients = emails.length
    ? await db.client.findMany({
        where: { email: { in: Array.from(new Set(emails)) }, archived: false },
        include: {
          jobs: {
            where: { archived: false, status: { name: { notIn: ["Completed", "Cancelled"] } } },
            take: 3,
            orderBy: { createdAt: "desc" },
          },
        },
      })
    : [];
  const byEmail = new Map(clients.map((c) => [c.email.toLowerCase(), c]));

  return NextResponse.json({
    messages: raw.map((m) => {
      const base = mapListMessage(m);
      const client = byEmail.get(base.fromEmail.toLowerCase());
      const out: any = {
        ...base,
        client: client ? { id: client.id, name: client.name } : null,
        jobs: (client?.jobs ?? []).map((j) => ({ id: j.id, jobNumber: j.jobNumber, site: j.siteAddress || "" })),
      };
      if (full) {
        out.to = (m.toRecipients ?? []).map((r: any) => r.emailAddress?.address || "").join(", ");
        out.cc = (m.ccRecipients ?? []).map((r: any) => r.emailAddress?.address || "").join(", ");
        out.bodyHtml = m.body?.contentType === "html" ? m.body.content : "";
        out.bodyText = m.body?.contentType === "text" ? m.body.content : (m.body?.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      }
      return out;
    }),
    hasMore: raw.length === 30,
  });
}
