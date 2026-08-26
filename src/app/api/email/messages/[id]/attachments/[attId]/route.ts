import { graphRequest } from "@/lib/msal";

export const dynamic = "force-dynamic";

// GET .../attachments/[attId] — stream the file content back
export async function GET(_req: Request, { params }: { params: { id: string; attId: string } }) {
  let res: Response;
  try {
    res = await graphRequest(
      `/me/messages/${encodeURIComponent(params.id)}/attachments/${encodeURIComponent(params.attId)}`,
    );
  } catch (e: any) {
    if (e.message === "NOT_CONNECTED") return new Response("Not connected", { status: 401 });
    throw e;
  }
  if (!res.ok) return new Response("Attachment fetch failed", { status: res.status });
  const a = await res.json();
  const bytes = Buffer.from(a.contentBytes ?? "", "base64");
  return new Response(bytes, {
    headers: {
      "Content-Type": a.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${(a.name || "attachment").replace(/"/g, "")}"`,
    },
  });
}
