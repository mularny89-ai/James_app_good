import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { graphRequest } from "@/lib/msal";
import { fmtMoney, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_mailbox",
    description: "Search the user's Outlook mailbox. Returns matching messages with id, subject, from, date, preview.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search terms, e.g. a name, address, job number, or subject words" },
        top: { type: "number", description: "Max results (default 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "read_email",
    description: "Read the full body of a specific message by its id (from search_mailbox results).",
    input_schema: {
      type: "object" as const,
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "get_job_context",
    description: "Look up a job in the practice manager by job number (e.g. J66002) or site address. Returns client, status, quotes, invoices.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string", description: "Job number or address fragment" } },
      required: ["query"],
    },
  },
  {
    name: "draft_email",
    description: "Fill the compose window with a drafted email. Use when the user asks to write/reply to an email.",
    input_schema: {
      type: "object" as const,
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        note: { type: "string", description: "One-line summary of what you drafted and why" },
      },
      required: ["to", "subject", "body"],
    },
  },
];

const SYSTEM = `You are the email assistant inside Mellan Practice Manager, the practice-management app for Mellan Consulting Engineers, a structural engineering consultancy on the Gold Coast, Australia. The user is James Mellan, the director (james@mellanconsulting.com.au).

You can search and read his Outlook mailbox, look up jobs/quotes/invoices in the app, and draft emails into the compose window with draft_email.

Style rules for drafting:
- Professional but plain-spoken Australian English. Short paragraphs. No fluff, no "I hope this email finds you well".
- Sign off as "Cheers,\nJames" unless told otherwise.
- Quotes/inspections context: site inspections are $400 + GST each; Form 15 is issued with drawings at no extra cost; Form 12s after inspections once fees are paid.
- Never invent job details — use get_job_context/search_mailbox to verify facts (job numbers, amounts, dates) before including them.

When answering questions about mail, cite the sender and date. When you draft, always call draft_email AND reply with a short note.`;

async function runTool(name: string, input: any): Promise<string> {
  try {
    if (name === "search_mailbox") {
      const top = Math.min(input.top ?? 10, 20);
      const res = await graphRequest(
        `/me/messages?$search=${encodeURIComponent(`"${input.query}"`)}&$top=${top}&$select=id,subject,from,receivedDateTime,bodyPreview,hasAttachments`,
      );
      if (!res.ok) return `Search failed: ${res.status}`;
      const data = await res.json();
      return JSON.stringify(
        (data.value ?? []).map((m: any) => ({
          id: m.id,
          subject: m.subject,
          from: m.from?.emailAddress?.address,
          fromName: m.from?.emailAddress?.name,
          date: m.receivedDateTime,
          preview: (m.bodyPreview || "").slice(0, 200),
          hasAttachments: m.hasAttachments,
        })),
      );
    }
    if (name === "read_email") {
      const res = await graphRequest(`/me/messages/${encodeURIComponent(input.id)}?$select=subject,from,toRecipients,receivedDateTime,body`);
      if (!res.ok) return `Read failed: ${res.status}`;
      const m = await res.json();
      const text =
        m.body?.contentType === "text"
          ? m.body.content
          : (m.body?.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return JSON.stringify({
        subject: m.subject,
        from: m.from?.emailAddress?.address,
        to: (m.toRecipients ?? []).map((r: any) => r.emailAddress?.address).join(", "),
        date: m.receivedDateTime,
        body: text.slice(0, 4000),
      });
    }
    if (name === "get_job_context") {
      const q = String(input.query || "");
      const num = q.match(/J\d+/i)?.[0];
      const job = await db.job.findFirst({
        where: (num
          ? { jobNumber: num }
          : {
              OR: [
                { siteAddress: { contains: q } },
                { siteStreet: { contains: q } },
                { siteSuburb: { contains: q } },
                { name: { contains: q } },
              ],
            }) as any,
        include: { client: true, status: true, quote: true, invoices: { orderBy: { id: "desc" }, take: 3 } },
      });
      if (!job) return "No matching job found.";
      return JSON.stringify({
        jobNumber: job.jobNumber,
        address: job.siteAddress,
        client: job.client.name,
        clientEmail: job.client.email,
        status: job.status.name,
        quotedFee: fmtMoney(job.quotedFee),
        quote: job.quote ? { number: job.quote.quoteNumber, total: fmtMoney(job.quote.total), status: job.quote.status } : null,
        invoices: job.invoices.map((i) => ({
          number: i.invoiceNumber,
          total: fmtMoney(i.total),
          paid: fmtMoney(i.amountPaid),
          status: i.status,
          due: i.dueDate ? fmtDate(i.dueDate) : null,
        })),
      });
    }
    if (name === "draft_email") {
      return JSON.stringify({ drafted: true, to: input.to, subject: input.subject, body: input.body, note: input.note });
    }
    return `Unknown tool: ${name}`;
  } catch (e: any) {
    return `Tool error: ${e.message}`;
  }
}

// POST /api/email/assistant { message, history: [{role, content}] }
export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY || (await db.companySettings.findUnique({ where: { id: 1 }, select: { aiApiKey: true } }))?.aiApiKey;
  if (!key) return NextResponse.json({ error: "no_ai_key" }, { status: 400 });

  const { message, history } = await req.json();
  if (!message) return NextResponse.json({ error: "Message required." }, { status: 400 });

  const anthropic = new Anthropic({ apiKey: key });
  const messages: Anthropic.MessageParam[] = [
    ...(Array.isArray(history) ? history.slice(-10) : []),
    { role: "user", content: message },
  ];

  try {
    let draft: any = null;
    let reply = "";
    // Agentic loop — cap at 6 tool rounds.
    for (let round = 0; round < 6; round++) {
      const res = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        system: SYSTEM,
        tools: TOOLS,
        messages,
      });
      messages.push({ role: "assistant", content: res.content });

      const toolUses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const textBlocks = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
      if (textBlocks.length) reply = textBlocks.map((t) => t.text).join("\n");

      if (res.stop_reason !== "tool_use" || toolUses.length === 0) break;

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const result = await runTool(tu.name, tu.input);
        if (tu.name === "draft_email") {
          const p = JSON.parse(result);
          draft = { to: p.to, subject: p.subject, body: p.body };
        }
        results.push({ type: "tool_result", tool_use_id: tu.id, content: result });
      }
      messages.push({ role: "user", content: results });
    }

    return NextResponse.json({ reply: reply || "(no reply)", draft });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "AI request failed." }, { status: 500 });
  }
}
