import { NextResponse } from "next/server";
import { getAuthUrl, msalConfigured, msalRedirectUri } from "@/lib/msal";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || url.host;
  const base = `${proto}://${host}`;
  if (!msalConfigured()) {
    const params = new URLSearchParams({
      error: "msal_not_configured",
      redirect_uri: msalRedirectUri(),
    });
    return NextResponse.redirect(`${base}/email?${params}`);
  }
  return NextResponse.redirect(await getAuthUrl());
}
