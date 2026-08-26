import { NextResponse } from "next/server";
import { handleAuthCallback } from "@/lib/msal";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || url.host;
  const base = `${proto}://${host}`;
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${base}/email?error=${encodeURIComponent(error || "No auth code returned.")}`);
  }
  try {
    const account = await handleAuthCallback(code);
    return NextResponse.redirect(`${base}/email?connected=${encodeURIComponent(account)}`);
  } catch (e: any) {
    return NextResponse.redirect(`${base}/email?error=${encodeURIComponent(e.message || "Connection failed.")}`);
  }
}
