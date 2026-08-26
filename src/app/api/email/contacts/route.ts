import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { graphRequest } from "@/lib/msal";

export const dynamic = "force-dynamic";

export type ContactSuggestion = { email: string; name: string; source: string };

// GET /api/email/contacts?q= — autocomplete from clients, employees, and
// recent email correspondents (Graph).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const out = new Map<string, ContactSuggestion>();
  const add = (email: string, name: string, source: string) => {
    if (!email || !email.includes("@")) return;
    const key = email.toLowerCase();
    if (!out.has(key)) out.set(key, { email, name, source });
  };

  const [clients, employees] = await Promise.all([
    db.client.findMany({ where: { archived: false, email: { not: "" } }, select: { name: true, email: true, company: true }, take: 500 }),
    db.employee.findMany({ where: { email: { not: "" } }, select: { displayName: true, email: true }, take: 200 }),
  ]);
  clients.forEach((c) => add(c.email, c.name, c.company ? `Client — ${c.company}` : "Client"));
  employees.forEach((e) => add(e.email, e.displayName, "Employee"));

  // Recent correspondents from the mailbox (best-effort).
  try {
    const res = await graphRequest(
      "/me/messages?$top=50&$select=from,toRecipients&$orderby=receivedDateTime desc",
    );
    if (res.ok) {
      const data = await res.json();
      (data.value ?? []).forEach((m: any) => {
        add(m.from?.emailAddress?.address ?? "", m.from?.emailAddress?.name ?? "", "Recent");
        (m.toRecipients ?? []).forEach((r: any) =>
          add(r.emailAddress?.address ?? "", r.emailAddress?.name ?? "", "Recent"),
        );
      });
    }
  } catch { /* offline / not connected — DB contacts still work */ }

  const all = Array.from(out.values());
  const filtered = q
    ? all.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
    : all;
  return NextResponse.json({ contacts: filtered.slice(0, 10) });
}
