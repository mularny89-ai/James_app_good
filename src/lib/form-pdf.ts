import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, PDFFont } from "pdf-lib";
import {
  FormType,
  PDF_FIELD_MAP,
  TEMPLATE_FILE,
  DATE_KEYS,
  pdfDate,
} from "@/lib/forms";

/**
 * Shared fill routine for generate + preview. Embeds one Helvetica font and
 * rebuilds appearance streams of every touched field so values don't smear.
 * Returns a saved Uint8Array. Signature PNG is embedded into Signature fields.
 */
export async function fillFormTemplate(
  formType: FormType,
  data: Record<string, string>
): Promise<Uint8Array> {
  const tplPath = path.join(process.cwd(), "public", "uploads", "form-templates", TEMPLATE_FILE[formType]);
  const pdf = await PDFDocument.load(fs.readFileSync(tplPath));
  const helvet = await pdf.embedFont(StandardFonts.Helvetica);
  const form = pdf.getForm();
  const touched: Array<{ updateAppearances: (font: PDFFont) => void }> = [];

  for (const [key, fieldName] of Object.entries(PDF_FIELD_MAP[formType])) {
    const raw = data[key] ?? "";
    const value = DATE_KEYS.includes(key) ? pdfDate(raw) : raw;
    try {
      try {
        const tf = form.getTextField(fieldName);
        tf.setText(value);
        touched.push(tf);
      } catch {
        if (value) {
          const dd = form.getDropdown(fieldName);
          if (dd.getOptions().includes(value)) {
            dd.select(value);
            touched.push(dd);
          }
        }
      }
    } catch {
      // Field missing in template — skip rather than fail the PDF.
    }
  }

  for (const f of touched) {
    try {
      f.updateAppearances(helvet);
    } catch {
      // some dropdowns disallow it; default appearance is fine.
    }
  }

  // Embed a drawn signature into the PDF's signature fields, if provided.
  const sigPng = data.signature ?? "";
  if (sigPng.startsWith("data:image/png;base64,")) {
    try {
      const sgName = formType === "form15" ? "Signature1" : "Signature Field 1";
      const sg = form.getSignature(sgName);
      const widgets = sg.acroField.getWidgets();
      const png = await pdf.embedPng(sigPng);
      for (const w of widgets) {
        const rect = w.getRectangle();
        const page = pdf.getPages()[0];
        page.drawImage(png, {
          x: rect.x + 2,
          y: rect.y + 2,
          width: Math.min(rect.width - 4, rect.width - 4),
          height: Math.min((rect.width - 4) * (png.height / png.width), rect.height - 4),
        });
      }
    } catch {
      // signature embed failed — still produce the rest of the form.
    }
  }

  form.flatten();
  return pdf.save();
}
