import { NextResponse } from "next/server";
import { graphRequest } from "@/lib/msal";

export const dynamic = "force-dynamic";

// GET /api/email/messages?q=search — inbox messages with client/job matching
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const graphPath = q
    ? `/me/messages?$search=${encodeURIComponent(`"${q}"`)}&$top=30&$select=id,subject,from,receivedDateTime,bodyPreview,isRead,body,internetMessageId&$orderby=receivedDateTime desc`
    : `/me/mailFolders/inbox/messages?$top=30&$select=id,subject,from,receivedDateTime,bodyPreview,isRead,body,internetMessageId&$orderby=receivedDateTime desc`;

  let res: Response;
  try {
    res = await graphRequest(graphPath);
  } catch (e: any) {
    if (e.message === "NOT_CONNECTED") return NextResponse.json({ error: "not_connected" }, { status: 401 });
    throw e;
  }
  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: `graph_${res.status}`, detail: detail.slice(0, 300) }, { status: res.status });
  }
  const data = await res.json();
  const messages: any[] = data.value ?? [];

  // Match senders to clients; clients to active jobs.
  const emails = messages
    .map((m) => m.from?.emailAddress?.address?.toLowerCase())
    .filter((e): e is string => Boolean(e));
  const clients = emails.length
    ? await (await import("@/lib/db")).db.client.findMany({
        where: { email: { in: emails }, archived: false },
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
    messages: messages.map((m) => {
      const fromEmail = m.from?.emailAddress?.address?.toLowerCase() ?? "";
      const client = byEmail.get(fromEmail);
      return {
        id: m.id,
        subject: m.subject || "(no subject)",
        from: m.from?.emailAddress?.name || fromEmail,
        fromEmail,
        receivedAt: m.receivedDateTime,
        preview: m.bodyPreview || "",
        isRead: m.isRead,
        bodyText: m.body?.contentType === "text" ? m.body.content : (m.body?.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        internetMessageId: m.internetMessageId ?? "",
        client: client ? { id: client.id, name: client.name } : null,
        jobs: (client?.jobs ?? []).map((j) => ({ id: j.id, jobNumber: j.jobNumber, site: j.siteAddress || "" })),
      };
    }),
  });
}
