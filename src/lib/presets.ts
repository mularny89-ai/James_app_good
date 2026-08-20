import { db } from "@/lib/db";
import type { PresetOpt } from "@/components/LineItemsEditor";

/** Active invoice presets formatted for the line-item dropdown. */
export async function presetOpts(): Promise<PresetOpt[]> {
  const ps = await db.invoicePreset.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }] });
  return ps.map((p) => ({
    value: String(p.id),
    label: p.name,
    hint: `$${p.unitPrice.toFixed(2)}${p.gstApplicable ? "" : " (no GST)"}`,
    description: p.description || p.name,
    qty: p.defaultQty,
    unitPrice: p.unitPrice,
  }));
}
