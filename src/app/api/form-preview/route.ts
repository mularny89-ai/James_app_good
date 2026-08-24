import { NextResponse } from "next/server";
import { fillFormTemplate } from "@/lib/form-pdf";
import { FormType } from "@/lib/forms";

/** POST {formType, data} → renders the current editor values into the official template without saving. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const formType = body.formType as FormType;
    const data = (body.data ?? {}) as Record<string, string>;
    if (formType !== "form15" && formType !== "form12") return new NextResponse("bad type", { status: 400 });
    const bytes = await fillFormTemplate(formType, data);
    return new NextResponse(bytes, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline" },
    });
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 500 });
  }
}
