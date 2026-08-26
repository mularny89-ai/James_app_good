import { NextResponse } from "next/server";
import { getAuthUrl, msalConfigured, msalRedirectUri } from "@/lib/msal";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!msalConfigured()) {
    const params = new URLSearchParams({
      error: "msal_not_configured",
      redirect_uri: msalRedirectUri(),
    });
    return NextResponse.redirect(`${process.env.APP_BASE_URL || "http://localhost:12000"}/email?${params}`);
  }
  return NextResponse.redirect(await getAuthUrl());
}
