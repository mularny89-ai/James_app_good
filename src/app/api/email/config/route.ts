import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/email/config { secret, appUrl } — save the Azure app credentials
// to the database (avoids needing server env vars).
export async function POST(req: Request) {
  const form = await req.formData();
  const secret = form.get("secret");
  const aiKey = form.get("aiKey");
  const data: Record<string, string> = {};
  if (typeof secret === "string" && secret.trim()) data.msalClientSecret = secret.trim();
  if (typeof aiKey === "string" && aiKey.trim()) data.aiApiKey = aiKey.trim();
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }
  await db.companySettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || url.host;
  return NextResponse.redirect(`${proto}://${host}/email?saved=1`, 303);
}
