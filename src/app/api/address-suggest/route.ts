import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for address autocomplete (OpenStreetMap Nominatim, AU).
 * Browsers can block third-party fetches from HTTPS pages; proxying through
 * the app keeps predictions reliable everywhere.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3) return NextResponse.json([]);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=au&limit=6&q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": "MellanPracticeManager/1.0 (mellanconsulting.com.au)", Accept: "application/json" }, cache: "no-store" }
    );
    if (!res.ok) return NextResponse.json([]);
    const rows = await res.json();
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]);
  }
}
