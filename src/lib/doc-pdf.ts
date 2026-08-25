import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { CompanySettings } from "@prisma/client";
import { fmtDate } from "@/lib/format";
import type { PrintOpts } from "@/lib/print-opts";

export type DocItem = { name?: string; description: string; qty: number; unitPrice: number; amount: number };

export type DocPayload = {
  docType: string;
  docNumber: string;
  date: Date | string | null;
  dueOrValid?: { label: string; value: Date | string | null } | null;
  clientName: string;
  clientCompany?: string;
  billingAddress?: string;
  siteAddress?: string;
  jobNumber?: string;
  description?: string;
  scope?: string;
  exclusions?: string;
  notes?: string;
  paymentAdvice?: string;
  items: DocItem[];
  subtotal: number;
  gst: number;
  total: number;
  gstRate: number;
};

const A4: [number, number] = [595.28, 841.89];
const M = 48; // margin
const BRAND = rgb(0.204, 0.212, 0.545); // #34368B
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.87, 0.9);

function money(n: number) {
  return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return BRAND;
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
}

/** Renders the branded quote/invoice as a real A4 PDF (Preview Quote/Invoice button). */
export async function generateDocumentPdf(settings: CompanySettings, doc: DocPayload, opts: PrintOpts): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const brand = hexToRgb(settings.primaryColor || "#34368B");

  let page = pdf.addPage(A4);
  const [W, H] = A4;
  const cw = W - M * 2;
  let y = H - M;

  const addPage = () => { page = pdf.addPage(A4); y = H - M; };
  const ensure = (need: number) => { if (y - need < M) addPage(); };

  const text = (s: string, x: number, yy: number, size = 9, f = font, color = rgb(0.13, 0.13, 0.13)) => {
    page.drawText(s, { x, y: yy, size, font: f, color });
  };
  const wrap = (s: string, size: number, f = font, width = cw): string[] => {
    const out: string[] = [];
    for (const para of s.split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const t = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = word; } else line = t;
      }
      out.push(line);
    }
    return out;
  };
  const para = (s: string, size = 9, f = font, width = cw, color = rgb(0.13, 0.13, 0.13), lead = 1.35) => {
    for (const ln of wrap(s, size, f, width)) {
      ensure(size * lead + 2);
      y -= size * lead;
      text(ln, M, y, size, f, color);
    }
  };
  const label = (s: string) => {
    ensure(24);
    y -= 14;
    text(s.toUpperCase(), M, y, 7.5, bold, MUTED);
    y -= 4;
  };

  // ---- Header ----
  const contactBits = [settings.phone, settings.email, settings.website].filter(Boolean).join(" · ");
  let logoH = 0;
  if (settings.logoPath) {
    try {
      const { readFile } = await import("fs/promises");
      const sharp = (await import("sharp")).default;
      const png = await sharp(await readFile(process.cwd() + "/public" + settings.logoPath)).png().toBuffer();
      const img = await pdf.embedPng(png);
      const scale = 52 / img.height;
      page.drawImage(img, { x: M, y: y - 52, width: img.width * scale, height: 52 });
      logoH = 52;
    } catch { /* logo optional */ }
  }
  if (!logoH) text(settings.companyName, M, y - 16, 15, bold, brand);

  // Company meta under logo
  let metaY = y - logoH - 6;
  for (const ln of [settings.abn && `ABN: ${settings.abn}`, settings.address, contactBits].filter(Boolean) as string[]) {
    metaY -= 11;
    text(ln, M, metaY, 8, font, MUTED);
  }

  // Doc identity, right aligned
  const rt = (s: string, yy: number, size: number, f = bold, color = brand) =>
    text(s, W - M - f.widthOfTextAtSize(s, size), yy, size, f, color);
  rt(doc.docType.toUpperCase(), y - 14, 19);
  rt(doc.docNumber, y - 32, 11, bold, rgb(0.13, 0.13, 0.13));
  rt(`Date: ${fmtDate(doc.date)}`, y - 46, 8.5, font, MUTED);
  if (doc.dueOrValid) rt(`${doc.dueOrValid.label}: ${fmtDate(doc.dueOrValid.value)}`, y - 58, 8.5, font, MUTED);

  y -= logoH + 34;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 2.5, color: brand });
  y -= 6;

  // ---- Parties ----
  label("To");
  para(doc.clientName, 10, bold);
  if (doc.clientCompany) para(doc.clientCompany, 9, font, cw, MUTED);
  if (doc.billingAddress) para(doc.billingAddress, 8.5, font, cw, MUTED);

  const rightCol = [
    opts.siteAddress && doc.siteAddress ? ["Site Address", doc.siteAddress] : null,
    opts.jobNumber && doc.jobNumber ? ["Job No.", doc.jobNumber] : null,
    opts.description && doc.description ? ["Description", doc.description] : null,
  ].filter(Boolean) as [string, string][];
  for (const [k, v] of rightCol) { label(k); para(v, 9.5, bold); }

  // ---- Body sections ----
  if (opts.scope && doc.scope) { label("Scope of Works"); para(doc.scope); }
  if (opts.exclusions && doc.exclusions) { label("Exclusions"); para(doc.exclusions, 9, font, cw, MUTED); }

  // ---- Tasks ----
  label("Tasks");
  for (const it of doc.items) {
    const showName = opts.itemNames ? (it.name || it.description) : "";
    const showDesc = opts.itemDescriptions ? it.description : "";
    const parts = [
      opts.itemQty ? `Qty ${it.qty}` : null,
      opts.itemRate ? `Rate ${money(it.unitPrice)}` : null,
      opts.itemAmount ? `Amount ${money(it.amount)}` : null,
    ].filter(Boolean) as string[];

    const nameLines = showName ? wrap(showName, 9.5, bold, cw - 190) : [];
    const descLines = showDesc && (!opts.itemNames || it.name) ? wrap(showDesc, 8, font, cw - 190) : [];
    ensure(nameLines.length * 13 + descLines.length * 11 + 16);

    const topY = y - 12;
    let ly = topY;
    for (const ln of nameLines) { text(ln, M, ly, 9.5, bold); ly -= 13; }
    for (const ln of descLines) { text(ln, M, ly, 8, font, MUTED); ly -= 11; }
    // Right-side amounts, aligned to the first line of the item
    let rx = W - M;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      const isAmount = p.startsWith("Amount");
      const f = isAmount ? bold : font;
      rx -= f.widthOfTextAtSize(p, 8.5);
      text(p, rx, topY, 8.5, f, isAmount ? rgb(0.13, 0.13, 0.13) : MUTED);
      rx -= font.widthOfTextAtSize("  |  ", 8.5);
      if (i > 0) text("|", rx + font.widthOfTextAtSize("  ", 8.5), topY, 8.5, font, MUTED);
    }
    y = ly - 5;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: LINE });
    y -= 6;
  }

  // ---- Totals ----
  ensure(70);
  const totals: [string, string, boolean][] = [
    ["Subtotal (ex GST)", money(doc.subtotal), false],
    [`GST (${doc.gstRate}%)`, money(doc.gst), false],
    ["Total (inc GST)", money(doc.total), true],
  ];
  y -= 6;
  for (const [k, v, big] of totals) {
    y -= big ? 20 : 15;
    const f = big ? bold : font;
    const size = big ? 11 : 9;
    text(k, W - M - 230, y, size, f, big ? brand : MUTED);
    text(v, W - M - f.widthOfTextAtSize(v, size), y, size, f, big ? brand : rgb(0.13, 0.13, 0.13));
  }

  if (opts.notes && doc.notes) { y -= 8; label("Notes"); para(doc.notes); }
  if (opts.paymentAdvice && doc.paymentAdvice) {
    y -= 8;
    label("Payment Advice");
    para(doc.paymentAdvice, 8.5, font, cw, MUTED);
  }

  // ---- Footer ----
  const footer = `${settings.companyName}${settings.abn ? ` · ABN ${settings.abn}` : ""} · ${settings.website}`;
  text(footer, (W - font.widthOfTextAtSize(footer, 7.5)) / 2, 30, 7.5, font, MUTED);

  return pdf.save();
}
