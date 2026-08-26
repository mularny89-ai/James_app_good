import { NextResponse } from "next/server";
import { graphRequest } from "@/lib/msal";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// POST /api/email/send { to, cc?, subject, body, replyToMessageId?, jobId? }
export async function POST(req: Request) {
  const { to, cc, subject, body, replyToMessageId, jobId } = await req.json();
  if (!to || !subject || !body) {
    return NextResponse.json({ error: "To, subject and body are required." }, { status: 400 });
  }

  const toRecipients = [{ emailAddress: { address: to } }];
  const ccRecipients = cc ? [{ emailAddress: { address: cc } }] : [];

  let res: Response;
  try {
    if (replyToMessageId) {
      res = await graphRequest(`/me/messages/${encodeURIComponent(replyToMessageId)}/reply`, {
        method: "POST",
        body: { comment: body },
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
