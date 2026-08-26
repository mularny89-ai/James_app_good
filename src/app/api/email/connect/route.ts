import { NextResponse } from "next/server";
import { getAuthUrl, msalConfigured, msalRedirectUri, requestBase } from "@/lib/msal";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const base = requestBase(req);
  if (!(await msalConfigured())) {
    const params = new URLSearchParams({
      error: "msal_not_configured",
      redirect_uri: msalRedirectUri(base),
    });
    return NextResponse.redirect(`${base}/email?${params}`);
  }
  return NextResponse.redirect(await getAuthUrl(base));
}
