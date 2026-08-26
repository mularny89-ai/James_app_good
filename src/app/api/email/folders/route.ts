import { NextResponse } from "next/server";
import { graphRequest } from "@/lib/msal";

export const dynamic = "force-dynamic";

// GET /api/email/folders — well-known folders with unread counts
export async function GET() {
  let res: Response;
  try {
    res = await graphRequest("/me/mailFolders?$top=50&$select=id,displayName,unreadItemCount,totalItemCount");
  } catch (e: any) {
    if (e.message === "NOT_CONNECTED") return NextResponse.json({ error: "not_connected" }, { status: 401 });
    throw e;
  }
  if (!res.ok) return NextResponse.json({ error: `graph_${res.status}` }, { status: res.status });
  const data = await res.json();
  const all: any[] = data.value ?? [];

  // wellKnownName isn't selectable on all mailbox versions — match by display name.
  const WELL_KNOWN: [string, string][] = [
    ["inbox", "inbox"],
    ["drafts", "drafts"],
    ["sentitems", "sent items"],
    ["deleteditems", "deleted items"],
    ["junkemail", "junk email"],
    ["archive", "archive"],
    ["outbox", "outbox"],
  ];
  const matched = new Set<string>();
  const wellKnown = WELL_KNOWN.map(([key, name]) => all.find((f) => f.displayName.toLowerCase() === name))
    .filter(Boolean)
    .map((f: any) => {
      matched.add(f.id);
      const key = WELL_KNOWN.find(([, n]) => n === f.displayName.toLowerCase())?.[0] ?? "";
      return { id: f.id, name: f.displayName, key, unread: f.unreadItemCount, total: f.totalItemCount };
    });

  const custom = all
    .filter((f) => !matched.has(f.id) && !["conversation history", "rss feeds", "sync issues"].includes(f.displayName.toLowerCase()))
    .map((f: any) => ({ id: f.id, name: f.displayName, key: "", unread: f.unreadItemCount, total: f.totalItemCount }));

  return NextResponse.json({ wellKnown, custom });
}
