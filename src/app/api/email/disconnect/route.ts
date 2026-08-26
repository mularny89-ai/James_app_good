import { NextResponse } from "next/server";
import { disconnectMsal } from "@/lib/msal";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await disconnectMsal();
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || url.host;
  return NextResponse.redirect(`${proto}://${host}/email`, 303);
}
