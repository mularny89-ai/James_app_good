import { NextResponse } from "next/server";
import { graphRequest } from "@/lib/msal";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024; // keep sendMail simple; 3MB total is plenty for PDFs

// POST /api/email/send { to, cc?, subject, body, replyToMessageId?, replyAll?, jobId?, attachments? [{name, contentType, contentBytes(base64)}] }
export async function POST(req: Request) {
  const { to, cc, subject, body, replyToMessageId, replyAll, jobId, attachments } = await req.json();
  if (!to || !subject || !body) {
    return NextResponse.json({ error: "To, subject and body are required." }, { status: 400 });
  }

  const atts = Array.isArray(attachments) ? attachments : [];
  const totalBytes = atts.reduce((s: number, a: any) => s + Math.ceil(((a.contentBytes || "").length * 3) / 4), 0);
  if (totalBytes > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "Attachments too large (3 MB max)." }, { status: 400 });
  }

  const toRecipients = [{ emailAddress: { address: to } }];
  const ccRecipients = cc ? String(cc).split(/[;,]/).map((e: string) => e.trim()).filter(Boolean).map((e: string) => ({ emailAddress: { address: e } })) : [];

  let res: Response;
  try {
    if (replyToMessageId) {
      const endpoint = replyAll ? "replyAll" : "reply";
      res = await graphRequest(`/me/messages/${encodeURIComponent(replyToMessageId)}/${endpoint}`, {
        method: "POST",
        body: {
          comment: body,
          ...(ccRecipients.length ? { message: { ccRecipients } } : {}),
        },
      });
    } else {
      res = await graphRequest("/me/sendMail", {
        method: "POST",
        body: {
          message: {
            subject,
            body: { contentType: "Text", content: body },
            toRecipients,
            ccRecipients,
            attachments: atts.map((a: any) => ({
              "@odata.type": "#microsoft.graph.fileAttachment",
              name: a.name,
              contentType: a.contentType || "application/octet-stream",
              contentBytes: a.contentBytes,
            })),
          },
          saveToSentItems: true,
        },
      });
    }
  } catch (e: any) {
    if (e.message === "NOT_CONNECTED") return NextResponse.json({ error: "not_connected" }, { status: 401 });
    throw e;
  }

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: `graph_${res.status}`, detail: detail.slice(0, 300) }, { status: res.status });
  }

  if (jobId) {
    try {
      await logActivity(`Email sent to ${to} — "${subject}"`, { jobId: Number(jobId) });
    } catch {
      // activity logging is best-effort
    }
  }

  return NextResponse.json({ ok: true });
}
