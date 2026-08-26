import { NextResponse } from "next/server";
import { handleAuthCallback } from "@/lib/msal";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;
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
