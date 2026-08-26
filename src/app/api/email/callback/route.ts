import { NextResponse } from "next/server";
import { handleAuthCallback, requestBase } from "@/lib/msal";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = requestBase(req);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${base}/email?error=${encodeURIComponent(error || "No auth code returned.")}`);
  }
  try {
    const account = await handleAuthCallback(code, base);
    return NextResponse.redirect(`${base}/email?connected=${encodeURIComponent(account)}`);
  } catch (e: any) {
    return NextResponse.redirect(`${base}/email?error=${encodeURIComponent(e.message || "Connection failed.")}`);
  }
}
