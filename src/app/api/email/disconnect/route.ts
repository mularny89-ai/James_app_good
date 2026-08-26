import { NextResponse } from "next/server";
import { disconnectMsal } from "@/lib/msal";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await disconnectMsal();
  const url = new URL(req.url);
  return NextResponse.redirect(`${url.protocol}//${url.host}/email`, 303);
}
