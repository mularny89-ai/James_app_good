import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// next start doesn't serve public/ files added after build — stream generated PDFs
// from disk ourselves. Restricted to the uploads/forms directory.
export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } }
) {
  const segments = params.path.map((s) => decodeURIComponent(s));
  if (segments.some((s) => s.includes("..") || s.includes("/") || s.includes("\\"))) {
    return new NextResponse("Invalid path", { status: 400 });
  }
  const base = path.join(process.cwd(), "public", "uploads", "forms");
  const file = path.join(base, ...segments);
  if (!file.startsWith(base) || !fs.existsSync(file)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const bytes = fs.readFileSync(file);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(segments[segments.length - 1])}`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
